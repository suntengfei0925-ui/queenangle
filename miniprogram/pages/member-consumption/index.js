const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

const paymentMethods = [
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金" }
];

function emptyCalc() {
  return {
    balanceYuan: "0.00",
    discountText: "无折扣",
    payableYuan: "0.00",
    balancePayYuan: "0.00",
    extraPayYuan: "0.00",
    extraPayCent: 0
  };
}

guardedPage({
  data: {
    members: [],
    services: [],
    selectedMember: {},
    selectedService: {},
    selectedPayment: {},
    paymentMethods,
    form: {
      originalAmountYuan: "",
      remark: ""
    },
    calc: emptyCalc()
  },

  onLoad() {
    Promise.all([
      api.callBusiness("listMembers"),
      api.callBusiness("listServices", { onlyEnabled: true })
    ])
      .then(([members, services]) => {
        this.setData({
          members: (members || []).map((item) => ({
            ...item,
            displayName: `${item.name} ${item.phone || ""}`
          })),
          services: services || []
        });
      })
      .catch(api.showError);
  },

  onMemberChange(e) {
    this.setData({ selectedMember: this.data.members[Number(e.detail.value)] });
    this.refreshCalc();
  },

  onServiceChange(e) {
    const service = this.data.services[Number(e.detail.value)];
    this.setData({
      selectedService: service,
      "form.originalAmountYuan": fmt.centToYuan(service.priceCent)
    });
    this.refreshCalc();
  },

  onPaymentChange(e) {
    this.setData({ selectedPayment: this.data.paymentMethods[Number(e.detail.value)] });
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
    if (e.currentTarget.dataset.field === "originalAmountYuan") {
      this.refreshCalc();
    }
  },

  refreshCalc() {
    const member = this.data.selectedMember || {};
    const originalCent = fmt.yuanInputToCent(this.data.form.originalAmountYuan);
    const balanceCent = Number(member.balanceCent || 0);
    const discount = balanceCent > 0 ? Number(member.currentDiscount || 0) : 0;
    const payableCent = discount ? Math.round(originalCent * discount / 10) : originalCent;
    const balancePayCent = Math.min(balanceCent, payableCent);
    const extraPayCent = payableCent - balancePayCent;

    this.setData({
      calc: {
        balanceYuan: fmt.centToYuan(balanceCent),
        discountText: fmt.formatDiscount(discount),
        payableYuan: fmt.centToYuan(payableCent),
        balancePayYuan: fmt.centToYuan(balancePayCent),
        extraPayYuan: fmt.centToYuan(extraPayCent),
        extraPayCent
      }
    });
  },

  submit() {
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.data.selectedService._id) return api.showError(new Error("请选择服务项目"));
    if (this.data.calc.extraPayCent > 0 && !this.data.selectedPayment.value) {
      return api.showError(new Error("请选择补差价支付方式"));
    }

    api.callBusiness("createMemberConsumption", {
      memberId: this.data.selectedMember._id,
      serviceId: this.data.selectedService._id,
      originalAmountCent: fmt.yuanInputToCent(this.data.form.originalAmountYuan),
      paymentMethod: this.data.selectedPayment.value,
      extraPaymentMethod: this.data.selectedPayment.value,
      remark: this.data.form.remark
    })
      .then(() => {
        wx.showToast({ title: "已记录" });
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});

