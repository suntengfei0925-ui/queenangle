const app = getApp();

function callBusiness(action, data = {}) {
  return wx.cloud.callFunction({
    name: "business",
    data: {
      action,
      ...data
    }
  }).then((res) => {
    const result = res.result || {};
    if (!result.ok) {
      const message = result.message || "操作失败";
      if (result.code === "NO_PERMISSION") {
        wx.redirectTo({ url: "/pages/auth/no-permission" });
      }
      const err = new Error(message);
      err.code = result.code;
      err.result = result;
      throw err;
    }
    return result.data;
  });
}

function checkAuth() {
  return wx.cloud.callFunction({
    name: "login",
    data: {}
  }).then((res) => {
    const data = res.result || {};
    const owner = data.owner || {};
    const openid = data.openid || owner.openid || "";
    const name = data.name || owner.name || "";
    app.globalData.auth = {
      checked: true,
      allowed: !!data.allowed,
      openid,
      name,
      owner: data.allowed
        ? {
          openid,
          name
        }
        : null
    };

    if (!data.allowed) {
      wx.redirectTo({ url: "/pages/auth/no-permission" });
      return data;
    }

    return data;
  });
}

function requireAuth() {
  if (app.globalData.auth.checked) {
    if (!app.globalData.auth.allowed) {
      wx.redirectTo({ url: "/pages/auth/no-permission" });
      return Promise.reject(new Error("无权限"));
    }
    return Promise.resolve(app.globalData.auth);
  }
  return checkAuth();
}

function showError(err) {
  console.error(err);
  wx.showToast({
    title: err && err.message ? err.message : "操作失败",
    icon: "none"
  });
}

module.exports = {
  callBusiness,
  checkAuth,
  requireAuth,
  showError
};

