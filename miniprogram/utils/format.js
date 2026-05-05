function centToYuan(value) {
  const cent = Number(value || 0);
  return (cent / 100).toFixed(2);
}

function yuanInputToCent(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const num = Number(text);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function formatDiscount(value) {
  if (!value) return "无折扣";
  const num = Number(value);
  if (!Number.isFinite(num) || num >= 10) return "无折扣";
  return `${num}折`;
}

function formatPayment(value) {
  const map = {
    wechat: "微信",
    alipay: "支付宝",
    cash: "现金",
    balance: "会员余额",
    mixed: "混合支付",
    member_balance: "会员余额"
  };
  return map[value] || value || "-";
}

function formatRecordType(value) {
  const map = {
    guest_consumption: "散客消费",
    member_checkout: "会员结账",
    member_consumption: "会员消费",
    member_recharge: "会员充值",
    member_initial_balance: "初始余额",
    card_purchase: "次卡购买",
  };
  return map[value] || value || "-";
}

function formatBalanceFlowType(value) {
  const map = {
    initial_balance: "初始余额",
    recharge: "充值",
    consume: "消费"
  };
  return map[value] || value || "-";
}

function formatServiceItemName(item) {
  const categoryName = item && item.categoryName ? item.categoryName : "";
  const serviceName = item && item.serviceName ? item.serviceName : "";
  if (categoryName && serviceName) return `${categoryName}-${serviceName}`;
  return serviceName || categoryName || "-";
}

function formatServiceSummary(record) {
  const items = record && Array.isArray(record.serviceItems) ? record.serviceItems : [];
  if (items.length > 0) {
    const first = formatServiceItemName(items[0]);
    return items.length > 1 ? `${first} 等 ${items.length} 项` : first;
  }
  return record && record.serviceName ? record.serviceName : "";
}

function formatCheckoutSummary(record) {
  const cardItems = record && Array.isArray(record.cardItems) ? record.cardItems : [];
  const serviceItems = record && Array.isArray(record.serviceItems) ? record.serviceItems : [];
  const cardText = cardItems.map((item) => item.cardName).filter(Boolean).join("、");
  const serviceText = serviceItems.map(formatServiceItemName).filter((name) => name && name !== "-").join("、");
  if (cardText && serviceText) return `次卡：${cardText}；项目：${serviceText}`;
  if (cardText) return `使用次卡：${cardText}`;
  if (serviceText) return `项目：${serviceText}`;
  return "";
}

function formatCardPurchaseSummary(record) {
  const items = record && Array.isArray(record.cardItems) ? record.cardItems : [];
  const names = items.map((item) => item.cardName).filter(Boolean);
  if (names.length > 0) return `购卡：${names.join("、")}`;
  return "";
}

function formatRecordSummary(record) {
  if (record && record.type === "member_recharge") return `充值后折扣：${record.discountLabel || formatDiscount(record.discount)}`;
  if (record && record.type === "card_purchase") return formatCardPurchaseSummary(record);
  if (record && record.type === "member_checkout") return formatCheckoutSummary(record);
  return formatServiceSummary(record);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

module.exports = {
  centToYuan,
  yuanInputToCent,
  formatDiscount,
  formatPayment,
  formatRecordType,
  formatBalanceFlowType,
  formatServiceItemName,
  formatServiceSummary,
  formatCheckoutSummary,
  formatCardPurchaseSummary,
  formatRecordSummary,
  formatDateTime
};

