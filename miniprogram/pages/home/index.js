const { getOrderStatistics, listWorkOrders } = require('../../services/workOrder')
const app = getApp()

// 与工单列表 orderEnricher manager 角色保持一致
const STATUS_TEXT_MAP = {
  'Pending Repair': '已提报',
  'In Progress': '维修中',
  'Repaired': '待复核',
  'Needs Rework': '需返工',
  'Completed': '已完成',
}

const STATUS_BG_COLORS = {
  'Pending Repair': '#dbeafe',
  'In Progress': '#cffafe',
  'Repaired': '#ede9fe',
  'Needs Rework': '#fee2e2',
  'Completed': '#d1fae5',
}

const STATUS_TEXT_COLORS = {
  'Pending Repair': '#2563eb',
  'In Progress': '#0891b2',
  'Repaired': '#7c3aed',
  'Needs Rework': '#dc2626',
  'Completed': '#059669',
}

function formatRecordTime(dateVal) {
  if (!dateVal) return ''
  const d = new Date(dateVal)
  const now = new Date()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

Page({
  data: {
    statusBarHeight: 0,
    activeTab: 0,
    tabs: ['工单维修', '耗品管理', '楼宇巡检'],
    isMaintenanceWorker: false,
    refreshing: false,
    // 受控 scroll-top：切 tab 回来时重置为 0（先设非 0 再设 0 才能触发滚动）
    scrollTops: [0, 0, 0],

    // 工单维修 - 统计数据
    workOrderStats: {
      pending: 0,
      inProgress: 0,
      review: 0,
      completed: 0
    },
    // 工单维修 - 功能入口
    workOrderFunctions: [
      { icon: 'orders-o', label: '工单列表', color: '#4F46E5', bg: '#EEF2FF' },
      { icon: 'chart-trending-o', label: '数据看板', color: '#D97706', bg: '#FEF3C7' },
      { icon: 'gift-o', label: '物料管理', color: '#059669', bg: '#ECFDF5' }
    ],
    // 工单维修 - 最近记录
    workOrderRecords: [],

    // 耗品管理 - 统计数据（待办数字）
    consumableStats: {
      pendingApproval: 5,
      stockWarning: 3,
    },
    // 耗品管理 - 数据概览
    consumableOverview: {
      totalStock: 5472,
      monthIn: 1286,
      monthInAmount: '128,560',
      monthOut: 863,
      monthOutAmount: '96,320',
    },
    consumableMonth: '',
    // 耗品管理 - 功能宫格（2行×4列）
    consumableFuncRows: [
      [
        { icon: 'add-o', label: '入库管理', bg: '#1677FF' },
        { icon: 'upgrade', label: '出库管理', bg: '#FF6A00' },
        { icon: 'search', label: '库存查询', bg: '#00B578' },
        { icon: 'records-o', label: '库存盘点', bg: '#7B61FF' },
      ],
      [
        { icon: 'logistics', label: '快递管理', bg: '#00B4D8' },
        { icon: 'chart-trending-o', label: '数据报表', bg: '#FFB100' },
        { icon: 'sign', label: '申领审批', bg: '#FF4D4F' },
        { icon: 'warning-o', label: '预警管理', bg: '#EB2F96' },
      ],
    ],
    // 耗品管理 - 最近动态
    consumableActivities: [
      { text: '办公桌椅 x20 已入库', time: '10:30', badgeBg: '#1677FF1A', timeColor: '#1677FF' },
      { text: '打印纸 x50 待审批出库', time: '09:15', badgeBg: '#FF6A001A', timeColor: '#8A6A53' },
      { text: '库存盘点完成，差异3项', time: '昨天', badgeBg: '#00B5781A', timeColor: '#4E8F72' },
    ],

    // 楼宇巡检 - 统计数据
    inspectionStats: {
      pendingFix: 7,
      fixed: 23,
      overdue: 3
    },
    // 楼宇巡检 - 功能入口
    inspectionFunctions: [
      { icon: 'orders-o', label: '巡检列表', color: '#4F46E5', bg: '#EEF2FF' },
      { icon: 'setting-o', label: '整改处理', color: '#D97706', bg: '#FEF3C7' },
      { icon: 'chart-trending-o', label: '数据看板', color: '#059669', bg: '#ECFDF5' }
    ],
    // 楼宇巡检 - 最近记录
    inspectionRecords: [
      { title: '消防通道巡检 #B2024031', subtitle: '待整改 · 今天 10:30', dotColor: '#FB923C' },
      { title: '电梯机房巡检 #B2024028', subtitle: '已整改 · 今天 09:15', dotColor: '#4ADE80' },
      { title: '地下车库照明 #B2024025', subtitle: '延期整改 · 昨天', dotColor: '#F87171' }
    ]
  },

  onLoad() {
    const systemInfo = wx.getWindowInfo()
    const now = new Date()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20,
      consumableMonth: `${now.getFullYear()}年${now.getMonth() + 1}月`,
    })
  },

  onShow() {
    // 设置 TabBar 选中状态（首页 = index 0）
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    // 按角色调整工单功能入口
    const roleId = app.globalData.userInfo?.role_id
    const isMaintenanceWorker = roleId === 3
    const isManager = roleId === 2
    if (isMaintenanceWorker) {
      this.setData({
        isMaintenanceWorker: true,
        tabs: ['工单维修'],
        workOrderFunctions: this.data.workOrderFunctions.filter(f => f.label !== '物料管理')
      })
    } else if (isManager) {
      const baseFuncs = this.data.workOrderFunctions.filter(f => f.label !== '收费工单')
      this.setData({
        workOrderFunctions: [
          ...baseFuncs,
          { icon: 'gold-coin-o', label: '收费工单', color: '#B45309', bg: '#FFFBEB' }
        ]
      })
    }
    this.loadWorkOrderStats()
    this.loadRecentWorkOrders()
  },

  async onRefresh() {
    this.setData({ refreshing: true })
    try {
      await this.loadTabData(this.data.activeTab)
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // 按当前 tab 加载/刷新数据（Tab 1/2 暂为静态数据，后续接入真实数据时补充 case）
  async loadTabData(index) {
    if (index === 0) {
      await Promise.all([this.loadWorkOrderStats(), this.loadRecentWorkOrders()])
    }
  },

  // 加载最近工单记录
  async loadRecentWorkOrders() {
    try {
      const { orders } = await listWorkOrders({ limit: 4, page: 1 })
      const records = orders.map(o => ({
        orderId: o.order_id,
        info: [o.floor, o.location, o.description].filter(Boolean).join(' · '),
        timeText: formatRecordTime(o.created_at),
        statusText: STATUS_TEXT_MAP[o.status] || o.status,
        statusColor: STATUS_TEXT_COLORS[o.status] || '#9e9e9e',
        statusBg: STATUS_BG_COLORS[o.status] || '#f5f5f5',
        dotColor: STATUS_TEXT_COLORS[o.status] || '#9e9e9e',
      }))
      this.setData({ workOrderRecords: records })
    } catch (e) {
      console.error('[Home] 加载最近工单失败:', e)
    }
  },

  // 加载工单统计数据
  async loadWorkOrderStats() {
    try {
      const { statistics } = await getOrderStatistics()
      this.setData({
        workOrderStats: {
          pending: statistics['Pending Repair'] || 0,
          inProgress: statistics['In Progress'] || 0,
          review: statistics['Repaired'] || 0,
          completed: statistics['Completed'] || 0
        }
      })
    } catch (e) {
      console.error('[Home] 加载工单统计失败:', e)
    }
  },

  // 统计卡片点击 - 跳转到对应状态的工单列表
  onStatCardTap(e) {
    const { status } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/index/index?status=${status}`
    })
  },

  // 标签切换
  onTabChange(e) {
    const index = e.currentTarget.dataset.index
    if (index === this.data.activeTab) return
    this.setData({ activeTab: index })
    this.resetScroll(index)
    this.loadTabData(index)
  },

  // swiper 滑动切换
  onSwiperChange(e) {
    const index = e.detail.current
    if (index === this.data.activeTab) return
    this.setData({ activeTab: index })
    this.resetScroll(index)
    this.loadTabData(index)
  },

  // 重置指定 tab 的滚动位置到顶部
  resetScroll(index) {
    const key = `scrollTops[${index}]`
    this.setData({ [key]: 1 })
    setTimeout(() => this.setData({ [key]: 0 }), 0)
  },

  // 功能入口点击
  onFunctionTap(e) {
    const { module, label } = e.currentTarget.dataset
    console.log('点击功能:', module, label)

    if (module === 'workOrder' && label === '工单列表') {
      wx.navigateTo({
        url: '/pages/index/index',
        fail: (err) => {
          console.error('navigateTo failed:', err)
          wx.reLaunch({ url: '/pages/index/index' })
        }
      })
      return
    }

    if (module === 'workOrder' && label === '数据看板') {
      wx.navigateTo({
        url: '/pages/data/index',
        fail: (err) => {
          console.error('navigateTo failed:', err)
          wx.reLaunch({ url: '/pages/data/index' })
        }
      })
      return
    }

    if (module === 'workOrder' && label === '物料管理') {
      wx.navigateTo({
        url: '/pages/material/index',
        fail: (err) => {
          console.error('navigateTo failed:', err)
          wx.reLaunch({ url: '/pages/material/index' })
        }
      })
      return
    }

    if (module === 'workOrder' && label === '收费工单') {
      wx.navigateTo({ url: '/pages/charge-order/index' })
      return
    }

    // 后续添加页面跳转
    wx.showToast({ title: label, icon: 'none' })
  },

  // 快捷操作点击
  onQuickAction(e) {
    const { action } = e.currentTarget.dataset
    console.log('快捷操作:', action)

    if (action === '新建工单') {
      wx.navigateTo({ url: '/pages/property/submit/index' })
      return
    }

    if (action === '物料入库') {
      wx.navigateTo({ url: '/pages/material/add/index' })
      return
    }

    wx.showToast({ title: action, icon: 'none' })
  },

  // 记录点击
  onRecordTap(e) {
    const { index } = e.currentTarget.dataset
    const record = this.data.workOrderRecords[index]
    if (record && record.orderId) {
      wx.navigateTo({ url: `/pages/work-order-detail/index?id=${record.orderId}` })
    }
  },

  // 查看全部
  onViewAll(e) {
    const { module } = e.currentTarget.dataset
    console.log('查看全部:', module)
    wx.showToast({ title: '查看全部', icon: 'none' })
  }
})
