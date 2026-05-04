const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

const paymentMethods = [
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金" }
];

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

guardedPage({
  data: {
    categories: [],
    activeCategoryId: "",
    activeServices: [],
    selectedItems: [],
    selectedPayment: {},
    paymentMethods,
    totalOriginalYuan: "0.00",
    form: {
      actualReceivedYuan: "",
      remark: ""
    }
  },

  onLoad() {
    this.loadCatalog();
  },

  loadCatalog() {
    api.callBusiness("listServiceCatalog", { onlyEnabled: true })
      .then((catalog) => {
        const categories = normalizeCatalog(catalog);
        const first = categories[0] || {};
        this.setData({
          categories,
          activeCategoryId: first._id || "",
          activeServices: first.services || []
        });
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
    this.refreshTotal();
  },

  removeItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    const selectedItems = this.data.selectedItems.filter((_, itemIndex) => itemIndex !== index);
    this.setData({ selectedItems });
    this.refreshTotal();
  },

  onItemAmountInput(e) {
    this.setData({
      [`selectedItems[${e.currentTarget.dataset.index}].originalAmountYuan`]: e.detail.value
    });
    this.refreshTotal();
  },

  refreshTotal() {
    const totalCent = this.data.selectedItems.reduce((sum, item) => {
      if (!isAmountFilled(item.originalAmountYuan)) return sum;
      return sum + fmt.yuanInputToCent(item.originalAmountYuan);
    }, 0);
    this.setData({ totalOriginalYuan: fmt.centToYuan(totalCent) });
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  onPaymentChange(e) {
    this.setData({
      selectedPayment: this.data.paymentMethods[Number(e.currentTarget.dataset.index)]
    });
  },

  validateItems() {
    if (this.data.selectedItems.length === 0) {
      api.showError(new Error("请选择至少一个服务项目"));
      return false;
    }
    const hasEmptyAmount = this.data.selectedItems.some((item) => !isAmountFilled(item.originalAmountYuan));
    if (hasEmptyAmount) {
      api.showError(new Error("请填写每个项目的单项原价"));
      return false;
    }
    return true;
  },

  submit() {
    if (!this.validateItems()) return;
    if (!this.data.selectedPayment.value) {
      api.showError(new Error("请选择支付方式"));
      return;
    }

    api.callBusiness("createGuestConsumption", {
      serviceItems: this.data.selectedItems.map((item) => ({
        serviceId: item.serviceId,
        originalAmountCent: fmt.yuanInputToCent(item.originalAmountYuan)
      })),
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
