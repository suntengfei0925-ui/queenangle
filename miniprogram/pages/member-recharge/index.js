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
    tiers: [],
    selectedMember: {},
    selectedTier: {},
    selectedPayment: {},
    paymentMethods,
    form: {
      remark: ""
    }
  },

  onLoad() {
    Promise.all([
      api.callBusiness("listMembers"),
      api.callBusiness("listRechargeTiers")
    ])
      .then(([members, tiers]) => {
        this.setData({
          members: (members || []).map((item) => ({
            ...item,
            displayName: `${item.name} ${item.phone || ""}`
          })),
          tiers: (tiers || []).map((item) => ({
            ...item,
            amountYuan: fmt.centToYuan(item.amountCent),
            displayName: `¥${fmt.centToYuan(item.amountCent)} / ${item.discountLabel}`
          }))
        });
      })
      .catch(api.showError);
  },

  onMemberChange(e) {
    this.setData({ selectedMember: this.data.members[Number(e.detail.value)] });
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
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});

