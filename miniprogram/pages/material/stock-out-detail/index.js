const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, STOCK_OUT_STATUS_DISPLAY_NAMES } = require('../../../utils/constants');

function fmt(d) {
  if (!d) return '';
  const x = new Date(d);
  const Y = x.getFullYear();
  const M = String(x.getMonth() + 1).padStart(2, '0');
  const D = String(x.getDate()).padStart(2, '0');
  const h = String(x.getHours()).padStart(2, '0');
  const m = String(x.getMinutes()).padStart(2, '0');
  return `${Y}/${M}/${D} ${h}:${m}`;
}

Page({
  data: {
    requestId: 0,
    request: null,
    loading: true,
    statusText: '',
    createdText: '',
    approvedText: '',
    rejectedText: '',
    cancelledText: '',
    showActions: false,
    canCancel: false,
    canApprove: false,
  },

  onLoad(query) {
    const id = parseInt(query.request_id, 10);
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ requestId: id });
    this._load();
  },

  onShow() {
    if (this.data.requestId) this._load();
  },

  async _load() {
    this.setData({ loading: true });
    const res = await materialService.getStockOutRequest(this.data.requestId);
    if (!res || !res.success) {
      this.setData({ loading: false, request: null });
      return;
    }
    const request = res.request;
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const isMine = request.requester && request.requester.user_id === userInfo.user_id;
    const canApproveRole = userInfo && [1, 5].includes(userInfo.role_id);

    this.setData({
      request,
      loading: false,
      statusText: STOCK_OUT_STATUS_DISPLAY_NAMES[request.status] || request.status,
      createdText: fmt(request.created_at),
      approvedText: fmt(request.approved_at),
      rejectedText: fmt(request.rejected_at),
      cancelledText: fmt(request.cancelled_at),
      canCancel: isMine && request.status === 'Pending',
      canApprove: canApproveRole && request.status === 'Pending',
      showActions: (isMine && request.status === 'Pending')
                || (canApproveRole && request.status === 'Pending'),
    });
  },

  onBack() {
    wx.navigateBack();
  },

  // Task 16 接入
  onCancel() {},
  onApprove() {},
  onReject() {},
});
