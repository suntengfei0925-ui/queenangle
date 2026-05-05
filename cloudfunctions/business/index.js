const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const C = {
  WHITELIST: "owner_whitelist",
  MEMBERS: "members",
  SERVICE_CATEGORIES: "service_categories",
  SERVICES: "services",
  TIERS: "recharge_tiers",
  CARD_TYPES: "card_types",
  RECORDS: "records",
  BALANCE_FLOWS: "balance_flows",
  CARD_FLOWS: "card_flows"
};

const PAYMENT_METHODS = ["wechat", "alipay", "cash"];
const OFFLINE_BOOKS = ["本子1", "本子2", "本子3", "本子4"];

function error(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function configOutdatedError() {
  return error("CONFIG_OUTDATED", "配置已更新，请重新选择");
}

function getOpenid() {
  return cloud.getWXContext().OPENID;
}

async function assertOwner() {
  const openid = getOpenid();
  const res = await db.collection(C.WHITELIST).where({ openid }).limit(1).get();
  const owner = res.data && res.data[0];
  if (!owner || owner.enabled === false) {
    throw error("NO_PERMISSION", "当前微信用户不在老板白名单中");
  }
  return openid;
}

function toCent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
}

function yuanToCent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function normalizeText(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function normalizeForHash(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }

  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      const item = value[key];
      acc[key] = item === undefined ? null : normalizeForHash(item);
      return acc;
    }, {});
  }

  return value === undefined ? null : value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeForHash(value));
}

function hashSnapshot(snapshot) {
  const text = stableStringify(snapshot);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isCollectionNotFound(err) {
  const message = String((err && (err.message || err.errMsg)) || "");
  return err && (err.errCode === -502005 || message.includes("DATABASE_COLLECTION_NOT_EXIST"));
}

function isCollectionAlreadyExists(err) {
  const message = String((err && (err.message || err.errMsg)) || "");
  return message.includes("collection exists")
    || message.includes("already exists")
    || message.includes("集合已存在");
}

async function ensureCollection(name) {
  try {
    await db.collection(name).limit(1).get();
    return;
  } catch (err) {
    if (!isCollectionNotFound(err)) throw err;
  }

  try {
    await db.createCollection(name);
  } catch (err) {
    if (!isCollectionAlreadyExists(err)) throw err;
  }
}

function normalizeDiscount(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num >= 10) return null;
  return Math.round(num * 100) / 100;
}

function discountLabel(value) {
  if (!value) return "无折扣";
  return `${value}折`;
}

function daysInMonth(month) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

function normalizeBirthday(monthValue, dayValue) {
  const monthText = normalizeText(monthValue);
  const dayText = normalizeText(dayValue);
  if (!monthText && !dayText) {
    return {
      birthdayMonth: null,
      birthdayDay: null
    };
  }
  if (!monthText || !dayText) {
    throw error("VALIDATION_ERROR", "生日月份和日期需要同时填写");
  }

  const birthdayMonth = Number(monthText);
  const birthdayDay = Number(dayText);
  if (!Number.isInteger(birthdayMonth) || birthdayMonth < 1 || birthdayMonth > 12) {
    throw error("VALIDATION_ERROR", "生日月份不正确");
  }
  if (!Number.isInteger(birthdayDay) || birthdayDay < 1 || birthdayDay > daysInMonth(birthdayMonth)) {
    throw error("VALIDATION_ERROR", "生日日期不正确");
  }

  return {
    birthdayMonth,
    birthdayDay
  };
}

function parseInitialBalanceYuan(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  const num = Number(text);
  if (!Number.isFinite(num)) throw error("VALIDATION_ERROR", "初始余额必须是有效数字");
  if (num < 0) throw error("VALIDATION_ERROR", "初始余额不能小于 0");
  return Math.round(num * 100);
}

function parseInitialBalanceCent(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  const num = Number(text);
  if (!Number.isFinite(num)) throw error("VALIDATION_ERROR", "初始余额必须是有效数字");
  if (num < 0) throw error("VALIDATION_ERROR", "初始余额不能小于 0");
  return Math.round(num);
}

function normalizeInitialDiscount(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const discount = normalizeDiscount(text);
  if (!discount) throw error("VALIDATION_ERROR", "折扣必须在 0 到 10 之间");
  return discount;
}

function normalizeOfflinePage(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const page = Number(text);
  if (!Number.isInteger(page) || page <= 0) {
    throw error("VALIDATION_ERROR", "页码必须是正整数");
  }
  return page;
}

function normalizeMemberImport(value) {
  const input = value || {};
  const initialBalanceCent = input.initialBalanceYuan !== undefined
    ? parseInitialBalanceYuan(input.initialBalanceYuan)
    : parseInitialBalanceCent(input.initialBalanceCent);
  const discount = normalizeInitialDiscount(input.discount);
  const offlineBook = normalizeText(input.offlineBook);
  const offlinePage = normalizeOfflinePage(input.offlinePage);
  const cardItems = normalizeInitialCardItemInputs(input.cardItems);

  if (offlineBook && !OFFLINE_BOOKS.includes(offlineBook)) {
    throw error("VALIDATION_ERROR", "来源本子不正确");
  }
  if ((offlineBook && !offlinePage) || (!offlineBook && offlinePage)) {
    throw error("VALIDATION_ERROR", "来源本子和页码需要同时填写");
  }

  const imported = initialBalanceCent > 0 || !!discount || (!!offlineBook && !!offlinePage) || cardItems.length > 0;
  const importRemark = imported && offlineBook && offlinePage
    ? `老会员补录；来源：${offlineBook}；页码：${offlinePage}`
    : imported ? "老会员补录" : "";
  return {
    imported,
    initialBalanceCent,
    discount,
    discountLabel: discountLabel(discount),
    offlineBook: offlineBook || "",
    offlinePage,
    importRemark,
    cardItems
  };
}

function normalizeInitialCardItemInputs(value) {
  const rawItems = Array.isArray(value) ? value : [];
  const seen = new Set();

  return rawItems.map((item) => {
    const cardTypeId = normalizeText(item && item.cardTypeId);
    const timesText = normalizeText(
      item && item.initialTimes !== undefined ? item.initialTimes : item && item.remainingTimes
    );

    if (!cardTypeId) throw error("VALIDATION_ERROR", "次卡类型不能为空");
    if (seen.has(cardTypeId)) throw error("VALIDATION_ERROR", "同一种次卡不能重复补录");
    seen.add(cardTypeId);
    if (!/^[1-9]\d*$/.test(timesText)) {
      throw error("VALIDATION_ERROR", "补录次卡剩余次数必须是正整数");
    }

    return {
      cardTypeId,
      initialTimes: Number(timesText)
    };
  });
}

