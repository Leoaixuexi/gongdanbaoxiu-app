const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    activeTab: 0,
    tabs: ['工单维修', '耗品管理', '楼宇巡检'],

    // 工单维修 - 统计数据
    workOrderStats: {
      pending: 12,
      inProgress: 8,
      completed: 156
    },
    // 工单维修 - 功能入口
    workOrderFunctions: [
      { icon: 'orders-o', label: '工单列表', color: '#4F46E5', bg: '#EEF2FF' },
      { icon: 'chart-trending-o', label: '数据看板', color: '#D97706', bg: '#FEF3C7' },
      { icon: 'gift-o', label: '物料管理', color: '#059669', bg: '#ECFDF5' }
    ],
    // 工单维修 - 最近记录
    workOrderRecords: [
      { title: '空调维修工单 #2024031', subtitle: '已派单 · 今天 10:30', dotColor: '#FB923C' },
      { title: '电梯检修 #2024028', subtitle: '维修中 · 今天 09:15', dotColor: '#60A5FA' },
      { title: '照明更换 #2024025', subtitle: '已完成 · 昨天', dotColor: '#4ADE80' }
    ],

    // 耗品管理 - 统计数据
    consumableStats: {
      pendingApproval: 5,
      stockWarning: 3,
      todayOut: 28,
      todayIn: 15
    },
    // 耗品管理 - 功能入口
    consumableFunctions: [
      [
        { icon: 'gift-o', label: '入库管理', color: '#4F46E5', bg: '#EEF2FF' },
        { icon: 'logistics', label: '出库管理', color: '#D97706', bg: '#FEF3C7' },
        { icon: 'shop-o', label: '库存管理', color: '#059669', bg: '#ECFDF5' }
      ],
      [
        { icon: 'envelop-o', label: '快递管理', color: '#EA580C', bg: '#FFF7ED' },
        { icon: 'chart-trending-o', label: '数据看板', color: '#0284C7', bg: '#F0F9FF' }
      ]
    ],
    // 耗品管理 - 最近记录
    consumableRecords: [
      { title: 'A4打印纸 出库20箱', subtitle: '今天 10:45', dotColor: '#60A5FA' },
      { title: '墨盒HP-26A 入库50个', subtitle: '今天 09:30', dotColor: '#4ADE80' },
      { title: '清洁用品 出库5套', subtitle: '昨天', dotColor: '#FB923C' }
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
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight || 20
    })
  },

  onShow() {
    // 设置 TabBar 选中状态（首页 = index 0）
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onPullDownRefresh() {
    // 模拟刷新
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  // 标签切换
  onTabChange(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ activeTab: index })
  },

  // swiper 滑动切换
  onSwiperChange(e) {
    this.setData({ activeTab: e.detail.current })
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

    wx.showToast({ title: action, icon: 'none' })
  },

  // 记录点击
  onRecordTap(e) {
    const { module, index } = e.currentTarget.dataset
    console.log('点击记录:', module, index)
    wx.showToast({ title: '查看详情', icon: 'none' })
  },

  // 查看全部
  onViewAll(e) {
    const { module } = e.currentTarget.dataset
    console.log('查看全部:', module)
    wx.showToast({ title: '查看全部', icon: 'none' })
  }
})
