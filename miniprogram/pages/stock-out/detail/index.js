const stockOutService = require('../../../services/stockOutService');
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

    showApproveDialog: false,
    approveQty: '',
    currentStock: 0,
    approveQtyValid: false,
    approving: false,

    showRejectDialog: false,
    rejectReason: '',
    rejectReasonValid: false,
    rejecting: false,
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
    const res = await stockOutService.getStockOutRequest(this.data.requestId);
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

  // ===== 撤回 =====
  onCancel() {
    const that = this;
    wx.showModal({
      title: '撤回申请',
      content: '撤回后无法恢复，确定继续？',
      confirmText: '撤回',
      confirmColor: '#DC2626',
      success: async (r) => {
        if (!r.confirm) return;
        const res = await stockOutService.cancelStockOutRequest(that.data.requestId);
        if (res && res.success) {
          wx.showToast({ title: '已撤回', icon: 'success' });
          that._load();
        }
      }
    });
  },

  // ===== 审核通过 =====
  async onApprove() {
    const stockRes = await stockOutService.getMaterialById(this.data.request.material_id);
    const stock = (stockRes && stockRes.success && stockRes.material) ? stockRes.material.stock : 0;

    this.setData({
      showApproveDialog: true,
      approveQty: String(Math.min(this.data.request.requested_quantity, stock)),
      currentStock: stock,
    }, this._refreshApproveValid);
  },

  onApproveQtyInput(e) {
    this.setData({ approveQty: e.detail.value }, this._refreshApproveValid);
  },

  _refreshApproveValid() {
    const q = Number(this.data.approveQty);
    const ok = Number.isInteger(q) && q >= 1
      && q <= this.data.request.requested_quantity
      && q <= this.data.currentStock;
    this.setData({ approveQtyValid: ok });
  },

  onCloseApprove() {
    this.setData({ showApproveDialog: false });
  },

  async onConfirmApprove() {
    if (!this.data.approveQtyValid || this.data.approving) return;
    this.setData({ approving: true });
    const res = await stockOutService.approveStockOutRequest(
      this.data.requestId,
      Number(this.data.approveQty)
    );
    this.setData({ approving: false });
    if (res && res.success) {
      wx.showToast({ title: '出库成功', icon: 'success' });
      this.setData({ showApproveDialog: false });
      this._load();
    }
  },

  // ===== 驳回 =====
  onReject() {
    this.setData({ showRejectDialog: true, rejectReason: '', rejectReasonValid: false });
  },

  onRejectReasonInput(e) {
    const v = e.detail.value || '';
    this.setData({
      rejectReason: v,
      rejectReasonValid: v.trim().length > 0 && v.length <= 200,
    });
  },

  onCloseReject() {
    this.setData({ showRejectDialog: false });
  },

  async onConfirmReject() {
    if (!this.data.rejectReasonValid || this.data.rejecting) return;
    this.setData({ rejecting: true });
    const res = await stockOutService.rejectStockOutRequest(
      this.data.requestId,
      this.data.rejectReason
    );
    this.setData({ rejecting: false });
    if (res && res.success) {
      wx.showToast({ title: '已驳回', icon: 'success' });
      this.setData({ showRejectDialog: false });
      this._load();
    }
  },
});