async function buildInitialCardItems(cardInputs, transaction) {
  const cardItems = [];
  for (const input of cardInputs || []) {
    const cardType = await getById(transaction.collection(C.CARD_TYPES), input.cardTypeId, "配置已更新，请重新选择");
    if (!cardType || cardType.enabled === false) {
      throw configOutdatedError();
    }

    cardItems.push({
      cardTypeId: cardType._id,
      cardName: cardType.name,
      initialTimes: input.initialTimes
    });
  }
  return cardItems;
}

function initialCardItemsToBalances(cardItems) {
  return (cardItems || []).map((item) => ({
    cardTypeId: item.cardTypeId,
    cardName: item.cardName,
    remainingTimes: Number(item.initialTimes || 0)
  }));
}

function serviceItemLabel(item) {
  const categoryName = normalizeText(item.categoryName);
  const serviceName = normalizeText(item.serviceName || item.name);
  if (categoryName && serviceName) return `${categoryName}-${serviceName}`;
  return serviceName || categoryName || "-";
}

function summarizeServiceItems(items, fallbackName) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return normalizeText(fallbackName);
  const first = serviceItemLabel(list[0]);
  return list.length > 1 ? `${first} 等 ${list.length} 项` : first;
}

function getCollection(context, name) {
  return context ? context.collection(name) : db.collection(name);
}

function compareServicesForSelection(a, b) {
  const aOther = a.isOther || a.name === "其他";
  const bOther = b.isOther || b.name === "其他";
  if (aOther !== bOther) return aOther ? 1 : -1;
  if (!aOther && a.usageCount !== b.usageCount) {
    return Number(b.usageCount || 0) - Number(a.usageCount || 0);
  }
  return normalizeText(a.name).localeCompare(normalizeText(b.name), "zh-Hans");
}

function sortServicesForSelection(services) {
  return [...(services || [])].sort(compareServicesForSelection);
}

function nowDate() {
  return new Date();
}

function parseDate(value) {
  if (!value) return nowDate();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowDate();
  return date;
}

