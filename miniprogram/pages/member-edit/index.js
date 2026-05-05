const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1}月`
}));
const DISCOUNT_OPTIONS = [
  { value: "7", label: "7折" },
  { value: "7.7", label: "7.7折" },
  { value: "8.5", label: "8.5折" }
];
const BOOK_OPTIONS = ["本子1", "本子2", "本子3", "本子4"];

function getDayOptions(month) {
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(month) - 1] || 0;
  return Array.from({ length: maxDay }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1}日`
  }));
}

function emptyForm() {
  return {
    name: "",
    phone: "",
    remark: "",
    birthdayMonth: "",
    birthdayDay: ""
  };
}

function emptyImportForm() {
  return {
    initialBalanceYuan: "",
    discount: "",
    offlineBook: "",
    offlinePage: ""
  };
}

function normalizeText(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function isFilled(value) {
  return normalizeText(value) !== "";
}

function normalizeDiscountText(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const num = Number(text);
  if (!Number.isFinite(num) || num <= 0 || num >= 10) return "";
  return String(Math.round(num * 100) / 100);
}

function normalizeInitialCardType(item) {
  return {
    ...item,
    selected: false,
    initialTimes: ""
  };
}

guardedPage({
  data: {
    id: "",
    redirect: "",
    saving: false,
    loadingCards: false,
    monthOptions: MONTH_OPTIONS,
    dayOptions: [],
    discountOptions: DISCOUNT_OPTIONS,
    bookOptions: BOOK_OPTIONS,
    initialCardTypes: [],
    importExpanded: false,
    form: emptyForm(),
    importForm: emptyImportForm()
  },

  onLoad(query) {
    this.setData({ redirect: query.redirect || "" });
    if (query.id) {
      this.setData({ id: query.id });
      this.loadMember(query.id);
    } else {
      this.loadInitialCardTypes();
    }
  },

  loadInitialCardTypes() {
    this.setData({ loadingCards: true });
    api.callBusiness("listCardTypes", { onlyEnabled: true })
      .then((cardTypes) => {
        this.setData({
          loadingCards: false,
          initialCardTypes: (cardTypes || []).map(normalizeInitialCardType)
        });
      })
      .catch((err) => {
        this.setData({ loadingCards: false });
        api.showError(err);
      });
  },

  loadMember(id) {
    api.callBusiness("getMemberDetail", { memberId: id })
      .then((data) => {
        const member = data.member || {};
        const birthdayMonth = member.birthdayMonth ? String(member.birthdayMonth) : "";
        this.setData({
          dayOptions: getDayOptions(birthdayMonth),
          form: {
            name: member.name || "",
            phone: member.phone || "",
            remark: member.remark || "",
            birthdayMonth,
            birthdayDay: member.birthdayDay ? String(member.birthdayDay) : ""
          }
        });
      })
      .catch(api.showError);
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value
    });
  },

  selectBirthdayMonth(e) {
    const value = String(e.currentTarget.dataset.value || "");
    const birthdayMonth = this.data.form.birthdayMonth === value ? "" : value;
    this.setData({
      "form.birthdayMonth": birthdayMonth,
      "form.birthdayDay": "",
      dayOptions: getDayOptions(birthdayMonth)
    });
  },

  selectBirthdayDay(e) {
    const value = String(e.currentTarget.dataset.value || "");
    this.setData({
      "form.birthdayDay": this.data.form.birthdayDay === value ? "" : value
    });
  },

  toggleImport() {
    this.setData({ importExpanded: !this.data.importExpanded });
  },

  onImportInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`importForm.${field}`]: e.detail.value
    });
  },

  selectDiscount(e) {
    const value = String(e.currentTarget.dataset.value || "");
    this.setData({
      "importForm.discount": this.data.importForm.discount === value ? "" : value
    });
  },

  clearDiscount() {
    this.setData({ "importForm.discount": "" });
  },

  selectOfflineBook(e) {
    const value = String(e.currentTarget.dataset.value || "");
    this.setData({
      "importForm.offlineBook": this.data.importForm.offlineBook === value ? "" : value
    });
  },

  noop() {},

  toggleImportCard(e) {
    const id = String(e.currentTarget.dataset.id || "");
    const initialCardTypes = this.data.initialCardTypes.map((item) => {
      if (item._id !== id) return item;
      const selected = !item.selected;
      return {
        ...item,
        selected,
        initialTimes: selected ? item.initialTimes : ""
      };
    });
    this.setData({ initialCardTypes });
  },

  onImportCardTimesInput(e) {
    const id = String(e.currentTarget.dataset.id || "");
    const initialCardTypes = this.data.initialCardTypes.map((item) => (
      item._id === id ? { ...item, initialTimes: e.detail.value } : item
    ));
    this.setData({ initialCardTypes });
  },

  validateBasic() {
    if (!normalizeText(this.data.form.name)) {
      api.showError(new Error("会员姓名不能为空"));
      return false;
    }
    if (!normalizeText(this.data.form.phone)) {
      api.showError(new Error("会员手机号不能为空"));
      return false;
    }
    return true;
  },

  validateBirthday() {
    const month = normalizeText(this.data.form.birthdayMonth);
    const day = normalizeText(this.data.form.birthdayDay);
    if (!month && !day) return true;
    if (!month || !day) {
      api.showError(new Error("请选择完整生日"));
      return false;
    }
    return true;
  },

  validateImportInfo() {
    const form = this.data.importForm;
    const balanceText = normalizeText(form.initialBalanceYuan);
    let balanceCent = 0;
    if (balanceText) {
      const balance = Number(balanceText);
      if (!Number.isFinite(balance)) {
        api.showError(new Error("初始余额必须是有效数字"));
        return null;
      }
      if (balance < 0) {
        api.showError(new Error("初始余额不能小于 0"));
        return null;
      }
      balanceCent = Math.round(balance * 100);
    }

    const discount = normalizeDiscountText(form.discount);
    if (isFilled(form.discount) && !discount) {
      api.showError(new Error("折扣必须在 0 到 10 之间"));
      return null;
    }

    const offlineBook = normalizeText(form.offlineBook);
    const offlinePage = normalizeText(form.offlinePage);
    if ((offlineBook && !offlinePage) || (!offlineBook && offlinePage)) {
      api.showError(new Error("来源本子和页码需要同时填写"));
      return null;
    }
    if (offlinePage) {
      const page = Number(offlinePage);
      if (!Number.isInteger(page) || page <= 0) {
        api.showError(new Error("页码必须是正整数"));
        return null;
      }
    }

    const selectedCards = this.data.initialCardTypes.filter((item) => item.selected);
    const cardItems = [];
    for (const card of selectedCards) {
      const timesText = normalizeText(card.initialTimes);
      if (!timesText) {
        api.showError(new Error("请填写已选次卡的剩余次数"));
        return null;
      }
      if (!/^[1-9]\d*$/.test(timesText)) {
        api.showError(new Error("剩余次数必须是正整数"));
        return null;
      }
      cardItems.push({
        cardTypeId: card._id,
        cardName: card.name,
        initialTimes: Number(timesText)
      });
    }

    const importActive = balanceCent > 0 || !!discount || (!!offlineBook && !!offlinePage) || cardItems.length > 0;
    return {
      importActive,
      initialBalanceYuan: balanceText,
      initialBalanceText: (balanceCent / 100).toFixed(2),
      discount,
      discountText: discount ? `${discount}折` : "无折扣",
      offlineBook,
      offlinePage,
      traceText: offlineBook && offlinePage ? `${offlineBook} 第${offlinePage}页` : "未填写",
      cardItems,
      cardText: cardItems.length > 0
        ? cardItems.map((item) => `${item.cardName}：${item.initialTimes} 次`).join("\n")
        : "未选择"
    };
  },

  save() {
    if (this.data.saving) return;
    if (!this.validateBasic()) return;
    if (!this.validateBirthday()) return;
    const importInfo = this.validateImportInfo();
    if (!importInfo) return;

    if (!this.data.id && importInfo.importActive) {
      wx.showModal({
        title: "确认补录",
        content: [
          `会员：${this.data.form.name || "-"}`,
          `初始余额：¥${importInfo.initialBalanceText}`,
          `初始折扣：${importInfo.discountText}`,
          `来源：${importInfo.traceText}`,
          `初始次卡：${importInfo.cardText}`,
          "初始余额、初始折扣和初始次卡保存后前台不可修改。"
        ].join("\n"),
        confirmText: "确认保存",
        success: (res) => {
          if (res.confirm) this.submitSave(importInfo);
        }
      });
      return;
    }

    this.submitSave(importInfo);
  },

  submitSave(importInfo) {
    this.setData({ saving: true });
    const payload = {
      id: this.data.id,
      ...this.data.form
    };

    if (!this.data.id) {
      payload.importInfo = {
        initialBalanceYuan: importInfo.initialBalanceYuan,
        discount: importInfo.discount,
        offlineBook: importInfo.offlineBook,
        offlinePage: importInfo.offlinePage,
        cardItems: importInfo.cardItems.map((item) => ({
          cardTypeId: item.cardTypeId,
          initialTimes: item.initialTimes
        }))
      };
    }

    api.callBusiness("saveMember", payload)
      .then((res) => {
        const memberId = this.data.id || (res && res.id);
        wx.showToast({ title: "已保存" });
        if (!this.data.id && this.data.redirect === "detail" && memberId) {
          wx.redirectTo({ url: `/pages/member-detail/index?id=${memberId}` });
          return;
        }
        wx.navigateBack();
      })
      .catch((err) => {
        this.setData({ saving: false });
        api.showError(err);
      });
  }
});

