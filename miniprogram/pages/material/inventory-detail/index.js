import * as echarts from '../../../components/ec-canvas/echarts';
const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, ROLES } = require('../../../utils/constants');
const { getNavBarInfo } = require('../../../utils/navigation');

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
  return user && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.WAREHOUSE_KEEPER].includes(user.role_id) && user.active !== false;
}

function monthLabel(monthKey) {
  // monthKey: '2025-11'
  const m = Number(monthKey.split('-')[1]);
  return `${m}月`;
}

function buildTrendOption(trend, activeType) {
  const categories = trend.map(t => monthLabel(t.month));
  const inData = trend.map(t => t.in);
  const outData = trend.map(t => t.out);
  const ACTIVE = '#1677FF';
  const FADED = '#1677FF25';

  return {
    grid: { top: 20, left: 30, right: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#F0F0F0' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 9, color: '#999' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F0F0F0' } },
      axisLabel: { fontSize: 9, color: '#999' },
    },
    series: [
      {
        name: '入库',
        type: 'bar',
        data: inData,
        itemStyle: {
          color: activeType === 'in' ? ACTIVE : FADED,
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: 10,
      },
      {
        name: '出库',
        type: 'bar',
        data: outData,
        itemStyle: {
          color: activeType === 'out' ? ACTIVE : FADED,
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: 10,
      }
    ]
  };
}

Page({
  _trendChart: null,

  data: {
    headerHeight: 0,
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
    isWarn: false,
    hasTrendData: false,
    trendType: 'in',
    ecTrend: { lazyLoad: true },
    showAdjust: false,
    adjForm: { type: '', quantity: 1, reason: '' },
    adjSubmitting: false,
    adjPreview: { tone: 'gain', opSymbol: '+', newStock: 0 },
  },

  onLoad(options) {
    const { headerHeight } = getNavBarInfo();
    const id = Number(options.id) || 0;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    this.setData({
      headerHeight: Math.ceil(headerHeight),
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
      if (hasTrendData) {
        // 等 setData 完成后再初始化（确保 wx:if 内的 ec-canvas 已渲染）
        wx.nextTick(() => this.initTrendChart());
      }
    } else {
      this.setData({ loading: false });
    }
  },

  onTrendTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.trendType) return;
    this.setData({ trendType: type });
    if (this._trendChart) {
      this._trendChart.setOption(buildTrendOption(this.data.detail.trend, type), true);
    }
  },

  initTrendChart() {
    if (this._trendChart) {
      this._trendChart.setOption(buildTrendOption(this.data.detail.trend, this.data.trendType), true);
      return;
    }
    const comp = this.selectComponent('#trendChart');
    if (!comp) return;
    comp.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      canvas.setChart(chart);
      chart.setOption(buildTrendOption(this.data.detail.trend, this.data.trendType));
      this._trendChart = chart;
      return chart;
    });
  },

  openAdjust() {
    this.setData({
      showAdjust: true,
      adjForm: { type: 'gain', quantity: 1, reason: '' },
    });
    this.refreshPreview();
  },

  closeAdjust() {
    if (this.data.adjSubmitting) return;
    this.setData({ showAdjust: false });
  },

  onAdjTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ ['adjForm.type']: type });
    this.refreshPreview();
  },

  onAdjQtyChange(e) {
    const q = Number(e.detail) || 1;
    this.setData({ ['adjForm.quantity']: q });
    this.refreshPreview();
  },

  onAdjReasonChange(e) {
    this.setData({ ['adjForm.reason']: e.detail || '' });
  },

  refreshPreview() {
    const f = this.data.adjForm;
    const cur = this.data.detail ? this.data.detail.currentStock : 0;
    const op = f.type === 'gain' ? '+' : '-';
    const tone = f.type === 'gain' ? 'gain' : 'loss';
    const newStock = f.type === 'gain' ? cur + f.quantity : cur - f.quantity;
    this.setData({
      adjPreview: { tone, opSymbol: op, newStock },
    });
  },

  async submitAdjust() {
    const f = this.data.adjForm;
    if (!f.type) {
      wx.showToast({ title: '请选择调整类型', icon: 'none' });
      return;
    }
    if (!f.quantity || f.quantity <= 0) {
      wx.showToast({ title: '请输入调整数量', icon: 'none' });
      return;
    }
    if (!f.reason || f.reason.trim().length < 2) {
      wx.showToast({ title: '请填写调整原因', icon: 'none' });
      return;
    }
    if (f.type !== 'gain' && f.quantity > this.data.detail.currentStock) {
      wx.showToast({ title: `库存不足，当前 ${this.data.detail.currentStock}`, icon: 'none' });
      return;
    }

    this.setData({ adjSubmitting: true });
    const res = await materialService.adjustStock({
      material_id: this.data.materialId,
      adjust_type: f.type,
      quantity: f.quantity,
      reason: f.reason.trim(),
    });
    this.setData({ adjSubmitting: false });

    if (res && res.success) {
      wx.showToast({ title: '调整成功', icon: 'success' });
      this.setData({ showAdjust: false });
      this.loadDetail();
    }
  },
});
