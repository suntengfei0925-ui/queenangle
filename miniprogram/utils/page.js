const api = require("./api");

function guardedPage(options) {
  const originalOnLoad = options.onLoad;
  const originalOnShow = options.onShow;

  options.onLoad = function onLoad(query) {
    api.requireAuth()
      .then(() => {
        if (originalOnLoad) originalOnLoad.call(this, query || {});
      })
      .catch(api.showError);
  };

  if (originalOnShow) {
    options.onShow = function onShow() {
      if (!getApp().globalData.auth.allowed) return;
      originalOnShow.call(this);
    };
  }

  Page(options);
}

module.exports = {
  guardedPage
};
