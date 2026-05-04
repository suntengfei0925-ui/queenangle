const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

function row(label, value) {
  return { label, value: value || "-" };
}

function buildRows(record) {
  const rows = [
    row("会员", record.memberName),
    row("次卡", record.cardName),
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

  if (record.type === "member_consumption") {
    rows.push(row("整单原价", `¥${fmt.centToYuan(record.originalAmountCent)}`));
    rows.push(row("折扣", record.discountLabelApplied));
    rows.push(row("消费金额", `¥${fmt.centToYuan(record.consumptionAmountCent)}`));
    rows.push(row("余额支付", `¥${fmt.centToYuan(record.balancePayCent)}`));
    rows.push(row("补差价", `¥${fmt.centToYuan(record.extraPayCent)}`));
    rows.push(row("补差价支付方式", fmt.formatPayment(record.extraPaymentMethod)));
  }

  if (record.type === "card_purchase") {
    rows.push(row("购买次数", `${record.purchaseTimes || 0} 次`));
    rows.push(row("实收金额", `¥${fmt.centToYuan(record.actualReceivedCent)}`));
  }

  if (record.type === "card_use") {
    rows.push(row("核销次数", `${record.useTimes || 0} 次`));
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

guardedPage({
  data: {
    recordId: "",
    record: {
      status: "",
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
        const normalized = {
          ...record,
          typeText: fmt.formatRecordType(record.type),
          statusText: record.status === "void" ? "已作废" : "有效",
          timeText: fmt.formatDateTime(record.occurredAt || record.createdAt),
          serviceItems: normalizeServiceItems(record)
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
  }
});
