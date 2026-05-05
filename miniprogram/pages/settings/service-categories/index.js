const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");
const basicConfig = require("../../../utils/basic-config");

const emptyForm = {
  id: "",
  name: ""
};

guardedPage({
  data: {
    form: { ...emptyForm },
    categories: []
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    api.callBusiness("listServiceCategories")
      .then((categories) => {
        this.setData({ categories: categories || [] });
      })
      .catch(api.showError);
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  save() {
    api.callBusiness("saveServiceCategory", {
      id: this.data.form.id,
      name: this.data.form.name,
      enabled: true
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        basicConfig.refreshBasicConfig({ silent: true });
        this.resetForm();
        this.loadData();
      })
      .catch(api.showError);
  },

  edit(e) {
    const item = this.data.categories.find((category) => category._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      form: {
        id: item._id,
        name: item.name
      }
    });
  },

  toggle(e) {
    api.callBusiness("toggleServiceCategory", {
      id: e.currentTarget.dataset.id,
      enabled: e.currentTarget.dataset.enabled
    })
      .then(() => {
        basicConfig.refreshBasicConfig({ silent: true });
        this.loadData();
      })
      .catch(api.showError);
  },

  resetForm() {
    this.setData({ form: { ...emptyForm } });
  }
});
