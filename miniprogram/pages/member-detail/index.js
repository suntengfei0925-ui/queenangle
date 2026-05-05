const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

function formatBirthday(member) {
  if (!member.birthdayMonth || !member.birthdayDay) return "";
  return `${member.birthdayMonth}月${member.birthdayDay}日`;
}

function formatOfflineTrace(item) {
  if (!item.offlineBook || !item.offlinePage) return "";
  return `${item.offlineBook} 第${item.offlinePage}页`;
}

function normalizeRecord(item) {
  return {
    ...item,
    typeText: fmt.formatRecordType(item.type),
    statusText: item.status === "void" ? "已作废" : "有效",
    timeText: fmt.formatDateTime(item.occurredAt || item.createdAt),
    actualReceivedYuan: fmt.centToYuan(item.actualReceivedCent),
    nameLine: fmt.formatRecordSummary(item) || item.cardName || item.discountLabel || ""
  };
}

guardedPage({
  data: {
    memberId: "",
    member: {
      name: "",
      phone: "",
      balanceYuan: "0.00",
      discountText: "无折扣"
    },
    cards: [],
    records: []
  },

  onLoad(query) {
    this.setData({ memberId: query.id || "" });
    this.loadDetail();
  },

  onShow() {
    if (this.data.memberId) this.loadDetail();
  },

  loadDetail() {
    if (!this.data.memberId) return;
    api.callBusiness("getMemberDetail", { memberId: this.data.memberId })
      .then((data) => {
        const member = data.member || {};
        this.setData({
          member: {
            ...member,
            balanceYuan: fmt.centToYuan(member.balanceCent),
            discountText: fmt.formatDiscount(member.currentDiscount),
            birthdayText: formatBirthday(member),
            offlineTraceText: formatOfflineTrace(member)
          },
          cards: member.cardBalances || [],
          records: (data.records || []).map(normalizeRecord)
        });
      })
      .catch(api.showError);
  },

  editMember() {
    wx.navigateTo({
      url: `/pages/member-edit/index?id=${this.data.memberId}`
    });
  },

  goMemberConsumption() {
    wx.navigateTo({
      url: `/pages/member-consumption/index?memberId=${this.data.memberId}`
    });
  },

  goMemberRecharge() {
    wx.navigateTo({
      url: `/pages/member-recharge/index?memberId=${this.data.memberId}`
    });
  },

  goRecord(e) {
    wx.navigateTo({
      url: `/pages/record-detail/index?id=${e.currentTarget.dataset.id}`
    });
  }
});
