/**
 * 数据统计页面
 */

const auth = require('../../services/auth');
const workOrderService = require('../../services/workOrder');
const dateUtils = require('../../utils/dateUtils');
const chartUtils = require('../../utils/chartUtils');
const animationUtils = require('../../utils/animationUtils');

// 引入 echarts
import * as echarts from '../../components/ec-canvas/echarts';

Page({
  data: {
    // 工单统计（办美员工/维修员使用）
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
    isManager: false,  // 行政经理
    loading: true,

    // ========== 行政经理专用数据 ==========
    // Tab切换
    activeTab: 'stats',  // 'stats' | 'charts'

    // 时间过滤
    timeFilter: 'all',  // 'all' | 'yesterday' | 'today' | 'week' | 'month' | 'custom'
    startDate: '',
    endDate: '',
    showDatePicker: false,
    customStartDate: '',  // 自定义日期选择器临时值
    customEndDate: '',    // 自定义日期选择器临时值

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

    // 图表数据
    statusChartData: [],
    trendChartData: { categories: [], reported: [], completed: [] },
    categoryChartData: [],
    responsibleChartData: [],
    floorChartData: { categories: [], values: [] },
    chartsInitialized: false,

    // ECharts配置对象（5个图表）
    ecStatus: { lazyLoad: true },
    ecTrend: { lazyLoad: true },
    ecCategory: { lazyLoad: true },
    ecResponsible: { lazyLoad: true },
    ecFloor: { lazyLoad: true },

    // Base64 Icons
    icons: {
      calendar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2YjcyODAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxsaW5lIHkxPSIyIiB5Mj0iNiIgeDE9IjE2IiB4Mj0iMTYiPjwvbGluZT48bGluZSB5MT0iMiIgeTI9IjYiIHgxPSI4IiB4Mj0iOCI+PC9saW5lPjxsaW5lIHkxPSIxMCIgeTI9IjEwIiB4MT0iMyIgeDI9IjIxIj48L2xpbmU+PC9zdmc+',
      document: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzNzQxNTEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMCAyIDJ2MTZhMiAyIDAgMCAwIDIgMmgyYTIgMiAwIDAgMCAyLTJWMc4gMTQtNS01WiI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjE0IDIgMTQgOCAyMCA4Ij48L3BvbHlsaW5lPjxsaW5lIHgxPSIxNiIgeTE9IjEzIiB4Mj0iOCIgeTI9IjEzIj48L2xpbmU+PGxpbmUgeDE9IjE2IiB5MT0iMTciIHgyPSI4IiB5Mj0iMTciPjwvbGluZT48cG9seWxpbmUgcG9pbnRzPSIxMCA5IDkgOSA4IDkiPjwvcG9seWxpbmU+PC9zdmc+',
      check: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxMGI5ODEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjIgMTEuMDhWMTIwMiAyIDAgMCAxLTIgMmgtM2wtNS01bDEgMWgzVjRzOSAxMSI+PC9wYXRoPjxwYXRoIGQ9Ik0yMiA0IDEyIDE0LjAxbC0zLTMiPjwvcGF0aD48L3N2Zz4=',
      clock: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMTIgNiAxMiAxMiAxNiAxNCI+PC9wb2x5bGluZT48L3N2Zz4=',
      timer: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmNTllMGIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNSAyMmgxNCI+PC9wYXRoPjxwYXRoIGQ9Ik01IDJoMTQiPjwvcGF0aD48cGF0aCBkPSJNMTcgMjJhNSA1IDAgMSAxIDAtMTBIN2E1IDUgMCAxIDEgMCAxMCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNyAyYTUgNSAwIDEgMCAwIDEwSDdhNSA1IDAgMSAwIDAtMTAiPjwvcGF0aD48L3N2Zz4='
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
        const isManager = userInfo.role_id === 2;  // 行政经理

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
          // 行政经理：初始化全局分析视图
          this.initManagerView();
        } else {
          // 办美员工/维修员：加载个人统计数据
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
      // 办美员工统计配置
      return [
        {
          key: 'today_reported',
          label: '今日提报',
          status: null, // 今日提报不按状态过滤
          bgClass: '#dbeafe',
          color: '#2563eb',
          icon: 'icon-jinritibao',
          iconSize: '64rpx'
        },
        {
          key: 'in_progress',
          label: '维修中',
          status: 'In Progress',
          bgClass: '#cffafe',
          color: '#0891b2',
          icon: 'icon-FM-weixiuzhongxin',
          iconSize: '64rpx'
        },
        {
          key: 'review',
          label: '待复核',
          status: 'Repaired',
          bgClass: '#fee2e2',
          color: '#dc2626',
          icon: 'icon-daifuhe',
          iconSize: '52rpx',
          iconRight: '16rpx',
          iconTop: '16rpx'
        },
        {
          key: 'completed',
          label: '已完成',
          status: 'Completed',
          bgClass: '#d1fae5',
          color: '#059669',
          icon: 'icon-trues',
          iconSize: '64rpx'
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
          color: '#2563eb',
          icon: 'icon-jihuashishi'
        },
        {
          key: 'repaired',
          label: '已修复',
          status: 'Repaired',
          bgClass: '#f3e8ff',
          color: '#9333ea',
          icon: 'icon-yixiufu_huaban'
        },
        {
          key: 'rework',
          label: '需返工',
          status: 'Needs Rework',
          bgClass: '#ffedd5',
          color: '#ea580c',
          icon: 'icon-zhongxiu'
        },
        {
          key: 'completed',
          label: '已完成',
          status: 'Completed',
          bgClass: '#d1fae5',
          color: '#059669',
          icon: 'icon-trues'
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

      const { isPropertyStaff, isMaintenanceWorker, userId, userDepartment, startDate, endDate } = this.data;

      // 获取统计配置
      const statsConfig = this.getStatsConfigByRole(isPropertyStaff, isMaintenanceWorker);

      // 获取所有工单
      const allOrders = await workOrderService.getWorkOrders({});

      // 根据角色过滤工单
      let myOrders = [];
      if (isPropertyStaff && userId) {
        // 办美员工：只看自己提报的工单
        myOrders = allOrders.filter(order =>
          order.submitter && order.submitter.user_id === userId
        );
      } else if (isMaintenanceWorker && userDepartment) {
        // 维修员：只看分配给自己的工单（云函数也会过滤，这里做兜底）
        myOrders = allOrders.filter(order =>
          order.assigned_technician && order.assigned_technician.user_id === userId
        );
      }

      // 应用日期过滤
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        myOrders = myOrders.filter(order => {
          const createdAt = order.created_at?.$date ?
            new Date(order.created_at.$date) : new Date(order.created_at);
          return createdAt >= start && createdAt <= end;
        });
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
          color: config.color,
          icon: config.icon,
          iconSize: config.iconSize,
          iconRight: config.iconRight,
          iconTop: config.iconTop
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

  // ========== 行政经理专用方法 ==========

  /**
   * 初始化行政经理视图
   */
  initManagerView() {
    console.log('[Manager] Initializing manager view');

    // 初始化日期范围为"全部"
    this.setData({
      startDate: '',
      endDate: '',
      timeFilter: 'all'
    });

    // 加载所有数据
    this.fetchAllManagerData();
  },

  /**
   * Tab切换
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return; // 相同tab不处理

    // 重置筛选条件为"全部"
    this.setData({
      activeTab: tab,
      timeFilter: 'all',
      startDate: '',
      endDate: '',
      chartsInitialized: false  // 重置图表初始化状态
    });

    // 重新加载数据
    this.fetchAllManagerData();
  },

  /**
   * 时间过滤器切换
   */
  onTimeFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;

    if (filter === 'custom') {
      // 显示日期选择器并立即设置 timeFilter 以激活样式
      this.setData({
        showDatePicker: true,
        timeFilter: 'custom'
      });
    } else if (filter === 'all') {
      // 全部：不限制日期
      this.setData({
        timeFilter: 'all',
        startDate: '',
        endDate: ''
      });
      this.fetchAllManagerData();
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
   * 自定义日期选择 - 开始日期变化
   */
  onCustomStartDateChange(e) {
    this.setData({
      customStartDate: e.detail.value
    });
  },

  /**
   * 自定义日期选择 - 结束日期变化
   */
  onCustomEndDateChange(e) {
    this.setData({
      customEndDate: e.detail.value
    });
  },

  /**
   * 关闭日期选择弹窗
   */
  closeDatePicker() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 阻止点击弹窗内容时关闭弹窗
  },

  /**
   * 取消日期选择
   */
  cancelDatePicker() {
    this.setData({
      showDatePicker: false,
      customStartDate: '',
      customEndDate: ''
    });
  },

  /**
   * 确认日期选择
   */
  confirmDatePicker() {
    const { customStartDate, customEndDate } = this.data;

    if (!customStartDate || !customEndDate) {
      wx.showToast({
        title: '请选择开始和结束日期',
        icon: 'none'
      });
      return;
    }

    this.setData({
      timeFilter: 'custom',
      startDate: customStartDate,
      endDate: customEndDate,
      showDatePicker: false
    });

    // 重新加载数据
    this.fetchAllManagerData();
  },

  /**
   * 加载所有行政经理数据
   */
  async fetchAllManagerData() {
    wx.showLoading({ title: '加载中...' });

    try {
      const { startDate, endDate } = this.data;

      // 计算一周趋势的固定日期范围（今天往前推6天，共7天）
      const today = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 6);
      const trendStartDate = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
      const trendEndDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // 并行调用所有云函数（7个）
      const [
        kpiRes, employeeRes,
        statusRes, trendRes, categoryRes, responsibleRes,
        floorRes
      ] = await Promise.all([
        // Tab1 数据
        wx.cloud.callFunction({
          name: 'getAnalyticsOverview',
          data: { startDate, endDate }
        }).catch(err => ({ result: { success: false, data: null } })),
        wx.cloud.callFunction({
          name: 'getEmployeeRanking',
          data: { startDate, endDate }
        }).catch(err => ({ result: { success: false, data: [] } })),
        // Tab2 图表数据（5个图表）
        wx.cloud.callFunction({
          name: 'getAnalyticsByStatus',
          data: { startDate, endDate }
        }).catch(err => ({ result: { success: false, data: [] } })),
        // 一周工单趋势使用固定的最近7天日期，不受日期筛选控制
        wx.cloud.callFunction({
          name: 'getAnalyticsTrends',
          data: { startDate: trendStartDate, endDate: trendEndDate }
        }).catch(err => ({ result: { success: false, data: { categories: [], reported: [], completed: [] } } })),
        wx.cloud.callFunction({
          name: 'getAnalyticsByCategory',
          data: { startDate, endDate }
        }).catch(err => ({ result: { success: false, data: [] } })),
        wx.cloud.callFunction({
          name: 'getAnalyticsByResponsible',
          data: { startDate, endDate }
        }).catch(err => ({ result: { success: false, data: [] } })),
        wx.cloud.callFunction({
          name: 'getAnalyticsByFloor',
          data: { startDate, endDate }
        }).catch(err => ({ result: { success: false, data: { categories: [], values: [] } } }))
      ]);

      // 安全地提取数据，提供默认值
      const kpiData = kpiRes.result?.data || {
        totalOrders: 0,
        completedOrders: 0,
        completionRate: 0,
        inProgressOrders: 0,
        avgCompletionTime: 0
      };

      // 转换员工排名数据为统一的 rankings 格式
      // 过滤掉完成工单数为0的员工，只显示有完成工单的排名
      const rankings = (employeeRes.result?.data || [])
        .filter(item => item.totalCompleted > 0)
        .map((item, index) => ({
          rank: index + 1,
          name: item.employeeName,
          completedOrders: item.totalCompleted,
          avatar: '/images/icons/default-avatar.png',
          isCurrentUser: false
        }));

      // 更新数据
      this.setData({
        kpiData: kpiData,
        rankings: rankings,
        statusChartData: statusRes.result?.data || [],
        trendChartData: trendRes.result?.data || { categories: [], reported: [], completed: [] },
        categoryChartData: categoryRes.result?.data || [],
        responsibleChartData: responsibleRes.result?.data || [],
        floorChartData: floorRes.result?.data || { categories: [], values: [] },
        loading: false
      });

      // 触发KPI卡片动画
      this.animateKPICards();

      // 如果当前在图表tab，延迟刷新图表（等待组件渲染完成）
      if (this.data.activeTab === 'charts') {
        setTimeout(() => {
          this.initCharts();
        }, 300);
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
   * 初始化ECharts图表（5个图表）
   */
  initCharts() {
    console.log('[Manager] Initializing 5 charts');

    // 检查是否在图表Tab
    if (this.data.activeTab !== 'charts') {
      console.log('[Manager] Not in charts tab, skip initialization');
      return;
    }

    // 1. 初始化状态环形图
    this.initStatusChart();
    // 2. 初始化趋势折线图
    this.initTrendChart();
    // 3. 初始化故障类型饼图
    this.initCategoryChart();
    // 4. 初始化责任方饼图
    this.initResponsibleChart();
    // 5. 初始化楼层柱状图
    this.initFloorChart();

    // 标记图表已初始化
    this.setData({ chartsInitialized: true });
  },

  /**
   * 1. 初始化状态环形图
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

      const option = chartUtils.getRingChartOption(this.data.statusChartData || []);
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 2. 初始化趋势折线图
   */
  initTrendChart() {
    const component = this.selectComponent('#trendChart');
    if (!component) {
      console.warn('[Manager] Trend chart component not found');
      return;
    }

    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const { categories, reported, completed } = this.data.trendChartData || { categories: [], reported: [], completed: [] };
      const option = chartUtils.getLineChartOption(categories, reported, completed);
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 3. 初始化故障类型饼图
   */
  initCategoryChart() {
    const component = this.selectComponent('#categoryChart');
    if (!component) {
      console.warn('[Manager] Category chart component not found');
      return;
    }

    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const option = chartUtils.getPieChartOption(this.data.categoryChartData || [], '故障类型');
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 4. 初始化责任方饼图
   */
  initResponsibleChart() {
    const component = this.selectComponent('#responsibleChart');
    if (!component) {
      console.warn('[Manager] Responsible chart component not found');
      return;
    }

    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      });
      canvas.setChart(chart);

      const option = chartUtils.getSolidPieChartOption(this.data.responsibleChartData || [], '责任方');
      chart.setOption(option);

      return chart;
    });
  },

  /**
   * 5. 初始化楼层柱状图
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

      const { categories, values } = this.data.floorChartData || { categories: [], values: [] };
      const option = chartUtils.getBarChartOption(categories, values, '楼层分布');
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
