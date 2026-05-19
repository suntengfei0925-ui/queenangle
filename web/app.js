const state = {
  user: null,
  view: "entry",
  summaryExpanded: false,
  loading: false,
  toastTimer: null,
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  memberKeyword: "",
  memberAlphaIndexActive: false,
  memberAlphaOverlayTimer: null,
  members: [],
  selectedMemberId: "",
  previousView: "entry",
  keywordTimer: null,
  editMemberId: "",
  editReturnView: "members",
  editForm: {
    name: "",
    phone: "",
    remark: "",
    birthdayMonth: "",
    birthdayDay: ""
  },
  importExpanded: false,
  importForm: {
    initialBalanceYuan: "",
    discount: "",
    offlineBook: "",
    offlinePage: ""
  },
  initialCardTypes: []
  ,
  guest: {
    categories: [],
    activeCategoryId: "",
    selectedItems: [],
    selectedPayment: "",
    selectedServicePerson: null,
    servicePeople: [],
    actualReceivedYuan: "",
    actualReceivedAutoSync: true,
    remark: "",
    configLoaded: false
  },
  recharge: {
    member: null,
    tiers: [],
    cardTypes: [],
    selectedTierId: "",
    selectedCardIds: [],
    selectedPayment: "",
    remark: "",
    configLoaded: false
  },
  checkout: {
    member: null,
    categories: [],
    activeCategoryId: "",
    selectedItems: [],
    availableCards: [],
    selectedCardIds: [],
    selectedPayment: "",
    selectedServicePerson: null,
    servicePeople: [],
    remark: "",
    signature: null,
    configLoaded: false
  },
  recordDetail: {
    recordId: "",
    returnView: "home",
    record: null
  },
  settingsExternalLinks: {
    loaded: false,
    dividerBefore: false,
    items: []
  },
  settingsConfig: {
    serviceMode: "list",
    tierMode: "list",
    cardTypeMode: "list",
    categories: [],
    serviceGroups: [],
    services: [],
    tiers: [],
    cardTypes: [],
    categoryForm: {
      id: "",
      name: ""
    },
    serviceForm: {
      id: "",
      categoryId: "",
      categoryName: "",
      name: "",
      remark: ""
    },
    tierForm: {
      id: "",
      amountYuan: "",
      discount: ""
    },
    cardTypeForm: {
      id: "",
      name: "",
      totalTimes: "",
      priceYuan: "",
      remark: ""
    }
  }
};

const titles = {
  entry: { title: "记一笔", subtitle: "" },
  guest: { title: "散客结账", subtitle: "" },
  home: { title: "账本", subtitle: "今日流水" },
  settings: { title: "设置", subtitle: "" },
  members: { title: "选择会员", subtitle: "" },
  "member-detail": { title: "会员详情", subtitle: "" },
  "member-checkout": { title: "会员结账", subtitle: "" },
  "member-recharge": { title: "购卡/充值", subtitle: "" },
  "record-detail": { title: "记录详情", subtitle: "" },
  "service-categories": { title: "服务分类", subtitle: "" },
  services: { title: "服务项目", subtitle: "" },
  "recharge-tiers": { title: "充值档位", subtitle: "" },
  "card-types": { title: "次卡类型", subtitle: "" },
  "member-edit": { title: "会员资料", subtitle: "" }
};

const settingsConfigViews = ["service-categories", "services", "recharge-tiers", "card-types"];
const monthOptions = Array.from({ length: 12 }, (_, index) => String(index + 1));
const daysPerMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pinyinCollator = new Intl.Collator("zh-Hans-u-co-pinyin", { numeric: true, sensitivity: "base" });
const PINYIN_INITIAL_BOUNDARIES = [
  ["A", "阿"],
  ["B", "八"],
  ["C", "嚓"],
  ["D", "咑"],
  ["E", "妸"],
  ["F", "发"],
  ["G", "旮"],
  ["H", "哈"],
  ["J", "击"],
  ["K", "咔"],
  ["L", "垃"],
  ["M", "妈"],
  ["N", "拿"],
  ["O", "噢"],
  ["P", "啪"],
  ["Q", "七"],
  ["R", "然"],
  ["S", "撒"],
  ["T", "他"],
  ["W", "挖"],
  ["X", "昔"],
  ["Y", "压"],
  ["Z", "匝"]
];
const OFFLINE_MESSAGE = "网络不可用，请连接网络后重试";
const APP_CONFIG_URL = "/app-config.json";
const mutatingBusinessActions = new Set([
  "saveWhitelistPerson",
  "saveMember",
  "saveServiceCategory",
  "toggleServiceCategory",
  "saveService",
  "toggleService",
  "saveRechargeTier",
  "saveCardType",
  "toggleCardType",
  "createGuestConsumption",
  "createMemberCheckout",
  "createMemberRecharge",
  "createMemberConsumption",
  "createCardPurchase",
  "voidRecord",
  "editRecord"
]);

function lockViewportZoom() {
  const viewport = document.querySelector('meta[name="viewport"]');
  const lockedViewport = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  if (viewport && viewport.getAttribute("content") !== lockedViewport) {
    viewport.setAttribute("content", lockedViewport);
  }

  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });

  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  let lastTouch = { time: 0, x: 0, y: 0, target: null };
  document.addEventListener("touchend", (event) => {
    if (event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const now = Date.now();
    const sameTarget = event.target === lastTouch.target;
    const quickRepeat = now - lastTouch.time < 350;
    const closeRepeat = Math.abs(touch.clientX - lastTouch.x) < 24 && Math.abs(touch.clientY - lastTouch.y) < 24;

    if (sameTarget && quickRepeat && closeRepeat) {
      event.preventDefault();
    }

    lastTouch = {
      time: now,
      x: touch.clientX,
      y: touch.clientY,
      target: event.target
    };
  }, { passive: false });
}

lockViewportZoom();

const el = {
  toast: document.querySelector("#toast"),
  offlineBanner: document.querySelector("#offline-banner"),
  loginScreen: document.querySelector("#login-screen"),
  appScreen: document.querySelector("#app-screen"),
  loginForm: document.querySelector("#login-form"),
  loginError: document.querySelector("#login-error"),
  backButton: document.querySelector("#back-button"),
  pageTitle: document.querySelector("#page-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  refreshButton: document.querySelector("#refresh-button"),
  logoutButton: document.querySelector("#logout-button"),
  currentUser: document.querySelector("#current-user"),
  settingsExternalLinksDivider: document.querySelector("#settings-external-links-divider"),
  settingsExternalLinkList: document.querySelector("#settings-external-link-list"),
  categoryForm: document.querySelector("#category-form"),
  categoryFormTitle: document.querySelector("#category-form-title"),
  categoryName: document.querySelector("#category-name"),
  categoryReset: document.querySelector("#category-reset"),
  settingsCategoryEmpty: document.querySelector("#settings-category-empty"),
  settingsCategoryList: document.querySelector("#settings-category-list"),
  serviceForm: document.querySelector("#service-form"),
  serviceFormTitle: document.querySelector("#service-form-title"),
  serviceCategoryReadonly: document.querySelector("#service-category-readonly"),
  serviceName: document.querySelector("#service-name"),
  serviceRemark: document.querySelector("#service-remark"),
  serviceBackList: document.querySelector("#service-back-list"),
  serviceGroups: document.querySelector("#service-groups"),
  tierForm: document.querySelector("#tier-form"),
  tierFormTitle: document.querySelector("#tier-form-title"),
  tierAmount: document.querySelector("#tier-amount"),
  tierDiscount: document.querySelector("#tier-discount"),
  tierBackList: document.querySelector("#tier-back-list"),
  tierEmpty: document.querySelector("#tier-empty"),
  tierList: document.querySelector("#tier-list"),
  tierFixedAction: document.querySelector("#tier-fixed-action"),
  tierAdd: document.querySelector("#tier-add"),
  cardTypeForm: document.querySelector("#card-type-form"),
  cardTypeFormTitle: document.querySelector("#card-type-form-title"),
  cardTypeName: document.querySelector("#card-type-name"),
  cardTypeTimes: document.querySelector("#card-type-times"),
  cardTypePrice: document.querySelector("#card-type-price"),
  cardTypeRemark: document.querySelector("#card-type-remark"),
  cardTypeBackList: document.querySelector("#card-type-back-list"),
  cardTypeEmpty: document.querySelector("#card-type-empty"),
  cardTypeList: document.querySelector("#card-type-list"),
  cardTypeFixedAction: document.querySelector("#card-type-fixed-action"),
  cardTypeAdd: document.querySelector("#card-type-add"),
  summaryToggle: document.querySelector("#summary-toggle"),
  summaryBody: document.querySelector("#summary-body"),
  businessDate: document.querySelector("#business-date"),
  summaryActual: document.querySelector("#summary-actual"),
  summaryActiveCount: document.querySelector("#summary-active-count"),
  summaryConsumption: document.querySelector("#summary-consumption"),
  summaryBalance: document.querySelector("#summary-balance"),
  summaryRecharge: document.querySelector("#summary-recharge"),
  summaryCard: document.querySelector("#summary-card"),
  recordsEmpty: document.querySelector("#records-empty"),
  recordList: document.querySelector("#record-list"),
  memberKeyword: document.querySelector("#member-keyword"),
  membersEmpty: document.querySelector("#members-empty"),
  memberList: document.querySelector("#member-list"),
  memberAlphaIndex: document.querySelector("#member-alpha-index"),
  memberAlphaOverlay: document.querySelector("#member-alpha-overlay"),
  addMemberButton: document.querySelector("#add-member-button"),
  memberName: document.querySelector("#member-name"),
  memberPhone: document.querySelector("#member-phone"),
  memberBalance: document.querySelector("#member-balance"),
  memberDiscount: document.querySelector("#member-discount"),
  memberRemark: document.querySelector("#member-remark"),
  memberMeta: document.querySelector("#member-meta"),
  memberBirthdayBox: document.querySelector("#member-birthday-box"),
  memberBirthday: document.querySelector("#member-birthday"),
  memberOfflineBox: document.querySelector("#member-offline-box"),
  memberOffline: document.querySelector("#member-offline"),
  cardsEmpty: document.querySelector("#cards-empty"),
  cardList: document.querySelector("#card-list"),
  memberRecordsEmpty: document.querySelector("#member-records-empty"),
  memberRecordList: document.querySelector("#member-record-list"),
  recordDetailType: document.querySelector("#record-detail-type"),
  recordDetailTime: document.querySelector("#record-detail-time"),
  recordDetailStatus: document.querySelector("#record-detail-status"),
  recordDetailVoidReason: document.querySelector("#record-detail-void-reason"),
  recordDetailRows: document.querySelector("#record-detail-rows"),
  recordDetailServicesPanel: document.querySelector("#record-detail-services-panel"),
  recordDetailServices: document.querySelector("#record-detail-services"),
  recordDetailCardsPanel: document.querySelector("#record-detail-cards-panel"),
  recordDetailCardsTitle: document.querySelector("#record-detail-cards-title"),
  recordDetailCards: document.querySelector("#record-detail-cards"),
  recordDetailRemarkPanel: document.querySelector("#record-detail-remark-panel"),
  recordDetailRemark: document.querySelector("#record-detail-remark"),
  recordDetailSignaturePanel: document.querySelector("#record-detail-signature-panel"),
  recordDetailSignatureTime: document.querySelector("#record-detail-signature-time"),
  recordDetailOpenSignature: document.querySelector("#record-detail-open-signature"),
  recordDetailSignature: document.querySelector("#record-detail-signature"),
  recordDetailVoid: document.querySelector("#record-detail-void"),
  editMemberButton: document.querySelector("#edit-member-button"),
  memberCheckoutButton: document.querySelector("#member-checkout-button"),
  memberRechargeButton: document.querySelector("#member-recharge-button"),
  memberEditForm: document.querySelector("#member-edit-form"),
  editName: document.querySelector("#edit-name"),
  editPhone: document.querySelector("#edit-phone"),
  editRemark: document.querySelector("#edit-remark"),
  birthdayMonths: document.querySelector("#birthday-months"),
  birthdayDays: document.querySelector("#birthday-days"),
  importToggle: document.querySelector("#import-toggle"),
  importPanel: document.querySelector("#import-panel"),
  importBalance: document.querySelector("#import-balance"),
  importDiscount: document.querySelector("#import-discount"),
  importPage: document.querySelector("#import-page"),
  initialCardLoading: document.querySelector("#initial-card-loading"),
  initialCardEmpty: document.querySelector("#initial-card-empty"),
  initialCardList: document.querySelector("#initial-card-list"),
  saveMemberButton: document.querySelector("#save-member-button")
  ,
  guestForm: document.querySelector("#guest-form"),
  selectedServicePerson: document.querySelector("#selected-service-person"),
  servicePersonButton: document.querySelector("#service-person-button"),
  guestConfigError: document.querySelector("#guest-config-error"),
  servicePicker: document.querySelector("#service-picker"),
  categoryList: document.querySelector("#category-list"),
  serviceList: document.querySelector("#service-list"),
  selectedEmpty: document.querySelector("#selected-empty"),
  selectedServiceList: document.querySelector("#selected-service-list"),
  guestTotal: document.querySelector("#guest-total"),
  guestActual: document.querySelector("#guest-actual"),
  paymentQr: document.querySelector("#payment-qr"),
  guestRemark: document.querySelector("#guest-remark"),
  guestSubmit: document.querySelector("#guest-submit"),
  servicePersonSheet: document.querySelector("#service-person-sheet"),
  servicePersonList: document.querySelector("#service-person-list"),
  closeServicePerson: document.querySelector("#close-service-person"),
  rechargeForm: document.querySelector("#recharge-form"),
  rechargeMemberName: document.querySelector("#recharge-member-name"),
  rechargeMemberPhone: document.querySelector("#recharge-member-phone"),
  rechargeMemberBalance: document.querySelector("#recharge-member-balance"),
  rechargeMemberDiscount: document.querySelector("#recharge-member-discount"),
  rechargeMemberCardTotal: document.querySelector("#recharge-member-card-total"),
  rechargeConfigError: document.querySelector("#recharge-config-error"),
  rechargeTierList: document.querySelector("#recharge-tier-list"),
  rechargeCardEmpty: document.querySelector("#recharge-card-empty"),
  rechargeCardList: document.querySelector("#recharge-card-list"),
  rechargePaymentQr: document.querySelector("#recharge-payment-qr"),
  rechargeTierSummary: document.querySelector("#recharge-tier-summary"),
  rechargeSummaryAmount: document.querySelector("#recharge-summary-amount"),
  rechargeSummaryDiscount: document.querySelector("#recharge-summary-discount"),
  rechargeSummaryReceived: document.querySelector("#recharge-summary-received"),
  rechargeCardSummary: document.querySelector("#recharge-card-summary"),
  rechargeCardSummaryList: document.querySelector("#recharge-card-summary-list"),
  rechargeCardTotalTimes: document.querySelector("#recharge-card-total-times"),
  rechargeCardTotalAmount: document.querySelector("#recharge-card-total-amount"),
  rechargeRemark: document.querySelector("#recharge-remark"),
  rechargeSubmit: document.querySelector("#recharge-submit"),
  checkoutForm: document.querySelector("#checkout-form"),
  checkoutMemberName: document.querySelector("#checkout-member-name"),
  checkoutMemberPhone: document.querySelector("#checkout-member-phone"),
  checkoutMemberBalance: document.querySelector("#checkout-member-balance"),
  checkoutMemberDiscount: document.querySelector("#checkout-member-discount"),
  checkoutMemberCardTotal: document.querySelector("#checkout-member-card-total"),
  checkoutServicePersonButton: document.querySelector("#checkout-service-person-button"),
  checkoutSelectedServicePerson: document.querySelector("#checkout-selected-service-person"),
  checkoutCardSection: document.querySelector("#checkout-card-section"),
  checkoutCardOptions: document.querySelector("#checkout-card-options"),
  checkoutConfigError: document.querySelector("#checkout-config-error"),
  checkoutServicePicker: document.querySelector("#checkout-service-picker"),
  checkoutCategoryList: document.querySelector("#checkout-category-list"),
  checkoutServiceList: document.querySelector("#checkout-service-list"),
  checkoutSelectedEmpty: document.querySelector("#checkout-selected-empty"),
  checkoutSelectedList: document.querySelector("#checkout-selected-list"),
  checkoutCalcPanel: document.querySelector("#checkout-calc-panel"),
  checkoutOriginal: document.querySelector("#checkout-original"),
  checkoutPayable: document.querySelector("#checkout-payable"),
  checkoutBalancePay: document.querySelector("#checkout-balance-pay"),
  checkoutShortageNote: document.querySelector("#checkout-shortage-note"),
  checkoutExtraPay: document.querySelector("#checkout-extra-pay"),
  checkoutBalanceAfter: document.querySelector("#checkout-balance-after"),
  checkoutPaymentSection: document.querySelector("#checkout-payment-section"),
  checkoutPaymentQr: document.querySelector("#checkout-payment-qr"),
  checkoutRemark: document.querySelector("#checkout-remark"),
  checkoutSignaturePreview: document.querySelector("#checkout-signature-preview"),
  checkoutSignatureStatus: document.querySelector("#checkout-signature-status"),
  checkoutSignatureImage: document.querySelector("#checkout-signature-image"),
  checkoutResignButton: document.querySelector("#checkout-resign-button"),
  checkoutSubmit: document.querySelector("#checkout-submit"),
  checkoutServicePersonSheet: document.querySelector("#checkout-service-person-sheet"),
  checkoutServicePersonList: document.querySelector("#checkout-service-person-list"),
  checkoutCloseServicePerson: document.querySelector("#checkout-close-service-person"),
  checkoutConfirmMask: document.querySelector("#checkout-confirm-mask"),
  checkoutConfirmContent: document.querySelector("#checkout-confirm-content"),
  checkoutConfirmCancel: document.querySelector("#checkout-confirm-cancel"),
  checkoutConfirmSign: document.querySelector("#checkout-confirm-sign"),
  signatureSheet: document.querySelector("#signature-sheet"),
  signatureCanvas: document.querySelector("#signature-canvas"),
  signatureClear: document.querySelector("#signature-clear"),
  signatureConfirm: document.querySelector("#signature-confirm"),
  qrViewer: document.querySelector("#qr-viewer"),
  qrViewerClose: document.querySelector("#qr-viewer-close"),
  qrViewerImage: document.querySelector("#qr-viewer-image")
};

function centToYuan(value) {
  const cent = Number(value || 0);
  return (cent / 100).toFixed(2);
}

function yuanInputToCent(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  const num = Number(text);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

function money(value) {
  return `¥${centToYuan(value)}`;
}

function openQrViewer(image) {
  if (!image || image.hidden || !image.src) return;
  el.qrViewerImage.src = image.src;
  el.qrViewer.hidden = false;
  const requestFullscreen = el.qrViewer.requestFullscreen || el.qrViewer.webkitRequestFullscreen;
  if (!requestFullscreen) return;
  const result = requestFullscreen.call(el.qrViewer);
  if (result && typeof result.catch === "function") result.catch(() => {});
}

function closeQrViewer() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
  if (fullscreenElement === el.qrViewer && exitFullscreen) {
    const result = exitFullscreen.call(document);
    if (result && typeof result.catch === "function") result.catch(() => {});
  }
  el.qrViewer.hidden = true;
  el.qrViewerImage.removeAttribute("src");
}

function handleQrFullscreenChange() {
  const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  if (!fullscreenElement && !el.qrViewer.hidden) closeQrViewer();
}

function bindQrViewer(image) {
  if (!image) return;
  image.tabIndex = 0;
  image.setAttribute("role", "button");
  image.addEventListener("click", () => openQrViewer(image));
  image.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openQrViewer(image);
  });
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
    member_initial_balance: "老会员补录",
    card_purchase: "次卡购买"
  };
  return map[value] || value || "-";
}

