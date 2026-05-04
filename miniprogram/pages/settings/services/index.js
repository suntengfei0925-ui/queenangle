const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");

const FIXED_CATEGORY_NAMES = ["美甲", "美睫"];

const emptyForm = {
  id: "",
  categoryId: "",
  categoryName: "",
  name: "",
  remark: ""
};

function isOtherService(service) {
  return !!service && (service.isOther || service.name === "其他");
}

function compareServices(a, b) {
  const aOther = isOtherService(a);
  const bOther = isOtherService(b);
  if (aOther !== bOther) return aOther ? 1 : -1;
  if (!aOther && a.usageCount !== b.usageCount) {
    return Number(b.usageCount || 0) - Number(a.usageCount || 0);
  }
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans");
}

function buildServiceGroups(categories, services) {
  const categoryMap = {};
  (categories || []).forEach((category) => {
    if (FIXED_CATEGORY_NAMES.indexOf(category.name) >= 0) {
      categoryMap[category.name] = category;
    }
  });

  return FIXED_CATEGORY_NAMES.map((name) => {
    const category = categoryMap[name] || {};
    const groupServices = (services || [])
      .filter((service) => (service.categoryId && category._id
        ? service.categoryId === category._id
        : service.categoryName === name))
      .sort(compareServices);

    return {
      name,
      categoryId: category._id || "",
      services: groupServices
    };
  });
}

function normalizeCatalog(catalog) {
  const categories = (catalog || []).map((category) => ({
    _id: category._id || "",
    name: category.name || "",
    enabled: category.enabled !== false
  }));
  const services = (catalog || []).reduce((list, category) => list.concat(category.services || []), []);
  return {
    categories,
    services,
    serviceGroups: buildServiceGroups(categories, services)
  };
}

guardedPage({
  data: {
    mode: "list",
    form: { ...emptyForm },
    categories: [],
    services: [],
    serviceGroups: []
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    api.callBusiness("listServiceCatalog", { onlyEnabled: false })
      .then((catalog) => {
        this.setData(normalizeCatalog(catalog));
      })
      .catch(api.showError);
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  startAdd(e) {
    if (!e.currentTarget.dataset.categoryId) {
      wx.showToast({ title: "服务分类未初始化", icon: "none" });
      return;
    }
    this.setData({
      mode: "form",
      form: {
        ...emptyForm,
        categoryId: e.currentTarget.dataset.categoryId,
        categoryName: e.currentTarget.dataset.categoryName
      }
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
        this.backToList();
        this.loadData();
      })
      .catch(api.showError);
  },

  edit(e) {
    const item = this.data.services.find((service) => service._id === e.currentTarget.dataset.id);
    if (!item) return;
    if (isOtherService(item)) {
      wx.showToast({ title: "系统项目不能编辑", icon: "none" });
      return;
    }
    this.setData({
      mode: "form",
      form: {
        id: item._id,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        name: item.name,
        remark: item.remark || ""
      }
    });
  },

  toggle(e) {
    const item = this.data.services.find((service) => service._id === e.currentTarget.dataset.id);
    if (isOtherService(item)) {
      wx.showToast({ title: "系统项目不能停用", icon: "none" });
      return;
    }
    api.callBusiness("toggleService", {
      id: e.currentTarget.dataset.id,
      enabled: e.currentTarget.dataset.enabled
    })
      .then(() => this.loadData())
      .catch(api.showError);
  },

  backToList() {
    this.setData({
      mode: "list",
      form: { ...emptyForm }
    });
  },

  resetForm() {
    this.setData({ form: { ...emptyForm } });
  }
});
