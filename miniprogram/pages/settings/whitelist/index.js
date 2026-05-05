const { guardedPage } = require("../../../utils/page");
const api = require("../../../utils/api");

const emptyAddForm = {
  openid: "",
  name: "",
  remark: ""
};

const emptyApproveForm = {
  applicationId: "",
  openid: "",
  name: "",
  remark: ""
};

const emptyEditForm = {
  id: "",
  openid: "",
  name: "",
  remark: "",
  enabled: true,
  isOwner: false,
  originalEnabled: true,
  originalIsOwner: false
};

function pad(value) {
  const text = String(value);
  return text.length >= 2 ? text : `0${text}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizePerson(person) {
  const enabled = person.enabled !== false;
  const isOwner = person.isOwner === true;
  return {
    ...person,
    enabled,
    isOwner,
    statusText: enabled ? "启用" : "停用",
    roleText: isOwner ? "老板" : "普通人员"
  };
}

function normalizeApplication(application) {
  return {
    ...application,
    createdAtText: formatDate(application.createdAt || application.updatedAt),
    statusText: application.status === "pending" ? "待审核" : application.status
  };
}

guardedPage({
  data: {
    mode: "list",
    loading: false,
    saving: false,
    currentOpenid: "",
    applications: [],
    people: [],
    addForm: { ...emptyAddForm },
    approveForm: { ...emptyApproveForm },
    editForm: { ...emptyEditForm }
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    this.setData({ loading: true });
    api.callBusiness("listWhitelistManagement")
      .then((data) => {
        this.setData({
          currentOpenid: data.currentOpenid || "",
          applications: (data.applications || []).map(normalizeApplication),
          people: (data.people || []).map(normalizePerson)
        });
      })
      .catch((err) => {
        if (err.code === "OWNER_PERMISSION_REQUIRED") {
          wx.showModal({
            title: "无权限",
            content: "只有老板可以管理白名单",
            showCancel: false,
            success() {
              wx.navigateBack();
            }
          });
          return;
        }
        api.showError(err);
      })
      .then(() => {
        this.setData({ loading: false });
      });
  },

  onInput(e) {
    const scope = e.currentTarget.dataset.scope;
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`${scope}.${field}`]: e.detail.value
    });
  },

  onSwitch(e) {
    const scope = e.currentTarget.dataset.scope;
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`${scope}.${field}`]: e.detail.value
    });
  },

  startAdd() {
    this.setData({
      mode: "add",
      addForm: { ...emptyAddForm }
    });
  },

  saveAdd() {
    const form = this.data.addForm;
    if (!String(form.openid || "").trim()) {
      wx.showToast({ title: "请填写 openid", icon: "none" });
      return;
    }
    if (!String(form.name || "").trim()) {
      wx.showToast({ title: "请填写姓名", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    api.callBusiness("saveWhitelistPerson", {
      openid: form.openid,
      name: form.name,
      remark: form.remark
    })
      .then(() => {
        wx.showToast({ title: "已新增" });
        this.backToList();
        this.loadData();
      })
      .catch(api.showError)
      .then(() => {
        this.setData({ saving: false });
      });
  },

  startApprove(e) {
    const item = this.data.applications.find((application) => application._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      mode: "approve",
      approveForm: {
        ...emptyApproveForm,
        applicationId: item._id,
        openid: item.openid
      }
    });
  },

  approveApplication() {
    const form = this.data.approveForm;
    if (!String(form.name || "").trim()) {
      wx.showToast({ title: "请填写姓名", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    api.callBusiness("reviewWhitelistApplication", {
      applicationId: form.applicationId,
      decision: "approved",
      name: form.name,
      remark: form.remark
    })
      .then(() => {
        wx.showToast({ title: "已通过" });
        this.backToList();
        this.loadData();
      })
      .catch(api.showError)
      .then(() => {
        this.setData({ saving: false });
      });
  },

  rejectApplication(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "确认拒绝",
      content: "拒绝后，对方再次申请会重新进入待审核。",
      success: (res) => {
        if (!res.confirm) return;
        api.callBusiness("reviewWhitelistApplication", {
          applicationId: id,
          decision: "rejected"
        })
          .then(() => {
            wx.showToast({ title: "已拒绝" });
            this.loadData();
          })
          .catch(api.showError);
      }
    });
  },

  editPerson(e) {
    const item = this.data.people.find((person) => person._id === e.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      mode: "edit",
      editForm: {
        id: item._id,
        openid: item.openid,
        name: item.name,
        remark: item.remark || "",
        enabled: item.enabled,
        isOwner: item.isOwner,
        originalEnabled: item.enabled,
        originalIsOwner: item.isOwner
      }
    });
  },

  saveEdit() {
    const form = this.data.editForm;
    if (!String(form.name || "").trim()) {
      wx.showToast({ title: "请填写姓名", icon: "none" });
      return;
    }

    const sensitive = form.originalIsOwner !== form.isOwner
      || (form.originalEnabled && form.originalIsOwner && !form.enabled);
    if (sensitive) {
      wx.showModal({
        title: "确认老板权限变更",
        content: "该操作会影响白名单管理权限，请确认无误。",
        success: (res) => {
          if (res.confirm) this.submitEdit(true);
        }
      });
      return;
    }

    this.submitEdit(false);
  },

  submitEdit(confirmSensitive) {
    const form = this.data.editForm;
    this.setData({ saving: true });
    api.callBusiness("saveWhitelistPerson", {
      id: form.id,
      name: form.name,
      remark: form.remark,
      enabled: form.enabled,
      isOwner: form.isOwner,
      confirmSensitive
    })
      .then(() => {
        wx.showToast({ title: "已保存" });
        if (form.openid === this.data.currentOpenid) {
          return api.checkAuth().then((auth) => {
            if (!auth.allowed || auth.isOwner !== true) {
              if (auth.allowed) wx.navigateBack();
              return;
            }
            this.backToList();
            this.loadData();
          });
        }
        this.backToList();
        this.loadData();
        return null;
      })
      .catch(api.showError)
      .then(() => {
        this.setData({ saving: false });
      });
  },

  backToList() {
    this.setData({
      mode: "list",
      addForm: { ...emptyAddForm },
      approveForm: { ...emptyApproveForm },
      editForm: { ...emptyEditForm }
    });
  }
});