function businessDate(date) {
  const d = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function todayBusinessDate() {
  return businessDate(nowDate());
}

function pickMemberState(member) {
  return {
    balanceCent: toCent(member.balanceCent),
    currentDiscount: member.currentDiscount || null,
    currentDiscountLabel: member.currentDiscountLabel || discountLabel(member.currentDiscount),
    cardBalances: Array.isArray(member.cardBalances) ? member.cardBalances : []
  };
}

function assertPayment(value, fieldName = "支付方式") {
  if (!PAYMENT_METHODS.includes(value)) {
    throw error("VALIDATION_ERROR", `${fieldName}必须是微信、支付宝或现金`);
  }
}

async function getById(collection, id, message) {
  if (!id) throw error("VALIDATION_ERROR", message || "缺少 ID");
  try {
    const res = await collection.doc(id).get();
    return res.data;
  } catch (e) {
    throw error("NOT_FOUND", message || "数据不存在");
  }
}

async function listMembers(event) {
  await assertOwner();
  const keyword = normalizeText(event.keyword).toLowerCase();
  const res = await db.collection(C.MEMBERS).orderBy("updatedAt", "desc").limit(200).get();
  const data = res.data || [];
  if (!keyword) return data;
  return data.filter((member) => {
    const name = normalizeText(member.name).toLowerCase();
    const phone = normalizeText(member.phone);
    return name.includes(keyword) || phone.includes(keyword) || phone.slice(-4) === keyword;
  });
}

async function saveMember(event) {
  const openid = await assertOwner();
  const id = event.id;
  const name = normalizeText(event.name);
  const phone = normalizeText(event.phone);
  const remark = normalizeText(event.remark);
  const birthday = normalizeBirthday(event.birthdayMonth, event.birthdayDay);
  const importInfo = normalizeMemberImport(event.importInfo);

  if (!name) throw error("VALIDATION_ERROR", "会员姓名不能为空");
  if (!phone) throw error("VALIDATION_ERROR", "会员手机号不能为空");

  const payload = {
    name,
    phone,
    remark,
    birthdayMonth: birthday.birthdayMonth,
    birthdayDay: birthday.birthdayDay,
    updatedAt: db.serverDate()
  };

  return db.runTransaction(async (transaction) => {
    const memberCollection = transaction.collection(C.MEMBERS);
    const samePhone = await memberCollection.where({ phone }).limit(10).get();
    const duplicated = (samePhone.data || []).some((item) => item._id !== id);
    if (duplicated) throw error("DUPLICATE_PHONE", "该手机号已存在会员");

    if (id) {
      await memberCollection.doc(id).update({ data: payload });
      return { id };
    }

    const initialCardItems = importInfo.imported
      ? await buildInitialCardItems(importInfo.cardItems, transaction)
      : [];
    const initialCardBalances = initialCardItemsToBalances(initialCardItems);
    const initialState = {
      balanceCent: importInfo.imported ? importInfo.initialBalanceCent : 0,
      currentDiscount: importInfo.imported ? importInfo.discount : null,
      currentDiscountLabel: importInfo.imported ? importInfo.discountLabel : "无折扣",
      cardBalances: initialCardBalances
    };
    const memberData = {
      ...payload,
      ...initialState,
      memberSource: importInfo.imported ? "imported" : "normal",
      offlineBook: importInfo.imported ? importInfo.offlineBook : "",
      offlinePage: importInfo.imported ? importInfo.offlinePage : null,
      importRemark: importInfo.imported ? importInfo.importRemark : "",
      createdAt: db.serverDate()
    };

    if (importInfo.imported) {
      memberData.importedAt = db.serverDate();
      memberData.importedByOpenid = openid;
    }

    const addRes = await memberCollection.add({ data: memberData });
    if (!importInfo.imported) return { id: addRes._id };

    const occurredAt = nowDate();
    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "member_initial_balance",
        status: "active",
        memberId: addRes._id,
        memberName: name,
        amountCent: importInfo.initialBalanceCent,
        actualReceivedCent: 0,
        paymentMethod: "",
        discount: importInfo.discount,
        discountLabel: importInfo.discountLabel,
        offlineBook: importInfo.offlineBook,
        offlinePage: importInfo.offlinePage,
        cardItems: initialCardItems,
        remark: importInfo.importRemark,
        memberBefore: null,
        memberAfter: initialState,
        occurredAt,
        businessDate: businessDate(occurredAt),
        createdByOpenid: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await transaction.collection(C.BALANCE_FLOWS).add({
      data: {
        memberId: addRes._id,
        memberName: name,
        type: "initial_balance",
        sourceRecordId: recordRes._id,
        amountCent: importInfo.initialBalanceCent,
        balanceAfterCent: importInfo.initialBalanceCent,
        remark: importInfo.importRemark,
        createdAt: db.serverDate()
      }
    });

    for (const item of initialCardItems) {
      await transaction.collection(C.CARD_FLOWS).add({
        data: {
          memberId: addRes._id,
          memberName: name,
          type: "initial_card",
          sourceRecordId: recordRes._id,
          cardTypeId: item.cardTypeId,
          cardName: item.cardName,
          deltaTimes: item.initialTimes,
          remainingTimes: item.initialTimes,
          remark: importInfo.importRemark,
          createdAt: db.serverDate()
        }
      });
    }

    return { id: addRes._id };
  });
}

async function getMemberDetail(event) {
  await assertOwner();
  const member = await getById(db.collection(C.MEMBERS), event.memberId, "会员不存在");
  const recordRes = await db.collection(C.RECORDS)
    .where({ memberId: event.memberId })
    .orderBy("createdAt", "desc")
    .limit(80)
    .get();
  const balanceRes = await db.collection(C.BALANCE_FLOWS)
    .where({ memberId: event.memberId })
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  const cardRes = await db.collection(C.CARD_FLOWS)
    .where({ memberId: event.memberId })
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return {
    member,
    records: recordRes.data || [],
    balanceFlows: balanceRes.data || [],
    cardFlows: cardRes.data || []
  };
}

async function ensureOtherService(category, context) {
  const serviceCollection = getCollection(context, C.SERVICES);
  const res = await serviceCollection
    .where({
      categoryId: category._id,
      name: "其他"
    })
    .limit(1)
    .get();

  if ((res.data || []).length > 0) {
    const existing = res.data[0];
    if (!existing.isOther || existing.enabled === false || existing.categoryName !== category.name) {
      await serviceCollection.doc(existing._id).update({
        data: {
          categoryName: category.name,
          isOther: true,
          enabled: true,
          updatedAt: db.serverDate()
        }
      });
    }
    return existing;
  }

  const addRes = await serviceCollection.add({
    data: {
      categoryId: category._id,
      categoryName: category.name,
      name: "其他",
      isOther: true,
      enabled: true,
      remark: "",
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return { _id: addRes._id };
}

async function ensureDefaultServiceCategories() {
  await ensureCollection(C.SERVICE_CATEGORIES);
  await ensureCollection(C.SERVICES);

  const defaults = ["美甲", "美睫"];
  for (const name of defaults) {
    const res = await db.collection(C.SERVICE_CATEGORIES)
      .where({ name })
      .limit(1)
      .get();
    const category = (res.data || [])[0];

    if (category) {
      if (category.enabled === false) {
        await db.collection(C.SERVICE_CATEGORIES).doc(category._id).update({
          data: {
            enabled: true,
            updatedAt: db.serverDate()
          }
        });
      }
      await ensureOtherService({ _id: category._id, name });
      continue;
    }

    const addRes = await db.collection(C.SERVICE_CATEGORIES).add({
      data: {
        name,
        enabled: true,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    await ensureOtherService({ _id: addRes._id, name });
  }
}

async function listServiceCategories(event = {}) {
  await assertOwner();
  await ensureDefaultServiceCategories();
  const onlyEnabled = !!event.onlyEnabled;
  const collection = db.collection(C.SERVICE_CATEGORIES);
  const query = onlyEnabled ? collection.where({ enabled: true }) : collection;
  const res = await query.orderBy("createdAt", "asc").limit(100).get();
  const categories = res.data || [];
  for (const category of categories) {
    await ensureOtherService(category);
  }
  return categories;
}

async function saveServiceCategory(event) {
  await assertOwner();
  const name = normalizeText(event.name);
  const enabled = event.enabled !== false;
  if (!name) throw error("VALIDATION_ERROR", "分类名称不能为空");

  const duplicateRes = await db.collection(C.SERVICE_CATEGORIES)
    .where({ name })
    .limit(10)
    .get();
  const duplicated = (duplicateRes.data || []).some((item) => item._id !== event.id);
  if (duplicated) throw error("DUPLICATE_NAME", "服务分类名称已存在");

  const payload = {
    name,
    enabled,
    updatedAt: db.serverDate()
  };

  if (event.id) {
    await db.collection(C.SERVICE_CATEGORIES).doc(event.id).update({ data: payload });
    await db.collection(C.SERVICES).where({ categoryId: event.id }).update({
      data: {
        categoryName: name,
        updatedAt: db.serverDate()
      }
    });
    await ensureOtherService({ _id: event.id, name });
    return { id: event.id };
  }

  const res = await db.collection(C.SERVICE_CATEGORIES).add({
    data: {
      ...payload,
      createdAt: db.serverDate()
    }
  });
  await ensureOtherService({ _id: res._id, name });
  return { id: res._id };
}

async function toggleServiceCategory(event) {
  await assertOwner();
  const category = await getById(db.collection(C.SERVICE_CATEGORIES), event.id, "服务分类不存在");
  await db.collection(C.SERVICE_CATEGORIES).doc(event.id).update({
    data: {
      enabled: !!event.enabled,
      updatedAt: db.serverDate()
    }
  });
  await ensureOtherService(category);
  return { id: event.id };
}

async function getServiceUsageCounts() {
  const res = await db.collection(C.RECORDS)
    .where({
      status: "active"
    })
    .limit(1000)
    .get();
  const counts = {};
  (res.data || []).forEach((record) => {
    if (!["guest_consumption", "member_consumption"].includes(record.type)) return;
    const items = Array.isArray(record.serviceItems) && record.serviceItems.length
      ? record.serviceItems
      : record.serviceId ? [{ serviceId: record.serviceId }] : [];
    items.forEach((item) => {
      if (!item.serviceId) return;
      counts[item.serviceId] = (counts[item.serviceId] || 0) + 1;
    });
  });
  return counts;
}

async function listServices(event = {}) {
  await assertOwner();
  await ensureDefaultServiceCategories();
  const onlyEnabled = !!event.onlyEnabled;
  const categories = await listServiceCategories({ onlyEnabled: false });
  const categoryMap = {};
  categories.forEach((category) => {
    categoryMap[category._id] = category;
  });

  let services = [];
  if (event.categoryId) {
    const res = await db.collection(C.SERVICES)
      .where({ categoryId: event.categoryId })
      .limit(200)
      .get();
    services = res.data || [];
  } else {
    const res = await db.collection(C.SERVICES).limit(500).get();
    services = res.data || [];
  }

  const usageCounts = await getServiceUsageCounts();
  services = services
    .filter((service) => service.categoryId)
    .filter((service) => !onlyEnabled || (service.enabled !== false && categoryMap[service.categoryId] && categoryMap[service.categoryId].enabled !== false))
    .map((service) => ({
      ...service,
      categoryName: service.categoryName || (categoryMap[service.categoryId] && categoryMap[service.categoryId].name) || "",
      categoryEnabled: categoryMap[service.categoryId] ? categoryMap[service.categoryId].enabled !== false : false,
      isOther: service.isOther || service.name === "其他",
      usageCount: usageCounts[service._id] || 0
    }));

  return services.sort((a, b) => {
    const categoryDiff = normalizeText(a.categoryName).localeCompare(normalizeText(b.categoryName), "zh-Hans");
    if (categoryDiff !== 0) return categoryDiff;
    return compareServicesForSelection(a, b);
  });
}

async function listServiceCatalog(event = {}) {
  await assertOwner();
  await ensureDefaultServiceCategories();
  const onlyEnabled = !!event.onlyEnabled;
  const categories = await listServiceCategories({ onlyEnabled });
  const services = await listServices({ onlyEnabled });

  return categories.map((category) => ({
    ...category,
    services: sortServicesForSelection(services.filter((service) => service.categoryId === category._id))
  }));
}

async function saveService(event) {
  await assertOwner();
  await ensureDefaultServiceCategories();
  const categoryId = event.categoryId;
  const category = await getById(db.collection(C.SERVICE_CATEGORIES), categoryId, "请选择服务分类");
  const name = normalizeText(event.name);
  const remark = normalizeText(event.remark);
  const enabled = event.enabled !== false;

  if (!name) throw error("VALIDATION_ERROR", "项目名称不能为空");

  const oldService = event.id
    ? await getById(db.collection(C.SERVICES), event.id, "服务项目不存在")
    : null;
  if (oldService && (oldService.isOther || oldService.name === "其他") && name !== "其他") {
    throw error("VALIDATION_ERROR", "其他项目不能改名");
  }
  if (oldService && (oldService.isOther || oldService.name === "其他") && enabled === false) {
    throw error("VALIDATION_ERROR", "其他项目不能停用");
  }

  const duplicateRes = await db.collection(C.SERVICES)
    .where({ categoryId, name })
    .limit(10)
    .get();
  const duplicated = (duplicateRes.data || []).some((item) => item._id !== event.id);
  if (duplicated) throw error("DUPLICATE_NAME", "同一分类下项目名称已存在");

  const payload = {
    categoryId,
    categoryName: category.name,
    name,
    remark,
    enabled: oldService && (oldService.isOther || oldService.name === "其他") ? true : enabled,
    isOther: oldService ? !!(oldService.isOther || oldService.name === "其他") : name === "其他",
    updatedAt: db.serverDate()
  };

  if (event.id) {
    await db.collection(C.SERVICES).doc(event.id).update({ data: payload });
    return { id: event.id };
  }

  const res = await db.collection(C.SERVICES).add({
    data: {
      ...payload,
      createdAt: db.serverDate()
    }
  });
  return { id: res._id };
}

async function toggleService(event) {
  await assertOwner();
  const service = await getById(db.collection(C.SERVICES), event.id, "服务项目不存在");
  if ((service.isOther || service.name === "其他") && event.enabled === false) {
    throw error("VALIDATION_ERROR", "其他项目不能停用");
  }
  await db.collection(C.SERVICES).doc(event.id).update({
    data: {
      enabled: !!event.enabled,
      updatedAt: db.serverDate()
    }
  });
  return { id: event.id };
}

function normalizeServiceItemInputs(event) {
  const items = Array.isArray(event.serviceItems) ? event.serviceItems : [];
  if (items.length > 0) return items;
  if (!event.serviceId) return [];
  return [{
    serviceId: event.serviceId,
    originalAmountCent: event.originalAmountCent,
    originalAmountYuan: event.originalAmountYuan
  }];
}

async function buildServiceItemSnapshots(event, context) {
  const inputs = normalizeServiceItemInputs(event);
  if (inputs.length === 0) throw error("VALIDATION_ERROR", "请选择至少一个服务项目");

  const serviceCollection = getCollection(context, C.SERVICES);
  const categoryCollection = getCollection(context, C.SERVICE_CATEGORIES);
  const snapshots = [];

  for (const input of inputs) {
    if (!input.serviceId) throw error("VALIDATION_ERROR", "服务项目不能为空");
    if (input.originalAmountCent === undefined && input.originalAmountYuan === undefined) {
      throw error("VALIDATION_ERROR", "单项原价不能为空");
    }

    const originalAmountCent = input.originalAmountCent !== undefined
      ? toCent(input.originalAmountCent)
      : yuanToCent(input.originalAmountYuan);
    if (originalAmountCent < 0) throw error("VALIDATION_ERROR", "单项原价不能小于 0");

    const service = await getById(serviceCollection, input.serviceId, "配置已更新，请重新选择");
    if (service.enabled === false) throw configOutdatedError();
    const category = await getById(categoryCollection, service.categoryId, "配置已更新，请重新选择");
    if (category.enabled === false) throw configOutdatedError();

    snapshots.push({
      categoryId: category._id,
      categoryName: category.name,
      serviceId: service._id,
      serviceName: service.name,
      originalAmountCent
    });
  }

  return snapshots;
}

function sumServiceItems(items) {
  return (items || []).reduce((sum, item) => sum + toCent(item.originalAmountCent), 0);
}

async function buildCheckoutServiceItemSnapshots(event, context) {
  const inputs = normalizeServiceItemInputs(event);
  if (inputs.length === 0) return [];
  return buildServiceItemSnapshots(event, context);
}

function normalizeCheckoutCardInputs(event) {
  const rawItems = Array.isArray(event.cardItems) ? event.cardItems : [];
  const rawIds = Array.isArray(event.cardTypeIds)
    ? event.cardTypeIds.map((cardTypeId) => ({ cardTypeId }))
    : [];
  const inputs = rawItems.length > 0 ? rawItems : rawIds;
  const seen = {};

  return inputs.map((item) => {
    const cardTypeId = normalizeText(item && item.cardTypeId);
    if (!cardTypeId) throw error("VALIDATION_ERROR", "次卡不能为空");
    if (seen[cardTypeId]) throw error("VALIDATION_ERROR", "次卡不能重复选择");
    seen[cardTypeId] = true;
    return { cardTypeId };
  });
}

function applyCheckoutCardUses(cardBalances, cardInputs) {
  const list = Array.isArray(cardBalances) ? cardBalances.map((item) => ({ ...item })) : [];
  const cardItems = [];

  cardInputs.forEach((input) => {
    const index = list.findIndex((item) => item.cardTypeId === input.cardTypeId);
    if (index < 0) throw error("CARD_NOT_FOUND", "会员没有该次卡");

    const card = list[index];
    const remainingTimes = Number(card.remainingTimes || 0);
    if (!Number.isFinite(remainingTimes) || remainingTimes <= 0) {
      throw error("CARD_NOT_ENOUGH", "次卡剩余次数不足");
    }

    const remainingTimesAfter = remainingTimes - 1;
    list[index] = {
      ...card,
      remainingTimes: remainingTimesAfter
    };
    cardItems.push({
      cardTypeId: card.cardTypeId,
      cardName: card.cardName,
      useTimes: 1,
      remainingTimesBefore: remainingTimes,
      remainingTimesAfter
    });
  });

  return {
    cardBalances: list,
    cardItems
  };
}

async function listRechargeTiers(event = {}) {
  await assertOwner();
  const res = await db.collection(C.TIERS).orderBy("amountCent", "asc").limit(100).get();
  const tiers = res.data || [];
  return event.onlyEnabled ? tiers.filter((item) => item.enabled !== false) : tiers;
}

async function saveRechargeTier(event) {
  await assertOwner();
  const amountCent = event.amountCent !== undefined ? toCent(event.amountCent) : yuanToCent(event.amountYuan);
  const discount = normalizeDiscount(event.discount);
  if (amountCent <= 0) throw error("VALIDATION_ERROR", "充值金额必须大于 0");
  if (!discount) throw error("VALIDATION_ERROR", "折扣必须在 0 到 10 之间");

  const payload = {
    amountCent,
    discount,
    discountLabel: discountLabel(discount),
    enabled: event.enabled !== false,
    updatedAt: db.serverDate()
  };

  if (event.id) {
    await db.collection(C.TIERS).doc(event.id).update({ data: payload });
    return { id: event.id };
  }

  const res = await db.collection(C.TIERS).add({
    data: {
      ...payload,
      createdAt: db.serverDate()
    }
  });
  return { id: res._id };
}

async function listCardTypes(event) {
  await assertOwner();
  const onlyEnabled = !!event.onlyEnabled;
  const res = await db.collection(C.CARD_TYPES).orderBy("updatedAt", "desc").limit(100).get();
  const cardTypes = res.data || [];
  return onlyEnabled ? cardTypes.filter((item) => item.enabled !== false) : cardTypes;
}

async function getBasicConfig() {
  await assertOwner();
  const [serviceCatalog, cardTypes, rechargeTiers] = await Promise.all([
    listServiceCatalog({ onlyEnabled: true }),
    listCardTypes({ onlyEnabled: true }),
    listRechargeTiers({ onlyEnabled: true })
  ]);
  const snapshot = {
    serviceCatalog,
    cardTypes,
    rechargeTiers
  };

  return {
    ...snapshot,
    version: hashSnapshot(snapshot),
    updatedAt: nowDate().toISOString()
  };
}

async function saveCardType(event) {
  await assertOwner();
  const name = normalizeText(event.name);
  const totalTimes = Number(event.totalTimes || 0);
  const priceCent = event.priceCent !== undefined ? toCent(event.priceCent) : yuanToCent(event.priceYuan);
  const remark = normalizeText(event.remark);

  if (!name) throw error("VALIDATION_ERROR", "次卡名称不能为空");
  if (!Number.isInteger(totalTimes) || totalTimes <= 0) throw error("VALIDATION_ERROR", "默认次数必须大于 0");
  if (priceCent < 0) throw error("VALIDATION_ERROR", "参考价格不能小于 0");

  const payload = {
    name,
    totalTimes,
    priceCent,
    remark,
    enabled: event.enabled !== false,
    updatedAt: db.serverDate()
  };

  if (event.id) {
    await db.collection(C.CARD_TYPES).doc(event.id).update({ data: payload });
    return { id: event.id };
  }

  const res = await db.collection(C.CARD_TYPES).add({
    data: {
      ...payload,
      createdAt: db.serverDate()
    }
  });
  return { id: res._id };
}

async function toggleCardType(event) {
  await assertOwner();
  await db.collection(C.CARD_TYPES).doc(event.id).update({
    data: {
      enabled: !!event.enabled,
      updatedAt: db.serverDate()
    }
  });
  return { id: event.id };
}

async function createGuestConsumption(event) {
  const openid = await assertOwner();
  assertPayment(event.paymentMethod);

  const occurredAt = parseDate(event.occurredAt);
  const serviceItems = await buildServiceItemSnapshots(event);
  const originalAmountCent = sumServiceItems(serviceItems);
  const firstItem = serviceItems[0];
  const serviceName = summarizeServiceItems(serviceItems);
  const actualReceivedCent = event.actualReceivedCent !== undefined ? toCent(event.actualReceivedCent) : yuanToCent(event.actualReceivedYuan);
  if (actualReceivedCent < 0) throw error("VALIDATION_ERROR", "实收金额不能小于 0");

  const record = {
    type: "guest_consumption",
    status: "active",
    serviceId: firstItem.serviceId,
    serviceName,
    serviceItems,
    originalAmountCent,
    consumptionAmountCent: actualReceivedCent,
    actualReceivedCent,
    balancePayCent: 0,
    paymentMethod: event.paymentMethod,
    remark: normalizeText(event.remark),
    occurredAt,
    businessDate: businessDate(occurredAt),
    createdByOpenid: openid,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  const res = await db.collection(C.RECORDS).add({ data: record });
  return { recordId: res._id };
}

async function createMemberRecharge(event) {
  const openid = await assertOwner();
  assertPayment(event.paymentMethod);
  const occurredAt = parseDate(event.occurredAt);
  const memberId = event.memberId;
  const tierId = event.tierId;

  return db.runTransaction(async (transaction) => {
    const member = await getById(transaction.collection(C.MEMBERS), memberId, "会员不存在");
    const tier = await getById(transaction.collection(C.TIERS), tierId, "配置已更新，请重新选择");
    if (!tier || tier.enabled === false) {
      throw configOutdatedError();
    }

    const before = pickMemberState(member);
    const amountCent = toCent(tier.amountCent);
    const after = {
      ...before,
      balanceCent: before.balanceCent + amountCent,
      currentDiscount: tier.discount,
      currentDiscountLabel: tier.discountLabel || discountLabel(tier.discount)
    };

    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "member_recharge",
        status: "active",
        memberId,
        memberName: member.name,
        amountCent,
        actualReceivedCent: amountCent,
        paymentMethod: event.paymentMethod,
        tierId,
        discount: tier.discount,
        discountLabel: tier.discountLabel,
        memberBefore: before,
        memberAfter: after,
        remark: normalizeText(event.remark),
        occurredAt,
        businessDate: businessDate(occurredAt),
        createdByOpenid: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await transaction.collection(C.MEMBERS).doc(memberId).update({
      data: {
        balanceCent: after.balanceCent,
        currentDiscount: after.currentDiscount,
        currentDiscountLabel: after.currentDiscountLabel,
        updatedAt: db.serverDate()
      }
    });

    await transaction.collection(C.BALANCE_FLOWS).add({
      data: {
        memberId,
        memberName: member.name,
        type: "recharge",
        sourceRecordId: recordRes._id,
        amountCent,
        balanceAfterCent: after.balanceCent,
        remark: normalizeText(event.remark),
        createdAt: db.serverDate()
      }
    });

    return { recordId: recordRes._id };
  });
}

function buildCheckoutPaymentMethod(originalAmountCent, balancePayCent, extraPayCent, selectedPayment) {
  if (originalAmountCent <= 0) return "";
  if (balancePayCent > 0 && extraPayCent > 0) return "mixed";
  if (balancePayCent > 0) return "member_balance";
  return selectedPayment || "";
}

function buildCheckoutSignatureSnapshot(input) {
  return {
    version: 1,
    member: {
      memberId: input.memberId || "",
      memberName: input.member.name || "",
      phone: input.member.phone || ""
    },
    serviceItems: input.serviceItems,
    cardItems: input.cardItems,
    balanceBeforeCent: input.before.balanceCent,
    discountApplied: input.discount || null,
    discountLabelApplied: input.originalAmountCent > 0 ? discountLabel(input.discount) : "",
    originalAmountCent: input.originalAmountCent,
    consumptionAmountCent: input.payableCent,
    balancePayCent: input.balancePayCent,
    extraPayCent: input.extraPayCent,
    extraPaymentMethod: input.extraPaymentMethod,
    paymentMethod: input.paymentMethod,
    balanceAfterCent: input.after.balanceCent,
    remark: normalizeText(input.remark)
  };
}

function normalizeCheckoutSignature(event, expectedSnapshot) {
  const signatureFileId = normalizeText(event.signatureFileId);
  const signatureSignedAtInput = normalizeText(event.signatureSignedAt);
  const signatureSnapshot = event.signatureSnapshot;
  const signatureSnapshotHash = normalizeText(event.signatureSnapshotHash);

  if (!signatureFileId || !signatureSignedAtInput || !signatureSnapshot || !signatureSnapshotHash) {
    throw error("SIGNATURE_REQUIRED", "请先完成客户确认和签字");
  }

  const signatureSignedAt = new Date(signatureSignedAtInput);
  if (Number.isNaN(signatureSignedAt.getTime())) {
    throw error("VALIDATION_ERROR", "签字时间不正确");
  }

  const clientHash = hashSnapshot(signatureSnapshot);
  const expectedHash = hashSnapshot(expectedSnapshot);
  if (clientHash !== signatureSnapshotHash || expectedHash !== signatureSnapshotHash) {
    throw error("SIGNATURE_MISMATCH", "签名已失效，请重新确认并签字");
  }

  return {
    signatureFileId,
    signatureSignedAt,
    signatureSnapshot: expectedSnapshot,
    signatureSnapshotHash: expectedHash
  };
}

async function createMemberCheckout(event) {
  const openid = await assertOwner();
  const memberId = event.memberId;
  const occurredAt = parseDate(event.occurredAt);

  return db.runTransaction(async (transaction) => {
    const member = await getById(transaction.collection(C.MEMBERS), memberId, "会员不存在");
    const serviceItems = await buildCheckoutServiceItemSnapshots(event, transaction);
    const cardInputs = normalizeCheckoutCardInputs(event);
    if (serviceItems.length === 0 && cardInputs.length === 0) {
      throw error("VALIDATION_ERROR", "请选择次卡或服务项目");
    }

    const originalAmountCent = sumServiceItems(serviceItems);
    const firstItem = serviceItems[0] || {};
    const serviceName = summarizeServiceItems(serviceItems);
    const before = pickMemberState(member);
    const cardResult = applyCheckoutCardUses(before.cardBalances, cardInputs);

    let payableCent = originalAmountCent;
    const hasBalance = before.balanceCent > 0;
    const discount = originalAmountCent > 0 && hasBalance
      ? Number(before.currentDiscount || 0) || null
      : null;

    if (hasBalance && discount) {
      payableCent = Math.round(originalAmountCent * discount / 10);
    }

    const balancePayCent = Math.min(before.balanceCent, payableCent);
    const extraPayCent = payableCent - balancePayCent;
    const extraPaymentMethod = extraPayCent > 0 ? (event.extraPaymentMethod || event.paymentMethod) : "";

    if (extraPayCent > 0) {
      assertPayment(extraPaymentMethod, "补差价支付方式");
    }

    const balanceAfterCent = before.balanceCent - balancePayCent;
    const shouldClearDiscount = originalAmountCent > 0 && balanceAfterCent <= 0;
    const after = {
      ...before,
      balanceCent: balanceAfterCent,
      currentDiscount: shouldClearDiscount ? null : before.currentDiscount,
      currentDiscountLabel: shouldClearDiscount ? "无折扣" : before.currentDiscountLabel,
      cardBalances: cardResult.cardBalances
    };

    const paymentMethod = buildCheckoutPaymentMethod(
      originalAmountCent,
      balancePayCent,
      extraPayCent,
      extraPaymentMethod
    );
    const signaturePayload = normalizeCheckoutSignature(event, buildCheckoutSignatureSnapshot({
      memberId,
      member,
      serviceItems,
      cardItems: cardResult.cardItems,
      before,
      after,
      originalAmountCent,
      payableCent,
      balancePayCent,
      extraPayCent,
      extraPaymentMethod,
      paymentMethod,
      discount,
      remark: event.remark
    }));

    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "member_checkout",
        status: "active",
        memberId,
        memberName: member.name,
        serviceId: firstItem.serviceId || "",
        serviceName,
        serviceItems,
        cardItems: cardResult.cardItems,
        originalAmountCent,
        consumptionAmountCent: payableCent,
        actualReceivedCent: extraPayCent,
        balancePayCent,
        extraPayCent,
        paymentMethod,
        extraPaymentMethod,
        discountApplied: discount,
        discountLabelApplied: originalAmountCent > 0 ? discountLabel(discount) : "",
        memberBefore: before,
        memberAfter: after,
        ...signaturePayload,
        remark: normalizeText(event.remark),
        occurredAt,
        businessDate: businessDate(occurredAt),
        createdByOpenid: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await transaction.collection(C.MEMBERS).doc(memberId).update({
      data: {
        balanceCent: after.balanceCent,
        currentDiscount: after.currentDiscount,
        currentDiscountLabel: after.currentDiscountLabel,
        cardBalances: after.cardBalances,
        updatedAt: db.serverDate()
      }
    });

    if (balancePayCent > 0) {
      await transaction.collection(C.BALANCE_FLOWS).add({
        data: {
          memberId,
          memberName: member.name,
          type: "consume",
          sourceRecordId: recordRes._id,
          amountCent: -balancePayCent,
          balanceAfterCent: after.balanceCent,
          remark: normalizeText(event.remark),
          createdAt: db.serverDate()
        }
      });
    }

    for (const cardItem of cardResult.cardItems) {
      await transaction.collection(C.CARD_FLOWS).add({
        data: {
          memberId,
          memberName: member.name,
          type: "use",
          sourceRecordId: recordRes._id,
          cardTypeId: cardItem.cardTypeId,
          cardName: cardItem.cardName,
          deltaTimes: -cardItem.useTimes,
          remainingTimes: cardItem.remainingTimesAfter,
          remark: normalizeText(event.remark),
          createdAt: db.serverDate()
        }
      });
    }

    return { recordId: recordRes._id };
  });
}

async function createMemberConsumption(event) {
  return createMemberCheckout(event);
}

function updateCardBalances(cardBalances, cardType, deltaTimes) {
  const list = Array.isArray(cardBalances) ? [...cardBalances] : [];
  const index = list.findIndex((item) => item.cardTypeId === cardType._id);
  if (index >= 0) {
    const nextTimes = Number(list[index].remainingTimes || 0) + deltaTimes;
    if (nextTimes < 0) throw error("CARD_NOT_ENOUGH", "次卡剩余次数不足");
    list[index] = {
      ...list[index],
      cardName: cardType.name,
      remainingTimes: nextTimes
    };
    return list;
  }

  if (deltaTimes < 0) throw error("CARD_NOT_FOUND", "会员没有该次卡");
  list.push({
    cardTypeId: cardType._id,
    cardName: cardType.name,
    remainingTimes: deltaTimes
  });
  return list;
}

function normalizeCardPurchaseIds(event) {
  const rawItems = Array.isArray(event.cardItems) ? event.cardItems : [];
  const rawIds = rawItems.length > 0
    ? rawItems.map((item) => item && item.cardTypeId)
    : Array.isArray(event.cardTypeIds) ? event.cardTypeIds : [];
  const ids = rawIds.map(normalizeText).filter(Boolean);

  if (ids.length === 0) {
    throw error("VALIDATION_ERROR", "请选择充值档位或次卡");
  }

  const seen = new Set();
  ids.forEach((id) => {
    if (seen.has(id)) {
      throw error("VALIDATION_ERROR", "同一种次卡本次只能购买一次");
    }
    seen.add(id);
  });

  return ids;
}

async function buildCardPurchaseItems(event, transaction) {
  const cardTypeIds = normalizeCardPurchaseIds(event);
  const items = [];

  for (const cardTypeId of cardTypeIds) {
    const cardType = await getById(transaction.collection(C.CARD_TYPES), cardTypeId, "配置已更新，请重新选择");
    if (!cardType || cardType.enabled === false) {
      throw configOutdatedError();
    }

    const purchaseTimes = Number(cardType.totalTimes || 0);
    const priceCent = toCent(cardType.priceCent);
    if (!Number.isInteger(purchaseTimes) || purchaseTimes <= 0) {
      throw configOutdatedError();
    }
    if (priceCent < 0) {
      throw configOutdatedError();
    }

    items.push({
      cardTypeId: cardType._id,
      cardName: cardType.name,
      purchaseTimes,
      priceCent
    });
  }

  return items;
}

function applyCardPurchaseItems(cardBalances, cardItems) {
  let nextBalances = Array.isArray(cardBalances) ? [...cardBalances] : [];
  const flowItems = [];

  cardItems.forEach((item) => {
    nextBalances = updateCardBalances(nextBalances, {
      _id: item.cardTypeId,
      name: item.cardName
    }, item.purchaseTimes);
    const balance = nextBalances.find((card) => card.cardTypeId === item.cardTypeId);
    flowItems.push({
      ...item,
      remainingTimesAfter: balance ? Number(balance.remainingTimes || 0) : 0
    });
  });

  return {
    cardBalances: nextBalances,
    flowItems
  };
}

function getTimeValue(value) {
  const date = new Date(value || 0);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function applyCardDelta(state, cardTypeId, cardName, deltaTimes) {
  const list = Array.isArray(state.cardBalances) ? [...state.cardBalances] : [];
  const index = list.findIndex((item) => item.cardTypeId === cardTypeId);
  const delta = Number(deltaTimes || 0);

  if (!cardTypeId || !Number.isFinite(delta) || delta === 0) {
    state.cardBalances = list;
    return;
  }

  if (index >= 0) {
    const nextTimes = Number(list[index].remainingTimes || 0) + delta;
    if (nextTimes < 0) throw error("CARD_NOT_ENOUGH", "次卡剩余次数不足，不能作废");
    list[index] = {
      ...list[index],
      cardName,
      remainingTimes: nextTimes
    };
  } else if (delta > 0) {
    list.push({
      cardTypeId,
      cardName,
      remainingTimes: delta
    });
  } else {
    throw error("CARD_NOT_ENOUGH", "次卡剩余次数不足，不能作废");
  }

  state.cardBalances = list;
}

function replayMemberState(records, ignoredRecordId) {
  const state = {
    balanceCent: 0,
    currentDiscount: null,
    currentDiscountLabel: "无折扣",
    cardBalances: []
  };

  const sorted = (records || [])
    .filter((item) => item._id !== ignoredRecordId && item.status === "active")
    .sort((a, b) => {
      const timeDiff = getTimeValue(a.occurredAt || a.createdAt) - getTimeValue(b.occurredAt || b.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return getTimeValue(a.createdAt) - getTimeValue(b.createdAt);
    });

  sorted.forEach((record) => {
    if (record.type === "member_initial_balance") {
      state.balanceCent = toCent(record.amountCent);
      state.currentDiscount = record.discount || null;
      state.currentDiscountLabel = record.discountLabel || discountLabel(record.discount);
      (record.cardItems || []).forEach((item) => {
        applyCardDelta(state, item.cardTypeId, item.cardName, Number(item.initialTimes || 0));
      });
    }

    if (record.type === "member_recharge") {
      state.balanceCent += toCent(record.amountCent);
      state.currentDiscount = record.discount || null;
      state.currentDiscountLabel = record.discountLabel || discountLabel(record.discount);
    }

    if ((record.type === "member_consumption" || record.type === "member_checkout") && toCent(record.originalAmountCent) > 0) {
      const originalAmountCent = toCent(record.originalAmountCent);
      const payableCent = state.balanceCent > 0 && state.currentDiscount
        ? Math.round(originalAmountCent * state.currentDiscount / 10)
        : originalAmountCent;
      const balancePayCent = Math.min(state.balanceCent, payableCent);
      state.balanceCent -= balancePayCent;
      if (state.balanceCent <= 0) {
        state.balanceCent = 0;
        state.currentDiscount = null;
        state.currentDiscountLabel = "无折扣";
      }
    }

    if (record.type === "member_checkout") {
      (record.cardItems || []).forEach((item) => {
        applyCardDelta(state, item.cardTypeId, item.cardName, -Number(item.useTimes || 1));
      });
    }

    if (record.type === "card_purchase") {
      (record.cardItems || []).forEach((item) => {
        applyCardDelta(state, item.cardTypeId, item.cardName, Number(item.purchaseTimes || 0));
      });
    }

  });

  return state;
}

async function createCardPurchase(event) {
  const openid = await assertOwner();
  assertPayment(event.paymentMethod);
  const occurredAt = parseDate(event.occurredAt);

  return db.runTransaction(async (transaction) => {
    const member = await getById(transaction.collection(C.MEMBERS), event.memberId, "会员不存在");
    const cardItems = await buildCardPurchaseItems(event, transaction);
    const before = pickMemberState(member);
    const actualReceivedCent = cardItems.reduce((sum, item) => sum + toCent(item.priceCent), 0);
    const cardResult = applyCardPurchaseItems(before.cardBalances, cardItems);

    const after = {
      ...before,
      cardBalances: cardResult.cardBalances
    };

    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "card_purchase",
        status: "active",
        memberId: event.memberId,
        memberName: member.name,
        cardItems,
        actualReceivedCent,
        paymentMethod: event.paymentMethod,
        memberBefore: before,
        memberAfter: after,
        remark: normalizeText(event.remark),
        occurredAt,
        businessDate: businessDate(occurredAt),
        createdByOpenid: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await transaction.collection(C.MEMBERS).doc(event.memberId).update({
      data: {
        cardBalances: after.cardBalances,
        updatedAt: db.serverDate()
      }
    });

    for (const item of cardResult.flowItems) {
      await transaction.collection(C.CARD_FLOWS).add({
        data: {
          memberId: event.memberId,
          memberName: member.name,
          type: "purchase",
          sourceRecordId: recordRes._id,
          cardTypeId: item.cardTypeId,
          cardName: item.cardName,
          deltaTimes: item.purchaseTimes,
          remainingTimes: item.remainingTimesAfter,
          remark: normalizeText(event.remark),
          createdAt: db.serverDate()
        }
      });
    }

    return { recordId: recordRes._id };
  });
}

async function listTodayRecords() {
  await assertOwner();
  const res = await db.collection(C.RECORDS)
    .where({ businessDate: todayBusinessDate() })
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return res.data || [];
}

async function getHomeSummary() {
  await assertOwner();
  const records = await listTodayRecords();
  const active = records.filter((item) => item.status === "active");
  const summary = active.reduce((acc, item) => {
    acc.actualReceivedCent += toCent(item.actualReceivedCent);
    acc.consumptionAmountCent += toCent(item.consumptionAmountCent);
    acc.balancePayCent += toCent(item.balancePayCent);
    if (item.type === "member_recharge") acc.rechargeCent += toCent(item.amountCent);
    if (item.type === "card_purchase") acc.cardPurchaseCent += toCent(item.actualReceivedCent);
    return acc;
  }, {
    actualReceivedCent: 0,
    consumptionAmountCent: 0,
    balancePayCent: 0,
    rechargeCent: 0,
    cardPurchaseCent: 0,
    activeCount: active.length,
    totalCount: records.length
  });

  return {
    businessDate: todayBusinessDate(),
    summary,
    records
  };
}

async function getRecord(event) {
  await assertOwner();
  return getById(db.collection(C.RECORDS), event.recordId, "记录不存在");
}

async function voidRecord(event) {
  const openid = await assertOwner();
  const recordId = event.recordId;
  if (!recordId) throw error("VALIDATION_ERROR", "缺少记录 ID");

  return db.runTransaction(async (transaction) => {
    const record = await getById(transaction.collection(C.RECORDS), recordId, "记录不存在");
    if (record.status !== "active") throw error("INVALID_STATUS", "该记录已不是有效状态");

    if (record.memberId) {
      const recordRes = await transaction.collection(C.RECORDS)
        .where({
          memberId: record.memberId,
          status: "active"
        })
        .limit(1000)
        .get();
      const nextState = replayMemberState(recordRes.data || [], recordId);

      await transaction.collection(C.MEMBERS).doc(record.memberId).update({
        data: {
          balanceCent: nextState.balanceCent,
          currentDiscount: nextState.currentDiscount,
          currentDiscountLabel: nextState.currentDiscountLabel,
          cardBalances: nextState.cardBalances,
          updatedAt: db.serverDate()
        }
      });
    }

    await transaction.collection(C.RECORDS).doc(recordId).update({
      data: {
        status: "void",
        voidReason: normalizeText(event.reason),
        voidedByOpenid: openid,
        voidedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    return { recordId };
  });
}

async function replaceTodayRecord(event) {
  await assertOwner();
  const record = await getById(db.collection(C.RECORDS), event.recordId, "记录不存在");
  if (record.businessDate !== todayBusinessDate()) {
    throw error("NOT_TODAY", "只有当天记录允许编辑");
  }
  await voidRecord({ recordId: event.recordId, reason: "当天编辑重记" });

  const payload = event.payload || {};
  const actionMap = {
    guest_consumption: createGuestConsumption,
    member_checkout: createMemberCheckout,
    member_consumption: createMemberConsumption,
    member_recharge: createMemberRecharge,
    card_purchase: createCardPurchase
  };
  const fn = actionMap[payload.type || record.type];
  if (!fn) throw error("VALIDATION_ERROR", "不支持的记录类型");
  return fn(payload);
}

const actions = {
  listMembers,
  saveMember,
  getMemberDetail,
  listServiceCategories,
  saveServiceCategory,
  toggleServiceCategory,
  listServices,
  listServiceCatalog,
  saveService,
  toggleService,
  listRechargeTiers,
  saveRechargeTier,
  listCardTypes,
  getBasicConfig,
  saveCardType,
  toggleCardType,
  createGuestConsumption,
  createMemberCheckout,
  createMemberRecharge,
  createMemberConsumption,
  createCardPurchase,
  listTodayRecords,
  getHomeSummary,
  getRecord,
  voidRecord,
  replaceTodayRecord
};

exports.main = async (event = {}) => {
  try {
    const action = event.action;
    if (!actions[action]) {
      throw error("UNKNOWN_ACTION", "未知操作");
    }
    const data = await actions[action](event);
    return {
      ok: true,
      data
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "系统异常"
    };
  }
};
