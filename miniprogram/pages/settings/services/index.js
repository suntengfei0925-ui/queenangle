const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");

const emptyForm = {
  id: "",
  categoryId: "",
  categoryIndex: -1,
  categoryName: "",
  name: "",
  remark: ""
};

guardedPage({
  data: {
    form: { ...emptyForm },
    categories: [],
    services: []
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    Promise.all([
      api.callBusiness("listServiceCategories"),
      api.callBusiness("listServices")
    ])
      .then(([categories, services]) => {
        this.setData({
          categories: categories || [],
          services: services || []
        });
      })
      .catch(api.showError);
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    const category = this.data.categories[categoryIndex] || {};
    this.setData({
      "form.categoryIndex": categoryIndex,
      "form.categoryId": category._id || "",
      "form.categoryName": category.name || ""
    });
  },

  save() {
    api.callBusiness("saveService", {
      id: this.data.form.id,
      categoryId: this.data.form.categoryId,
      name: this.data.form.name,
      remark: this.data.form.remark,
      enabled: true
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        this.resetForm();
        this.loadData();
      })
      .catch(api.showError);
  },

  edit(e) {
    const item = this.data.services.find((service) => service._id === e.currentTarget.dataset.id);
    if (!item) return;
    const categoryIndex = this.data.categories.findIndex((category) => category._id === item.categoryId);
    this.setData({
      form: {
        id: item._id,
        categoryId: item.categoryId,
        categoryIndex,
        categoryName: item.categoryName,
        name: item.name,
        remark: item.remark || ""
      }
    });
  },

  toggle(e) {
    api.callBusiness("toggleService", {
      id: e.currentTarget.dataset.id,
      enabled: e.currentTarget.dataset.enabled
    })
      .then(() => this.loadData())
      .catch(api.showError);
  },

  resetForm() {
    this.setData({ form: { ...emptyForm } });
  }
});
