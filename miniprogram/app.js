App({
  globalData: {
    cloudEnv: "",
    auth: {
      checked: false,
      allowed: false,
      openid: ""
    }
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: "云开发不可用",
        content: "请使用支持云开发的微信开发者工具或基础库。",
        showCancel: false
      });
      return;
    }

    wx.cloud.init({
      env: this.globalData.cloudEnv || undefined,
      traceUser: true
    });
  }
});