function formatDiscount(value) {
  if (!value) return "无折扣";
  const num = Number(value);
  if (!Number.isFinite(num) || num >= 10) return "无折扣";
  return `${num}折`;
}

function formatServiceItemName(item) {
  const categoryName = item && item.categoryName ? item.categoryName : "";
  const serviceName = item && item.serviceName ? item.serviceName : "";
  if (categoryName && serviceName) return `${categoryName}-${serviceName}`;
  return serviceName || categoryName || "-";
}

function formatCheckoutSummary(record) {
  const cardItems = Array.isArray(record.cardItems) ? record.cardItems : [];
  const serviceItems = Array.isArray(record.serviceItems) ? record.serviceItems : [];
  const cardText = cardItems.map((item) => item.cardName).filter(Boolean).join("、");
  const serviceText = serviceItems.map(formatServiceItemName).filter((name) => name && name !== "-").join("、");
  if (cardText && serviceText) return `次卡：${cardText}；项目：${serviceText}`;
  if (cardText) return `使用次卡：${cardText}`;
  if (serviceText) return `项目：${serviceText}`;
  return "";
}

function formatServiceSummary(record) {
  const items = Array.isArray(record.serviceItems) ? record.serviceItems : [];
  if (items.length > 0) {
    const first = formatServiceItemName(items[0]);
    return items.length > 1 ? `${first} 等 ${items.length} 项` : first;
  }
  return record.serviceName || "";
}

function formatRecordSummary(record) {
  if (record.type === "member_recharge") return `充值后折扣：${record.discountLabel || formatDiscount(record.discount)}`;
  if (record.type === "member_initial_balance") return "老会员补录";
  if (record.type === "card_purchase") {
    const items = Array.isArray(record.cardItems) ? record.cardItems : [];
    const names = items.map((item) => item.cardName).filter(Boolean);
    return names.length > 0 ? `购卡：${names.join("、")}` : "";
  }
  if (record.type === "member_checkout") return formatCheckoutSummary(record);
  return formatServiceSummary(record);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatBirthday(member) {
  if (!member || !member.birthdayMonth || !member.birthdayDay) return "";
  return `${member.birthdayMonth}月${member.birthdayDay}日`;
}

function formatOfflineTrace(member) {
  if (!member || !member.offlineBook || !member.offlinePage) return "";
  return `${member.offlineBook} 第${member.offlinePage}页`;
}

function formatRecordStatus(status) {
  return status === "void" ? "已作废" : "有效";
}

function getRecordSettlementAmountCent(record) {
  if (record && record.settlementAmountCent !== undefined && record.settlementAmountCent !== null) {
    return record.settlementAmountCent;
  }
  return Number(record && record.balancePayCent || 0) + Number(record && record.extraPayCent || 0);
}

function hasRecordShortageExtraPay(record) {
  return !!record && Number(record.extraPayCent || 0) > 0 && !!record.shortageExtraPayRule;
}

function buildShortageExplanation(record) {
  if (!hasRecordShortageExtraPay(record)) return "";
  return `余额按折扣可抵扣原价 ${money(record.balanceCoveredOriginalCent)}，剩余原价 ${money(record.extraPayCent)} 按原价补差。`;
}

function formatRecordOfflineTrace(record) {
  if (!record || !record.offlineBook || !record.offlinePage) return "";
  return `${record.offlineBook} 第${record.offlinePage}页`;
}

function detailRow(label, value) {
  return {
    label,
    value: value === 0 || value ? String(value) : "-"
  };
}

function normalizeRecordServiceItems(record) {
  if (!record) return [];
  if (Array.isArray(record.serviceItems) && record.serviceItems.length > 0) {
    return record.serviceItems.map((item) => ({
      name: item.displayName || formatServiceItemName(item),
      amountCent: item.originalAmountCent
    }));
  }
  if (record.serviceName) {
    return [{
      name: record.serviceName,
      amountCent: record.originalAmountCent || record.consumptionAmountCent || record.actualReceivedCent
    }];
  }
  return [];
}

function normalizeRecordCardItems(record) {
  const items = Array.isArray(record && record.cardItems) ? record.cardItems : [];
  if (!record || items.length === 0) return [];

  if (record.type === "card_purchase") {
    return items.map((item) => ({
      name: item.cardName || "-",
      note: `+${Number(item.purchaseTimes || 0)} 次`,
      value: money(item.priceCent)
    }));
  }

  if (record.type === "member_initial_balance") {
    return items.map((item) => ({
      name: item.cardName || "-",
      note: `初始 ${Number(item.initialTimes || 0)} 次`,
      value: ""
    }));
  }

  return items.map((item) => ({
    name: item.cardName || "-",
    note: `扣 ${Number(item.useTimes || 1)} 次`,
    value: `剩余 ${Number(item.remainingTimesAfter || 0)} 次`
  }));
}

function buildRecordRows(record) {
  const rows = [];
  if (!record) return rows;

  if (record.memberName) rows.push(detailRow("会员", record.memberName));
  if (record.paymentMethod) rows.push(detailRow("支付方式", formatPayment(record.paymentMethod)));
  if (["guest_consumption", "member_consumption", "member_checkout"].includes(record.type)) {
    rows.push(detailRow("服务人", record.servicePersonName));
  }

  if (record.type === "guest_consumption") {
    rows.push(detailRow("整单原价", money(record.originalAmountCent)));
    rows.push(detailRow("实收金额", money(record.actualReceivedCent)));
    return rows;
  }

  if (record.type === "member_recharge") {
    rows.push(detailRow("充值金额", money(record.amountCent)));
    rows.push(detailRow("充值后折扣", record.discountLabel || formatDiscount(record.discount)));
    rows.push(detailRow("实收金额", money(record.actualReceivedCent)));
    return rows;
  }

  if (record.type === "member_initial_balance") {
    rows.push(detailRow("初始余额", money(record.amountCent)));
    rows.push(detailRow("初始折扣", record.discountLabel || formatDiscount(record.discount)));
    rows.push(detailRow("线下位置", formatRecordOfflineTrace(record)));
    rows.push(detailRow("实收金额", money(record.actualReceivedCent)));
    return rows;
  }

  if (record.type === "member_consumption" || record.type === "member_checkout") {
    rows.push(detailRow("整单原价", money(record.originalAmountCent)));
    rows.push(detailRow("折扣", record.discountLabelApplied || formatDiscount(record.discountApplied)));
    rows.push(detailRow("整单会员价", money(record.consumptionAmountCent)));
    rows.push(detailRow("余额支付", money(record.balancePayCent)));
    if (hasRecordShortageExtraPay(record)) {
      rows.push(detailRow("余额可抵扣原价", money(record.balanceCoveredOriginalCent)));
      rows.push(detailRow("补差价", money(record.extraPayCent)));
      rows.push(detailRow("本单结算金额", money(getRecordSettlementAmountCent(record))));
      rows.push(detailRow("补差价支付方式", formatPayment(record.extraPaymentMethod)));
      rows.push(detailRow("补差说明", buildShortageExplanation(record)));
    } else if (Number(record.extraPayCent || 0) > 0) {
      rows.push(detailRow("补差价", money(record.extraPayCent)));
    }
    return rows;
  }

  if (record.type === "card_purchase") {
    const totalTimes = (Array.isArray(record.cardItems) ? record.cardItems : [])
      .reduce((sum, item) => sum + Number(item.purchaseTimes || 0), 0);
    rows.push(detailRow("合计次数", `${totalTimes} 次`));
    rows.push(detailRow("实收金额", money(record.actualReceivedCent)));
    return rows;
  }

  rows.push(detailRow("实收金额", money(record.actualReceivedCent)));
  return rows;
}

function normalizeText(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (err) {
    return false;
  }
}

function normalizeSettingsExternalLinks(config) {
  const items = Array.isArray(config && config.items) ? config.items : [];
  return items
    .map((item, index) => {
      const name = normalizeText(item && item.name);
      const url = normalizeText(item && item.url);
      const order = Number(item && item.order);
      return {
        id: normalizeText(item && item.id) || `settings-external-link-${index}`,
        name,
        url,
        enabled: item && item.enabled !== false,
        order: Number.isFinite(order) ? order : 0
      };
    })
    .filter((item) => item.enabled && item.name && item.url && isHttpUrl(item.url))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "zh-CN"));
}

function applySettingsExternalLinksConfig(config) {
  state.settingsExternalLinks.dividerBefore = !!(config && config.dividerBefore);
  state.settingsExternalLinks.items = normalizeSettingsExternalLinks(config);
}

function isCjkCharacter(value) {
  return /^[\u3400-\u9fff]$/.test(value);
}

function getChineseInitial(char) {
  for (let i = PINYIN_INITIAL_BOUNDARIES.length - 1; i >= 0; i -= 1) {
    const [letter, boundary] = PINYIN_INITIAL_BOUNDARIES[i];
    if (pinyinCollator.compare(char, boundary) >= 0) return letter;
  }
  return "#";
}

function memberSortName(member) {
  return normalizeText(member && member.name);
}

function getMemberInitial(member) {
  const name = memberSortName(member);
  if (!name) return "#";
  const first = Array.from(name)[0];
  const upper = first.toUpperCase();
  if (/^[A-Z]$/.test(upper)) return upper;
  if (isCjkCharacter(first)) return getChineseInitial(first);
  return "#";
}

function compareMembersByName(a, b) {
  const nameResult = pinyinCollator.compare(memberSortName(a), memberSortName(b));
  if (nameResult !== 0) return nameResult;
  return normalizeText(a && a.phone).localeCompare(normalizeText(b && b.phone));
}

function compareMemberGroups(a, b) {
  if (a === b) return 0;
  if (a === "#") return 1;
  if (b === "#") return -1;
  return a.localeCompare(b);
}

function groupMembersByInitial(members) {
  const groups = new Map();
  (Array.isArray(members) ? members : []).forEach((member) => {
    const letter = getMemberInitial(member);
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(member);
  });

  return Array.from(groups.entries())
    .sort(([letterA], [letterB]) => compareMemberGroups(letterA, letterB))
    .map(([letter, items]) => ({
      letter,
      items: items.slice().sort(compareMembersByName)
    }));
}

function normalizeForHash(value) {
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      const item = value[key];
      acc[key] = item === undefined ? null : normalizeForHash(item);
      return acc;
    }, {});
  }
  return value === undefined ? null : value;
}

function hashSnapshot(snapshot) {
  const text = JSON.stringify(normalizeForHash(snapshot));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeCent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

function normalizeDiscountForCalc(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0 || num >= 10) return null;
  return Math.round(num * 100) / 100;
}

function roundCentToJiao(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num / 10) * 10;
}

function baseCheckoutResult(balanceCent, discount, originalCent, memberPriceCent) {
  return {
    balanceCent,
    discount,
    originalAmountCent: originalCent,
    payableCent: memberPriceCent,
    balancePayCent: 0,
    extraPayCent: 0,
    balanceCoveredOriginalCent: 0,
    remainingOriginalCent: originalCent,
    settlementAmountCent: 0,
    balanceAfterCent: balanceCent,
    shortageExtraPayRule: "",
    hasShortageExtraPay: false
  };
}

function calculateCheckoutAmount(member, originalCent) {
  const balanceCent = normalizeCent(member && member.balanceCent);
  const amountCent = normalizeCent(originalCent);
  const discount = amountCent > 0 && balanceCent > 0 ? normalizeDiscountForCalc(member && member.currentDiscount) : null;
  const discountRate = discount ? discount / 10 : 1;
  const memberPriceCent = discount ? Math.round(amountCent * discountRate) : amountCent;

  if (amountCent <= 0) return baseCheckoutResult(balanceCent, discount, 0, 0);
  if (balanceCent <= 0) {
    return {
      ...baseCheckoutResult(0, null, amountCent, amountCent),
      extraPayCent: amountCent,
      settlementAmountCent: amountCent,
      balanceAfterCent: 0
    };
  }
  if (balanceCent >= memberPriceCent) {
    return {
      ...baseCheckoutResult(balanceCent, discount, amountCent, memberPriceCent),
      balancePayCent: memberPriceCent,
      balanceCoveredOriginalCent: amountCent,
      remainingOriginalCent: 0,
      settlementAmountCent: memberPriceCent,
      balanceAfterCent: balanceCent - memberPriceCent
    };
  }

  const balancePayCent = balanceCent;
  const balanceCoveredOriginalCent = Math.min(amountCent, roundCentToJiao(balanceCent / discountRate));
  const rawRemainingOriginalCent = Math.max(0, amountCent - balanceCoveredOriginalCent);
  const extraPayCent = Math.max(0, roundCentToJiao(rawRemainingOriginalCent));
  return {
    balanceCent,
    discount,
    originalAmountCent: amountCent,
    payableCent: memberPriceCent,
    balancePayCent,
    extraPayCent,
    balanceCoveredOriginalCent,
    remainingOriginalCent: extraPayCent,
    settlementAmountCent: balancePayCent + extraPayCent,
    balanceAfterCent: balanceCent - balancePayCent,
    shortageExtraPayRule: extraPayCent > 0 ? "balance_discount_cover_original_v1" : "",
    hasShortageExtraPay: extraPayCent > 0
  };
}

