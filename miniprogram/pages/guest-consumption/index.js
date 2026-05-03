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
    services: [],
    selectedService: {},
    selectedPayment: {},
    paymentMethods,
    form: {
      originalAmountYuan: "",
      actualReceivedYuan: "",
      remark: ""
    }
  },

  onLoad() {
    api.callBusiness("listServices", { onlyEnabled: true })
      .then((services) => {
        this.setData({ services: services || [] });
      })
      .catch(api.showError);
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  onServiceChange(e) {
    const service = this.data.services[Number(e.detail.value)];
    this.setData({
      selectedService: service,
      "form.originalAmountYuan": fmt.centToYuan(service.priceCent),
      "form.actualReceivedYuan": fmt.centToYuan(service.priceCent)
    });
  },

  onPaymentChange(e) {
    this.setData({
      selectedPayment: this.data.paymentMethods[Number(e.detail.value)]
    });
  },

  submit() {
    if (!this.data.selectedService._id) {
      api.showError(new Error("请选择服务项目"));
      return;
    }
    if (!this.data.selectedPayment.value) {
      api.showError(new Error("请选择支付方式"));
      return;
    }

    api.callBusiness("createGuestConsumption", {
      serviceId: this.data.selectedService._id,
      originalAmountCent: fmt.yuanInputToCent(this.data.form.originalAmountYuan),
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

