const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

function normalizeRecord(item) {
  return {
    ...item,
    typeText: fmt.formatRecordType(item.type),
    statusText: item.status === "void" ? "已作废" : "有效",
    nameLine: fmt.formatRecordSummary(item) || item.memberName || item.cardName || "-",
    actualReceivedYuan: fmt.centToYuan(item.actualReceivedCent),
    paymentText: fmt.formatPayment(item.paymentMethod)
  };
}

guardedPage({
  data: {
    businessDate: "",
    summaryExpanded: false,
    summary: {
      actualReceivedYuan: "0.00",
      consumptionYuan: "0.00",
      balancePayYuan: "0.00",
      rechargeYuan: "0.00",
      cardPurchaseYuan: "0.00",
      activeCount: 0
    },
    records: []
  },

  onLoad() {
    // guardedPage may skip onShow while auth is still resolving.
    setTimeout(() => {
      if (!this._hasShownAfterAuth) this.loadData();
    }, 0);
  },

  onShow() {
    this._hasShownAfterAuth = true;
    this.setData({ summaryExpanded: false });
    this.loadData();
  },

  loadData() {
    api.callBusiness("getHomeSummary")
      .then((data) => {
        const s = data.summary || {};
        this.setData({
          businessDate: data.businessDate || "",
          summary: {
            actualReceivedYuan: fmt.centToYuan(s.actualReceivedCent),
            consumptionYuan: fmt.centToYuan(s.consumptionAmountCent),
            balancePayYuan: fmt.centToYuan(s.balancePayCent),
            rechargeYuan: fmt.centToYuan(s.rechargeCent),
            cardPurchaseYuan: fmt.centToYuan(s.cardPurchaseCent),
            activeCount: s.activeCount || 0
          },
          records: (data.records || []).map(normalizeRecord)
        });
      })
      .catch(api.showError);
  },

  toggleSummary() {
    this.setData({
      summaryExpanded: !this.data.summaryExpanded
    });
  },

  goEntry() {
    wx.switchTab({ url: "/pages/entry/index" });
  },

  goRecord(e) {
    wx.navigateTo({
      url: `/pages/record-detail/index?id=${e.currentTarget.dataset.id}`
    });
  }
});

