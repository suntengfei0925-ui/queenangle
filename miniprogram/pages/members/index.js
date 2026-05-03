const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");
const fmt = require("../../utils/format");

let keywordTimer = null;

function normalizeMember(item) {
  const cards = Array.isArray(item.cardBalances) ? item.cardBalances : [];
  return {
    ...item,
    balanceYuan: fmt.centToYuan(item.balanceCent),
    discountText: fmt.formatDiscount(item.currentDiscount),
    cardTotal: cards.reduce((sum, card) => sum + Number(card.remainingTimes || 0), 0)
  };
}

guardedPage({
  data: {
    keyword: "",
    members: []
  },

  onLoad() {
    this.loadMembers();
  },

  onShow() {
    this.loadMembers();
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
    clearTimeout(keywordTimer);
    keywordTimer = setTimeout(() => this.loadMembers(), 300);
  },

  loadMembers() {
    api.callBusiness("listMembers", { keyword: this.data.keyword })
      .then((members) => {
        this.setData({ members: (members || []).map(normalizeMember) });
      })
      .catch(api.showError);
  },

  addMember() {
    wx.navigateTo({ url: "/pages/member-edit/index" });
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/member-detail/index?id=${e.currentTarget.dataset.id}`
    });
  }
});

