const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");

guardedPage({
  data: {
    id: "",
    redirect: "",
    form: {
      name: "",
      phone: "",
      remark: ""
    }
  },

  onLoad(query) {
    this.setData({ redirect: query.redirect || "" });
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
      .then((res) => {
        const memberId = this.data.id || (res && res.id);
        wx.showToast({ title: "已保存" });
        if (!this.data.id && this.data.redirect === "detail" && memberId) {
          wx.redirectTo({ url: `/pages/member-detail/index?id=${memberId}` });
          return;
        }
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});

