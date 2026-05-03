const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const C = {
  WHITELIST: "owner_whitelist",
  MEMBERS: "members",
  SERVICES: "services",
  TIERS: "recharge_tiers",
  CARD_TYPES: "card_types",
  RECORDS: "records",
  BALANCE_FLOWS: "balance_flows",
  CARD_FLOWS: "card_flows"
};

const PAYMENT_METHODS = ["wechat", "alipay", "cash"];

function error(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
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
  return String(value || "").trim();
}

function normalizeDiscount(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num >= 10) return null;
  return Math.round(num * 100) / 100;
}

function discountLabel(value) {
  if (!value) return "无折扣";
  return `${value} 折`;
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
  await assertOwner();
  const id = event.id;
  const name = normalizeText(event.name);
  const phone = normalizeText(event.phone);
  const remark = normalizeText(event.remark);

  if (!name) throw error("VALIDATION_ERROR", "会员姓名不能为空");
  if (!phone) throw error("VALIDATION_ERROR", "会员手机号不能为空");

  const samePhone = await db.collection(C.MEMBERS).where({ phone }).limit(10).get();
  const duplicated = (samePhone.data || []).some((item) => item._id !== id);
  if (duplicated) throw error("DUPLICATE_PHONE", "该手机号已存在会员");

  const payload = {
    name,
    phone,
    remark,
    updatedAt: db.serverDate()
  };

  if (id) {
    await db.collection(C.MEMBERS).doc(id).update({ data: payload });
    return { id };
  }

  const addRes = await db.collection(C.MEMBERS).add({
    data: {
      ...payload,
      balanceCent: 0,
      currentDiscount: null,
      currentDiscountLabel: "无折扣",
      cardBalances: [],
      createdAt: db.serverDate()
    }
  });
  return { id: addRes._id };
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

async function listServices(event) {
  await assertOwner();
  const onlyEnabled = !!event.onlyEnabled;
  const collection = db.collection(C.SERVICES);
  const query = onlyEnabled ? collection.where({ enabled: true }) : collection;
  const res = await query.orderBy("updatedAt", "desc").limit(100).get();
  return res.data || [];
}

async function saveService(event) {
  await assertOwner();
  const name = normalizeText(event.name);
  const priceCent = event.priceCent !== undefined ? toCent(event.priceCent) : yuanToCent(event.priceYuan);
  const remark = normalizeText(event.remark);
  const enabled = event.enabled !== false;

  if (!name) throw error("VALIDATION_ERROR", "项目名称不能为空");
  if (priceCent < 0) throw error("VALIDATION_ERROR", "标准价格不能小于 0");

  const payload = {
    name,
    priceCent,
    remark,
    enabled,
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
  await db.collection(C.SERVICES).doc(event.id).update({
    data: {
      enabled: !!event.enabled,
      updatedAt: db.serverDate()
    }
  });
  return { id: event.id };
}

async function listRechargeTiers() {
  await assertOwner();
  const res = await db.collection(C.TIERS).orderBy("amountCent", "asc").limit(100).get();
  return res.data || [];
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
  const collection = db.collection(C.CARD_TYPES);
  const query = onlyEnabled ? collection.where({ enabled: true }) : collection;
  const res = await query.orderBy("updatedAt", "desc").limit(100).get();
  return res.data || [];
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
  const serviceId = event.serviceId || "";
  let serviceName = normalizeText(event.serviceName);
  let originalAmountCent = event.originalAmountCent !== undefined ? toCent(event.originalAmountCent) : yuanToCent(event.originalAmountYuan);

  if (serviceId) {
    const service = await getById(db.collection(C.SERVICES), serviceId, "服务项目不存在");
    serviceName = service.name;
    if (!originalAmountCent) originalAmountCent = toCent(service.priceCent);
  }

  const actualReceivedCent = event.actualReceivedCent !== undefined ? toCent(event.actualReceivedCent) : yuanToCent(event.actualReceivedYuan);
  if (!serviceName) throw error("VALIDATION_ERROR", "消费项目不能为空");
  if (actualReceivedCent < 0) throw error("VALIDATION_ERROR", "实收金额不能小于 0");

  const record = {
    type: "guest_consumption",
    status: "active",
    serviceId,
    serviceName,
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
    const tier = await getById(transaction.collection(C.TIERS), tierId, "充值档位不存在");

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

async function createMemberConsumption(event) {
  const openid = await assertOwner();
  const memberId = event.memberId;
  const serviceId = event.serviceId;
  const occurredAt = parseDate(event.occurredAt);

  return db.runTransaction(async (transaction) => {
    const member = await getById(transaction.collection(C.MEMBERS), memberId, "会员不存在");
    const service = await getById(transaction.collection(C.SERVICES), serviceId, "服务项目不存在");
    const before = pickMemberState(member);

    let originalAmountCent = event.originalAmountCent !== undefined ? toCent(event.originalAmountCent) : yuanToCent(event.originalAmountYuan);
    if (!originalAmountCent) originalAmountCent = toCent(service.priceCent);

    let payableCent = originalAmountCent;
    const hasBalance = before.balanceCent > 0;
    const discount = hasBalance ? before.currentDiscount : null;

    if (hasBalance && discount) {
      payableCent = Math.round(originalAmountCent * discount / 10);
    }

    const balancePayCent = Math.min(before.balanceCent, payableCent);
    const extraPayCent = payableCent - balancePayCent;

    if (extraPayCent > 0) {
      assertPayment(event.extraPaymentMethod || event.paymentMethod, "补差价支付方式");
    }

    const balanceAfterCent = before.balanceCent - balancePayCent;
    const after = {
      ...before,
      balanceCent: balanceAfterCent,
      currentDiscount: balanceAfterCent > 0 ? before.currentDiscount : null,
      currentDiscountLabel: balanceAfterCent > 0 ? before.currentDiscountLabel : "无折扣"
    };

    const paymentMethod = balancePayCent > 0 && extraPayCent > 0
      ? "mixed"
      : balancePayCent > 0 ? "member_balance" : (event.paymentMethod || event.extraPaymentMethod);

    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "member_consumption",
        status: "active",
        memberId,
        memberName: member.name,
        serviceId,
        serviceName: service.name,
        originalAmountCent,
        consumptionAmountCent: payableCent,
        actualReceivedCent: extraPayCent,
        balancePayCent,
        extraPayCent,
        paymentMethod,
        extraPaymentMethod: extraPayCent > 0 ? (event.extraPaymentMethod || event.paymentMethod) : "",
        discountApplied: discount,
        discountLabelApplied: discountLabel(discount),
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

    return { recordId: recordRes._id };
  });
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

function getTimeValue(value) {
  const date = new Date(value || 0);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function applyCardDelta(state, cardTypeId, cardName, deltaTimes) {
  const list = Array.isArray(state.cardBalances) ? [...state.cardBalances] : [];
  const index = list.findIndex((item) => item.cardTypeId === cardTypeId);

  if (index >= 0) {
    const nextTimes = Math.max(0, Number(list[index].remainingTimes || 0) + deltaTimes);
    list[index] = {
      ...list[index],
      cardName,
      remainingTimes: nextTimes
    };
  } else if (deltaTimes > 0) {
    list.push({
      cardTypeId,
      cardName,
      remainingTimes: deltaTimes
    });
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
    if (record.type === "member_recharge") {
      state.balanceCent += toCent(record.amountCent);
      state.currentDiscount = record.discount || null;
      state.currentDiscountLabel = record.discountLabel || discountLabel(record.discount);
    }

    if (record.type === "member_consumption") {
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

    if (record.type === "card_purchase") {
      applyCardDelta(state, record.cardTypeId, record.cardName, Number(record.purchaseTimes || 0));
    }

    if (record.type === "card_use") {
      applyCardDelta(state, record.cardTypeId, record.cardName, -Number(record.useTimes || 0));
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
    const cardType = await getById(transaction.collection(C.CARD_TYPES), event.cardTypeId, "次卡类型不存在");
    const before = pickMemberState(member);
    const purchaseTimes = Number(event.purchaseTimes || cardType.totalTimes || 0);
    const actualReceivedCent = event.actualReceivedCent !== undefined ? toCent(event.actualReceivedCent) : yuanToCent(event.actualReceivedYuan);

    if (!Number.isInteger(purchaseTimes) || purchaseTimes <= 0) throw error("VALIDATION_ERROR", "购买次数必须大于 0");
    if (actualReceivedCent < 0) throw error("VALIDATION_ERROR", "实收金额不能小于 0");

    const after = {
      ...before,
      cardBalances: updateCardBalances(before.cardBalances, cardType, purchaseTimes)
    };

    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "card_purchase",
        status: "active",
        memberId: event.memberId,
        memberName: member.name,
        cardTypeId: cardType._id,
        cardName: cardType.name,
        purchaseTimes,
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

    await transaction.collection(C.CARD_FLOWS).add({
      data: {
        memberId: event.memberId,
        memberName: member.name,
        type: "purchase",
        sourceRecordId: recordRes._id,
        cardTypeId: cardType._id,
        cardName: cardType.name,
        deltaTimes: purchaseTimes,
        remainingTimes: after.cardBalances.find((item) => item.cardTypeId === cardType._id).remainingTimes,
        remark: normalizeText(event.remark),
        createdAt: db.serverDate()
      }
    });

    return { recordId: recordRes._id };
  });
}

async function createCardUse(event) {
  const openid = await assertOwner();
  const occurredAt = parseDate(event.occurredAt);

  return db.runTransaction(async (transaction) => {
    const member = await getById(transaction.collection(C.MEMBERS), event.memberId, "会员不存在");
    const cardType = await getById(transaction.collection(C.CARD_TYPES), event.cardTypeId, "次卡类型不存在");
    const before = pickMemberState(member);
    const useTimes = Number(event.useTimes || 1);

    if (!Number.isInteger(useTimes) || useTimes <= 0) throw error("VALIDATION_ERROR", "核销次数必须大于 0");

    const after = {
      ...before,
      cardBalances: updateCardBalances(before.cardBalances, cardType, -useTimes)
    };
    const cardAfter = after.cardBalances.find((item) => item.cardTypeId === cardType._id);

    const recordRes = await transaction.collection(C.RECORDS).add({
      data: {
        type: "card_use",
        status: "active",
        memberId: event.memberId,
        memberName: member.name,
        cardTypeId: cardType._id,
        cardName: cardType.name,
        useTimes,
        actualReceivedCent: 0,
        consumptionAmountCent: 0,
        paymentMethod: "",
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

    await transaction.collection(C.CARD_FLOWS).add({
      data: {
        memberId: event.memberId,
        memberName: member.name,
        type: "use",
        sourceRecordId: recordRes._id,
        cardTypeId: cardType._id,
        cardName: cardType.name,
        deltaTimes: -useTimes,
        remainingTimes: cardAfter ? cardAfter.remainingTimes : 0,
        remark: normalizeText(event.remark),
        createdAt: db.serverDate()
      }
    });

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
    member_consumption: createMemberConsumption,
    member_recharge: createMemberRecharge,
    card_purchase: createCardPurchase,
    card_use: createCardUse
  };
  const fn = actionMap[payload.type || record.type];
  if (!fn) throw error("VALIDATION_ERROR", "不支持的记录类型");
  return fn(payload);
}

const actions = {
  listMembers,
  saveMember,
  getMemberDetail,
  listServices,
  saveService,
  toggleService,
  listRechargeTiers,
  saveRechargeTier,
  listCardTypes,
  saveCardType,
  toggleCardType,
  createGuestConsumption,
  createMemberRecharge,
  createMemberConsumption,
  createCardPurchase,
  createCardUse,
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
