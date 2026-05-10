const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();

function getContext() {
  const context = storage.getStore();
  if (!context) {
    throw new Error("Request context is not available.");
  }
  return context;
}

function runWithContext(context, fn) {
  return storage.run(context, fn);
}

const cloud = {
  DYNAMIC_CURRENT_ENV: "local",
  init() {},
  database() {
    return {
      collection(name) {
        return getContext().db.collection(name);
      },
      createCollection(name) {
        return getContext().db.createCollection(name);
      },
      runTransaction(fn) {
        return getContext().db.runTransaction(fn);
      },
      serverDate() {
        return getContext().db.serverDate();
      }
    };
  },
  getWXContext() {
    const { user } = getContext();
    return {
      OPENID: user && user.id ? user.id : ""
    };
  }
};

module.exports = {
  cloud,
  runWithContext
};
