const { guardedPage } = require("../../utils/page");
const api = require("../../utils/api");

const CANVAS_ID = "signatureCanvas";

guardedPage({
  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    hasStroke: false
  },

  onReady() {
    this.initCanvas();
  },

  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select(".signature-canvas")
      .boundingClientRect((rect) => {
        const width = rect && rect.width ? rect.width : 600;
        const height = rect && rect.height ? rect.height : 300;
        this.ctx = wx.createCanvasContext(CANVAS_ID, this);
        this.setData({
          canvasWidth: width,
          canvasHeight: height
        }, () => this.clearSignature());
      })
      .exec();
  },

  getTouchPoint(e) {
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || {};
    return {
      x: Number(touch.x || 0),
      y: Number(touch.y || 0)
    };
  },

  drawDot(point) {
    if (!this.ctx) return;
    this.ctx.setFillStyle("#111827");
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.draw(true);
  },

  onTouchStart(e) {
    const point = this.getTouchPoint(e);
    this.lastPoint = point;
    this.drawDot(point);
    this.setData({ hasStroke: true });
  },

  onTouchMove(e) {
    if (!this.ctx || !this.lastPoint) return;
    const point = this.getTouchPoint(e);
    this.ctx.setStrokeStyle("#111827");
    this.ctx.setLineWidth(5);
    this.ctx.setLineCap("round");
    this.ctx.setLineJoin("round");
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
    this.ctx.draw(true);
    this.lastPoint = point;
    if (!this.data.hasStroke) this.setData({ hasStroke: true });
  },

  onTouchEnd() {
    this.lastPoint = null;
  },

  clearSignature() {
    if (!this.ctx) return;
    const width = this.data.canvasWidth || 600;
    const height = this.data.canvasHeight || 300;
    this.ctx.setFillStyle("#ffffff");
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.draw();
    this.lastPoint = null;
    this.setData({ hasStroke: false });
  },

  confirmSignature() {
    if (!this.data.hasStroke) {
      api.showError(new Error("请先完成签字"));
      return;
    }

    const width = this.data.canvasWidth || 600;
    const height = this.data.canvasHeight || 300;
    wx.canvasToTempFilePath({
      canvasId: CANVAS_ID,
      fileType: "png",
      quality: 1,
      destWidth: Math.round(width * 2),
      destHeight: Math.round(height * 2),
      success: (res) => {
        const eventChannel = this.getOpenerEventChannel();
        eventChannel.emit("signatureConfirmed", {
          tempFilePath: res.tempFilePath,
          signedAt: new Date().toISOString()
        });
        wx.navigateBack();
      },
      fail: () => api.showError(new Error("签名生成失败，请重试"))
    }, this);
  }
});
