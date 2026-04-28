import * as echarts from '../../../components/ec-canvas/echarts';
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
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
    isWarn: false,
    hasTrendData: false,
    trendType: 'in',
    ecTrend: { lazyLoad: true },
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
    // Task 15 接通
  },
});