function getDayOptions(month) {
  const count = daysPerMonth[Number(month) - 1] || 0;
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

function emptyEditForm() {
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

function emptyCategoryForm() {
  return { id: "", name: "" };
}

function emptyServiceForm() {
  return { id: "", categoryId: "", categoryName: "", name: "", remark: "" };
}

function emptyTierForm() {
  return { id: "", amountYuan: "", discount: "" };
}

function emptyCardTypeForm() {
  return { id: "", name: "", totalTimes: "", priceYuan: "", remark: "" };
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  el.toast.textContent = message || "操作失败";
  el.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    el.toast.hidden = true;
  }, 1800);
}

function createOfflineError() {
  const err = new Error(OFFLINE_MESSAGE);
  err.code = "NETWORK_OFFLINE";
  return err;
}

function updateNetworkStatus() {
  state.isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  if (el.offlineBanner) el.offlineBanner.hidden = state.isOnline;
  document.documentElement.classList.toggle("is-offline", !state.isOnline);
  if (!state.isOnline) showToast(OFFLINE_MESSAGE);
}

function ensureOnlineForSave() {
  updateNetworkStatus();
  if (state.isOnline) return true;
  showToast(OFFLINE_MESSAGE);
  return false;
}

function setLoading(value) {
  state.loading = value;
  el.refreshButton.disabled = value;
  el.refreshButton.textContent = value ? "刷新中" : "刷新";
}

async function requestJson(url, options = {}) {
  if (!state.isOnline && String(url).startsWith("/api/")) {
    throw createOfflineError();
  }
  const headers = options.body instanceof FormData
    ? options.headers || {}
    : { "Content-Type": "application/json", ...(options.headers || {}) };
  let res;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers,
      ...options
    });
  } catch (err) {
    updateNetworkStatus();
    if (!state.isOnline) throw createOfflineError();
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    if (res.status === 401) {
      state.user = null;
      showLogin();
    }
    const err = new Error(data.message || "操作失败");
    err.code = data.code;
    err.data = data;
    throw err;
  }
  return data.data;
}

function callBusiness(action, payload = {}) {
  if (mutatingBusinessActions.has(action) && !ensureOnlineForSave()) {
    return Promise.reject(createOfflineError());
  }
  return requestJson("/api/business", {
    method: "POST",
    body: JSON.stringify({ action, ...payload })
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").then((registration) => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
    registration.update().catch(() => {});
  }).catch(() => {});
}

function showLogin() {
  el.loginScreen.hidden = false;
  el.appScreen.hidden = true;
}

function showApp() {
  el.loginScreen.hidden = true;
  el.appScreen.hidden = false;
  el.currentUser.textContent = state.user ? `${state.user.name}（${state.user.username}）` : "-";
  renderView();
  if (!state.settingsExternalLinks.loaded) {
    loadSettingsExternalLinks();
  }
}

function setView(view, options = {}) {
  state.view = view;
  if (!["members", "member-detail", "member-edit", "record-detail", ...settingsConfigViews].includes(view)) {
    state.previousView = view;
  }
  if (view === "home") {
    state.summaryExpanded = false;
    loadHome();
  }
  if (view === "members") {
    if (options.from) state.previousView = options.from;
    loadMembers();
  }
  if (view === "guest") {
    openGuestCheckout();
    return;
  }
  if (view === "member-edit" && options.memberId !== undefined) {
    openMemberEdit(options.memberId, options.returnView || "members");
    return;
  }
  if (view === "member-recharge") {
    openMemberRecharge(options.memberId || state.selectedMemberId);
    return;
  }
  if (view === "member-checkout") {
    openMemberCheckout(options.memberId || state.selectedMemberId);
    return;
  }
  if (view === "record-detail" && options.recordId) {
    openRecordDetail(options.recordId, options.returnView || state.previousView || "home");
    return;
  }
  if (settingsConfigViews.includes(view)) {
    renderView();
    loadSettingsConfig(view);
    return;
  }
  renderView();
}

function goBack() {
  if (settingsConfigViews.includes(state.view)) {
    setView("settings");
    return;
  }
  if (state.view === "record-detail") {
    returnFromRecordDetail();
    return;
  }
  if (state.view === "member-checkout") {
    if (state.selectedMemberId) {
      state.view = "member-detail";
      renderView();
      loadMemberDetail();
      return;
    }
    setView("members", { from: state.previousView || "entry" });
    return;
  }
  if (state.view === "member-recharge") {
    if (state.selectedMemberId) {
      state.view = "member-detail";
      renderView();
      loadMemberDetail();
      return;
    }
    setView("members", { from: state.previousView || "entry" });
    return;
  }
  if (state.view === "guest") {
    setView("entry");
    return;
  }
  if (state.view === "member-edit") {
    if (state.editReturnView === "member-detail" && state.selectedMemberId) {
      state.view = "member-detail";
      renderView();
      return;
    }
    setView("members", { from: state.previousView || "entry" });
    return;
  }
  if (state.view === "member-detail") {
    setView("members", { from: state.previousView || "entry" });
    return;
  }
  if (state.view === "members") {
    setView(state.previousView || "entry");
    return;
  }
  setView("entry");
}

function renderView() {
  const title = titles[state.view] || titles.entry;
  el.pageTitle.textContent = title.title;
  el.pageSubtitle.textContent = title.subtitle;
  el.backButton.hidden = !["members", "member-detail", "member-edit", "record-detail", ...settingsConfigViews].includes(state.view);
  if (["guest", "member-recharge", "member-checkout"].includes(state.view)) el.backButton.hidden = false;
  el.refreshButton.hidden = !["home", "members", "member-detail", "guest", "member-recharge", "member-checkout", "record-detail", ...settingsConfigViews].includes(state.view);
  document.querySelector(".tabbar").hidden = !["entry", "home", "settings"].includes(state.view);

  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.dataset.view !== state.view;
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === state.view);
  });

  renderSummaryToggle();
  renderSettingsExternalLinks();
}

function renderSummaryToggle() {
  el.summaryBody.hidden = !state.summaryExpanded;
  el.summaryToggle.textContent = state.summaryExpanded ? "折叠" : "展开";
}

function renderRecords(records) {
  const list = Array.isArray(records) ? records : [];
  el.recordsEmpty.hidden = list.length > 0;
  el.recordList.innerHTML = "";

  list.forEach((record) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `list-item${record.status === "void" ? " void-record" : ""}`;
    item.dataset.recordId = record._id || "";
    item.innerHTML = `
      <span class="record-top">
        <strong class="sub-title"></strong>
        ${record.status === "void" ? '<span class="tag red">已作废</span>' : ""}
      </span>
      <span class="record-name"></span>
      <span class="record-money">
        <strong class="money"></strong>
        <span class="muted"></span>
      </span>
    `;
    item.querySelector(".record-top strong").textContent = formatRecordType(record.type);
    item.querySelector(".record-name").textContent = formatRecordSummary(record) || record.memberName || record.cardName || "-";
    item.querySelector(".record-money strong").textContent = `实收 ${money(record.actualReceivedCent)}`;
    item.querySelector(".record-money .muted").textContent = formatPayment(record.paymentMethod);
    item.addEventListener("click", () => openRecordDetail(record._id, "home"));
    el.recordList.appendChild(item);
  });
}

function renderMembers(members) {
  const list = Array.isArray(members) ? members : [];
  const isSearching = !!normalizeText(state.memberKeyword);
  el.membersEmpty.hidden = list.length > 0;
  el.memberList.innerHTML = "";

  if (isSearching) {
    el.memberList.classList.remove("indexed");
    renderMemberAlphaIndex([]);
    list.forEach((member) => el.memberList.appendChild(createMemberItem(member)));
    return;
  }

  const groups = groupMembersByInitial(list);
  el.memberList.classList.toggle("indexed", groups.length > 0);
  groups.forEach((group) => {
    const anchor = document.createElement("div");
    anchor.className = "member-group-anchor";
    anchor.dataset.memberGroupAnchor = group.letter;
    el.memberList.appendChild(anchor);

    const title = document.createElement("div");
    title.className = "member-group-title";
    title.dataset.memberGroup = group.letter;
    title.textContent = group.letter;
    el.memberList.appendChild(title);

    group.items.forEach((member) => {
      el.memberList.appendChild(createMemberItem(member));
    });
  });
  renderMemberAlphaIndex(groups.map((group) => group.letter));
}

function createMemberItem(member) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "list-item member-item";
  const name = document.createElement("strong");
  const phone = document.createElement("span");
  name.textContent = member.name || "-";
  phone.textContent = member.phone || "";
  item.append(name, phone);
  item.addEventListener("click", () => showMemberDetail(member._id));
  return item;
}

function renderMemberAlphaIndex(letters) {
  if (!el.memberAlphaIndex) return;
  const list = Array.isArray(letters) ? letters : [];
  const shouldShow = state.view === "members" && list.length > 0 && !normalizeText(state.memberKeyword);
  el.memberAlphaIndex.hidden = !shouldShow;
  el.memberAlphaIndex.innerHTML = "";
  if (!shouldShow) return;

  list.forEach((letter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "member-alpha-letter";
    button.dataset.alphaLetter = letter;
    button.textContent = letter;
    el.memberAlphaIndex.appendChild(button);
  });
}

function findMemberGroupAnchor(letter) {
  return Array.from(el.memberList.querySelectorAll("[data-member-group-anchor]"))
    .find((item) => item.dataset.memberGroupAnchor === letter) || null;
}

function showMemberAlphaOverlay(letter) {
  if (!el.memberAlphaOverlay) return;
  window.clearTimeout(state.memberAlphaOverlayTimer);
  el.memberAlphaOverlay.textContent = letter;
  el.memberAlphaOverlay.hidden = false;
  state.memberAlphaOverlayTimer = window.setTimeout(() => {
    el.memberAlphaOverlay.hidden = true;
  }, 650);
}

function jumpToMemberGroup(letter) {
  if (!letter) return;
  const anchor = findMemberGroupAnchor(letter);
  if (!anchor) return;
  const appHeader = document.querySelector(".app-header");
  const headerHeight = appHeader ? appHeader.getBoundingClientRect().height : 0;
  anchor.style.scrollMarginTop = `${Math.ceil(headerHeight + 8)}px`;
  anchor.scrollIntoView({ block: "start", behavior: "auto" });
  showMemberAlphaOverlay(letter);
}

function memberAlphaLetterFromPoint(clientX, clientY) {
  if (!el.memberAlphaIndex || el.memberAlphaIndex.hidden) return "";
  const letters = Array.from(el.memberAlphaIndex.querySelectorAll("[data-alpha-letter]"));
  if (letters.length === 0) return "";

  const indexRect = el.memberAlphaIndex.getBoundingClientRect();
  const clampedY = Math.min(Math.max(clientY, indexRect.top), indexRect.bottom);
  const directHit = letters.find((letterNode) => {
    const rect = letterNode.getBoundingClientRect();
    return clampedY >= rect.top && clampedY <= rect.bottom;
  });
  if (directHit) return directHit.dataset.alphaLetter || "";

  return letters.reduce((closest, letterNode) => {
    const rect = letterNode.getBoundingClientRect();
    const distance = Math.abs(clampedY - (rect.top + rect.height / 2));
    if (!closest || distance < closest.distance) return { letterNode, distance };
    return closest;
  }, null).letterNode.dataset.alphaLetter || "";
}

function handleMemberAlphaPointer(event) {
  const letter = memberAlphaLetterFromPoint(event.clientX, event.clientY);
  if (!letter) return;
  event.preventDefault();
  jumpToMemberGroup(letter);
}

async function loadMembers() {
  if (state.loading) return;
  setLoading(true);
  try {
    const members = await callBusiness("listMembers", { keyword: state.memberKeyword });
    state.members = members || [];
    renderMembers(state.members);
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function renderCards(cards) {
  const list = Array.isArray(cards) ? cards : [];
  el.cardsEmpty.hidden = list.length > 0;
  el.cardList.innerHTML = "";

  list.forEach((card) => {
    const row = document.createElement("div");
    row.className = "card-row";
    const name = document.createElement("span");
    const times = document.createElement("strong");
    times.className = "money";
    name.textContent = card.cardName || "-";
    times.textContent = `${Number(card.remainingTimes || 0)} 次`;
    row.append(name, times);
    el.cardList.appendChild(row);
  });
}

function renderMemberRecords(records) {
  const list = Array.isArray(records) ? records : [];
  el.memberRecordsEmpty.hidden = list.length > 0;
  el.memberRecordList.innerHTML = "";

  list.forEach((record) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `list-item${record.status === "void" ? " void-record" : ""}`;
    item.innerHTML = `
      <span class="record-top">
        <strong class="sub-title"></strong>
        <span class="tag"></span>
      </span>
      <span class="record-name"></span>
      <span class="record-money">
        <strong class="money"></strong>
        <span class="muted"></span>
      </span>
    `;
    item.querySelector(".record-top strong").textContent = formatRecordType(record.type);
    const statusTag = item.querySelector(".tag");
    statusTag.textContent = record.status === "void" ? "已作废" : "有效";
    statusTag.classList.toggle("red", record.status === "void");
    item.querySelector(".record-name").textContent = formatDateTime(record.occurredAt || record.createdAt);
    item.querySelector(".record-money strong").textContent = `实收 ${money(record.actualReceivedCent)}`;
    item.querySelector(".record-money .muted").textContent = formatRecordSummary(record) || record.cardName || record.discountLabel || "";
    item.addEventListener("click", () => openRecordDetail(record._id, "member-detail"));
    el.memberRecordList.appendChild(item);
  });
}

function renderRecordRows(rows) {
  el.recordDetailRows.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "detail-row";
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.className = "detail-label";
    value.className = "detail-value";
    label.textContent = row.label;
    value.textContent = row.value;
    item.append(label, value);
    el.recordDetailRows.appendChild(item);
  });
}

function renderRecordServices(record) {
  const items = normalizeRecordServiceItems(record);
  el.recordDetailServicesPanel.hidden = items.length === 0;
  el.recordDetailServices.innerHTML = "";

  items.forEach((service) => {
    const item = document.createElement("div");
    item.className = "detail-item";
    const main = document.createElement("div");
    const name = document.createElement("strong");
    const sub = document.createElement("p");
    const amount = document.createElement("strong");
    main.className = "detail-main";
    sub.className = "detail-sub";
    amount.className = "money";
    name.textContent = service.name || "-";
    sub.textContent = "原价";
    amount.textContent = money(service.amountCent);
    main.append(name, sub);
    item.append(main, amount);
    el.recordDetailServices.appendChild(item);
  });
}

function renderRecordCards(record) {
  const items = normalizeRecordCardItems(record);
  el.recordDetailCardsPanel.hidden = items.length === 0;
  el.recordDetailCardsTitle.textContent = record && record.type === "member_initial_balance" ? "初始次卡" : "次卡明细";
  el.recordDetailCards.innerHTML = "";

  items.forEach((card) => {
    const item = document.createElement("div");
    item.className = "detail-item";
    const main = document.createElement("div");
    const name = document.createElement("strong");
    const sub = document.createElement("p");
    const value = document.createElement("strong");
    main.className = "detail-main";
    sub.className = "detail-sub";
    value.className = "money";
    name.textContent = card.name || "-";
    sub.textContent = card.note || "";
    value.textContent = card.value || "";
    main.append(name, sub);
    item.append(main, value);
    el.recordDetailCards.appendChild(item);
  });
}

