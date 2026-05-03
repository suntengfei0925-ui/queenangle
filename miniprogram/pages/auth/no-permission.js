const api = require("../../utils/api");

Page({
  data: {
    openid: ""
  },

  onLoad() {
    const app = getApp();
    this.setData({
      openid: app.globalData.auth.openid || ""
    });
  },

  checkAgain() {
    api.checkAuth()
      .then((auth) => {
        if (auth.allowed) {
          wx.switchTab({ url: "/pages/home/index" });
        } else {
          this.setData({ openid: auth.openid || "" });
        }
      })
      .catch(api.showError);
  }
});

