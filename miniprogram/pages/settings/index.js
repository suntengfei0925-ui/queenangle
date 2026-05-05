const { guardedPage } = require("../../utils/page");

guardedPage({
  data: {
    isOwner: false
  },

  onLoad() {
    this.refreshOwnerState();
  },

  onShow() {
    this.refreshOwnerState();
  },

  refreshOwnerState() {
    const auth = getApp().globalData.auth || {};
    this.setData({
      isOwner: auth.isOwner === true
    });
  },

  goPage(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  }
});