function renderRecordDetail(record) {
  state.recordDetail.record = record || null;
  const safeRecord = record || {};
  const status = safeRecord.status || "active";
  const signatureUrl = safeRecord.signatureFileId ? `/api/files/${encodeURIComponent(safeRecord.signatureFileId)}` : "";

  el.recordDetailType.textContent = formatRecordType(safeRecord.type);
  el.recordDetailTime.textContent = formatDateTime(safeRecord.occurredAt || safeRecord.createdAt);
  el.recordDetailStatus.textContent = formatRecordStatus(status);
  el.recordDetailStatus.classList.toggle("red", status === "void");
  el.recordDetailVoidReason.hidden = status !== "void";
  el.recordDetailVoidReason.textContent = safeRecord.voidReason ? `作废原因：${safeRecord.voidReason}` : "已作废";

  renderRecordRows(buildRecordRows(safeRecord));
  renderRecordServices(safeRecord);
  renderRecordCards(safeRecord);

  el.recordDetailRemarkPanel.hidden = !safeRecord.remark;
  el.recordDetailRemark.textContent = safeRecord.remark || "";

  el.recordDetailSignaturePanel.hidden = !signatureUrl;
  el.recordDetailSignatureTime.textContent = safeRecord.signatureSignedAt
    ? `签字时间：${formatDateTime(safeRecord.signatureSignedAt)}`
    : "已签字";
  el.recordDetailSignature.src = signatureUrl;
  el.recordDetailOpenSignature.dataset.url = signatureUrl;

  el.recordDetailVoid.hidden = status !== "active";
  el.recordDetailVoid.disabled = false;
  el.recordDetailVoid.textContent = "作废记录";
}

