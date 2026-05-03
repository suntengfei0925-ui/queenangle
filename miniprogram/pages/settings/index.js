const { guardedPage } = require("../../utils/page");

guardedPage({
  goPage(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  }
});

