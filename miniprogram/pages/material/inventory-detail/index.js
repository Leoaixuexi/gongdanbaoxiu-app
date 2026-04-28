const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, ROLES } = require('../../../utils/constants');

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const ADJ_LABEL = { gain: '盘盈', loss: '盘亏', scrap: '报废', lost: '丢失' };

function decorateRecord(r) {
  let tone, label, qtyText;
  if (r.type === 'in') {
    tone = 'in';
    label = '入库';
    qtyText = `+${r.quantity}`;
  } else if (r.type === 'adjust') {
    tone = 'adjust';
    label = ADJ_LABEL[r.adjust_type] || '调整';
    qtyText = (r.adjust_type === 'gain' ? '+' : '-') + r.quantity;
  } else {
    tone = 'out';
    label = '出库';
    qtyText = `-${r.quantity}`;
  }
  return {
    ...r,
    _tone: tone,
    _typeLabel: label,
    _qtyText: qtyText,
    _dateLabel: fmtDate(r.created_at),
  };
}

function canManage(user) {
  return user && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, 5].includes(user.role_id) && user.active !== false;
}

Page({
  data: {
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
    isWarn: false,
    hasTrendData: false,
    trendType: 'in',
    ecTrend: null,
    // 调整抽屉 Task 15 加
  },

  onLoad(options) {
    const id = Number(options.id) || 0;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    this.setData({
      materialId: id,
      canAdjust: canManage(userInfo),
    });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    const res = await materialService.getInventoryDetail(this.data.materialId);
    if (res && res.success) {
      const detail = res;
      const isWarn = detail.currentStock <= detail.minStock;
      const hasTrendData = (detail.trend || []).some(t => t.in > 0 || t.out > 0);
      detail.recentRecords = (detail.recentRecords || []).map(decorateRecord);
      this.setData({
        detail,
        loading: false,
        isWarn,
        hasTrendData,
      });
    } else {
      this.setData({ loading: false });
    }
  },

  onTrendTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.trendType) return;
    this.setData({ trendType: type });
    // 趋势图重渲染由 Task 14 接通
  },

  openAdjust() {
    // Task 15 接通
  },
});
