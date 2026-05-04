const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");

guardedPage({
  data: {
    members: [],
    selectedMember: {},
    memberCards: [],
    selectedCard: {},
    form: {
      useTimes: "1",
      remark: ""
    }
  },

  onLoad() {
    api.callBusiness("listMembers")
      .then((members) => {
        this.setData({
          members: (members || []).map((item) => ({
            ...item,
            displayName: `${item.name} ${item.phone || ""}`
          }))
        });
      })
      .catch(api.showError);
  },

  onMemberChange(e) {
    const member = this.data.members[Number(e.currentTarget.dataset.index)];
    const cards = (member.cardBalances || [])
      .filter((item) => Number(item.remainingTimes || 0) > 0)
      .map((item) => ({
        ...item,
        displayName: `${item.cardName} / 剩余 ${item.remainingTimes} 次`
      }));
    this.setData({
      selectedMember: member,
      memberCards: cards,
      selectedCard: {}
    });
  },

  onCardChange(e) {
    this.setData({ selectedCard: this.data.memberCards[Number(e.currentTarget.dataset.index)] });
  },

  onInput(e) {
    this.setData({
      [`form.${e.currentTarget.dataset.field}`]: e.detail.value
    });
  },

  submit() {
    if (!this.data.selectedMember._id) return api.showError(new Error("请选择会员"));
    if (!this.data.selectedCard.cardTypeId) return api.showError(new Error("请选择次卡"));

    api.callBusiness("createCardUse", {
      memberId: this.data.selectedMember._id,
      cardTypeId: this.data.selectedCard.cardTypeId,
      useTimes: Number(this.data.form.useTimes || 1),
      remark: this.data.form.remark
    })
      .then(() => {
        wx.showToast({ title: "已记录" });
        wx.navigateBack();
      })
      .catch(api.showError);
  }
});
