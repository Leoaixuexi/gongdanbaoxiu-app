const chargeOrderStore = require('./store')
const echarts = require('../../components/ec-canvas/echarts')
const { getNavBarInfo } = require('../../utils/navigation')

// 近 12 个月支出趋势数据（固定 mock，不随时间筛选器变化）
const trendData = [
  { month: '5月', amount: 2400 },
  { month: '6月', amount: 2900 },
  { month: '7月', amount: 1800 },
  { month: '8月', amount: 3400 },
  { month: '9月', amount: 3500 },
  { month: '10月', amount: 2900 },
  { month: '11月', amount: 1400 },
  { month: '12月', amount: 4200 },
  { month: '1月', amount: 2900 },
  { month: '2月', amount: 2600 },
  { month: '3月', amount: 3700 },
  { month: '4月', amount: 3000 },
]

// 日期工具：把 range 名称解析为 {start: Date, end: Date}
function rangeToDates(range, customRange) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()  // 0-based
  if (range === '本月') {
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) }
  }
  if (range === '上月') {
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
  }
  if (range === '本季度') {
    const qStart = Math.floor(m / 3) * 3
    return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 1) }
  }
  if (range === '本年') {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
  }
  if (range === '自定义' && customRange.start && customRange.end) {
    const s = new Date(customRange.start + 'T00:00:00')
    const e = new Date(customRange.end + 'T00:00:00')
    e.setDate(e.getDate() + 1)  // 包含结束日当天
    return { start: s, end: e }
  }
  // 兜底：本月
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) }
}

// 等长度的"前一段"区间（用于环比）
function previousRange({ start, end }) {
  const len = end.getTime() - start.getTime()
  return { start: new Date(start.getTime() - len), end: new Date(start.getTime()) }
}

function parseCreatedAt(s) {
  if (!s) return null
  // 兼容 "YYYY-MM-DD HH:mm" 与 "YYYY-MM-DD"
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0))
}

function inRange(order, range) {
  const d = parseCreatedAt(order.created_at)
  if (!d) return false
  return d >= range.start && d < range.end
}

// 颜色板（分类占比 + 兜底）
const CATEGORY_COLORS = ['#3B82F6', '#06B6D4', '#F59E0B', '#EF4444', '#10B981', '#94a3b8']

