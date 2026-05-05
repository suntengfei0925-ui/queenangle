const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");
const signatureUtils = require("../../utils/signature");
const { paymentMethods } = require("../../utils/payment");

function emptyCalc() {
  return {
    balanceYuan: "0.00",
    discountText: "无折扣",
    originalYuan: "0.00",
    payableYuan: "0.00",
    balancePayYuan: "0.00",
    extraPayYuan: "0.00",
    balanceAfterYuan: "0.00",
    extraPayCent: 0
  };
}

function isAmountFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeCatalog(catalog) {
  return (catalog || []).filter((category) => (category.services || []).length > 0);
}

function selectedItem(service, category) {
  return {
    key: `${service._id}-${Date.now()}-${Math.random()}`,
    categoryId: category._id,
    categoryName: category.name,
    serviceId: service._id,
    serviceName: service.name,
    displayName: `${category.name}-${service.name}`,
    originalAmountYuan: ""
  };
}

function normalizeMember(member) {
  const cardBalances = Array.isArray(member.cardBalances) ? member.cardBalances : [];
  return {
    ...member,
    balanceYuan: fmt.centToYuan(member.balanceCent),
    discountText: fmt.formatDiscount(member.currentDiscount),
    cardTotal: cardBalances.reduce((sum, card) => sum + Number(card.remainingTimes || 0), 0)
  };
}

function cardBalancesToOptions(cardBalances) {
  return (Array.isArray(cardBalances) ? cardBalances : [])
    .filter((card) => Number(card.remainingTimes || 0) > 0)
    .map((card) => ({
      ...card,
      selected: false
    }));
}

function calculateCheckout(member, originalCent) {
  const balanceCent = Number((member && member.balanceCent) || 0);
  const hasBalance = balanceCent > 0;
  const discount = originalCent > 0 && hasBalance ? Number(member.currentDiscount || 0) : 0;
  const payableCent = hasBalance && discount
    ? Math.round(originalCent * discount / 10)
    : originalCent;
  const balancePayCent = Math.min(balanceCent, payableCent);
  const extraPayCent = payableCent - balancePayCent;

  return {
    balanceCent,
    discount: discount || null,
    payableCent,
    balancePayCent,
    extraPayCent,
    balanceAfterCent: balanceCent - balancePayCent
  };
}

function buildCheckoutPaymentMethod(originalCent, balancePayCent, extraPayCent, selectedPayment) {
  if (originalCent <= 0) return "";
  if (balancePayCent > 0 && extraPayCent > 0) return "mixed";
  if (balancePayCent > 0) return "member_balance";
  return selectedPayment || "";
}

function formatServiceConfirmItem(item) {
  return {
    ...item,
    displayName: fmt.formatServiceItemName(item),
    originalYuan: fmt.centToYuan(item.originalAmountCent)
  };
}

function buildConfirmationView(snapshot) {
  const serviceItems = (snapshot.serviceItems || []).map((item, index) => ({
    ...formatServiceConfirmItem(item),
    key: `${item.serviceId || "service"}-${index}`
  }));
  const cardItems = (snapshot.cardItems || []).map((item, index) => ({
    ...item,
    key: `${item.cardTypeId || "card"}-${index}`,
    remainingTimesBefore: Number(item.remainingTimesBefore || 0),
    remainingTimesAfter: Number(item.remainingTimesAfter || 0)
  }));

  return {
    hasServiceItems: serviceItems.length > 0,
    serviceItems,
    cardItems,
    balanceBeforeYuan: fmt.centToYuan(snapshot.balanceBeforeCent),
    balancePayYuan: fmt.centToYuan(snapshot.balancePayCent),
    balanceAfterYuan: fmt.centToYuan(snapshot.balanceAfterCent),
    originalYuan: fmt.centToYuan(snapshot.originalAmountCent),
    discountText: snapshot.discountLabelApplied || "无折扣",
    payableYuan: fmt.centToYuan(snapshot.consumptionAmountCent),
    extraPayYuan: fmt.centToYuan(snapshot.extraPayCent),
    extraPaymentText: fmt.formatPayment(snapshot.extraPaymentMethod),
    hasRemark: !!snapshot.remark,
    remark: snapshot.remark
  };
}

