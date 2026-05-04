const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

const paymentMethods = [
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金" }
];

function normalizeMember(member) {
  const cardBalances = Array.isArray(member.cardBalances) ? member.cardBalances : [];
  return {
    ...member,
    balanceYuan: fmt.centToYuan(member.balanceCent),
    discountText: fmt.formatDiscount(member.currentDiscount),
    cardTotal: cardBalances.reduce((sum, card) => sum + Number(card.remainingTimes || 0), 0)
  };
}

guardedPage({
  data: {
    memberId: "",
    tiers: [],
    selectedMember: {},
    selectedTier: {},
    selectedPayment: {},
    paymentMethods,
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
      api.callBusiness("listRechargeTiers")
    ])
      .then(([detail, tiers]) => {
        const member = normalizeMember((detail && detail.member) || {});
        this.setData({
          selectedMember: member,
          tiers: (tiers || []).map((item) => ({
            ...item,
            amountYuan: fmt.centToYuan(item.amountCent),
            displayName: `¥${fmt.centToYuan(item.amountCent)} / ${item.discountLabel}`
          }))
        });
      })
      .catch(api.showError);
  },

  onTierChange(e) {
    this.setData({ selectedTier: this.data.tiers[Number(e.detail.value)] });
  },

  onPaymentChange(e) {
    this.setData({ selectedPayment: this.data.paymentMethods[Number(e.detail.value)] });
  },

  onRemarkInput(e) {
    this.setData({ "form.remark": e.detail.value });
  },

  submit() {
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.data.selectedTier._id) return api.showError(new Error("请选择充值档位"));
    if (!this.data.selectedPayment.value) return api.showError(new Error("请选择支付方式"));

    api.callBusiness("createMemberRecharge", {
      memberId: this.data.selectedMember._id,
      tierId: this.data.selectedTier._id,
      paymentMethod: this.data.selectedPayment.value,
      remark: this.data.form.remark
    })
      .then(() => {
        wx.showToast({ title: "已记录" });
        this.returnToMemberDetail();
      })
      .catch(api.showError);
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

