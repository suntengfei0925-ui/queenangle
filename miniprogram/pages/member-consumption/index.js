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
    originalYuan: "0.00",
    payableYuan: "0.00",
    balancePayYuan: "0.00",
    extraPayYuan: "0.00",
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

guardedPage({
  data: {
    members: [],
    categories: [],
    activeCategoryId: "",
    activeServices: [],
    selectedItems: [],
    selectedMember: {},
    selectedPayment: {},
    paymentMethods,
    form: {
      remark: ""
    },
    calc: emptyCalc()
  },

  onLoad() {
    Promise.all([
      api.callBusiness("listMembers"),
      api.callBusiness("listServiceCatalog", { onlyEnabled: true })
    ])
      .then(([members, catalog]) => {
        const categories = normalizeCatalog(catalog);
        const first = categories[0] || {};
        this.setData({
          members: (members || []).map((item) => ({
            ...item,
            displayName: `${item.name} ${item.phone || ""}`
          })),
          categories,
          activeCategoryId: first._id || "",
          activeServices: first.services || []
        });
      })
      .catch(api.showError);
  },

  onMemberChange(e) {
    this.setData({ selectedMember: this.data.members[Number(e.detail.value)] });
    this.refreshCalc();
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
    this.setData({ selectedPayment: this.data.paymentMethods[Number(e.detail.value)] });
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
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
    const balanceCent = Number(member.balanceCent || 0);
    const discount = balanceCent > 0 ? Number(member.currentDiscount || 0) : 0;
    const payableCent = discount ? Math.round(originalCent * discount / 10) : originalCent;
    const balancePayCent = Math.min(balanceCent, payableCent);
    const extraPayCent = payableCent - balancePayCent;

    this.setData({
      calc: {
        balanceYuan: fmt.centToYuan(balanceCent),
        discountText: fmt.formatDiscount(discount),
        originalYuan: fmt.centToYuan(originalCent),
        payableYuan: fmt.centToYuan(payableCent),
        balancePayYuan: fmt.centToYuan(balancePayCent),
        extraPayYuan: fmt.centToYuan(extraPayCent),
        extraPayCent
      }
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
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.validateItems()) return;
    if (this.data.calc.extraPayCent > 0 && !this.data.selectedPayment.value) {
      return api.showError(new Error("请选择补差价支付方式"));
    }

    api.callBusiness("createMemberConsumption", {
      memberId: this.data.selectedMember._id,
      serviceItems: this.data.selectedItems.map((item) => ({
        serviceId: item.serviceId,
        originalAmountCent: fmt.yuanInputToCent(item.originalAmountYuan)
      })),
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
