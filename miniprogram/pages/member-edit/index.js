const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");

guardedPage({
  data: {
    id: "",
    form: {
      name: "",
      phone: "",
      remark: ""
    }
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ id: query.id });
      this.loadMember(query.id);
    }
  },

  loadMember(id) {
    api.callBusiness("getMemberDetail", { memberId: id })
      .then((data) => {
        const member = data.member || {};
        this.setData({
          form: {
            name: member.name || "",
            phone: member.phone || "",
            remark: member.remark || ""
          }
        });
      })
      .catch(api.showError);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value
    });
  },

  save() {
    api.callBusiness("saveMember", {
      id: this.data.id,
      ...this.data.form
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});

