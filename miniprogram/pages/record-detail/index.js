const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

function row(label, value) {
  return { label, value: value || "-" };
}

function formatOfflineTrace(record) {
  if (!record.offlineBook || !record.offlinePage) return "";
  return `${record.offlineBook} 第${record.offlinePage}页`;
}

function buildRows(record) {
  const hasServiceItems = Array.isArray(record.serviceItems) && record.serviceItems.length > 0;
  const rows = [
    row("会员", record.memberName),
    row("支付方式", fmt.formatPayment(record.paymentMethod))
  ];

  if (record.type === "guest_consumption") {
    rows.push(row("整单原价", `¥${fmt.centToYuan(record.originalAmountCent)}`));
    rows.push(row("实收金额", `¥${fmt.centToYuan(record.actualReceivedCent)}`));
  }

  if (record.type === "member_recharge") {
    rows.push(row("充值金额", `¥${fmt.centToYuan(record.amountCent)}`));
    rows.push(row("充值后折扣", record.discountLabel));
    rows.push(row("实收金额", `¥${fmt.centToYuan(record.actualReceivedCent)}`));
  }

  if (record.type === "member_initial_balance") {
    rows.push(row("初始余额", `¥${fmt.centToYuan(record.amountCent)}`));
    rows.push(row("初始折扣", record.discountLabel || fmt.formatDiscount(record.discount)));
    rows.push(row("线下位置", formatOfflineTrace(record)));
    rows.push(row("实收金额", `¥${fmt.centToYuan(record.actualReceivedCent)}`));
  }

  if (record.type === "member_consumption") {
    rows.push(row("整单原价", `¥${fmt.centToYuan(record.originalAmountCent)}`));
    rows.push(row("折扣", record.discountLabelApplied));
    rows.push(row("消费金额", `¥${fmt.centToYuan(record.consumptionAmountCent)}`));
    rows.push(row("余额支付", `¥${fmt.centToYuan(record.balancePayCent)}`));
    rows.push(row("补差价", `¥${fmt.centToYuan(record.extraPayCent)}`));
    rows.push(row("补差价支付方式", fmt.formatPayment(record.extraPaymentMethod)));
  }

  if (record.type === "member_checkout" && hasServiceItems) {
    rows.push(row("整单原价", `¥${fmt.centToYuan(record.originalAmountCent)}`));
    rows.push(row("折扣", record.discountLabelApplied));
    rows.push(row("消费金额", `¥${fmt.centToYuan(record.consumptionAmountCent)}`));
    rows.push(row("余额支付", `¥${fmt.centToYuan(record.balancePayCent)}`));
    rows.push(row("补差价", `¥${fmt.centToYuan(record.extraPayCent)}`));
    rows.push(row("补差价支付方式", fmt.formatPayment(record.extraPaymentMethod)));
  }

  if (record.type === "card_purchase") {
    rows.push(row("合计次数", `${record.cardPurchaseTotalTimes || 0} 次`));
    rows.push(row("实收金额", `¥${fmt.centToYuan(record.actualReceivedCent)}`));
  }


  return rows.filter((item) => item.value !== "-");
}

function normalizeServiceItems(record) {
  const items = Array.isArray(record.serviceItems) ? record.serviceItems : [];
  if (items.length === 0 && record.serviceName) {
    return [{
      key: "legacy-service",
      displayName: record.serviceName,
      priceYuan: fmt.centToYuan(record.originalAmountCent)
    }];
  }

  return items.map((item, index) => ({
    ...item,
    key: `${item.serviceId || "service"}-${index}`,
    displayName: fmt.formatServiceItemName(item),
    priceYuan: fmt.centToYuan(item.originalAmountCent)
  }));
}

function normalizeCardItems(record) {
  const items = Array.isArray(record.cardItems) ? record.cardItems : [];
  if (record.type === "card_purchase") {
    return items.map((item, index) => ({
      ...item,
      key: `${item.cardTypeId || "card"}-${index}`,
      purchaseTimes: Number(item.purchaseTimes || 0),
      priceYuan: fmt.centToYuan(item.priceCent)
    }));
  }

  if (record.type === "member_initial_balance") {
    return items.map((item, index) => ({
      ...item,
      key: `${item.cardTypeId || "card"}-${index}`,
      initialTimes: Number(item.initialTimes || 0)
    }));
  }

  return items.map((item, index) => ({
    ...item,
    key: `${item.cardTypeId || "card"}-${index}`,
    useTimes: Number(item.useTimes || 1),
    remainingTimesAfter: Number(item.remainingTimesAfter || 0)
  }));
}

guardedPage({
  data: {
    recordId: "",
    record: {
      status: "",
      cardItems: [],
      serviceItems: []
    },
    rows: []
  },

  onLoad(query) {
    this.setData({ recordId: query.id || "" });
    this.loadRecord();
  },

  loadRecord() {
    if (!this.data.recordId) return;
    api.callBusiness("getRecord", { recordId: this.data.recordId })
      .then((record) => {
        const cardItems = normalizeCardItems(record);
        const normalized = {
          ...record,
          typeText: fmt.formatRecordType(record.type),
          statusText: record.status === "void" ? "已作废" : "有效",
          timeText: fmt.formatDateTime(record.occurredAt || record.createdAt),
          signatureSignedAtText: fmt.formatDateTime(record.signatureSignedAt),
          serviceItems: normalizeServiceItems(record),
          cardItems,
          cardPurchaseTotalTimes: record.type === "card_purchase"
            ? cardItems.reduce((sum, item) => sum + Number(item.purchaseTimes || 0), 0)
            : 0
        };
        this.setData({
          record: normalized,
          rows: buildRows(normalized)
        });
      })
      .catch(api.showError);
  },

  voidRecord() {
    wx.showModal({
      title: "作废记录",
      editable: true,
      placeholderText: "请输入作废原因",
      success: (res) => {
        if (!res.confirm) return;
        api.callBusiness("voidRecord", {
          recordId: this.data.recordId,
          reason: res.content || "手动作废"
        })
          .then(() => {
            wx.showToast({ title: "已作废" });
            this.loadRecord();
          })
          .catch(api.showError);
      }
    });
  },

  previewSignature() {
    const fileId = this.data.record.signatureFileId;
    if (!fileId) return;

    wx.cloud.getTempFileURL({ fileList: [fileId] })
      .then((res) => {
        const item = (res.fileList || [])[0] || {};
        const url = item.tempFileURL || fileId;
        wx.previewImage({
          current: url,
          urls: [url]
        });
      })
      .catch(() => {
        wx.previewImage({
          current: fileId,
          urls: [fileId]
        });
      });
  }
});
