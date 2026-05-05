const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const basicConfig = require("../../utils/basic-config");
const fmt = require("../../utils/format");
const { paymentMethods } = require("../../utils/payment");
const servicePerson = require("../../utils/service-person");

function isAmountFilled(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeCatalog(catalog) {
  return (catalog || []).filter((category) => (category.services || []).length > 0);
}

function selectedServiceIdMap(selectedItems) {
  const map = {};
  (selectedItems || []).forEach((item) => {
    if (item.serviceId) map[item.serviceId] = true;
  });
  return map;
}

function markSelectedServices(services, selectedItems) {
  const selectedMap = selectedServiceIdMap(selectedItems);
  return (services || []).map((service) => ({
    ...service,
    selected: !!selectedMap[service._id]
  }));
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
    selectedServicePerson: {},
    servicePeople: [],
    servicePeopleLoadError: "",
    servicePersonPickerVisible: false,
    paymentMethods,
    configError: "",
    totalOriginalYuan: "0.00",
    actualReceivedAutoSync: true,
    form: {
      actualReceivedYuan: "",
      remark: ""
    }
  },

  onLoad() {
    this.initServicePerson();
    this.loadCatalog();
  },

  initServicePerson() {
    const current = servicePerson.getCurrentServicePerson();
    const cachedPeople = servicePerson.readServicePeopleCache();
    this.setData({
      selectedServicePerson: current.openid && current.name ? current : {},
      servicePeople: cachedPeople,
      servicePeopleLoadError: ""
    });

    servicePerson.refreshServicePeople()
      .then((people) => {
        const selected = this.data.selectedServicePerson || {};
        const refreshedSelected = selected.openid
          ? (people.find((person) => person.openid === selected.openid) || selected)
          : {};
        this.setData({
          selectedServicePerson: refreshedSelected,
          servicePeople: people,
          servicePeopleLoadError: ""
        });
      })
      .catch(() => {
        this.setData({ servicePeopleLoadError: "服务人名单加载失败" });
      });
  },

  loadCatalog() {
    const cache = basicConfig.readBasicConfigCache();
    if (cache) {
      this.applyCatalog(cache.serviceCatalog);
    }

    basicConfig.refreshBasicConfig({ silent: !!cache })
      .then((config) => {
        if (config) this.applyCatalog(config.serviceCatalog);
      })
      .catch((err) => {
        this.setData({ configError: "配置加载失败，请重试" });
        api.showError(err);
      });
  },

  applyCatalog(catalog) {
    const categories = normalizeCatalog(catalog);
    const current = categories.find((item) => item._id === this.data.activeCategoryId);
    const first = current || categories[0] || {};
    this.setData({
      configError: "",
      categories,
      activeCategoryId: first._id || "",
      activeServices: markSelectedServices(first.services || [], this.data.selectedItems)
    });
  },

  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === categoryId) || {};
    this.setData({
      activeCategoryId: categoryId,
      activeServices: markSelectedServices(category.services || [], this.data.selectedItems)
    });
  },

  addService(e) {
    const serviceId = e.currentTarget.dataset.id;
    const category = this.data.categories.find((item) => item._id === this.data.activeCategoryId);
    if (!category) return;
    const service = (category.services || []).find((item) => item._id === serviceId);
    if (!service) return;
    const selectedItems = this.data.selectedItems || [];
    const selectedIndex = selectedItems.findIndex((item) => item.serviceId === serviceId);
    const nextSelectedItems = selectedIndex >= 0
      ? selectedItems.filter((_, index) => index !== selectedIndex)
      : [...selectedItems, selectedItem(service, category)];
    this.setData({
      selectedItems: nextSelectedItems,
      activeServices: markSelectedServices(category.services || [], nextSelectedItems)
    });
    this.refreshTotal();
  },

  removeItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    const selectedItems = this.data.selectedItems.filter((_, itemIndex) => itemIndex !== index);
    const category = this.data.categories.find((item) => item._id === this.data.activeCategoryId) || {};
    this.setData({
      selectedItems,
      activeServices: markSelectedServices(category.services || [], selectedItems)
    });
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
    const nextData = {
      totalOriginalYuan: fmt.centToYuan(totalCent)
    };
    if (this.data.selectedItems.length === 0) {
      nextData.actualReceivedAutoSync = true;
      nextData["form.actualReceivedYuan"] = "";
    } else if (this.data.actualReceivedAutoSync) {
      nextData["form.actualReceivedYuan"] = fmt.centToYuan(totalCent);
    }
    this.setData(nextData);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const nextData = {
      [`form.${field}`]: value
    };
    if (field === "actualReceivedYuan") {
      nextData.actualReceivedAutoSync = String(value).trim() === "";
    }
    this.setData({
      ...nextData
    });
  },

  onPaymentChange(e) {
    this.setData({
      selectedPayment: this.data.paymentMethods[Number(e.currentTarget.dataset.index)]
    });
  },

  openServicePersonPicker() {
    const current = this.data.selectedServicePerson || {};
    if (!current.openid || !current.name) {
      api.showError(new Error("服务人信息加载失败，请重试"));
      return;
    }
    if (this.data.servicePeopleLoadError && this.data.servicePeople.length <= 1) {
      api.showError(new Error(this.data.servicePeopleLoadError));
      return;
    }
    if (this.data.servicePeople.length === 0) {
      api.showError(new Error("服务人名单加载中，请稍后"));
      return;
    }
    this.setData({ servicePersonPickerVisible: true });
  },

  closeServicePersonPicker() {
    this.setData({ servicePersonPickerVisible: false });
  },

  selectServicePerson(e) {
    const openid = e.currentTarget.dataset.openid;
    const person = this.data.servicePeople.find((item) => item.openid === openid);
    if (!person) return;
    this.setData({
      selectedServicePerson: person,
      servicePersonPickerVisible: false
    });
  },

  noop() {},

  validateServicePerson() {
    const person = this.data.selectedServicePerson || {};
    if (!person.openid || !person.name) {
      api.showError(new Error("服务人信息加载失败，请重试"));
      return false;
    }
    return true;
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
    if (!this.validateServicePerson()) return;
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
      servicePersonOpenid: this.data.selectedServicePerson.openid,
      remark: this.data.form.remark
    })
      .then(() => {
        wx.showToast({ title: "已记录" });
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});
