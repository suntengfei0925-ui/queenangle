const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");
const { paymentMethods } = require("../../utils/payment");

function normalizeMember(member) {
  const cardBalances = Array.isArray(member.cardBalances) ? member.cardBalances : [];
  return {
    ...member,
    balanceYuan: fmt.centToYuan(member.balanceCent),
    discountText: fmt.formatDiscount(member.currentDiscount),
    cardTotal: cardBalances.reduce((sum, card) => sum + Number(card.remainingTimes || 0), 0)
  };
}

function normalizeCardType(item) {
  return {
    ...item,
    selected: false,
    priceYuan: fmt.centToYuan(item.priceCent)
  };
}

function buildCardSummary(cards) {
  const totalTimes = cards.reduce((sum, item) => sum + Number(item.totalTimes || 0), 0);
  const totalCent = cards.reduce((sum, item) => sum + Number(item.priceCent || 0), 0);
  return {
    totalTimes,
    totalYuan: fmt.centToYuan(totalCent)
  };
}

guardedPage({
  data: {
    memberId: "",
    tiers: [],
    cardTypes: [],
    selectedMember: {},
    selectedTier: {},
    selectedCards: [],
    cardSummary: buildCardSummary([]),
    selectedPayment: {},
    paymentMethods,
    submitting: false,
    form: {
      remark: ""
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
      api.callBusiness("listRechargeTiers"),
      api.callBusiness("listCardTypes", { onlyEnabled: true })
    ])
      .then(([detail, tiers, cardTypes]) => {
        const member = normalizeMember((detail && detail.member) || {});
        this.setData({
          selectedMember: member,
          tiers: (tiers || []).map((item) => ({
            ...item,
            amountYuan: fmt.centToYuan(item.amountCent),
            displayName: `充 ¥${fmt.centToYuan(item.amountCent)} / 享 ${item.discountLabel}`
          })),
          cardTypes: (cardTypes || []).map(normalizeCardType)
        });
      })
      .catch(api.showError);
  },

  onTierChange(e) {
    const tier = this.data.tiers[Number(e.currentTarget.dataset.index)];
    this.setData({
      selectedTier: tier,
      selectedCards: [],
      cardSummary: buildCardSummary([]),
      cardTypes: this.data.cardTypes.map((item) => ({
        ...item,
        selected: false
      }))
    });
  },

  onCardTypeToggle(e) {
    const index = Number(e.currentTarget.dataset.index);
    const cardTypes = this.data.cardTypes.map((item, itemIndex) => ({
      ...item,
      selected: itemIndex === index ? !item.selected : item.selected
    }));
    const selectedCards = cardTypes.filter((item) => item.selected);
    this.setData({
      selectedTier: {},
      cardTypes,
      selectedCards,
      cardSummary: buildCardSummary(selectedCards)
    });
  },

  onPaymentChange(e) {
    this.setData({ selectedPayment: this.data.paymentMethods[Number(e.currentTarget.dataset.index)] });
  },

  onRemarkInput(e) {
    this.setData({ "form.remark": e.detail.value });
  },

  submit() {
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (this.data.submitting) return;

    const hasTier = !!this.data.selectedTier._id;
    const hasCards = this.data.selectedCards.length > 0;
    if (!hasTier && !hasCards) return api.showError(new Error("请选择充值档位或次卡"));
    if (!this.data.selectedPayment.value) return api.showError(new Error("请选择支付方式"));

    const action = hasTier ? "createMemberRecharge" : "createCardPurchase";
    const payload = hasTier
      ? {
        memberId: this.data.selectedMember._id,
        tierId: this.data.selectedTier._id,
        paymentMethod: this.data.selectedPayment.value,
        remark: this.data.form.remark
      }
      : {
        memberId: this.data.selectedMember._id,
        cardTypeIds: this.data.selectedCards.map((item) => item._id),
        paymentMethod: this.data.selectedPayment.value,
        remark: this.data.form.remark
      };

    this.setData({ submitting: true });
    api.callBusiness(action, payload)
      .then(() => {
        wx.showToast({ title: "已记录" });
        this.returnToMemberDetail();
      })
      .catch((err) => {
        this.setData({ submitting: false });
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