function computeDashboard(orders, range, prevRange) {
  const curr = orders.filter(o => inRange(o, range))
  const prev = orders.filter(o => inRange(o, prevRange))

  const sumAmount = arr => arr.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
  const currTotal = sumAmount(curr)
  const prevTotal = sumAmount(prev)
  const currCount = curr.length
  const avgOrder = currCount > 0 ? Math.round(currTotal / currCount) : 0
  const momPct = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0

  // 分类占比：按 order_category 聚合金额，取 TOP 5，其余合并为"其他"
  const catMap = {}
  curr.forEach(o => {
    const k = o.order_category || '未分类'
    catMap[k] = (catMap[k] || 0) + (Number(o.totalAmount) || 0)
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const catTop = catSorted.slice(0, 5)
  const catRest = catSorted.slice(5).reduce((s, [, v]) => s + v, 0)
  const categoryData = catTop.map(([name, value], i) => ({
    name, value, color: CATEGORY_COLORS[i],
  }))
  if (catRest > 0) {
    categoryData.push({ name: '其他', value: catRest, color: CATEGORY_COLORS[5] })
  }

  // 楼层 TOP 5（按工单数）
  const floorMap = {}
  curr.forEach(o => {
    const k = o.floor || '未知'
    floorMap[k] = (floorMap[k] || 0) + 1
  })
  const topFloors = Object.entries(floorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // 设备 TOP 5（按工单数，维度同样是 order_category）
  const devMap = {}
  curr.forEach(o => {
    const k = o.order_category || '未分类'
    devMap[k] = (devMap[k] || 0) + 1
  })
  const topDevices = Object.entries(devMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return {
    kpi: { total: currTotal, count: currCount, avg: avgOrder, momPct },
    categoryData,
    topFloors,
    topDevices,
  }
}

const makeEc = getOption => ({
  lazyLoad: false,
  onInit: (canvas, width, height, dpr) => {
    const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
    chart.setOption(getOption())
    canvas.setChart(chart)
    return chart
  },
})

// 趋势图：固定展示 trendData 12 个月；独立于时间筛选器，不被 refreshDashboard 联动
const trendOption = {
  grid: { left: 56, right: 20, top: 20, bottom: 36 },
  tooltip: { trigger: 'axis', formatter: p => `${p[0].axisValue} ¥${p[0].data.toLocaleString('en-US')}` },
  xAxis: {
    type: 'category',
    data: trendData.map(d => d.month),
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#737373', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    splitLine: { lineStyle: { color: '#f0f0f0' } },
    axisLabel: { color: '#a3a3a3', fontSize: 10, formatter: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v },
  },
  series: [{
    type: 'bar',
    data: trendData.map(d => d.amount),
    itemStyle: {
      borderRadius: [6, 6, 0, 0],
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#60a5fa' }] },
    },
    barWidth: 12,
  }],
}

function buildHBarOption(items, color) {
  const names = items.map(i => i.name)
  const values = items.map(i => i.count)
  return {
    grid: { left: 100, right: 40, top: 10, bottom: 20 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#a3a3a3', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#525252', fontSize: 11 },
      inverse: true,
    },
    series: [{
      type: 'bar',
      data: values,
      barWidth: 14,
      itemStyle: { borderRadius: [0, 6, 6, 0], color },
      label: {
        show: true,
        position: 'right',
        formatter: '{c} 单',
        color: '#525252',
        fontSize: 10,
      },
    }],
  }
}

function buildPieOption(categoryData) {
  const safeData = (categoryData && categoryData.length > 0) ? categoryData : []
  return {
    tooltip: { trigger: 'item', formatter: p => `${p.name}: ¥${p.data.value.toLocaleString('en-US')} (${p.percent}%)` },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['42%', '60%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data: safeData.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } })),
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
    }],
  }
}

Page({
  data: {
    headerHeight: 0,
    activeTab: 0,
    tabs: ['收费列表', '数据看板'],

    // Tab 1 — 列表
    activeFilter: '全部',
    filters: ['全部', '待维修', '已完成'],
    keyword: '',
    orders: [],

    // Tab 2 — 时间筛选器
    rangeOptions: ['本月', '上月', '本季度', '本年', '自定义'],
    activeRange: '本月',
    customRangeLabel: '自定义',
    customRange: { start: '', end: '' },
    // 自定义日期弹窗
    isRangePickerOpen: false,
    tempStart: '',
    tempEnd: '',

    // 看板聚合结果
    dash: { kpi: { total: 0, count: 0, avg: 0, momPct: 0 }, categoryData: [], topFloors: [], topDevices: [] },
    kpiCards: [],

    // Tab 2 — 看板
    kpi: [
      { label: '收费工单数', value: '48', trend: '↑ 12%', trendColor: '#16a34a' },
      { label: '总收费金额', value: '¥156.8K', trend: '↑ 8.3%', trendColor: '#16a34a', accent: true },
      { label: '待付款数', value: '12', trend: '↓ 2', trendColor: '#dc2626' },
      { label: '平均维修费用', value: '¥450', trend: '↑ 2.0%', trendColor: '#16a34a' },
    ],
    ranking: [
      { name: '上海格力售后', amount: '¥42,600', pct: 100 },
      { name: '美的制冷服务', amount: '¥38,200', pct: 90 },
      { name: '日立电梯维保', amount: '¥31,500', pct: 74 },
      { name: '博世配件', amount: '¥24,800', pct: 58 },
      { name: '三菱电梯', amount: '¥19,700', pct: 46 },
    ],

    ecTrend: { onInit: null },
    ecPie: { onInit: null },
    ecFloor: null,
    ecDevice: null,
  },

  onLoad() {
    const { headerHeight } = getNavBarInfo()
    this.setData({
      headerHeight: Math.ceil(headerHeight),
      ecTrend: makeEc(() => trendOption),
      ecPie: null,  // pie 由 refreshDashboard 按 categoryData 注入
    }, () => this.refreshDashboard())
  },

  onShow() {
    this.applyFilter()
  },

  applyFilter() {
    const { activeFilter, keyword } = this.data
    const all = chargeOrderStore.getAll()
    let list = all
    if (activeFilter === '待维修') {
      list = all.filter(o => o.status === 'Pending Repair')
    } else if (activeFilter === '已完成') {
      list = all.filter(o => o.status === 'Completed')
    }
    if (keyword) {
      const kw = keyword.toLowerCase()
      list = list.filter(o =>
        (o.order_number || '').toLowerCase().includes(kw) ||
        (o.customer || '').includes(kw) ||
        (o.description || '').includes(kw)
      )
    }
    this.setData({ orders: list.map(chargeOrderStore.enrich) })
  },

  _setTab(index) {
    if (index === this.data.activeTab) return
    this.setData({ activeTab: index })
  },

  onTabChange(e) {
    this._setTab(Number(e.currentTarget.dataset.index))
  },

  onSwiperChange(e) {
    this._setTab(e.detail.current)
  },

  onFilterChange(e) {
    const { filter } = e.currentTarget.dataset
    if (filter === this.data.activeFilter) return
    this.setData({ activeFilter: filter }, () => this.applyFilter())
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilter())
  },

  onSearchClear() {
    this.setData({ keyword: '' }, () => this.applyFilter())
  },

  onRangeSelect(e) {
    const { range } = e.currentTarget.dataset
    if (range === '自定义') {
      this.setData({
        isRangePickerOpen: true,
        tempStart: this.data.customRange.start,
        tempEnd: this.data.customRange.end,
      })
      return
    }
    if (range === this.data.activeRange) return
    this.setData({ activeRange: range, customRangeLabel: '自定义' }, () => this.refreshDashboard())
  },

  closeRangePicker() { this.setData({ isRangePickerOpen: false }) },
  stopPropagation() {},

  onTempStartChange(e) { this.setData({ tempStart: e.detail.value }) },
  onTempEndChange(e) { this.setData({ tempEnd: e.detail.value }) },

  cancelRangePicker() { this.setData({ isRangePickerOpen: false }) },

  confirmRangePicker() {
    const { tempStart, tempEnd } = this.data
    if (!tempStart || !tempEnd) {
      wx.showToast({ title: '请选择开始和结束日期', icon: 'none' })
      return
    }
    if (tempStart > tempEnd) {
      wx.showToast({ title: '开始日期不能晚于结束', icon: 'none' })
      return
    }
    const fmt = s => s.slice(5).replace('-', '/')
    this.setData({
      activeRange: '自定义',
      customRange: { start: tempStart, end: tempEnd },
      customRangeLabel: `${fmt(tempStart)}-${fmt(tempEnd)}`,
      isRangePickerOpen: false,
    }, () => this.refreshDashboard())
  },

  refreshDashboard() {
    const orders = chargeOrderStore.getAll()
    const range = rangeToDates(this.data.activeRange, this.data.customRange)
    const prev = previousRange(range)
    const result = computeDashboard(orders, range, prev)

    const fmtMoney = n => '¥' + Math.round(n).toLocaleString('en-US')
    const fmtMom = p => {
      const abs = Math.abs(p).toFixed(1) + '%'
      if (p > 0) return { text: '↑ ' + abs, color: '#ef4444' }  // 支出上升=警示红
      if (p < 0) return { text: '↓ ' + abs, color: '#16a34a' }  // 支出下降=好=绿
      return { text: '— 0.0%', color: '#94a3b8' }
    }
    const mom = fmtMom(result.kpi.momPct)

    const kpiCards = [
      { label: '总支出', value: fmtMoney(result.kpi.total), accent: true },
      { label: '工单数', value: String(result.kpi.count) },
      { label: '平均单次', value: fmtMoney(result.kpi.avg) },
      { label: '环比变化', value: mom.text, color: mom.color },
    ]

    this.setData({
      dash: result,
      kpiCards,
      ecPie: null,
      ecFloor: null,
      ecDevice: null,
    }, () => {
      this.setData({
        ecPie: makeEc(() => buildPieOption(result.categoryData)),
        ecFloor: makeEc(() => buildHBarOption(result.topFloors, '#F59E0B')),
        ecDevice: makeEc(() => buildHBarOption(result.topDevices, '#06B6D4')),
      })
    })
  },

  onOrderTap(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/charge-order/detail?id=${id}` })
  },

})
