const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");
const basicConfig = require("../../../utils/basic-config");
const fmt = require("../../../utils/format");

const emptyForm = {
  id: "",
  name: "",
  totalTimes: "",
  priceYuan: "",
  remark: ""
};

guardedPage({
  data: {
    mode: "list",
    form: { ...emptyForm },
    cardTypes: []
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    api.callBusiness("listCardTypes")
      .then((cardTypes) => {
        this.setData({
          cardTypes: (cardTypes || []).map((item) => ({
            ...item,
            priceYuan: fmt.centToYuan(item.priceCent)
          }))
        });
      })
      .catch(api.showError);
  },

  startAdd() {
    this.setData({
      mode: "form",
      form: { ...emptyForm }
    });
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  save() {
    api.callBusiness("saveCardType", {
      id: this.data.form.id,
      name: this.data.form.name,
      totalTimes: Number(this.data.form.totalTimes),
      priceCent: fmt.yuanInputToCent(this.data.form.priceYuan),
      remark: this.data.form.remark,
      enabled: true
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        basicConfig.refreshBasicConfig({ silent: true });
        this.backToList();
        this.loadData();
      })
      .catch(api.showError);
  },

  edit(e) {
    const item = this.data.cardTypes.find((card) => card._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      mode: "form",
      form: {
        id: item._id,
        name: item.name,
        totalTimes: String(item.totalTimes || ""),
        priceYuan: item.priceYuan,
        remark: item.remark || ""
      }
    });
  },

  toggle(e) {
    api.callBusiness("toggleCardType", {
      id: e.currentTarget.dataset.id,
      enabled: e.currentTarget.dataset.enabled
    })
      .then(() => {
        basicConfig.refreshBasicConfig({ silent: true });
        this.loadData();
      })
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