async function loadRecordDetail() {
  if (!state.recordDetail.recordId || state.loading) return;
  setLoading(true);
  try {
    const record = await callBusiness("getRecord", { recordId: state.recordDetail.recordId });
    renderRecordDetail(record);
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function openRecordDetail(recordId, returnView) {
  if (!recordId) return;
  state.recordDetail.recordId = recordId;
  state.recordDetail.returnView = returnView || state.view || "home";
  state.recordDetail.record = null;
  state.view = "record-detail";
  renderView();
  loadRecordDetail();
}

function returnFromRecordDetail() {
  const target = state.recordDetail.returnView || "home";
  if (target === "member-detail" && state.selectedMemberId) {
    state.view = "member-detail";
    renderView();
    loadMemberDetail();
    return;
  }
  if (target === "home") {
    state.view = "home";
    renderView();
    loadHome();
    return;
  }
  setView(target);
}

async function voidCurrentRecord() {
  const record = state.recordDetail.record;
  if (!record || !record._id || record.status !== "active") return;
  const input = window.prompt("请输入作废原因", "手动作废");
  if (input === null) return;
  const reason = normalizeText(input) || "手动作废";

  el.recordDetailVoid.disabled = true;
  el.recordDetailVoid.textContent = "作废中...";
  try {
    await callBusiness("voidRecord", { recordId: record._id, reason });
    showToast("已作废");
    await loadRecordDetail();
  } catch (err) {
    showToast(err.message);
    el.recordDetailVoid.disabled = false;
    el.recordDetailVoid.textContent = "作废记录";
  }
}

function setCategoryForm(form) {
  state.settingsConfig.categoryForm = { ...emptyCategoryForm(), ...(form || {}) };
  el.categoryFormTitle.textContent = state.settingsConfig.categoryForm.id ? "编辑服务分类" : "新增服务分类";
  el.categoryName.value = state.settingsConfig.categoryForm.name;
}

function renderCategoryList() {
  const list = state.settingsConfig.categories || [];
  el.settingsCategoryEmpty.hidden = list.length > 0;
  el.settingsCategoryList.innerHTML = "";

  list.forEach((category) => {
    const item = document.createElement("div");
    item.className = `list-item config-row${category.enabled === false ? " is-disabled" : ""}`;

    const main = document.createElement("div");
    main.className = "config-main";
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    title.className = "sub-title config-title";
    meta.className = "muted config-meta";
    title.textContent = category.name || "-";
    meta.textContent = "新增分类会自动生成“其他”项目";
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "inline-actions";
    const status = document.createElement("span");
    status.className = `tag${category.enabled === false ? " red" : ""}`;
    status.textContent = category.enabled === false ? "停用" : "启用";
    const edit = document.createElement("button");
    edit.className = "secondary inline-btn";
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => setCategoryForm({ id: category._id, name: category.name || "" }));
    const toggle = document.createElement("button");
    toggle.className = category.enabled === false ? "green-btn inline-btn" : "red-btn inline-btn";
    toggle.type = "button";
    toggle.textContent = category.enabled === false ? "启用" : "停用";
    toggle.addEventListener("click", () => toggleServiceCategory(category._id, category.enabled === false));
    actions.append(status, edit, toggle);

    item.append(main, actions);
    el.settingsCategoryList.appendChild(item);
  });
}

async function loadServiceCategories() {
  if (state.loading) return;
  setLoading(true);
  try {
    const categories = await callBusiness("listServiceCategories");
    state.settingsConfig.categories = categories || [];
    renderCategoryList();
    setCategoryForm(state.settingsConfig.categoryForm);
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

async function saveServiceCategoryForm(event) {
  event.preventDefault();
  const form = state.settingsConfig.categoryForm;
  try {
    await callBusiness("saveServiceCategory", {
      id: form.id,
      name: el.categoryName.value,
      enabled: true
    });
    showToast("已保存");
    setCategoryForm(emptyCategoryForm());
    await loadServiceCategories();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleServiceCategory(id, enabled) {
  if (!id) return;
  try {
    await callBusiness("toggleServiceCategory", { id, enabled });
    await loadServiceCategories();
  } catch (err) {
    showToast(err.message);
  }
}

function isOtherService(service) {
  return !!service && (service.isOther || service.name === "其他");
}

function compareSettingsServices(a, b) {
  const aOther = isOtherService(a);
  const bOther = isOtherService(b);
  if (aOther !== bOther) return aOther ? 1 : -1;
  if (!aOther && Number(a.usageCount || 0) !== Number(b.usageCount || 0)) {
    return Number(b.usageCount || 0) - Number(a.usageCount || 0);
  }
  return String(a.name || "").localeCompare(String(b.name || ""), "zh-Hans");
}

function normalizeServiceCatalog(catalog) {
  const groups = (catalog || []).map((category) => ({
    ...category,
    enabled: category.enabled !== false,
    services: (category.services || []).slice().sort(compareSettingsServices)
  }));
  return {
    groups,
    services: groups.reduce((list, group) => list.concat(group.services || []), [])
  };
}

function setServiceForm(form) {
  state.settingsConfig.serviceForm = { ...emptyServiceForm(), ...(form || {}) };
  const data = state.settingsConfig.serviceForm;
  el.serviceFormTitle.textContent = data.id ? "编辑服务项目" : `新增${data.categoryName || ""}项目`;
  el.serviceCategoryReadonly.textContent = data.categoryName || "-";
  el.serviceName.value = data.name || "";
  el.serviceRemark.value = data.remark || "";
}

function renderServices() {
  const mode = state.settingsConfig.serviceMode;
  const groups = state.settingsConfig.serviceGroups || [];
  el.serviceForm.hidden = mode !== "form";
  el.serviceGroups.hidden = mode === "form";
  setServiceForm(state.settingsConfig.serviceForm);

  if (mode === "form") return;
  el.serviceGroups.innerHTML = "";
  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "暂无服务分类";
    el.serviceGroups.appendChild(empty);
    return;
  }

  groups.forEach((group) => {
    const panel = document.createElement("article");
    panel.className = "panel stack service-group";

    const head = document.createElement("div");
    head.className = "row";
    const title = document.createElement("strong");
    const count = document.createElement("span");
    title.className = "sub-title";
    count.className = `tag${group.enabled === false ? " red" : ""}`;
    title.textContent = group.name || "-";
    count.textContent = group.enabled === false ? "分类已停用" : `${(group.services || []).length} 项`;
    head.append(title, count);
    panel.appendChild(head);

    const list = document.createElement("div");
    list.className = "config-list";
    if (!group.services || group.services.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty compact-empty";
      empty.textContent = "暂无服务项目";
      list.appendChild(empty);
    } else {
      group.services.forEach((service) => {
        const row = document.createElement("div");
        row.className = `config-row${service.enabled === false || group.enabled === false ? " is-disabled" : ""}`;

        const main = document.createElement("div");
        main.className = "config-main";
        const name = document.createElement("strong");
        const meta = document.createElement("span");
        name.className = "sub-title config-title";
        meta.className = "muted config-meta";
        name.textContent = service.name || "-";
        meta.textContent = service.remark || (isOtherService(service) ? "系统项目" : `${Number(service.usageCount || 0)} 次使用`);
        main.append(name, meta);

        const actions = document.createElement("div");
        actions.className = "inline-actions";
        if (isOtherService(service)) {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = "系统";
          actions.appendChild(tag);
        } else {
          const edit = document.createElement("button");
          edit.className = "secondary inline-btn";
          edit.type = "button";
          edit.textContent = "编辑";
          edit.addEventListener("click", () => editService(service._id));
          const toggle = document.createElement("button");
          toggle.className = service.enabled === false ? "green-btn inline-btn" : "red-btn inline-btn";
          toggle.type = "button";
          toggle.textContent = service.enabled === false ? "启用" : "停用";
          toggle.addEventListener("click", () => toggleServiceItem(service._id, service.enabled === false));
          actions.append(edit, toggle);
        }

        row.append(main, actions);
        list.appendChild(row);
      });
    }
    panel.appendChild(list);

    const add = document.createElement("button");
    add.className = "secondary full-button";
    add.type = "button";
    add.textContent = `新增${group.name || ""}项目`;
    add.disabled = !group._id;
    add.addEventListener("click", () => startAddService(group));
    panel.appendChild(add);
    el.serviceGroups.appendChild(panel);
  });
}

async function loadServices() {
  if (state.loading) return;
  setLoading(true);
  try {
    const catalog = await callBusiness("listServiceCatalog", { onlyEnabled: false });
    const normalized = normalizeServiceCatalog(catalog);
    state.settingsConfig.serviceGroups = normalized.groups;
    state.settingsConfig.services = normalized.services;
    renderServices();
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function startAddService(group) {
  if (!group || !group._id) {
    showToast("服务分类未初始化");
    return;
  }
  state.settingsConfig.serviceMode = "form";
  setServiceForm({
    categoryId: group._id,
    categoryName: group.name || ""
  });
  renderServices();
}

function editService(id) {
  const item = state.settingsConfig.services.find((service) => service._id === id);
  if (!item) return;
  if (isOtherService(item)) {
    showToast("系统项目不能编辑");
    return;
  }
  state.settingsConfig.serviceMode = "form";
  setServiceForm({
    id: item._id,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    name: item.name,
    remark: item.remark || ""
  });
  renderServices();
}

async function saveServiceForm(event) {
  event.preventDefault();
  const form = state.settingsConfig.serviceForm;
  try {
    await callBusiness("saveService", {
      id: form.id,
      categoryId: form.categoryId,
      name: el.serviceName.value,
      remark: el.serviceRemark.value,
      enabled: true
    });
    showToast("已保存");
    state.settingsConfig.serviceMode = "list";
    setServiceForm(emptyServiceForm());
    await loadServices();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleServiceItem(id, enabled) {
  if (!id) return;
  try {
    await callBusiness("toggleService", { id, enabled });
    await loadServices();
  } catch (err) {
    showToast(err.message);
  }
}

function setTierForm(form) {
  state.settingsConfig.tierForm = { ...emptyTierForm(), ...(form || {}) };
  const data = state.settingsConfig.tierForm;
  el.tierFormTitle.textContent = data.id ? "编辑充值档位" : "新增充值档位";
  el.tierAmount.value = data.amountYuan || "";
  el.tierDiscount.value = data.discount || "";
}

function renderRechargeTiers() {
  const mode = state.settingsConfig.tierMode;
  const tiers = state.settingsConfig.tiers || [];
  el.tierForm.hidden = mode !== "form";
  el.tierFixedAction.hidden = mode === "form";
  el.tierEmpty.hidden = mode === "form" || tiers.length > 0;
  el.tierList.hidden = mode === "form";
  el.tierList.innerHTML = "";
  setTierForm(state.settingsConfig.tierForm);
  if (mode === "form") return;

  tiers.forEach((tier) => {
    const row = document.createElement("div");
    row.className = "list-item config-row";
    const main = document.createElement("div");
    main.className = "config-main";
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    title.className = "sub-title config-title";
    meta.className = "muted config-meta";
    title.textContent = `充 ${money(tier.amountCent)}`;
    meta.textContent = tier.discountLabel || formatDiscount(tier.discount);
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "inline-actions";
    const edit = document.createElement("button");
    edit.className = "secondary inline-btn";
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => editRechargeTier(tier._id));
    actions.appendChild(edit);
    row.append(main, actions);
    el.tierList.appendChild(row);
  });
}

async function loadRechargeTiers() {
  if (state.loading) return;
  setLoading(true);
  try {
    const tiers = await callBusiness("listRechargeTiers");
    state.settingsConfig.tiers = tiers || [];
    renderRechargeTiers();
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function startAddRechargeTier() {
  state.settingsConfig.tierMode = "form";
  setTierForm(emptyTierForm());
  renderRechargeTiers();
}

function editRechargeTier(id) {
  const item = state.settingsConfig.tiers.find((tier) => tier._id === id);
  if (!item) return;
  state.settingsConfig.tierMode = "form";
  setTierForm({
    id: item._id,
    amountYuan: centToYuan(item.amountCent),
    discount: String(item.discount || "")
  });
  renderRechargeTiers();
}

async function saveRechargeTierForm(event) {
  event.preventDefault();
  const form = state.settingsConfig.tierForm;
  try {
    await callBusiness("saveRechargeTier", {
      id: form.id,
      amountCent: yuanInputToCent(el.tierAmount.value),
      discount: el.tierDiscount.value
    });
    showToast("已保存");
    state.settingsConfig.tierMode = "list";
    setTierForm(emptyTierForm());
    await loadRechargeTiers();
  } catch (err) {
    showToast(err.message);
  }
}

function setCardTypeForm(form) {
  state.settingsConfig.cardTypeForm = { ...emptyCardTypeForm(), ...(form || {}) };
  const data = state.settingsConfig.cardTypeForm;
  el.cardTypeFormTitle.textContent = data.id ? "编辑次卡类型" : "新增次卡";
  el.cardTypeName.value = data.name || "";
  el.cardTypeTimes.value = data.totalTimes || "";
  el.cardTypePrice.value = data.priceYuan || "";
  el.cardTypeRemark.value = data.remark || "";
}

function renderCardTypes() {
  const mode = state.settingsConfig.cardTypeMode;
  const cards = state.settingsConfig.cardTypes || [];
  el.cardTypeForm.hidden = mode !== "form";
  el.cardTypeFixedAction.hidden = mode === "form";
  el.cardTypeEmpty.hidden = mode === "form" || cards.length > 0;
  el.cardTypeList.hidden = mode === "form";
  el.cardTypeList.innerHTML = "";
  setCardTypeForm(state.settingsConfig.cardTypeForm);
  if (mode === "form") return;

  cards.forEach((card) => {
    const row = document.createElement("div");
    row.className = `list-item config-row${card.enabled === false ? " is-disabled" : ""}`;
    const main = document.createElement("div");
    main.className = "config-main";
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    title.className = "sub-title config-title";
    meta.className = "muted config-meta";
    title.textContent = card.name || "-";
    meta.textContent = `${Number(card.totalTimes || 0)} 次，${money(card.priceCent)}`;
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "inline-actions";
    const edit = document.createElement("button");
    edit.className = "secondary inline-btn";
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => editCardType(card._id));
    const toggle = document.createElement("button");
    toggle.className = card.enabled === false ? "green-btn inline-btn" : "red-btn inline-btn";
    toggle.type = "button";
    toggle.textContent = card.enabled === false ? "启用" : "停用";
    toggle.addEventListener("click", () => toggleCardType(card._id, card.enabled === false));
    actions.append(edit, toggle);
    row.append(main, actions);
    el.cardTypeList.appendChild(row);
  });
}

async function loadCardTypes() {
  if (state.loading) return;
  setLoading(true);
  try {
    const cards = await callBusiness("listCardTypes");
    state.settingsConfig.cardTypes = cards || [];
    renderCardTypes();
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function startAddCardType() {
  state.settingsConfig.cardTypeMode = "form";
  setCardTypeForm(emptyCardTypeForm());
  renderCardTypes();
}

function editCardType(id) {
  const item = state.settingsConfig.cardTypes.find((card) => card._id === id);
  if (!item) return;
  state.settingsConfig.cardTypeMode = "form";
  setCardTypeForm({
    id: item._id,
    name: item.name || "",
    totalTimes: String(item.totalTimes || ""),
    priceYuan: centToYuan(item.priceCent),
    remark: item.remark || ""
  });
  renderCardTypes();
}

async function saveCardTypeForm(event) {
  event.preventDefault();
  const form = state.settingsConfig.cardTypeForm;
  try {
    await callBusiness("saveCardType", {
      id: form.id,
      name: el.cardTypeName.value,
      totalTimes: Number(el.cardTypeTimes.value || 0),
      priceCent: yuanInputToCent(el.cardTypePrice.value),
      remark: el.cardTypeRemark.value,
      enabled: true
    });
    showToast("已保存");
    state.settingsConfig.cardTypeMode = "list";
    setCardTypeForm(emptyCardTypeForm());
    await loadCardTypes();
  } catch (err) {
    showToast(err.message);
  }
}

async function toggleCardType(id, enabled) {
  if (!id) return;
  try {
    await callBusiness("toggleCardType", { id, enabled });
    await loadCardTypes();
  } catch (err) {
    showToast(err.message);
  }
}

function loadSettingsConfig(view) {
  if (view === "service-categories") return loadServiceCategories();
  if (view === "services") return loadServices();
  if (view === "recharge-tiers") return loadRechargeTiers();
  if (view === "card-types") return loadCardTypes();
  return null;
}

async function loadSettingsExternalLinks() {
  try {
    const res = await fetch(APP_CONFIG_URL, {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!res.ok) throw new Error("APP_CONFIG_LOAD_FAILED");
    const config = await res.json();
    applySettingsExternalLinksConfig(config && config.settingsExternalLinks);
  } catch (err) {
    applySettingsExternalLinksConfig(null);
  } finally {
    state.settingsExternalLinks.loaded = true;
    renderSettingsExternalLinks();
  }
}

function renderSettingsExternalLinks() {
  if (!el.settingsExternalLinksDivider || !el.settingsExternalLinkList) return;
  const items = state.settingsExternalLinks.items || [];
  const hasItems = items.length > 0;

  el.settingsExternalLinksDivider.hidden = !hasItems || !state.settingsExternalLinks.dividerBefore;
  el.settingsExternalLinkList.hidden = !hasItems;
  el.settingsExternalLinkList.innerHTML = "";

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-button settings-external-link";
    button.textContent = item.name;
    button.dataset.externalLinkId = item.id;
    button.dataset.externalUrl = item.url;
    button.addEventListener("click", () => {
      window.location.href = item.url;
    });
    el.settingsExternalLinkList.appendChild(button);
  });
}

function renderMemberDetail(data) {
  const member = data.member || {};
  const birthdayText = formatBirthday(member);
  const offlineTraceText = formatOfflineTrace(member);

  el.memberName.textContent = member.name || "-";
  el.memberPhone.textContent = member.phone || "-";
  el.memberBalance.textContent = money(member.balanceCent);
  el.memberDiscount.textContent = formatDiscount(member.currentDiscount);

  el.memberRemark.hidden = !member.remark;
  el.memberRemark.textContent = member.remark || "";

  el.memberBirthdayBox.hidden = !birthdayText;
  el.memberBirthday.textContent = birthdayText;
  el.memberOfflineBox.hidden = !offlineTraceText;
  el.memberOffline.textContent = offlineTraceText;
  el.memberMeta.hidden = !birthdayText && !offlineTraceText;

  renderCards(member.cardBalances || []);
  renderMemberRecords(data.records || []);
}

async function showMemberDetail(memberId) {
  if (!memberId) return;
  state.selectedMemberId = memberId;
  state.view = "member-detail";
  renderView();
  await loadMemberDetail();
}

async function loadMemberDetail() {
  if (state.loading || !state.selectedMemberId) return;
  setLoading(true);
  try {
    const data = await callBusiness("getMemberDetail", { memberId: state.selectedMemberId });
    renderMemberDetail(data || {});
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function renderBirthdayControls() {
  el.birthdayMonths.innerHTML = "";
  const selectedMonth = state.editForm.birthdayMonth;
  const months = selectedMonth ? [selectedMonth] : monthOptions;

  months.forEach((month) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `choice-chip${selectedMonth === month ? " active" : ""}`;
    button.textContent = `${month}月`;
    button.addEventListener("click", () => {
      state.editForm.birthdayMonth = selectedMonth === month ? "" : month;
      state.editForm.birthdayDay = "";
      renderBirthdayControls();
    });
    el.birthdayMonths.appendChild(button);
  });

  el.birthdayDays.innerHTML = "";
  if (!state.editForm.birthdayMonth) return;

  getDayOptions(state.editForm.birthdayMonth).forEach((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `choice-chip${state.editForm.birthdayDay === day ? " active" : ""}`;
    button.textContent = day;
    button.addEventListener("click", () => {
      state.editForm.birthdayDay = state.editForm.birthdayDay === day ? "" : day;
      renderBirthdayControls();
    });
    el.birthdayDays.appendChild(button);
  });
}

function renderImportControls() {
  const isEdit = !!state.editMemberId;
  el.importToggle.hidden = isEdit;
  el.importPanel.hidden = isEdit || !state.importExpanded;
  el.importToggle.textContent = state.importExpanded ? "收起补录老会员信息" : "补录老会员信息";

  el.importBalance.value = state.importForm.initialBalanceYuan;
  el.importDiscount.value = state.importForm.discount;
  el.importPage.value = state.importForm.offlinePage;

  document.querySelectorAll("[data-discount]").forEach((button) => {
    button.classList.toggle("active", button.dataset.discount === state.importForm.discount);
  });
  document.querySelectorAll("[data-book]").forEach((button) => {
    button.classList.toggle("active", button.dataset.book === state.importForm.offlineBook);
  });
}

function renderInitialCardTypes() {
  const cards = state.initialCardTypes || [];
  el.initialCardLoading.hidden = true;
  el.initialCardEmpty.hidden = cards.length > 0;
  el.initialCardList.innerHTML = "";

  cards.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `initial-card-option${card.selected ? " active" : ""}`;
    button.innerHTML = `
      <span class="initial-card-row">
        <strong class="initial-card-name"></strong>
        <span class="initial-card-meta"></span>
      </span>
    `;
    button.querySelector(".initial-card-name").textContent = card.name || "-";
    button.querySelector(".initial-card-meta").textContent = `默认 ${card.totalTimes || 0} 次`;
    button.addEventListener("click", () => {
      card.selected = !card.selected;
      if (!card.selected) card.initialTimes = "";
      renderInitialCardTypes();
    });

    if (card.selected) {
      const row = document.createElement("label");
      row.className = "initial-times-row";
      row.innerHTML = `
        <span class="muted">剩余次数</span>
        <input class="compact-input initial-times-input" inputmode="numeric" placeholder="正整数">
      `;
      const input = row.querySelector("input");
      input.value = card.initialTimes || "";
      input.addEventListener("click", (event) => event.stopPropagation());
      input.addEventListener("input", (event) => {
        card.initialTimes = event.target.value;
      });
      button.appendChild(row);
    }

    el.initialCardList.appendChild(button);
  });
}

function renderMemberEditForm() {
  el.editName.value = state.editForm.name;
  el.editPhone.value = state.editForm.phone;
  el.editRemark.value = state.editForm.remark;
  renderBirthdayControls();
  renderImportControls();
  renderInitialCardTypes();
}

async function loadInitialCardTypes() {
  if (state.editMemberId) return;
  el.initialCardLoading.hidden = false;
  el.initialCardEmpty.hidden = true;
  el.initialCardList.innerHTML = "";
  try {
    const config = await callBusiness("getBasicConfig");
    state.initialCardTypes = (config.cardTypes || []).map((card) => ({
      ...card,
      selected: false,
      initialTimes: ""
    }));
    renderInitialCardTypes();
  } catch (err) {
    el.initialCardLoading.hidden = true;
    showToast(err.message);
  }
}

async function openMemberEdit(memberId = "", returnView = "members") {
  state.view = "member-edit";
  state.editMemberId = memberId || "";
  state.editReturnView = returnView;
  state.editForm = emptyEditForm();
  state.importExpanded = false;
  state.importForm = emptyImportForm();
  state.initialCardTypes = [];
  renderView();
  renderMemberEditForm();

  if (!state.editMemberId) {
    await loadInitialCardTypes();
    return;
  }

  setLoading(true);
  try {
    const data = await callBusiness("getMemberDetail", { memberId: state.editMemberId });
    const member = data.member || {};
    state.editForm = {
      name: member.name || "",
      phone: member.phone || "",
      remark: member.remark || "",
      birthdayMonth: member.birthdayMonth ? String(member.birthdayMonth) : "",
      birthdayDay: member.birthdayDay ? String(member.birthdayDay) : ""
    };
    renderMemberEditForm();
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function normalizeDiscountText(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const num = Number(text);
  if (!Number.isFinite(num) || num <= 0 || num >= 10) return "";
  return String(Math.round(num * 100) / 100);
}

function validateMemberEdit() {
  if (!normalizeText(state.editForm.name)) {
    showToast("会员姓名不能为空");
    return null;
  }
  if ((state.editForm.birthdayMonth && !state.editForm.birthdayDay) || (!state.editForm.birthdayMonth && state.editForm.birthdayDay)) {
    showToast("请选择完整生日");
    return null;
  }
  return {
    id: state.editMemberId,
    ...state.editForm
  };
}

function validateImportInfo() {
  const balanceText = normalizeText(state.importForm.initialBalanceYuan);
  let balanceCent = 0;
  if (balanceText) {
    const balance = Number(balanceText);
    if (!Number.isFinite(balance)) {
      showToast("初始余额必须是有效数字");
      return null;
    }
    if (balance < 0) {
      showToast("初始余额不能小于 0");
      return null;
    }
    balanceCent = Math.round(balance * 100);
  }

  const discount = normalizeDiscountText(state.importForm.discount);
  if (state.importForm.discount && !discount) {
    showToast("折扣必须在 0 到 10 之间");
    return null;
  }

  const offlineBook = normalizeText(state.importForm.offlineBook);
  const offlinePage = normalizeText(state.importForm.offlinePage);
  if ((offlineBook && !offlinePage) || (!offlineBook && offlinePage)) {
    showToast("来源本子和页码需要同时填写");
    return null;
  }
  if (offlinePage && (!/^[1-9]\d*$/.test(offlinePage))) {
    showToast("页码必须是正整数");
    return null;
  }

  const cardItems = [];
  for (const card of state.initialCardTypes.filter((item) => item.selected)) {
    const timesText = normalizeText(card.initialTimes);
    if (!timesText) {
      showToast("请填写已选次卡的剩余次数");
      return null;
    }
    if (!/^[1-9]\d*$/.test(timesText)) {
      showToast("剩余次数必须是正整数");
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
    cardItems
  };
}

async function submitMemberEdit(payload, importInfo) {
  el.saveMemberButton.disabled = true;
  el.saveMemberButton.textContent = "保存中";
  try {
    if (!state.editMemberId) {
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

    const result = await callBusiness("saveMember", payload);
    const memberId = state.editMemberId || result.id;
    showToast("已保存");
    state.selectedMemberId = memberId;
    await showMemberDetail(memberId);
  } catch (err) {
    showToast(err.message);
  } finally {
    el.saveMemberButton.disabled = false;
    el.saveMemberButton.textContent = "保存";
  }
}

function emptyGuestState() {
  return {
    categories: state.guest.categories,
    activeCategoryId: state.guest.activeCategoryId,
    selectedItems: [],
    selectedPayment: "",
    selectedServicePerson: state.guest.selectedServicePerson,
    servicePeople: state.guest.servicePeople,
    actualReceivedYuan: "",
    actualReceivedAutoSync: true,
    remark: "",
    configLoaded: state.guest.configLoaded
  };
}

function activeGuestCategory() {
  return state.guest.categories.find((item) => item._id === state.guest.activeCategoryId) || state.guest.categories[0] || null;
}

function selectedServiceMap() {
  return state.guest.selectedItems.reduce((acc, item) => {
    acc[item.serviceId] = true;
    return acc;
  }, {});
}

function guestTotalCent() {
  return state.guest.selectedItems.reduce((sum, item) => sum + yuanInputToCent(item.originalAmountYuan), 0);
}

function syncGuestActual() {
  const total = guestTotalCent();
  if (state.guest.selectedItems.length === 0) {
    state.guest.actualReceivedAutoSync = true;
    state.guest.actualReceivedYuan = "";
    return;
  }
  if (state.guest.actualReceivedAutoSync) {
    state.guest.actualReceivedYuan = centToYuan(total);
  }
}

function renderServicePeople() {
  const selected = state.guest.selectedServicePerson;
  el.selectedServicePerson.textContent = selected && selected.name ? selected.name : "加载中";
  el.servicePersonList.innerHTML = "";
  state.guest.servicePeople.forEach((person) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sheet-option${selected && selected.openid === person.openid ? " active" : ""}`;
    button.innerHTML = `<span></span><strong></strong>`;
    button.querySelector("span").textContent = person.name;
    button.querySelector("strong").textContent = selected && selected.openid === person.openid ? "已选" : "";
    button.addEventListener("click", () => {
      state.guest.selectedServicePerson = person;
      el.servicePersonSheet.hidden = true;
      renderServicePeople();
    });
    el.servicePersonList.appendChild(button);
  });
}

function renderServicePicker() {
  const selectedMap = selectedServiceMap();
  el.categoryList.innerHTML = "";
  el.serviceList.innerHTML = "";

  state.guest.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-item${category._id === state.guest.activeCategoryId ? " active" : ""}`;
    button.textContent = category.name;
    button.addEventListener("click", () => {
      state.guest.activeCategoryId = category._id;
      renderServicePicker();
    });
    el.categoryList.appendChild(button);
  });

  const category = activeGuestCategory();
  (category && category.services ? category.services : []).forEach((service) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `service-item${selectedMap[service._id] ? " selected" : ""}`;
    button.textContent = service.name || "-";
    button.addEventListener("click", () => toggleGuestService(category, service));
    el.serviceList.appendChild(button);
  });
}

function renderSelectedGuestItems() {
  el.selectedEmpty.hidden = state.guest.selectedItems.length > 0;
  el.selectedServiceList.innerHTML = "";
  state.guest.selectedItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "selected-item";
    row.innerHTML = `
      <strong></strong>
      <input class="price-input" inputmode="decimal" placeholder="单项原价">
      <button class="secondary remove-btn" type="button">移除</button>
    `;
    row.querySelector("strong").textContent = item.displayName;
    const input = row.querySelector("input");
    input.value = item.originalAmountYuan;
    input.addEventListener("input", (event) => {
      state.guest.selectedItems[index].originalAmountYuan = event.target.value;
      syncGuestActual();
      renderGuestTotals();
    });
    row.querySelector("button").addEventListener("click", () => {
      state.guest.selectedItems.splice(index, 1);
      syncGuestActual();
      renderGuest();
    });
    el.selectedServiceList.appendChild(row);
  });
}

function renderPayment() {
  document.querySelectorAll("[data-payment]").forEach((button) => {
    button.classList.toggle("active", button.dataset.payment === state.guest.selectedPayment);
  });
  const qrMap = {
    wechat: "/assets/payment/wechat.jfif",
    alipay: "/assets/payment/alipay.jfif"
  };
  const src = qrMap[state.guest.selectedPayment] || "";
  el.paymentQr.hidden = !src;
  if (src) el.paymentQr.src = src;
}

function renderGuestTotals() {
  el.guestTotal.textContent = money(guestTotalCent());
  el.guestActual.value = state.guest.actualReceivedYuan;
}

function renderGuest() {
  renderServicePeople();
  renderServicePicker();
  renderSelectedGuestItems();
  renderPayment();
  renderGuestTotals();
  el.guestRemark.value = state.guest.remark;
  el.guestConfigError.hidden = true;
  el.servicePicker.hidden = false;
}

function toggleGuestService(category, service) {
  const index = state.guest.selectedItems.findIndex((item) => item.serviceId === service._id);
  if (index >= 0) {
    state.guest.selectedItems.splice(index, 1);
  } else {
    state.guest.selectedItems.push({
      key: `${service._id}-${Date.now()}`,
      categoryId: category._id,
      categoryName: category.name,
      serviceId: service._id,
      serviceName: service.name,
      displayName: `${category.name}-${service.name}`,
      originalAmountYuan: ""
    });
  }
  syncGuestActual();
  renderGuest();
}

async function loadGuestConfig() {
  setLoading(true);
  try {
    const [config, people] = await Promise.all([
      callBusiness("getBasicConfig"),
      callBusiness("listServicePeople")
    ]);
    state.guest.categories = (config.serviceCatalog || []).filter((category) => (category.services || []).length > 0);
    state.guest.activeCategoryId = state.guest.categories[0] ? state.guest.categories[0]._id : "";
    state.guest.servicePeople = people || [];
    if (!state.guest.selectedServicePerson && state.user) {
      state.guest.selectedServicePerson = state.guest.servicePeople.find((person) => person.openid === state.user.id)
        || state.guest.servicePeople[0]
        || null;
    }
    state.guest.configLoaded = true;
    renderGuest();
  } catch (err) {
    el.guestConfigError.textContent = "配置加载失败，请重试";
    el.guestConfigError.hidden = false;
    el.servicePicker.hidden = true;
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

async function openGuestCheckout() {
  state.view = "guest";
  state.guest = emptyGuestState();
  renderView();
  renderGuest();
  await loadGuestConfig();
}

function validateGuest() {
  const person = state.guest.selectedServicePerson;
  if (!person || !person.openid || !person.name) {
    showToast("服务人信息加载失败，请重试");
    return null;
  }
  if (state.guest.selectedItems.length === 0) {
    showToast("请选择至少一个服务项目");
    return null;
  }
  const hasEmptyAmount = state.guest.selectedItems.some((item) => !normalizeText(item.originalAmountYuan));
  if (hasEmptyAmount) {
    showToast("请填写每个项目的单项原价");
    return null;
  }
  const invalidAmount = state.guest.selectedItems.some((item) => !Number.isFinite(Number(item.originalAmountYuan)) || Number(item.originalAmountYuan) < 0);
  if (invalidAmount) {
    showToast("单项原价不能小于 0");
    return null;
  }
  if (!state.guest.selectedPayment) {
    showToast("请选择支付方式");
    return null;
  }
  const actual = normalizeText(state.guest.actualReceivedYuan);
  if (!actual || !Number.isFinite(Number(actual)) || Number(actual) < 0) {
    showToast("请填写有效实收金额");
    return null;
  }
  return {
    serviceItems: state.guest.selectedItems.map((item) => ({
      serviceId: item.serviceId,
      originalAmountCent: yuanInputToCent(item.originalAmountYuan)
    })),
    actualReceivedCent: yuanInputToCent(state.guest.actualReceivedYuan),
    paymentMethod: state.guest.selectedPayment,
    servicePersonOpenid: person.openid,
    remark: state.guest.remark
  };
}

async function submitGuest() {
  const payload = validateGuest();
  if (!payload) return;
  el.guestSubmit.disabled = true;
  el.guestSubmit.textContent = "保存中";
  try {
    await callBusiness("createGuestConsumption", payload);
    showToast("已记录");
    state.guest = emptyGuestState();
    setView("home");
  } catch (err) {
    showToast(err.message);
  } finally {
    el.guestSubmit.disabled = false;
    el.guestSubmit.textContent = "保存记录";
  }
}

function emptyRechargeState() {
  return {
    member: null,
    tiers: [],
    cardTypes: [],
    selectedTierId: "",
    selectedCardIds: [],
    selectedPayment: "",
    remark: "",
    configLoaded: false
  };
}

function selectedRechargeTier() {
  return state.recharge.tiers.find((tier) => tier._id === state.recharge.selectedTierId) || null;
}

function selectedRechargeCards() {
  const selected = new Set(state.recharge.selectedCardIds);
  return state.recharge.cardTypes.filter((card) => selected.has(card._id));
}

function cardTotalTimes(cards) {
  return (cards || []).reduce((sum, card) => sum + Number(card.totalTimes || 0), 0);
}

function cardTotalPriceCent(cards) {
  return (cards || []).reduce((sum, card) => sum + Number(card.priceCent || 0), 0);
}

function renderRechargeMember() {
  const member = state.recharge.member || {};
  const cards = Array.isArray(member.cardBalances) ? member.cardBalances : [];
  el.rechargeMemberName.textContent = member.name || "-";
  el.rechargeMemberPhone.textContent = member.phone || "-";
  el.rechargeMemberBalance.textContent = money(member.balanceCent);
  el.rechargeMemberDiscount.textContent = formatDiscount(member.currentDiscount);
  el.rechargeMemberCardTotal.textContent = `${cards.reduce((sum, card) => sum + Number(card.remainingTimes || 0), 0)} 次`;
}

function renderRechargeOptions() {
  el.rechargeTierList.innerHTML = "";
  state.recharge.tiers.forEach((tier) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `select-option${tier._id === state.recharge.selectedTierId ? " active" : ""}`;
    button.innerHTML = `<span class="select-option-title"></span><span class="select-option-meta"></span>`;
    button.querySelector(".select-option-title").textContent = `充 ${money(tier.amountCent)}`;
    button.querySelector(".select-option-meta").textContent = `享 ${tier.discountLabel || formatDiscount(tier.discount)}`;
    button.addEventListener("click", () => {
      state.recharge.selectedTierId = tier._id === state.recharge.selectedTierId ? "" : tier._id;
      if (state.recharge.selectedTierId) state.recharge.selectedCardIds = [];
      renderRecharge();
    });
    el.rechargeTierList.appendChild(button);
  });

  el.rechargeCardList.innerHTML = "";
  el.rechargeCardEmpty.hidden = state.recharge.cardTypes.length > 0;
  const selected = new Set(state.recharge.selectedCardIds);
  state.recharge.cardTypes.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `select-option${selected.has(card._id) ? " active" : ""}`;
    button.innerHTML = `<span class="select-option-title"></span><span class="select-option-meta"></span>`;
    button.querySelector(".select-option-title").textContent = card.name || "-";
    button.querySelector(".select-option-meta").textContent = `${card.totalTimes || 0} 次 / ${money(card.priceCent)}`;
    button.addEventListener("click", () => {
      if (selected.has(card._id)) {
        state.recharge.selectedCardIds = state.recharge.selectedCardIds.filter((id) => id !== card._id);
      } else {
        state.recharge.selectedCardIds.push(card._id);
      }
      if (state.recharge.selectedCardIds.length > 0) state.recharge.selectedTierId = "";
      renderRecharge();
    });
    el.rechargeCardList.appendChild(button);
  });
}

function renderRechargePayment() {
  document.querySelectorAll("[data-recharge-payment]").forEach((button) => {
    button.classList.toggle("active", button.dataset.rechargePayment === state.recharge.selectedPayment);
  });
  const qrMap = {
    wechat: "/assets/payment/wechat.jfif",
    alipay: "/assets/payment/alipay.jfif"
  };
  const src = qrMap[state.recharge.selectedPayment] || "";
  el.rechargePaymentQr.hidden = !src;
  if (src) el.rechargePaymentQr.src = src;
}

function renderRechargeSummary() {
  const tier = selectedRechargeTier();
  const cards = selectedRechargeCards();
  el.rechargeTierSummary.hidden = !tier;
  el.rechargeCardSummary.hidden = cards.length === 0;

  if (tier) {
    el.rechargeSummaryAmount.textContent = money(tier.amountCent);
    el.rechargeSummaryDiscount.textContent = tier.discountLabel || formatDiscount(tier.discount);
    el.rechargeSummaryReceived.textContent = money(tier.amountCent);
  }

  el.rechargeCardSummaryList.innerHTML = "";
  cards.forEach((card) => {
    const row = document.createElement("div");
    row.className = "summary-row";
    row.innerHTML = `<span></span><strong class="money"></strong>`;
    row.querySelector("span").textContent = card.name || "-";
    row.querySelector("strong").textContent = `+${card.totalTimes || 0} 次 / ${money(card.priceCent)}`;
    el.rechargeCardSummaryList.appendChild(row);
  });
  el.rechargeCardTotalTimes.textContent = `${cardTotalTimes(cards)} 次`;
  el.rechargeCardTotalAmount.textContent = money(cardTotalPriceCent(cards));
}

function renderRecharge() {
  renderRechargeMember();
  renderRechargeOptions();
  renderRechargePayment();
  renderRechargeSummary();
  el.rechargeRemark.value = state.recharge.remark;
}

async function openMemberRecharge(memberId) {
  if (!memberId) {
    showToast("请先选择会员");
    setView("members", { from: "entry" });
    return;
  }
  state.view = "member-recharge";
  state.selectedMemberId = memberId;
  state.recharge = emptyRechargeState();
  renderView();
  renderRecharge();
  await loadRechargeData();
}

async function loadRechargeData() {
  if (!state.selectedMemberId) return;
  setLoading(true);
  try {
    const [detail, config] = await Promise.all([
      callBusiness("getMemberDetail", { memberId: state.selectedMemberId }),
      callBusiness("getBasicConfig")
    ]);
    state.recharge.member = detail.member || {};
    state.recharge.tiers = config.rechargeTiers || [];
    state.recharge.cardTypes = config.cardTypes || [];
    state.recharge.configLoaded = true;
    el.rechargeConfigError.hidden = true;
    renderRecharge();
  } catch (err) {
    el.rechargeConfigError.textContent = "配置加载失败，请重试";
    el.rechargeConfigError.hidden = false;
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function validateRecharge() {
  if (!state.recharge.member || !state.recharge.member._id) {
    showToast("请选择会员");
    return null;
  }
  const tier = selectedRechargeTier();
  const cards = selectedRechargeCards();
  if (!tier && cards.length === 0) {
    showToast("请选择充值档位或次卡");
    return null;
  }
  if (!state.recharge.selectedPayment) {
    showToast("请选择支付方式");
    return null;
  }
  if (tier) {
    return {
      action: "createMemberRecharge",
      payload: {
        memberId: state.recharge.member._id,
        tierId: tier._id,
        paymentMethod: state.recharge.selectedPayment,
        remark: state.recharge.remark
      }
    };
  }
  return {
    action: "createCardPurchase",
    payload: {
      memberId: state.recharge.member._id,
      cardTypeIds: cards.map((card) => card._id),
      paymentMethod: state.recharge.selectedPayment,
      remark: state.recharge.remark
    }
  };
}

async function submitRecharge() {
  const request = validateRecharge();
  if (!request) return;
  el.rechargeSubmit.disabled = true;
  el.rechargeSubmit.textContent = "保存中";
  try {
    await callBusiness(request.action, request.payload);
    showToast("已记录");
    state.selectedMemberId = state.recharge.member._id;
    state.view = "member-detail";
    renderView();
    await loadMemberDetail();
  } catch (err) {
    showToast(err.message);
  } finally {
    el.rechargeSubmit.disabled = false;
    el.rechargeSubmit.textContent = "完成充值";
  }
}

function emptyCheckoutState() {
  return {
    member: null,
    categories: [],
    activeCategoryId: "",
    selectedItems: [],
    availableCards: [],
    selectedCardIds: [],
    selectedPayment: "",
    selectedServicePerson: null,
    servicePeople: [],
    remark: "",
    signature: null,
    confirmation: null,
    configLoaded: false
  };
}

function checkoutOriginalCent() {
  return state.checkout.selectedItems.reduce((sum, item) => sum + yuanInputToCent(item.originalAmountYuan), 0);
}

function checkoutCalc() {
  return calculateCheckoutAmount(state.checkout.member || {}, checkoutOriginalCent());
}

function selectedCheckoutCardMap() {
  return state.checkout.selectedCardIds.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {});
}

function activeCheckoutCategory() {
  return state.checkout.categories.find((item) => item._id === state.checkout.activeCategoryId) || state.checkout.categories[0] || null;
}

function renderCheckoutMember() {
  const member = state.checkout.member || {};
  const cards = Array.isArray(member.cardBalances) ? member.cardBalances : [];
  el.checkoutMemberName.textContent = member.name || "-";
  el.checkoutMemberPhone.textContent = member.phone || "-";
  el.checkoutMemberBalance.textContent = money(member.balanceCent);
  el.checkoutMemberDiscount.textContent = formatDiscount(member.currentDiscount);
  el.checkoutMemberCardTotal.textContent = `${cards.reduce((sum, card) => sum + Number(card.remainingTimes || 0), 0)} 次`;
}

function renderCheckoutServicePeople() {
  const selected = state.checkout.selectedServicePerson;
  el.checkoutSelectedServicePerson.textContent = selected && selected.name ? selected.name : "加载中";
  el.checkoutServicePersonList.innerHTML = "";
  state.checkout.servicePeople.forEach((person) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sheet-option${selected && selected.openid === person.openid ? " active" : ""}`;
    button.innerHTML = `<span></span><strong></strong>`;
    button.querySelector("span").textContent = person.name;
    button.querySelector("strong").textContent = selected && selected.openid === person.openid ? "已选" : "";
    button.addEventListener("click", () => {
      state.checkout.selectedServicePerson = person;
      state.checkoutServicePersonSheetHidden = true;
      el.checkoutServicePersonSheet.hidden = true;
      invalidateCheckoutSignature();
      renderCheckoutServicePeople();
    });
    el.checkoutServicePersonList.appendChild(button);
  });
}

function renderCheckoutCards() {
  const cards = state.checkout.availableCards || [];
  const selected = selectedCheckoutCardMap();
  el.checkoutCardSection.hidden = cards.length === 0;
  el.checkoutCardOptions.innerHTML = "";
  cards.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `select-option${selected[card.cardTypeId] ? " active" : ""}`;
    button.innerHTML = `<span class="select-option-title"></span><span class="select-option-meta"></span>`;
    button.querySelector(".select-option-title").textContent = card.cardName || "-";
    button.querySelector(".select-option-meta").textContent = `剩余 ${card.remainingTimes || 0} 次`;
    button.addEventListener("click", () => {
      if (selected[card.cardTypeId]) {
        state.checkout.selectedCardIds = state.checkout.selectedCardIds.filter((id) => id !== card.cardTypeId);
      } else {
        state.checkout.selectedCardIds.push(card.cardTypeId);
      }
      invalidateCheckoutSignature();
      renderCheckout();
    });
    el.checkoutCardOptions.appendChild(button);
  });
}

function renderCheckoutServicePicker() {
  const selectedMap = state.checkout.selectedItems.reduce((acc, item) => {
    acc[item.serviceId] = true;
    return acc;
  }, {});
  el.checkoutCategoryList.innerHTML = "";
  el.checkoutServiceList.innerHTML = "";
  state.checkout.categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-item${category._id === state.checkout.activeCategoryId ? " active" : ""}`;
    button.textContent = category.name;
    button.addEventListener("click", () => {
      state.checkout.activeCategoryId = category._id;
      renderCheckoutServicePicker();
    });
    el.checkoutCategoryList.appendChild(button);
  });
  const category = activeCheckoutCategory();
  (category && category.services ? category.services : []).forEach((service) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `service-item${selectedMap[service._id] ? " selected" : ""}`;
    button.textContent = service.name || "-";
    button.addEventListener("click", () => toggleCheckoutService(category, service));
    el.checkoutServiceList.appendChild(button);
  });
}

function renderCheckoutSelected() {
  const selectedCards = state.checkout.availableCards.filter((card) => state.checkout.selectedCardIds.includes(card.cardTypeId));
  const hasAny = selectedCards.length > 0 || state.checkout.selectedItems.length > 0;
  el.checkoutSelectedEmpty.hidden = hasAny;
  el.checkoutSelectedList.innerHTML = "";
  selectedCards.forEach((card) => {
    const row = document.createElement("div");
    row.className = "selected-item";
    row.innerHTML = `
      <strong></strong>
      <span class="muted">使用次卡</span>
      <button class="secondary remove-btn" type="button">移除</button>
    `;
    row.querySelector("strong").textContent = card.cardName || "-";
    row.querySelector("button").addEventListener("click", () => {
      state.checkout.selectedCardIds = state.checkout.selectedCardIds.filter((id) => id !== card.cardTypeId);
      invalidateCheckoutSignature();
      renderCheckout();
    });
    el.checkoutSelectedList.appendChild(row);
  });
  state.checkout.selectedItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "selected-item";
    row.innerHTML = `
      <strong></strong>
      <input class="price-input" inputmode="decimal" placeholder="单项原价">
      <button class="secondary remove-btn" type="button">移除</button>
    `;
    row.querySelector("strong").textContent = item.displayName;
    const input = row.querySelector("input");
    input.value = item.originalAmountYuan;
    input.addEventListener("input", (event) => {
      state.checkout.selectedItems[index].originalAmountYuan = event.target.value;
      invalidateCheckoutSignature();
      renderCheckoutCalcAndSignature();
    });
    row.querySelector("button").addEventListener("click", () => {
      state.checkout.selectedItems.splice(index, 1);
      invalidateCheckoutSignature();
      renderCheckout();
    });
    el.checkoutSelectedList.appendChild(row);
  });
}

function renderCheckoutPayment() {
  const calc = checkoutCalc();
  el.checkoutPaymentSection.hidden = calc.extraPayCent <= 0;
  document.querySelectorAll("[data-checkout-payment]").forEach((button) => {
    button.classList.toggle("active", button.dataset.checkoutPayment === state.checkout.selectedPayment);
  });
  const qrMap = {
    wechat: "/assets/payment/wechat.jfif",
    alipay: "/assets/payment/alipay.jfif"
  };
  const src = qrMap[state.checkout.selectedPayment] || "";
  el.checkoutPaymentQr.hidden = !src || calc.extraPayCent <= 0;
  if (src) el.checkoutPaymentQr.src = src;
}

function renderCheckoutCalcAndSignature() {
  const calc = checkoutCalc();
  const hasService = state.checkout.selectedItems.length > 0;
  el.checkoutCalcPanel.hidden = !hasService;
  el.checkoutOriginal.textContent = money(calc.originalAmountCent);
  el.checkoutPayable.textContent = money(calc.payableCent);
  el.checkoutBalancePay.textContent = money(calc.balancePayCent);
  el.checkoutExtraPay.textContent = money(calc.extraPayCent);
  el.checkoutBalanceAfter.textContent = money(calc.balanceAfterCent);
  el.checkoutShortageNote.hidden = !calc.hasShortageExtraPay;
  if (calc.hasShortageExtraPay) {
    el.checkoutShortageNote.textContent = `余额 ${money(calc.balancePayCent)} 可抵扣原价 ${money(calc.balanceCoveredOriginalCent)}，剩余原价 ${money(calc.extraPayCent)} 需补差。`;
  }
  renderCheckoutPayment();
  renderCheckoutSignature();
}

function renderCheckoutSignature() {
  const signature = state.checkout.signature;
  el.checkoutSignaturePreview.hidden = !signature;
  if (!signature) return;
  const currentHash = buildCheckoutSnapshotInfo().hash;
  const valid = signature.snapshotHash === currentHash;
  el.checkoutSignaturePreview.classList.toggle("invalid", !valid);
  el.checkoutSignatureStatus.textContent = valid ? "再次点击完成结账后保存记录" : "结账内容已修改，请重新签字";
  el.checkoutSignatureStatus.className = valid ? "muted" : "danger";
  el.checkoutSignatureImage.src = signature.dataUrl;
}

function renderCheckout() {
  renderCheckoutMember();
  renderCheckoutServicePeople();
  renderCheckoutCards();
  renderCheckoutServicePicker();
  renderCheckoutSelected();
  renderCheckoutCalcAndSignature();
  el.checkoutRemark.value = state.checkout.remark;
}

function toggleCheckoutService(category, service) {
  const index = state.checkout.selectedItems.findIndex((item) => item.serviceId === service._id);
  if (index >= 0) {
    state.checkout.selectedItems.splice(index, 1);
  } else {
    state.checkout.selectedItems.push({
      categoryId: category._id,
      categoryName: category.name,
      serviceId: service._id,
      serviceName: service.name,
      displayName: `${category.name}-${service.name}`,
      originalAmountYuan: ""
    });
  }
  invalidateCheckoutSignature();
  renderCheckout();
}

function invalidateCheckoutSignature() {
  renderCheckoutSignature();
}

async function openMemberCheckout(memberId) {
  if (!memberId) {
    showToast("请先选择会员");
    setView("members", { from: "entry" });
    return;
  }
  state.view = "member-checkout";
  state.selectedMemberId = memberId;
  state.checkout = emptyCheckoutState();
  renderView();
  renderCheckout();
  await loadCheckoutData();
}

async function loadCheckoutData() {
  if (!state.selectedMemberId) return;
  setLoading(true);
  try {
    const [detail, config, people] = await Promise.all([
      callBusiness("getMemberDetail", { memberId: state.selectedMemberId }),
      callBusiness("getBasicConfig"),
      callBusiness("listServicePeople")
    ]);
    const member = detail.member || {};
    const categories = (config.serviceCatalog || []).filter((category) => (category.services || []).length > 0);
    state.checkout.member = member;
    state.checkout.availableCards = (member.cardBalances || []).filter((card) => Number(card.remainingTimes || 0) > 0);
    state.checkout.categories = categories;
    state.checkout.activeCategoryId = categories[0] ? categories[0]._id : "";
    state.checkout.servicePeople = people || [];
    state.checkout.selectedServicePerson = state.checkout.servicePeople.find((person) => person.openid === state.user.id)
      || state.checkout.servicePeople[0]
      || null;
    state.checkout.configLoaded = true;
    el.checkoutConfigError.hidden = true;
    renderCheckout();
  } catch (err) {
    el.checkoutConfigError.textContent = "配置加载失败，请重试";
    el.checkoutConfigError.hidden = false;
    el.checkoutServicePicker.hidden = true;
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

function buildCheckoutSnapshotInfo() {
  const member = state.checkout.member || {};
  const servicePerson = state.checkout.selectedServicePerson || {};
  const originalAmountCent = checkoutOriginalCent();
  const calc = checkoutCalc();
  const extraPaymentMethod = calc.extraPayCent > 0 ? state.checkout.selectedPayment : "";
  const selectedCards = state.checkout.availableCards.filter((card) => state.checkout.selectedCardIds.includes(card.cardTypeId));
  const cardItems = selectedCards.map((card) => ({
    cardTypeId: card.cardTypeId,
    cardName: card.cardName,
    useTimes: 1,
    remainingTimesBefore: Number(card.remainingTimes || 0),
    remainingTimesAfter: Math.max(0, Number(card.remainingTimes || 0) - 1)
  }));
  const snapshot = {
    version: 2,
    member: {
      memberId: member._id || "",
      memberName: member.name || "",
      phone: member.phone || ""
    },
    servicePersonOpenid: servicePerson.openid || "",
    servicePersonName: servicePerson.name || "",
    serviceItems: state.checkout.selectedItems.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      originalAmountCent: yuanInputToCent(item.originalAmountYuan)
    })),
    cardItems,
    balanceBeforeCent: calc.balanceCent,
    discountApplied: calc.discount || null,
    discountLabelApplied: originalAmountCent > 0 ? formatDiscount(calc.discount) : "",
    originalAmountCent,
    consumptionAmountCent: calc.payableCent,
    balancePayCent: calc.balancePayCent,
    balanceCoveredOriginalCent: calc.balanceCoveredOriginalCent,
    extraPayCent: calc.extraPayCent,
    settlementAmountCent: calc.settlementAmountCent,
    shortageExtraPayRule: calc.shortageExtraPayRule,
    extraPaymentMethod,
    paymentMethod: originalAmountCent <= 0 ? "" : (calc.balancePayCent > 0 && calc.extraPayCent > 0 ? "mixed" : calc.balancePayCent > 0 ? "member_balance" : extraPaymentMethod),
    balanceAfterCent: calc.balanceAfterCent,
    remark: normalizeText(state.checkout.remark)
  };
  return { snapshot, hash: hashSnapshot(snapshot) };
}

function buildCheckoutConfirmationView(snapshot) {
  const serviceItems = (snapshot.serviceItems || []).map((item, index) => ({
    key: `${item.serviceId || "service"}-${index}`,
    displayName: formatServiceItemName(item),
    originalYuan: money(item.originalAmountCent)
  }));
  const cardItems = (snapshot.cardItems || []).map((item, index) => ({
    key: `${item.cardTypeId || "card"}-${index}`,
    cardName: item.cardName || "-",
    useTimes: Number(item.useTimes || 0),
    remainingTimesAfter: Number(item.remainingTimesAfter || 0)
  }));
  const hasShortageExtraPay = !!snapshot.shortageExtraPayRule && Number(snapshot.extraPayCent || 0) > 0;

  return {
    servicePersonName: snapshot.servicePersonName || "-",
    serviceItems,
    cardItems,
    hasServiceItems: serviceItems.length > 0,
    balanceBefore: money(snapshot.balanceBeforeCent),
    balancePay: money(snapshot.balancePayCent),
    balanceAfter: money(snapshot.balanceAfterCent),
    originalAmount: money(snapshot.originalAmountCent),
    discountText: snapshot.discountLabelApplied || "无折扣",
    payable: money(snapshot.consumptionAmountCent),
    balanceCoveredOriginal: money(snapshot.balanceCoveredOriginalCent),
    extraPay: money(snapshot.extraPayCent),
    settlementAmount: money(snapshot.settlementAmountCent),
    hasShortageExtraPay,
    shortageExplanation: hasShortageExtraPay ? `余额 ${money(snapshot.balancePayCent)} 可抵扣原价 ${money(snapshot.balanceCoveredOriginalCent)}，剩余原价 ${money(snapshot.extraPayCent)} 需补差。` : "",
    extraPaymentText: formatPayment(snapshot.extraPaymentMethod),
    hasRemark: !!snapshot.remark,
    remark: snapshot.remark || ""
  };
}

function appendConfirmRow(section, label, value, options = {}) {
  const row = document.createElement("div");
  row.className = `checkout-confirm-row${options.highlight ? " highlight" : ""}`;
  const labelNode = document.createElement("span");
  labelNode.className = options.highlight ? "" : "muted";
  labelNode.textContent = label;
  const valueNode = document.createElement("span");
  valueNode.className = `checkout-confirm-value${options.danger ? " danger" : ""}`;
  valueNode.textContent = value;
  row.append(labelNode, valueNode);
  section.appendChild(row);
}

function createConfirmSection(title) {
  const section = document.createElement("section");
  section.className = "checkout-confirm-section";
  if (title) {
    const heading = document.createElement("div");
    heading.className = "checkout-confirm-section-title";
    heading.textContent = title;
    section.appendChild(heading);
  }
  return section;
}

function renderCheckoutConfirm(snapshotInfo) {
  const view = buildCheckoutConfirmationView(snapshotInfo.snapshot);
  el.checkoutConfirmContent.innerHTML = "";

  const serviceSection = createConfirmSection("");
  appendConfirmRow(serviceSection, "服务人", view.servicePersonName);
  el.checkoutConfirmContent.appendChild(serviceSection);

  const balanceSection = createConfirmSection("余额变化");
  appendConfirmRow(balanceSection, "期初余额", view.balanceBefore);
  appendConfirmRow(balanceSection, "余额支付", `-${view.balancePay}`, { danger: true, highlight: true });
  appendConfirmRow(balanceSection, "消费后余额", view.balanceAfter);
  el.checkoutConfirmContent.appendChild(balanceSection);

  if (view.hasServiceItems) {
    const amountSection = createConfirmSection("消费金额");
    const list = document.createElement("div");
    list.className = "checkout-confirm-list";
    view.serviceItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "checkout-confirm-item";
      const name = document.createElement("span");
      name.textContent = item.displayName;
      const amount = document.createElement("span");
      amount.className = "checkout-confirm-value";
      amount.textContent = item.originalYuan;
      row.append(name, amount);
      list.appendChild(row);
    });
    amountSection.appendChild(list);
    appendConfirmRow(amountSection, "项目原价合计", view.originalAmount);
    appendConfirmRow(amountSection, "当前折扣", view.discountText);
    appendConfirmRow(amountSection, "整单会员价", view.payable, { highlight: true });
    if (view.hasShortageExtraPay) {
      const note = document.createElement("div");
      note.className = "checkout-confirm-note";
      note.textContent = view.shortageExplanation;
      amountSection.appendChild(note);
      appendConfirmRow(amountSection, "余额可抵扣原价", view.balanceCoveredOriginal);
    }
    appendConfirmRow(amountSection, "补差价", view.extraPay);
    appendConfirmRow(amountSection, "本单结算金额", view.settlementAmount, { highlight: true });
    if (view.extraPaymentText !== "-") {
      appendConfirmRow(amountSection, "补差价支付方式", view.extraPaymentText);
    }
    el.checkoutConfirmContent.appendChild(amountSection);
  }

  if (view.cardItems.length > 0) {
    const cardSection = createConfirmSection("次卡变化");
    view.cardItems.forEach((item) => {
      const box = document.createElement("div");
      box.className = "checkout-card-change";
      const name = document.createElement("div");
      name.className = "checkout-card-change-name";
      name.textContent = item.cardName;
      const meta = document.createElement("div");
      meta.className = "checkout-card-change-meta";
      const used = document.createElement("span");
      used.className = "danger";
      used.textContent = `扣 ${item.useTimes} 次`;
      const remain = document.createElement("span");
      remain.textContent = `使用后剩余 ${item.remainingTimesAfter} 次`;
      meta.append(used, remain);
      box.append(name, meta);
      cardSection.appendChild(box);
    });
    el.checkoutConfirmContent.appendChild(cardSection);
  }

  if (view.hasRemark) {
    const remarkSection = createConfirmSection("备注");
    const remark = document.createElement("div");
    remark.textContent = view.remark;
    remarkSection.appendChild(remark);
    el.checkoutConfirmContent.appendChild(remarkSection);
  }
}

function validateCheckout() {
  const person = state.checkout.selectedServicePerson;
  if (!person || !person.openid || !person.name) {
    showToast("服务人信息加载失败，请重试");
    return false;
  }
  if (state.checkout.selectedItems.length === 0 && state.checkout.selectedCardIds.length === 0) {
    showToast("请选择次卡或服务项目");
    return false;
  }
  const hasEmptyAmount = state.checkout.selectedItems.some((item) => !normalizeText(item.originalAmountYuan));
  if (hasEmptyAmount) {
    showToast("请填写每个项目的单项原价");
    return false;
  }
  const invalidAmount = state.checkout.selectedItems.some((item) => !Number.isFinite(Number(item.originalAmountYuan)) || Number(item.originalAmountYuan) < 0);
  if (invalidAmount) {
    showToast("单项原价不能小于 0");
    return false;
  }
  const calc = checkoutCalc();
  if (calc.extraPayCent > 0 && !state.checkout.selectedPayment) {
    showToast("请选择补差价支付方式");
    return false;
  }
  return true;
}

let signatureCtx = null;
let signatureDrawing = false;
let signatureLastPoint = null;
let signatureHasStroke = false;

function resizeSignatureCanvas() {
  const canvas = el.signatureCanvas;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  signatureCtx = canvas.getContext("2d");
  signatureCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  clearSignatureCanvas();
}

function clearSignatureCanvas() {
  if (!signatureCtx) return;
  const canvas = el.signatureCanvas;
  const rect = canvas.getBoundingClientRect();
  signatureCtx.fillStyle = "#ffffff";
  signatureCtx.fillRect(0, 0, rect.width, rect.height);
  signatureCtx.lineCap = "round";
  signatureCtx.lineJoin = "round";
  signatureCtx.strokeStyle = "#111827";
  signatureCtx.lineWidth = 4;
  signatureDrawing = false;
  signatureLastPoint = null;
  signatureHasStroke = false;
}

function signaturePoint(event) {
  const rect = el.signatureCanvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top
  };
}