guardedPage({
  data: {
    memberId: "",
    categories: [],
    activeCategoryId: "",
    activeServices: [],
    availableCards: [],
    selectedCards: [],
    selectedItems: [],
    selectedMember: {},
    selectedPayment: {},
    paymentMethods,
    saving: false,
    form: {
      remark: ""
    },
    calc: emptyCalc(),
    checkoutConfirm: {
      visible: false,
      snapshot: null,
      snapshotHash: "",
      view: {}
    },
    signature: {
      tempFilePath: "",
      fileId: "",
      signedAt: "",
      snapshot: null,
      snapshotHash: "",
      valid: false
    }
  },

  onLoad(query) {
    const memberId = query.memberId || query.id || "";
    this.setData({ memberId });
    if (!memberId) {
      api.showError(new Error("请先选择会员"));
      wx.redirectTo({ url: "/pages/members/index" });
      return;
    }
    Promise.all([
      api.callBusiness("getMemberDetail", { memberId }),
      api.callBusiness("listServiceCatalog", { onlyEnabled: true })
    ])
      .then(([detail, catalog]) => {
        const member = normalizeMember((detail && detail.member) || {});
        const categories = normalizeCatalog(catalog);
        const first = categories[0] || {};
        this.setData({
          selectedMember: member,
          availableCards: cardBalancesToOptions(member.cardBalances),
          selectedCards: [],
          categories,
          activeCategoryId: first._id || "",
          activeServices: first.services || []
        });
        this.refreshCalc();
      })
      .catch(api.showError);
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === categoryId) || {};
    this.setData({
      activeCategoryId: categoryId,
      activeServices: category.services || []
    });
  },

  addService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === this.data.activeCategoryId);
    if (!category) return;
    const service = (category.services || []).find((item) => item._id === serviceId);
    if (!service) return;
    this.setData({
      selectedItems: [...this.data.selectedItems, selectedItem(service, category)]
    });
    this.refreshCalc();
  },

  toggleCard(e) {
    const cardTypeId = e.currentTarget.dataset.id;
    const availableCards = this.data.availableCards.map((card) => (
      card.cardTypeId === cardTypeId
        ? { ...card, selected: !card.selected }
        : card
    ));
    this.setData({
      availableCards,
      selectedCards: availableCards.filter((card) => card.selected)
    });
    this.refreshSignatureValidity();
  },

  removeItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    const selectedItems = this.data.selectedItems.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ selectedItems });
    this.refreshCalc();
  },

  onItemAmountInput(e) {
    this.setData({
      [`selectedItems[${e.currentTarget.dataset.index}].originalAmountYuan`]: e.detail.value
    });
    this.refreshCalc();
  },

  onPaymentChange(e) {
    this.setData({ selectedPayment: this.data.paymentMethods[Number(e.currentTarget.dataset.index)] });
    this.refreshSignatureValidity();
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
    this.refreshSignatureValidity();
  },

  getOriginalCent() {
    return this.data.selectedItems.reduce((sum, item) => {
      if (!isAmountFilled(item.originalAmountYuan)) return sum;
      return sum + fmt.yuanInputToCent(item.originalAmountYuan);
    }, 0);
  },

  refreshCalc() {
    const member = this.data.selectedMember || {};
    const originalCent = this.getOriginalCent();
    const calc = calculateCheckout(member, originalCent);

    this.setData({
      calc: {
        balanceYuan: fmt.centToYuan(calc.balanceCent),
        discountText: fmt.formatDiscount(calc.discount),
        originalYuan: fmt.centToYuan(originalCent),
        payableYuan: fmt.centToYuan(calc.payableCent),
        balancePayYuan: fmt.centToYuan(calc.balancePayCent),
        extraPayYuan: fmt.centToYuan(calc.extraPayCent),
        balanceAfterYuan: fmt.centToYuan(calc.balanceAfterCent),
        extraPayCent: calc.extraPayCent
      }
    });
    this.refreshSignatureValidity();
  },

  buildCheckoutSnapshotInfo() {
    const member = this.data.selectedMember || {};
    const originalAmountCent = this.getOriginalCent();
    const calc = calculateCheckout(member, originalAmountCent);
    const extraPaymentMethod = calc.extraPayCent > 0 ? (this.data.selectedPayment.value || "") : "";
    const serviceItems = this.data.selectedItems.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      originalAmountCent: fmt.yuanInputToCent(item.originalAmountYuan)
    }));
    const cardItems = this.data.selectedCards.map((card) => {
      const remainingTimesBefore = Number(card.remainingTimes || 0);
      return {
        cardTypeId: card.cardTypeId,
        cardName: card.cardName,
        useTimes: 1,
        remainingTimesBefore,
        remainingTimesAfter: Math.max(remainingTimesBefore - 1, 0)
      };
    });
    const snapshot = {
      version: 1,
      member: {
        memberId: member._id || "",
        memberName: member.name || "",
        phone: member.phone || ""
      },
      serviceItems,
      cardItems,
      balanceBeforeCent: calc.balanceCent,
      discountApplied: calc.discount,
      discountLabelApplied: originalAmountCent > 0 ? fmt.formatDiscount(calc.discount) : "",
      originalAmountCent,
      consumptionAmountCent: calc.payableCent,
      balancePayCent: calc.balancePayCent,
      extraPayCent: calc.extraPayCent,
      extraPaymentMethod,
      paymentMethod: buildCheckoutPaymentMethod(
        originalAmountCent,
        calc.balancePayCent,
        calc.extraPayCent,
        extraPaymentMethod
      ),
      balanceAfterCent: calc.balanceAfterCent,
      remark: String((this.data.form && this.data.form.remark) || "").trim()
    };

    return {
      snapshot,
      hash: signatureUtils.hashSnapshot(snapshot)
    };
  },

  refreshSignatureValidity() {
    const current = this.data.signature || {};
    if (!current.tempFilePath || !current.snapshotHash) return;
    const nextHash = this.buildCheckoutSnapshotInfo().hash;
    const valid = nextHash === current.snapshotHash;
    if (current.valid !== valid) {
      this.setData({ "signature.valid": valid });
    }
  },

  validateCheckout() {
    if (this.data.selectedItems.length === 0 && this.data.selectedCards.length === 0) {
      api.showError(new Error("请选择次卡或服务项目"));
      return false;
    }
    const hasEmptyAmount = this.data.selectedItems.some((item) => !isAmountFilled(item.originalAmountYuan));
    if (hasEmptyAmount) {
      api.showError(new Error("请填写每个项目的单项原价"));
      return false;
    }
    return true;
  },

  validateReadyForSignature() {
    if (this.data.saving) return;
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.validateCheckout()) return;
    if (this.data.calc.extraPayCent > 0 && !this.data.selectedPayment.value) {
      return api.showError(new Error("请选择补差价支付方式"));
    }
    return true;
  },

  showCheckoutConfirm(snapshotInfo) {
    this.setData({
      checkoutConfirm: {
        visible: true,
        snapshot: snapshotInfo.snapshot,
        snapshotHash: snapshotInfo.hash,
        view: buildConfirmationView(snapshotInfo.snapshot)
      }
    });
  },

  cancelCheckoutConfirm() {
    this.setData({
      "checkoutConfirm.visible": false
    });
  },

  noop() {},

  startSignatureFlow() {
    if (!this.validateReadyForSignature()) return;
    this.showCheckoutConfirm(this.buildCheckoutSnapshotInfo());
  },

  confirmAndSign() {
    const snapshotInfo = {
      snapshot: this.data.checkoutConfirm.snapshot,
      hash: this.data.checkoutConfirm.snapshotHash
    };
    this.setData({ "checkoutConfirm.visible": false });

    wx.navigateTo({
      url: "/pages/member-signature/index",
      events: {
        signatureConfirmed: (payload = {}) => {
          if (!payload.tempFilePath) return;
          this.setData({
            signature: {
              tempFilePath: payload.tempFilePath,
              fileId: "",
              signedAt: payload.signedAt || new Date().toISOString(),
              snapshot: snapshotInfo.snapshot,
              snapshotHash: snapshotInfo.hash,
              valid: true
            }
          });
        }
      },
      fail: () => api.showError(new Error("无法打开签字页"))
    });
  },

  previewSignature() {
    const tempFilePath = this.data.signature.tempFilePath;
    if (!tempFilePath) return;
    wx.previewImage({
      current: tempFilePath,
      urls: [tempFilePath]
    });
  },

  uploadSignature() {
    const current = this.data.signature || {};
    if (current.fileId) return Promise.resolve(current.fileId);
    if (!current.tempFilePath) return Promise.reject(new Error("请先完成客户签字"));

    const memberId = this.data.selectedMember._id || "unknown";
    const cloudPath = `signatures/member-checkout/${memberId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
    return new Promise((resolve, reject) => {
      wx.cloud.uploadFile({
        cloudPath,
        filePath: current.tempFilePath,
        success: (res) => {
          const fileId = res.fileID;
          this.setData({ "signature.fileId": fileId });
          resolve(fileId);
        },
        fail: reject
      });
    });
  },

  submit() {
    if (this.data.saving) return;
    if (!this.validateReadyForSignature()) return;

    const snapshotInfo = this.buildCheckoutSnapshotInfo();
    const currentSignature = this.data.signature || {};
    if (!currentSignature.tempFilePath || !currentSignature.signedAt || !currentSignature.valid || currentSignature.snapshotHash !== snapshotInfo.hash) {
      this.showCheckoutConfirm(snapshotInfo);
      return;
    }

    this.setData({ saving: true });
    this.uploadSignature()
      .then((signatureFileId) => api.callBusiness("createMemberCheckout", {
        memberId: this.data.selectedMember._id,
        cardItems: this.data.selectedCards.map((card) => ({
          cardTypeId: card.cardTypeId
        })),
        serviceItems: this.data.selectedItems.map((item) => ({
          serviceId: item.serviceId,
          originalAmountCent: fmt.yuanInputToCent(item.originalAmountYuan)
        })),
        paymentMethod: this.data.selectedPayment.value,
        extraPaymentMethod: this.data.selectedPayment.value,
        remark: this.data.form.remark,
        signatureFileId,
        signatureSignedAt: currentSignature.signedAt,
        signatureSnapshot: snapshotInfo.snapshot,
        signatureSnapshotHash: snapshotInfo.hash
      }))
      .then(() => {
        wx.showToast({ title: "已记录" });
        this.returnToMemberDetail();
      })
      .catch((err) => {
        if (err && (err.code === "SIGNATURE_MISMATCH" || err.code === "SIGNATURE_REQUIRED")) {
          this.setData({
            "signature.valid": false,
            "signature.fileId": ""
          });
        }
        this.setData({ saving: false });
        api.showError(err);
      });
  },

  returnToMemberDetail() {
    const pages = getCurrentPages();
    const previous = pages[pages.length - 2];
    if (previous && previous.route === "pages/member-detail/index") {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({
      url: `/pages/member-detail/index?id=${this.data.memberId}`
    });
  }
});
