/**
 * 数据统计页面
 */

const auth = require('../../services/auth');
const workOrderService = require('../../services/workOrder');
const dateUtils = require('../../utils/dateUtils');
const chartUtils = require('../../utils/chartUtils');
const animationUtils = require('../../utils/animationUtils');

Page({
  data: {
    // 工单统计（物业员工/维修员使用）
    stats: [],
    // 月度排名
    rankings: [],
    // 自定义导航栏高度
    headerHeight: 0,
    // 用户角色信息
    userRole: null,
    userDepartment: null,
    userId: null,
    isPropertyStaff: false,
    isMaintenanceWorker: false,
    isManager: false,  // 物业经理
    loading: true,

    // ========== 物业经理专用数据 ==========
    // Tab切换
    activeTab: 'stats',  // 'stats' | 'charts'

    // 时间过滤
    timeFilter: 'today',  // 'yesterday' | 'today' | 'week' | 'month' | 'custom'
    startDate: '',
    endDate: '',
    showDatePicker: false,

    // KPI指标
    kpiData: {
      totalOrders: 0,
      completedOrders: 0,
      completionRate: 0,
      inProgressOrders: 0,
      avgCompletionTime: 0
    },

    // 卡片动画
    card1Anim: {},
    card2Anim: {},
    card3Anim: {},
    card4Anim: {},

    // 排名数据
    employeeRankings: [],
    responsiblePartyRankings: [],

    // 图表数据
    statusChartData: [],
    floorChartData: {},
    locationChartData: {},
    chartsInitialized: false,

    // ECharts配置对象
    ecStatus: {
      lazyLoad: true
    },
    ecFloor: {
      lazyLoad: true
    },
    ecLocation: {
      lazyLoad: true
    }
  },

  onLoad() {
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: statusBarHeight + navBarHeight
    });
  },

  async onShow() {
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }

    // 获取用户角色信息
    try {
      const userInfo = await auth.getCurrentUser();
      if (userInfo) {
        const isPropertyStaff = userInfo.role_id === 4;
        const isMaintenanceWorker = userInfo.role_id === 3;
        const isManager = userInfo.role_id === 2;  // 物业经理

        this.setData({
          userRole: userInfo.role_id,
          userDepartment: userInfo.department,
          userId: userInfo.id,
          isPropertyStaff,
          isMaintenanceWorker,
          isManager
        });

        console.log('[Data] User role:', {
          role_id: userInfo.role_id,
          department: userInfo.department,
          isPropertyStaff,
          isMaintenanceWorker,
          isManager
        });

        // 根据角色加载不同的数据
        if (isManager) {
          // 物业经理：初始化全局分析视图
          this.initManagerView();
        } else {
          // 物业员工/维修员：加载个人统计数据
          await this.loadStatistics();
        }
      }
    } catch (error) {
      console.error('[Data] Get user info error:', error);
      this.setData({ loading: false });
    }
  },

  /**
   * 根据角色获取统计配置
   */
  getStatsConfigByRole(isPropertyStaff, isMaintenanceWorker) {
    if (isPropertyStaff) {
      // 物业员工统计配置
      return [
        {
          key: 'today_reported',
          label: '今日提报',
          status: null, // 今日提报不按状态过滤
          bgClass: '#dbeafe',
          color: '#2563eb'
        },
        {
          key: 'in_progress',
          label: '维修中',
          status: 'In Progress',
          bgClass: '#cffafe',
          color: '#0891b2'
        },
        {
          key: 'review',
          label: '待复核',
          status: 'Repaired',
          bgClass: '#fee2e2',
          color: '#dc2626'
        },
        {
          key: 'completed',
          label: '已完成',
          status: 'Completed',
          bgClass: '#d1fae5',
          color: '#059669'
        }
      ];
    } else if (isMaintenanceWorker) {
      // 维修员统计配置
      return [
        {
          key: 'today_maintenance',
          label: '今日维修',
          status: null, // 今日维修需要特殊处理
          bgClass: '#dbeafe',
          color: '#2563eb'
        },
        {
          key: 'repaired',
          label: '已修复',
          status: 'Repaired',
          bgClass: '#f3e8ff',
          color: '#9333ea'
        },
        {
          key: 'rework',
          label: '需重修',
          status: 'Needs Rework',
          bgClass: '#ffedd5',
          color: '#ea580c'
        },
        {
          key: 'completed',
          label: '已完成',
          status: 'Completed',
          bgClass: '#d1fae5',
          color: '#059669'
        }
      ];
    }
    return [];
  },

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      this.setData({ loading: true });

      const { isPropertyStaff, isMaintenanceWorker, userId, userDepartment } = this.data;

      // 获取统计配置
      const statsConfig = this.getStatsConfigByRole(isPropertyStaff, isMaintenanceWorker);

      // 获取所有工单
      const allOrders = await workOrderService.getWorkOrders({});

      // 根据角色过滤工单
      let myOrders = [];
      if (isPropertyStaff && userId) {
        // 物业员工：只看自己提报的工单
        myOrders = allOrders.filter(order =>
          order.submitter && order.submitter.user_id === userId
        );
      } else if (isMaintenanceWorker && userDepartment) {
        // 维修员：只看责任方=自己部门的工单
        myOrders = allOrders.filter(order =>
          order.responsible_party === userDepartment
        );
      }

      // 计算各项统计数据
      const stats = statsConfig.map(config => {
        let count = 0;

        if (config.key === 'today_reported' && isPropertyStaff) {
          // 今日提报：统计今天创建的工单
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          count = myOrders.filter(order => {
            const createdAt = order.created_at?.$date ?
              new Date(order.created_at.$date) : new Date(order.created_at);
            return createdAt >= today;
          }).length;
        } else if (config.key === 'today_maintenance' && isMaintenanceWorker) {
          // 今日维修：统计今天接单或正在维修的工单
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          count = myOrders.filter(order => {
            // 统计今天接单的工单（状态为 In Progress）或今天更新的维修中工单
            if (order.status === 'In Progress') {
              // 检查更新时间或创建时间是否在今天
              const updatedAt = order.updated_at?.$date ?
                new Date(order.updated_at.$date) : (order.updated_at ? new Date(order.updated_at) : null);
              const createdAt = order.created_at?.$date ?
                new Date(order.created_at.$date) : new Date(order.created_at);

              if (updatedAt && updatedAt >= today) {
                return true;
              }
              return createdAt >= today;
            }
            return false;
          }).length;
        } else if (config.status) {
          // 按状态统计
          count = myOrders.filter(order => order.status === config.status).length;
        }

        return {
          label: config.label,
          value: count,
          bgClass: config.bgClass,
          color: config.color
        };
      });

      this.setData({
        stats,
        loading: false
      });

      console.log('[Data] Statistics loaded:', stats);

    } catch (error) {
      console.error('[Data] Load statistics error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载统计失败',
        icon: 'none'
      });
    }
  },

  /**
   * 查看全部排名
   */
  viewAllRankings() {
    wx.showToast({
      title: '查看全部排名',
      icon: 'none'
    });
    // TODO: 跳转到完整排名页面
    // wx.navigateTo({
    //   url: '/pages/rankings/index'
    // });
  },

  // ========== 物业经理专用方法 ==========

  /**
   * 初始化物业经理视图
   */
  initManagerView() {
    console.log('[Manager] Initializing manager view');

    // 初始化日期范围为"今天"
    const { startDate, endDate } = dateUtils.getDateRange('today');
    this.setData({
      startDate: dateUtils.formatDate(startDate),
      endDate: dateUtils.formatDate(endDate),
      timeFilter: 'today'
    });

    // 加载所有数据
    this.fetchAllManagerData();
  },

  /**
   * Tab切换
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });

    // 如果切换到图表tab且图表未初始化，则初始化图表
    if (tab === 'charts' && !this.data.chartsInitialized) {
      this.initCharts();
    }
  },

  /**
   * 时间过滤器切换
   */
  onTimeFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;

    if (filter === 'custom') {
      // 显示日期选择器
      this.setData({ showDatePicker: true });
    } else {
      const { startDate, endDate } = dateUtils.getDateRange(filter);
      this.setData({
        timeFilter: filter,
        startDate: dateUtils.formatDate(startDate),
        endDate: dateUtils.formatDate(endDate)
      });

      // 重新加载数据
      this.fetchAllManagerData();
    }
  },

  /**
   * 自定义日期选择
   */
  onDatePickerConfirm(e) {
    const { start, end } = e.detail;
    this.setData({
      timeFilter: 'custom',
      startDate: start,
      endDate: end,
      showDatePicker: false
    });

    // 重新加载数据
    this.fetchAllManagerData();
  },

  onDatePickerCancel() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 加载所有物业经理数据
   */
  async fetchAllManagerData() {
    wx.showLoading({ title: '加载中...' });

    try {
      const { startDate, endDate } = this.data;

      // 并行调用所有云函数
      const [kpiRes, employeeRes, responsibleRes, statusRes, floorRes, locationRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getAnalyticsOverview',
          data: { startDate, endDate }
        }),
        wx.cloud.callFunction({
          name: 'getEmployeeRanking',
          data: { startDate, endDate }
        }),
        wx.cloud.callFunction({
          name: 'getResponsiblePartyRanking',
          data: { startDate, endDate }
        }),
        wx.cloud.callFunction({
          name: 'getAnalyticsByStatus',
          data: { startDate, endDate }
        }),
        wx.cloud.callFunction({
          name: 'getAnalyticsByFloor',
          data: { startDate, endDate }
        }),
        wx.cloud.callFunction({
          name: 'getAnalyticsByLocation',
          data: { startDate, endDate }
        })
      ]);

      // 更新数据
      this.setData({
        kpiData: kpiRes.result.data,
        employeeRankings: employeeRes.result.data,
        responsiblePartyRankings: responsibleRes.result.data,
        statusChartData: statusRes.result.data,
        floorChartData: floorRes.result.data,
        locationChartData: locationRes.result.data,
        loading: false
      });

      // 触发KPI卡片动画
      this.animateKPICards();

      // 如果当前在图表tab，刷新图表
      if (this.data.activeTab === 'charts') {
        this.initCharts();
      }

      wx.hideLoading();

    } catch (error) {
      console.error('[Manager] Fetch data error:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * KPI卡片动画
   */
  animateKPICards() {
    const animKeys = ['card1Anim', 'card2Anim', 'card3Anim', 'card4Anim'];
    animationUtils.animateCards(this, animKeys, 100, 100);
  },

  /**
   * 初始化ECharts图表
   */
  initCharts() {
    console.log('[Manager] Initializing charts with data:', {
      status: this.data.statusChartData.length,
      floor: this.data.floorChartData.categories?.length,
      location: this.data.locationChartData.categories?.length
    });

    // 初始化状态环形图
    this.initStatusChart();
    // 初始化楼层柱状图
    this.initFloorChart();
    // 初始化位置柱状图
    this.initLocationChart();

    // 标记图表已初始化
    this.setData({ chartsInitialized: true });
  },

  /**
   * 初始化状态环形图
   */
  initStatusChart() {
    const component = this.selectComponent('#statusChart');
    if (!component) {
      console.warn('[Manager] Status chart component not found');
      return;
    }

    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const option = chartUtils.getRingChartOption(this.data.statusChartData);
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 初始化楼层柱状图
   */
  initFloorChart() {
    const component = this.selectComponent('#floorChart');
    if (!component) {
      console.warn('[Manager] Floor chart component not found');
      return;
    }

    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const { categories, values } = this.data.floorChartData;
      const option = chartUtils.getBarChartOption(categories || [], values || [], '楼层分布');
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 初始化位置柱状图
   */
  initLocationChart() {
    const component = this.selectComponent('#locationChart');
    if (!component) {
      console.warn('[Manager] Location chart component not found');
      return;
    }

    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const { categories, values } = this.data.locationChartData;
      const option = chartUtils.getBarChartOption(categories || [], values || [], '位置分布');
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 手动刷新
   */
  onRefresh() {
    this.fetchAllManagerData();
  }
});