function startSignatureDraw(event) {
  event.preventDefault();
  if (!signatureCtx) return;
  signatureDrawing = true;
  signatureLastPoint = signaturePoint(event);
  signatureCtx.beginPath();
  signatureCtx.arc(signatureLastPoint.x, signatureLastPoint.y, 2, 0, Math.PI * 2);
  signatureCtx.fillStyle = "#111827";
  signatureCtx.fill();
  signatureHasStroke = true;
}

function moveSignatureDraw(event) {
  if (!signatureDrawing || !signatureCtx || !signatureLastPoint) return;
  event.preventDefault();
  const point = signaturePoint(event);
  signatureCtx.beginPath();
  signatureCtx.moveTo(signatureLastPoint.x, signatureLastPoint.y);
  signatureCtx.lineTo(point.x, point.y);
  signatureCtx.stroke();
  signatureLastPoint = point;
  signatureHasStroke = true;
}

function endSignatureDraw() {
  signatureDrawing = false;
  signatureLastPoint = null;
}

function closeCheckoutConfirm() {
  state.checkout.confirmation = null;
  el.checkoutConfirmMask.hidden = true;
  el.checkoutConfirmContent.innerHTML = "";
}

function openCheckoutConfirm() {
  if (!validateCheckout()) return;
  const snapshotInfo = buildCheckoutSnapshotInfo();
  state.checkout.confirmation = snapshotInfo;
  renderCheckoutConfirm(snapshotInfo);
  el.checkoutConfirmMask.hidden = false;
}

