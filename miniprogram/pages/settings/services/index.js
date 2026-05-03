const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");
const fmt = require("../../../utils/format");

const emptyForm = {
  id: "",
  name: "",
  priceYuan: "",
  remark: ""
};

guardedPage({
  data: {
    form: { ...emptyForm },
    services: []
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    api.callBusiness("listServices")
      .then((services) => {
        this.setData({
          services: (services || []).map((item) => ({
            ...item,
            priceYuan: fmt.centToYuan(item.priceCent)
          }))
        });
      })
      .catch(api.showError);
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  save() {
    api.callBusiness("saveService", {
      id: this.data.form.id,
      name: this.data.form.name,
      priceCent: fmt.yuanInputToCent(this.data.form.priceYuan),
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
    this.setData({
      form: {
        id: item._id,
        name: item.name,
        priceYuan: item.priceYuan,
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

