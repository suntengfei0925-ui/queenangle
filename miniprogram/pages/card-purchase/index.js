const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

const paymentMethods = [
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金" }
];

guardedPage({
  data: {
    members: [],
    cardTypes: [],
    selectedMember: {},
    selectedCardType: {},
    selectedPayment: {},
    paymentMethods,
    form: {
      purchaseTimes: "",
      actualReceivedYuan: "",
      remark: ""
    }
  },

  onLoad() {
    Promise.all([
      api.callBusiness("listMembers"),
      api.callBusiness("listCardTypes", { onlyEnabled: true })
    ])
      .then(([members, cardTypes]) => {
        this.setData({
          members: (members || []).map((item) => ({
            ...item,
            displayName: `${item.name} ${item.phone || ""}`
          })),
          cardTypes: (cardTypes || []).map((item) => ({
            ...item,
            priceYuan: fmt.centToYuan(item.priceCent),
            displayName: `${item.name} / ${item.totalTimes} 次卡 / ¥${fmt.centToYuan(item.priceCent)}`
          }))
        });
      })
      .catch(api.showError);
  },

  onMemberChange(e) {
    this.setData({ selectedMember: this.data.members[Number(e.currentTarget.dataset.index)] });
  },

  onCardTypeChange(e) {
    const cardType = this.data.cardTypes[Number(e.currentTarget.dataset.index)];
    this.setData({
      selectedCardType: cardType,
      "form.purchaseTimes": String(cardType.totalTimes || ""),
      "form.actualReceivedYuan": fmt.centToYuan(cardType.priceCent)
    });
  },

  onPaymentChange(e) {
    this.setData({ selectedPayment: this.data.paymentMethods[Number(e.currentTarget.dataset.index)] });
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  submit() {
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.data.selectedCardType._id) return api.showError(new Error("请选择次卡类型"));
    if (!this.data.selectedPayment.value) return api.showError(new Error("请选择支付方式"));

    api.callBusiness("createCardPurchase", {
      memberId: this.data.selectedMember._id,
      cardTypeId: this.data.selectedCardType._id,
      purchaseTimes: Number(this.data.form.purchaseTimes),
      actualReceivedCent: fmt.yuanInputToCent(this.data.form.actualReceivedYuan),
      paymentMethod: this.data.selectedPayment.value,
      remark: this.data.form.remark
    })
      .then(() => {
        wx.showToast({ title: "已记录" });
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});