function confirmCheckoutAndOpenSignature() {
  const snapshotInfo = state.checkout.confirmation;
  if (!snapshotInfo) {
    closeCheckoutConfirm();
    openCheckoutConfirm();
    return;
  }

  const currentHash = buildCheckoutSnapshotInfo().hash;
  closeCheckoutConfirm();
  if (snapshotInfo.hash !== currentHash) {
    showToast("结账内容已修改，请重新确认");
    openCheckoutConfirm();
    return;
  }

  openSignatureSheet();
}

function openSignatureSheet() {
  if (!validateCheckout()) return;
  el.signatureSheet.hidden = false;
  window.setTimeout(resizeSignatureCanvas, 0);
}

function confirmSignature() {
  if (!signatureHasStroke) {
    showToast("请先完成签字");
    return;
  }
  const snapshotInfo = buildCheckoutSnapshotInfo();
  const dataUrl = el.signatureCanvas.toDataURL("image/png");
  state.checkout.signature = {
    dataUrl,
    signedAt: new Date().toISOString(),
    snapshot: snapshotInfo.snapshot,
    snapshotHash: snapshotInfo.hash,
    fileId: ""
  };
  el.signatureSheet.hidden = true;
  renderCheckoutSignature();
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = (header.match(/data:(.*?);/) || [])[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadCheckoutSignature() {
  const signature = state.checkout.signature;
  if (!signature) throw new Error("请先完成客户签字");
  if (signature.fileId) return signature.fileId;
  const form = new FormData();
  form.append("file", dataUrlToBlob(signature.dataUrl), "signature.png");
  const data = await requestJson("/api/files/signatures", {
    method: "POST",
    body: form
  });
  signature.fileId = data.fileId || data.signatureFileId;
  return signature.fileId;
}

async function submitCheckout() {
  if (!validateCheckout()) return;
  const snapshotInfo = buildCheckoutSnapshotInfo();
  const signature = state.checkout.signature;
  if (!signature || signature.snapshotHash !== snapshotInfo.hash) {
    openCheckoutConfirm();
    return;
  }

  el.checkoutSubmit.disabled = true;
  el.checkoutSubmit.textContent = "保存中";
  try {
    const signatureFileId = await uploadCheckoutSignature();
    await callBusiness("createMemberCheckout", {
      memberId: state.checkout.member._id,
      cardItems: state.checkout.selectedCardIds.map((cardTypeId) => ({ cardTypeId })),
      serviceItems: state.checkout.selectedItems.map((item) => ({
        serviceId: item.serviceId,
        originalAmountCent: yuanInputToCent(item.originalAmountYuan)
      })),
      paymentMethod: state.checkout.selectedPayment,
      extraPaymentMethod: state.checkout.selectedPayment,
      servicePersonOpenid: state.checkout.selectedServicePerson.openid,
      remark: state.checkout.remark,
      signatureFileId,
      signatureSignedAt: signature.signedAt,
      signatureSnapshot: snapshotInfo.snapshot,
      signatureSnapshotHash: snapshotInfo.hash
    });
    showToast("已记录");
    state.selectedMemberId = state.checkout.member._id;
    state.view = "member-detail";
    renderView();
    await loadMemberDetail();
  } catch (err) {
    showToast(err.message);
    if (err.code === "SIGNATURE_MISMATCH" || err.code === "SIGNATURE_REQUIRED") {
      state.checkout.signature = null;
      renderCheckoutSignature();
    }
  } finally {
    el.checkoutSubmit.disabled = false;
    el.checkoutSubmit.textContent = "完成结账";
  }
}

async function loadHome() {
  if (state.loading) return;
  setLoading(true);
  try {
    const data = await callBusiness("getHomeSummary");
    const summary = data.summary || {};
    el.businessDate.textContent = data.businessDate || "-";
    el.summaryActual.textContent = money(summary.actualReceivedCent);
    el.summaryActiveCount.textContent = String(summary.activeCount || 0);
    el.summaryConsumption.textContent = money(summary.consumptionAmountCent);
    el.summaryBalance.textContent = money(summary.balancePayCent);
    el.summaryRecharge.textContent = money(summary.rechargeCent);
    el.summaryCard.textContent = money(summary.cardPurchaseCent);
    renderRecords(data.records || []);
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false);
  }
}

async function loadMe() {
  const data = await requestJson("/api/auth/me");
  if (!data.authenticated) {
    state.user = null;
    showLogin();
    return;
  }
  state.user = data.user;
  showApp();
}

el.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  el.loginError.textContent = "";
  const form = new FormData(el.loginForm);
  try {
    const data = await requestJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password")
      })
    });
    state.user = data.user;
    state.view = "entry";
    showApp();
  } catch (err) {
    el.loginError.textContent = err.message;
  }
});

