const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const basicConfig = require("../../utils/basic-config");
const fmt = require("../../utils/format");
const signatureUtils = require("../../utils/signature");
const { paymentMethods } = require("../../utils/payment");
const servicePerson = require("../../utils/service-person");

const SHORTAGE_EXTRA_PAY_RULE = "balance_discount_cover_original_v1";

function emptyCalc() {
  return {
    balanceYuan: "0.00",
    discountText: "无折扣",
    originalYuan: "0.00",
    payableYuan: "0.00",
    balancePayYuan: "0.00",
    balanceCoveredOriginalYuan: "0.00",
    remainingOriginalYuan: "0.00",
    extraPayYuan: "0.00",
    settlementAmountYuan: "0.00",
    settlementFormulaText: "",
    balanceAfterYuan: "0.00",
    shortageExplanation: "",
    extraPayCent: 0,
    hasShortageExtraPay: false
  };
}

function isAmountFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeCatalog(catalog) {
  return (catalog || []).filter((category) => (category.services || []).length > 0);
}

function selectedServiceIdMap(selectedItems) {
  const map = {};
  (selectedItems || []).forEach((item) => {
    if (item.serviceId) map[item.serviceId] = true;
  });
  return map;
}

function markSelectedServices(services, selectedItems) {
  const selectedMap = selectedServiceIdMap(selectedItems);
  return (services || []).map((service) => ({
    ...service,
    selected: !!selectedMap[service._id]
  }));
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

function normalizeCent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

function normalizeDiscountForCalc(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0 || num >= 10) return null;
  return Math.round(num * 100) / 100;
}

function roundCentToJiao(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num / 10) * 10;
}

function baseCheckoutResult(balanceCent, discount, originalCent, memberPriceCent) {
  return {
    balanceCent,
    discount,
    originalAmountCent: originalCent,
    payableCent: memberPriceCent,
    balancePayCent: 0,
    extraPayCent: 0,
    balanceCoveredOriginalCent: 0,
    remainingOriginalCent: originalCent,
    settlementAmountCent: 0,
    balanceAfterCent: balanceCent,
    shortageExtraPayRule: "",
    hasShortageExtraPay: false
  };
}

function calculateCheckout(member, originalCent) {
  const balanceCent = normalizeCent(member && member.balanceCent);
  const amountCent = normalizeCent(originalCent);
  const discount = amountCent > 0 && balanceCent > 0
    ? normalizeDiscountForCalc(member && member.currentDiscount)
    : null;
  const discountRate = discount ? discount / 10 : 1;
  const memberPriceCent = discount ? Math.round(amountCent * discountRate) : amountCent;

  if (amountCent <= 0) {
    return baseCheckoutResult(balanceCent, discount, 0, 0);
  }

  if (balanceCent <= 0) {
    return {
      ...baseCheckoutResult(0, null, amountCent, amountCent),
      extraPayCent: amountCent,
      settlementAmountCent: amountCent,
      balanceAfterCent: 0
    };
  }

  if (balanceCent >= memberPriceCent) {
    return {
      ...baseCheckoutResult(balanceCent, discount, amountCent, memberPriceCent),
      balancePayCent: memberPriceCent,
      balanceCoveredOriginalCent: amountCent,
      remainingOriginalCent: 0,
      settlementAmountCent: memberPriceCent,
      balanceAfterCent: balanceCent - memberPriceCent
    };
  }

  const balancePayCent = balanceCent;
  const balanceCoveredOriginalCent = Math.min(amountCent, roundCentToJiao(balanceCent / discountRate));
  const rawRemainingOriginalCent = Math.max(0, amountCent - balanceCoveredOriginalCent);
  const extraPayCent = Math.max(0, roundCentToJiao(rawRemainingOriginalCent));
  const remainingOriginalCent = extraPayCent;
  const hasShortageExtraPay = extraPayCent > 0;

  return {
    balanceCent,
    discount,
    originalAmountCent: amountCent,
    payableCent: memberPriceCent,
    balancePayCent,
    extraPayCent,
    balanceCoveredOriginalCent,
    remainingOriginalCent,
    settlementAmountCent: balancePayCent + extraPayCent,
    balanceAfterCent: balanceCent - balancePayCent,
    shortageExtraPayRule: hasShortageExtraPay ? SHORTAGE_EXTRA_PAY_RULE : "",
    hasShortageExtraPay
  };
}

