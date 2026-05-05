const STORAGE_KEY = "basicConfigCacheV1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeConfig(config = {}) {
  return {
    serviceCatalog: asArray(config.serviceCatalog),
    cardTypes: asArray(config.cardTypes),
    rechargeTiers: asArray(config.rechargeTiers),
    version: config.version || "",
    updatedAt: config.updatedAt || "",
    cachedAt: config.cachedAt || ""
  };
}

function readBasicConfigCache() {
  try {
    const cache = wx.getStorageSync(STORAGE_KEY);
    if (!cache || typeof cache !== "object" || !cache.cachedAt) return null;
    return normalizeConfig(cache);
  } catch (err) {
    console.warn("read basic config cache failed", err);
    return null;
  }
}

function writeBasicConfigCache(config) {
  const cache = normalizeConfig({
    ...config,
    cachedAt: new Date().toISOString()
  });
  wx.setStorageSync(STORAGE_KEY, cache);
  return cache;
}

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
      const err = new Error(result.message || "操作失败");
      err.code = result.code;
      err.result = result;
      throw err;
    }
    return result.data;
  });
}

function fetchBasicConfig() {
  return callBusiness("getBasicConfig");
}

function refreshBasicConfig(options = {}) {
  return fetchBasicConfig()
    .then(writeBasicConfigCache)
    .catch((err) => {
      if (options.silent) return null;
      throw err;
    });
}

function preloadBasicConfig() {
  return refreshBasicConfig({ silent: true });
}

module.exports = {
  readBasicConfigCache,
  writeBasicConfigCache,
  refreshBasicConfig,
  preloadBasicConfig
};