el.logoutButton.addEventListener("click", async () => {
  await requestJson("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => {});
  state.user = null;
  showLogin();
});

el.backButton.addEventListener("click", goBack);

el.refreshButton.addEventListener("click", () => {
  if (state.view === "home") return loadHome();
  if (state.view === "members") return loadMembers();
  if (state.view === "member-detail") return loadMemberDetail();
  if (state.view === "guest") return loadGuestConfig();
  if (state.view === "member-recharge") return loadRechargeData();
  if (state.view === "member-checkout") return loadCheckoutData();
  if (state.view === "record-detail") return loadRecordDetail();
  if (settingsConfigViews.includes(state.view)) return loadSettingsConfig(state.view);
  return null;
});

el.summaryToggle.addEventListener("click", () => {
  state.summaryExpanded = !state.summaryExpanded;
  renderSummaryToggle();
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

el.memberKeyword.addEventListener("input", (event) => {
  state.memberKeyword = event.target.value;
  window.clearTimeout(state.keywordTimer);
  state.keywordTimer = window.setTimeout(loadMembers, 300);
});

el.memberKeyword.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    window.clearTimeout(state.keywordTimer);
    loadMembers();
  }
});

el.memberAlphaIndex.addEventListener("pointerdown", (event) => {
  if (el.memberAlphaIndex.hidden) return;
  state.memberAlphaIndexActive = true;
  if (el.memberAlphaIndex.setPointerCapture) {
    el.memberAlphaIndex.setPointerCapture(event.pointerId);
  }
  handleMemberAlphaPointer(event);
});

el.memberAlphaIndex.addEventListener("pointermove", (event) => {
  if (!state.memberAlphaIndexActive) return;
  handleMemberAlphaPointer(event);
});

["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
  el.memberAlphaIndex.addEventListener(type, () => {
    state.memberAlphaIndexActive = false;
  });
});

el.addMemberButton.addEventListener("click", () => openMemberEdit("", "members"));
el.editMemberButton.addEventListener("click", () => openMemberEdit(state.selectedMemberId, "member-detail"));
el.memberCheckoutButton.addEventListener("click", () => openMemberCheckout(state.selectedMemberId));
el.memberRechargeButton.addEventListener("click", () => openMemberRecharge(state.selectedMemberId));
el.categoryForm.addEventListener("submit", saveServiceCategoryForm);
el.categoryReset.addEventListener("click", () => setCategoryForm(emptyCategoryForm()));
el.serviceForm.addEventListener("submit", saveServiceForm);
el.serviceBackList.addEventListener("click", () => {
  state.settingsConfig.serviceMode = "list";
  setServiceForm(emptyServiceForm());
  renderServices();
});
el.tierAdd.addEventListener("click", startAddRechargeTier);
el.tierForm.addEventListener("submit", saveRechargeTierForm);
el.tierBackList.addEventListener("click", () => {
  state.settingsConfig.tierMode = "list";
  setTierForm(emptyTierForm());
  renderRechargeTiers();
});
el.cardTypeAdd.addEventListener("click", startAddCardType);
el.cardTypeForm.addEventListener("submit", saveCardTypeForm);
el.cardTypeBackList.addEventListener("click", () => {
  state.settingsConfig.cardTypeMode = "list";
  setCardTypeForm(emptyCardTypeForm());
  renderCardTypes();
});
el.recordDetailVoid.addEventListener("click", voidCurrentRecord);
el.recordDetailOpenSignature.addEventListener("click", () => {
  const url = el.recordDetailOpenSignature.dataset.url;
  if (url) window.open(url, "_blank", "noopener");
});

el.editName.addEventListener("input", (event) => {
  state.editForm.name = event.target.value;
});
el.editPhone.addEventListener("input", (event) => {
  state.editForm.phone = event.target.value;
});
el.editRemark.addEventListener("input", (event) => {
  state.editForm.remark = event.target.value;
});

el.importToggle.addEventListener("click", () => {
  state.importExpanded = !state.importExpanded;
  renderImportControls();
});

el.importBalance.addEventListener("input", (event) => {
  state.importForm.initialBalanceYuan = event.target.value;
});
el.importDiscount.addEventListener("input", (event) => {
  state.importForm.discount = event.target.value;
  renderImportControls();
});
el.importPage.addEventListener("input", (event) => {
  state.importForm.offlinePage = event.target.value;
});

document.querySelectorAll("[data-discount]").forEach((button) => {
  button.addEventListener("click", () => {
    state.importForm.discount = button.dataset.discount;
    renderImportControls();
  });
});

document.querySelectorAll("[data-book]").forEach((button) => {
  button.addEventListener("click", () => {
    state.importForm.offlineBook = state.importForm.offlineBook === button.dataset.book ? "" : button.dataset.book;
    renderImportControls();
  });
});

el.memberEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = validateMemberEdit();
  if (!payload) return;
  const importInfo = state.editMemberId ? {
    importActive: false,
    initialBalanceYuan: "",
    discount: "",
    offlineBook: "",
    offlinePage: "",
    cardItems: []
  } : validateImportInfo();
  if (!importInfo) return;

  if (!state.editMemberId && importInfo.importActive) {
    const cardText = importInfo.cardItems.length > 0
      ? importInfo.cardItems.map((item) => `${item.cardName}：${item.initialTimes} 次`).join("\n")
      : "未选择";
    const confirmed = window.confirm([
      `会员：${state.editForm.name || "-"}`,
      `初始余额：¥${importInfo.initialBalanceText}`,
      `初始折扣：${importInfo.discountText}`,
      `来源：${importInfo.traceText}`,
      `初始次卡：${cardText}`,
      "初始余额、初始折扣和初始次卡保存后前台不可修改。"
    ].join("\n"));
    if (!confirmed) return;
  }

  await submitMemberEdit(payload, importInfo);
});

el.servicePersonButton.addEventListener("click", () => {
  if (state.guest.servicePeople.length === 0) {
    showToast("服务人名单加载中，请稍后");
    return;
  }
  el.servicePersonSheet.hidden = false;
  renderServicePeople();
});

el.closeServicePerson.addEventListener("click", () => {
  el.servicePersonSheet.hidden = true;
});

el.servicePersonSheet.addEventListener("click", (event) => {
  if (event.target === el.servicePersonSheet) {
    el.servicePersonSheet.hidden = true;
  }
});

el.guestActual.addEventListener("input", (event) => {
  state.guest.actualReceivedYuan = event.target.value;
  state.guest.actualReceivedAutoSync = normalizeText(event.target.value) === "";
});

el.guestRemark.addEventListener("input", (event) => {
  state.guest.remark = event.target.value;
});

document.querySelectorAll("[data-payment]").forEach((button) => {
  button.addEventListener("click", () => {
    state.guest.selectedPayment = button.dataset.payment;
    renderPayment();
  });
});

el.guestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitGuest();
});

document.querySelectorAll("[data-recharge-payment]").forEach((button) => {
  button.addEventListener("click", () => {
    state.recharge.selectedPayment = button.dataset.rechargePayment;
    renderRechargePayment();
  });
});

el.rechargeRemark.addEventListener("input", (event) => {
  state.recharge.remark = event.target.value;
});

el.rechargeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitRecharge();
});

el.checkoutServicePersonButton.addEventListener("click", () => {
  if (state.checkout.servicePeople.length === 0) {
    showToast("服务人名单加载中，请稍后");
    return;
  }
  el.checkoutServicePersonSheet.hidden = false;
  renderCheckoutServicePeople();
});

el.checkoutCloseServicePerson.addEventListener("click", () => {
  el.checkoutServicePersonSheet.hidden = true;
});

el.checkoutServicePersonSheet.addEventListener("click", (event) => {
  if (event.target === el.checkoutServicePersonSheet) el.checkoutServicePersonSheet.hidden = true;
});

document.querySelectorAll("[data-checkout-payment]").forEach((button) => {
  button.addEventListener("click", () => {
    state.checkout.selectedPayment = button.dataset.checkoutPayment;
    invalidateCheckoutSignature();
    renderCheckoutPayment();
  });
});

el.checkoutRemark.addEventListener("input", (event) => {
  state.checkout.remark = event.target.value;
  invalidateCheckoutSignature();
});

el.checkoutResignButton.addEventListener("click", openCheckoutConfirm);

el.checkoutConfirmCancel.addEventListener("click", closeCheckoutConfirm);
el.checkoutConfirmSign.addEventListener("click", confirmCheckoutAndOpenSignature);
el.checkoutConfirmMask.addEventListener("click", (event) => {
  if (event.target === el.checkoutConfirmMask) closeCheckoutConfirm();
});

el.checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitCheckout();
});

el.signatureCanvas.addEventListener("pointerdown", startSignatureDraw);
el.signatureCanvas.addEventListener("pointermove", moveSignatureDraw);
el.signatureCanvas.addEventListener("pointerup", endSignatureDraw);
el.signatureCanvas.addEventListener("pointercancel", endSignatureDraw);
el.signatureCanvas.addEventListener("pointerleave", endSignatureDraw);
el.signatureClear.addEventListener("click", clearSignatureCanvas);
el.signatureConfirm.addEventListener("click", confirmSignature);
el.signatureSheet.addEventListener("click", (event) => {
  if (event.target === el.signatureSheet) el.signatureSheet.hidden = true;
});

[el.paymentQr, el.rechargePaymentQr, el.checkoutPaymentQr].forEach(bindQrViewer);
el.qrViewerClose.addEventListener("click", closeQrViewer);
el.qrViewer.addEventListener("click", (event) => {
  if (event.target === el.qrViewer) closeQrViewer();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.qrViewer.hidden) closeQrViewer();
});
document.addEventListener("fullscreenchange", handleQrFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleQrFullscreenChange);

document.querySelectorAll("[data-route]").forEach((button) => {
  button.addEventListener("click", () => {
    const route = button.dataset.route;
    if (settingsConfigViews.includes(route)) {
      setView(route);
      return;
    }
    if (route === "members") {
      setView("members", { from: "entry" });
      return;
    }
    if (route === "guest") {
      setView("guest");
      return;
    }
    showToast(button.textContent.trim().split(/\s+/)[0]);
  });
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
updateNetworkStatus();
registerServiceWorker();

loadMe().catch(() => {
  showLogin();
});
