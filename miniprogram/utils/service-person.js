const api = require("./api");

const CACHE_KEY = "servicePeopleCache";

function normalizePerson(person) {
  return {
    openid: String((person && person.openid) || "").trim(),
    name: String((person && person.name) || "").trim()
  };
}

function currentOpenid() {
  const app = getApp();
  const auth = (app.globalData && app.globalData.auth) || {};
  return auth.openid || "";
}

function getCurrentServicePerson() {
  const app = getApp();
  const auth = (app.globalData && app.globalData.auth) || {};
  return normalizePerson(auth.owner || auth);
}

function visiblePeople(list) {
  const seen = {};
  return (Array.isArray(list) ? list : [])
    .map(normalizePerson)
    .filter((person) => person.openid && person.name)
    .filter((person) => {
      if (seen[person.openid]) return false;
      seen[person.openid] = true;
      return true;
    });
}

function withCurrentPerson(list) {
  const current = getCurrentServicePerson();
  const people = visiblePeople(list);
  if (!current.openid || !current.name || people.some((person) => person.openid === current.openid)) {
    return people;
  }
  return [current, ...people];
}

function writeServicePeopleCache(people) {
  const app = getApp();
  const normalized = withCurrentPerson(people);
  app.globalData.servicePeople = normalized;
  app.globalData.servicePeopleOwnerOpenid = currentOpenid();

  try {
    wx.setStorageSync(CACHE_KEY, {
      openid: currentOpenid(),
      people: normalized
    });
  } catch (e) {
    // Cache failure should not block checkout.
  }

  return normalized;
}

function readServicePeopleCache() {
  const app = getApp();
  const openid = currentOpenid();
  if (app.globalData.servicePeopleOwnerOpenid === openid && Array.isArray(app.globalData.servicePeople)) {
    return withCurrentPerson(app.globalData.servicePeople);
  }

  try {
    const cached = wx.getStorageSync(CACHE_KEY);
    if (cached && cached.openid === openid) {
      return writeServicePeopleCache(cached.people);
    }
  } catch (e) {
    // Ignore stale or unavailable local cache.
  }

  return withCurrentPerson([]);
}

function refreshServicePeople() {
  return api.callBusiness("listServicePeople")
    .then((people) => writeServicePeopleCache(people));
}

module.exports = {
  getCurrentServicePerson,
  readServicePeopleCache,
  refreshServicePeople
};
