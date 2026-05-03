const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");
const fmt = require("../../../utils/format");

const emptyForm = {
  id: "",
  amountYuan: "",
  discount: ""
};

guardedPage({
  data: {
    form: { ...emptyForm },
    tiers: []
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    api.callBusiness("listRechargeTiers")
      .then((tiers) => {
        this.setData({
          tiers: (tiers || []).map((item) => ({
            ...item,
            amountYuan: fmt.centToYuan(item.amountCent)
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
    api.callBusiness("saveRechargeTier", {
      id: this.data.form.id,
      amountCent: fmt.yuanInputToCent(this.data.form.amountYuan),
      discount: this.data.form.discount
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        this.resetForm();
        this.loadData();
      })
      .catch(api.showError);
  },

  edit(e) {
    const item = this.data.tiers.find((tier) => tier._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      form: {
        id: item._id,
        amountYuan: item.amountYuan,
        discount: String(item.discount || "")
      }
    });
  },

  resetForm() {
    this.setData({ form: { ...emptyForm } });
  }
});

