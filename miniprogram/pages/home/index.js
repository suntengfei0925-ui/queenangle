const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

function normalizeRecord(item) {
  return {
    ...item,
    typeText: fmt.formatRecordType(item.type),
    statusText: item.status === "void" ? "已作废" : "有效",
    nameLine: item.memberName || item.serviceName || item.cardName || "-",
    actualReceivedYuan: fmt.centToYuan(item.actualReceivedCent),
    paymentText: fmt.formatPayment(item.paymentMethod)
  };
}

guardedPage({
  data: {
    businessDate: "",
    summary: {
      actualReceivedYuan: "0.00",
      consumptionYuan: "0.00",
      balancePayYuan: "0.00",
      rechargeYuan: "0.00",
      activeCount: 0
    },
    records: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
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
            activeCount: s.activeCount || 0
          },
          records: (data.records || []).map(normalizeRecord)
        });
      })
      .catch(api.showError);
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