function buildShortageExplanation(calc) {
  if (!calc || !calc.hasShortageExtraPay) return "";
  const balanceText = fmt.centToYuan(calc.balancePayCent);
  const coveredText = fmt.centToYuan(calc.balanceCoveredOriginalCent);
  const remainingText = fmt.centToYuan(calc.remainingOriginalCent);
  if (calc.discount) {
    return `当前余额 ¥${balanceText} 按 ${fmt.formatDiscount(calc.discount)} 可抵扣原价 ¥${coveredText}，剩余原价 ¥${remainingText} 需补差。`;
  }
  return `当前余额 ¥${balanceText} 可抵扣原价 ¥${coveredText}，剩余原价 ¥${remainingText} 需补差。`;
}

function buildSettlementFormula(calc) {
  if (!calc || calc.extraPayCent <= 0) return "";
  return `${fmt.centToYuan(calc.balancePayCent)} + ${fmt.centToYuan(calc.extraPayCent)} = ${fmt.centToYuan(calc.settlementAmountCent)}`;
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

  const hasShortageExtraPay = !!snapshot.shortageExtraPayRule && Number(snapshot.extraPayCent || 0) > 0;
  const balanceCoveredOriginalCent = Number(snapshot.balanceCoveredOriginalCent || 0);
  const remainingOriginalCent = hasShortageExtraPay
    ? Number(snapshot.extraPayCent || 0)
    : Math.max(0, Number(snapshot.originalAmountCent || 0) - balanceCoveredOriginalCent);
  const settlementAmountCent = snapshot.settlementAmountCent === undefined
    ? Number(snapshot.balancePayCent || 0) + Number(snapshot.extraPayCent || 0)
    : Number(snapshot.settlementAmountCent || 0);
  const shortageExplanation = buildShortageExplanation({
    hasShortageExtraPay,
    balancePayCent: Number(snapshot.balancePayCent || 0),
    balanceCoveredOriginalCent,
    remainingOriginalCent,
    discount: snapshot.discountApplied || null
  });

  return {
    hasServiceItems: serviceItems.length > 0,
    serviceItems,
    cardItems,
    balanceBeforeYuan: fmt.centToYuan(snapshot.balanceBeforeCent),
    balancePayYuan: fmt.centToYuan(snapshot.balancePayCent),
    balanceCoveredOriginalYuan: fmt.centToYuan(balanceCoveredOriginalCent),
    balanceAfterYuan: fmt.centToYuan(snapshot.balanceAfterCent),
    servicePersonName: snapshot.servicePersonName || "-",
    originalYuan: fmt.centToYuan(snapshot.originalAmountCent),
    discountText: snapshot.discountLabelApplied || "无折扣",
    payableYuan: fmt.centToYuan(snapshot.consumptionAmountCent),
    extraPayYuan: fmt.centToYuan(snapshot.extraPayCent),
    settlementAmountYuan: fmt.centToYuan(settlementAmountCent),
    settlementFormulaText: buildSettlementFormula({
      balancePayCent: Number(snapshot.balancePayCent || 0),
      extraPayCent: Number(snapshot.extraPayCent || 0),
      settlementAmountCent
    }),
    hasShortageExtraPay,
    shortageExplanation,
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
    selectedServicePerson: {},
    servicePeople: [],
    servicePeopleLoadError: "",
    servicePeopleRefreshing: false,
    memberLoading: false,
    servicePersonPickerVisible: false,
    paymentMethods,
    continueExtraCheckout: false,
    configError: "",
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
    this.loadCatalog();
    this.initServicePerson();
    this.loadMemberDetail(memberId);
  },

  initServicePerson() {
    const current = servicePerson.getCurrentServicePerson();
    const cachedPeople = servicePerson.readServicePeopleCache();
    const cachedSelected = current.openid
      ? cachedPeople.find((person) => person.openid === current.openid)
      : null;
    this.setData({
      selectedServicePerson: cachedSelected || (current.openid && current.name ? current : {}),
      servicePeople: cachedPeople,
      servicePeopleLoadError: "",
      servicePeopleRefreshing: true
    });

    servicePerson.refreshServicePeople()
      .then((people) => {
        const selected = this.data.selectedServicePerson || {};
        const refreshedSelected = selected.openid
          ? (people.find((person) => person.openid === selected.openid) || selected)
          : {};
        this.setData({
          selectedServicePerson: refreshedSelected,
          servicePeople: people,
          servicePeopleLoadError: "",
          servicePeopleRefreshing: false
        }, () => this.refreshSignatureValidity());
      })
      .catch(() => {
        this.setData({
          servicePeopleLoadError: "服务人名单加载失败",
          servicePeopleRefreshing: false
        });
      });
  },

  loadMemberDetail(memberId) {
    this.setData({ memberLoading: true });
    api.callBusiness("getMemberDetail", { memberId })
      .then((detail) => {
        const member = normalizeMember((detail && detail.member) || {});
        this.setData({
          selectedMember: member,
          availableCards: cardBalancesToOptions(member.cardBalances),
          selectedCards: [],
          memberLoading: false
        });
        this.refreshCalc();
      })
      .catch((err) => {
        this.setData({ memberLoading: false });
        api.showError(err);
      });
  },

  loadCatalog() {
    const cache = basicConfig.readBasicConfigCache();
    if (cache) {
      this.applyCatalog(cache.serviceCatalog);
    }

    basicConfig.refreshBasicConfig({ silent: !!cache })
      .then((config) => {
        if (config) this.applyCatalog(config.serviceCatalog);
      })
      .catch((err) => {
        this.setData({ configError: "配置加载失败，请重试" });
        api.showError(err);
      });
  },

  applyCatalog(catalog) {
    const categories = normalizeCatalog(catalog);
    const current = categories.find((item) => item._id === this.data.activeCategoryId);
    const first = current || categories[0] || {};
    this.setData({
      configError: "",
      categories,
      activeCategoryId: first._id || "",
      activeServices: markSelectedServices(first.services || [], this.data.selectedItems)
    });
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === categoryId) || {};
    this.setData({
      activeCategoryId: categoryId,
      activeServices: markSelectedServices(category.services || [], this.data.selectedItems)
    });
  },

  addService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === this.data.activeCategoryId);
    if (!category) return;
    const service = (category.services || []).find((item) => item._id === serviceId);
    if (!service) return;
    const selectedItems = this.data.selectedItems || [];
    const selectedIndex = selectedItems.findIndex((item) => item.serviceId === serviceId);
    const nextSelectedItems = selectedIndex >= 0
      ? selectedItems.filter((_, index) => index !== selectedIndex)
      : [...selectedItems, selectedItem(service, category)];
    this.setData({
      selectedItems: nextSelectedItems,
      activeServices: markSelectedServices(category.services || [], nextSelectedItems)
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
    const category = this.data.categories.find((item) => item._id === this.data.activeCategoryId) || {};
    this.setData({
      selectedItems,
      activeServices: markSelectedServices(category.services || [], selectedItems)
    });
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

  openServicePersonPicker() {
    const current = this.data.selectedServicePerson || {};
    if (!current.openid || !current.name) {
      api.showError(new Error("服务人信息加载失败，请重试"));
      return;
    }
    if (this.data.servicePeopleLoadError && this.data.servicePeople.length <= 1) {
      api.showError(new Error(this.data.servicePeopleLoadError));
      return;
    }
    if (this.data.servicePeople.length === 0) {
      api.showError(new Error("服务人名单加载中，请稍后"));
      return;
    }
    this.setData({ servicePersonPickerVisible: true });
  },

  closeServicePersonPicker() {
    this.setData({ servicePersonPickerVisible: false });
  },

  selectServicePerson(e) {
    const openid = e.currentTarget.dataset.openid;
    const person = this.data.servicePeople.find((item) => item.openid === openid);
    if (!person) return;
    this.setData({
      selectedServicePerson: person,
      servicePersonPickerVisible: false
    }, () => this.refreshSignatureValidity());
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
    const continueExtraCheckout = calc.hasShortageExtraPay ? this.data.continueExtraCheckout : false;

    this.setData({
      continueExtraCheckout,
      calc: {
        balanceYuan: fmt.centToYuan(calc.balanceCent),
        discountText: fmt.formatDiscount(calc.discount),
        originalYuan: fmt.centToYuan(originalCent),
        payableYuan: fmt.centToYuan(calc.payableCent),
        balancePayYuan: fmt.centToYuan(calc.balancePayCent),
        balanceCoveredOriginalYuan: fmt.centToYuan(calc.balanceCoveredOriginalCent),
        remainingOriginalYuan: fmt.centToYuan(calc.remainingOriginalCent),
        extraPayYuan: fmt.centToYuan(calc.extraPayCent),
        settlementAmountYuan: fmt.centToYuan(calc.settlementAmountCent),
        settlementFormulaText: buildSettlementFormula(calc),
        balanceAfterYuan: fmt.centToYuan(calc.balanceAfterCent),
        shortageExplanation: buildShortageExplanation(calc),
        extraPayCent: calc.extraPayCent,
        hasShortageExtraPay: calc.hasShortageExtraPay
      }
    });
    this.refreshSignatureValidity();
  },

  buildCheckoutSnapshotInfo() {
    const member = this.data.selectedMember || {};
    const selectedServicePerson = this.data.selectedServicePerson || {};
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
      version: 2,
      member: {
        memberId: member._id || "",
        memberName: member.name || "",
        phone: member.phone || ""
      },
      servicePersonOpenid: selectedServicePerson.openid || "",
      servicePersonName: selectedServicePerson.name || "",
      serviceItems,
      cardItems,
      balanceBeforeCent: calc.balanceCent,
      discountApplied: calc.discount,
      discountLabelApplied: originalAmountCent > 0 ? fmt.formatDiscount(calc.discount) : "",
      originalAmountCent,
      consumptionAmountCent: calc.payableCent,
      balancePayCent: calc.balancePayCent,
      balanceCoveredOriginalCent: calc.balanceCoveredOriginalCent,
      extraPayCent: calc.extraPayCent,
      settlementAmountCent: calc.settlementAmountCent,
      shortageExtraPayRule: calc.shortageExtraPayRule,
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

  validateServicePerson() {
    const person = this.data.selectedServicePerson || {};
    if (!person.openid || !person.name) {
      api.showError(new Error("服务人信息加载失败，请重试"));
      return false;
    }
    return true;
  },

  validateReadyForSignature() {
    if (this.data.saving) return;
    if (this.data.memberLoading) return api.showError(new Error("会员信息加载中，请稍后"));
    if (this.data.servicePeopleRefreshing) return api.showError(new Error("服务人信息加载中，请稍后"));
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.validateServicePerson()) return;
    if (!this.validateCheckout()) return;
    if (this.data.calc.hasShortageExtraPay && !this.data.continueExtraCheckout) {
      return api.showError(new Error("请选择去充值或继续补差结账"));
    }
    if (this.data.calc.extraPayCent > 0 && !this.data.selectedPayment.value) {
      return api.showError(new Error("请选择补差价支付方式"));
    }
    return true;
  },

  goMemberRecharge() {
    wx.redirectTo({
      url: `/pages/member-recharge/index?memberId=${this.data.memberId}`
    });
  },

  continueShortageCheckout() {
    this.setData({ continueExtraCheckout: true }, () => this.refreshSignatureValidity());
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
        servicePersonOpenid: this.data.selectedServicePerson.openid,
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
