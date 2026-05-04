const api = require("../../utils/api");

Page({
  data: {
    openid: ""
  },

  onLoad() {
    const app = getApp();
    const openid = app.globalData.auth.openid || "";
    this.setData({
      openid
    });

    if (!openid) {
      this.checkAgain();
    }
  },

  checkAgain() {
    api.checkAuth()
      .then((auth) => {
        if (auth.allowed) {
          wx.switchTab({ url: "/pages/entry/index" });
        } else {
          this.setData({ openid: auth.openid || "" });
        }
      })
      .catch(api.showError);
  },

  copyOpenid() {
    if (!this.data.openid) {
      wx.showToast({
        title: "暂无 openid",
        icon: "none"
      });
      return;
    }

    wx.setClipboardData({
      data: this.data.openid,
      success() {
        wx.showToast({
          title: "已复制 openid",
          icon: "success"
        });
      }
    });
  }
});

