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
    mode: "list",
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
    api.callBusiness("saveRechargeTier", {
      id: this.data.form.id,
      amountCent: fmt.yuanInputToCent(this.data.form.amountYuan),
      discount: this.data.form.discount
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        this.backToList();
        this.loadData();
      })
      .catch(api.showError);
  },

  edit(e) {
    const item = this.data.tiers.find((tier) => tier._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      mode: "form",
      form: {
        id: item._id,
        amountYuan: item.amountYuan,
        discount: String(item.discount || "")
      }
    });
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

