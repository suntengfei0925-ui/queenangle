const paymentQrCodes = {
  wechat: "/assets/payment/wechat.jfif",
  alipay: "/assets/payment/alipay.jfif"
};

const paymentMethods = [
  { value: "wechat", label: "微信", qrCodeSrc: paymentQrCodes.wechat },
  { value: "alipay", label: "支付宝", qrCodeSrc: paymentQrCodes.alipay },
  { value: "cash", label: "现金" }
];

function getPaymentQrCode(value) {
  return paymentQrCodes[value] || "";
}

module.exports = {
  paymentMethods,
  getPaymentQrCode
};
