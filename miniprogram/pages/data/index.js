/**
 * 数据统计页面
 */

const auth = require('../../services/auth');
const workOrderService = require('../../services/workOrder');
const analyticsService = require('../../services/analyticsService');
const dateUtils = require('../../utils/dateUtils');
const chartUtils = require('../../utils/chartUtils');
const animationUtils = require('../../utils/animationUtils');
const { convertCloudUrls } = require('../../utils/cloudUtils');
const { getNavBarInfo } = require('../../utils/navigation');

// 引入 echarts
import * as echarts from '../../components/ec-canvas/echarts';

Page({
  data: {
    // 工单统计（办美员工/维修员使用）
    stats: [],
    // KPI统计数据（办美员工使用，与行政经理格式一致）
    staffKpiData: {
      totalOrders: 0,          // 提报工单数
      completedOrders: 0,      // 已完成数
      completionRate: 0,       // 完成率百分比
      inProgressOrders: 0,     // 进行中数
      avgCompletionTime: 0     // 平均完成时长（小时）
    },
    // 月度排名
    rankings: [],
    // 月度排名的年月选择
    rankingYear: new Date().getFullYear(),
    rankingMonth: new Date().getMonth() + 1,  // 1-12
    showAllRankings: false,  // 全部排名弹窗显示状态
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
    activeTab: 'charts',

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
    statusChartLegend: [],
    selectedStatusIdx: -1,
    trendChartData: { categories: [], reported: [], completed: [] },
    categoryChartData: [],
    categoryBarData: [],
    responsibleChartData: [],
    responsibleChartLegend: [],
    selectedResponsibleIdx: -1,
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
    },

    // 防重复加载和缓存
    _lastFetchTime: 0,
    _cacheValidMs: 30000,  // 30秒缓存有效期

    // 空状态图标临时URL
    emptyIconUrl: ''
  },

  onLoad() {
    // 计算自定义导航栏高度
    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight)
    });

    // 加载空状态图标
    this.loadEmptyIcon();
  },

  async onShow() {
    // 页面已从 TabBar 移除，不再设置 TabBar 状态

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

        // console.log('[Data] User role:', {
        //   role_id: userInfo.role_id,
        //   department: userInfo.department,
        //   isPropertyStaff,
        //   isMaintenanceWorker,
        //   isManager
        // });

        // 根据角色加载不同的数据
        if (isManager) {
          // 行政经理：检查缓存是否有效
          const now = Date.now();
          const cacheValid = (now - this.data._lastFetchTime) < this.data._cacheValidMs;
          if (cacheValid && this.data.kpiData.totalOrders > 0) {
            this.setData({ loading: false });
          } else {
            this.initManagerView();
          }
        } else if (isMaintenanceWorker) {
          // 维修员：完整看板（仅展示本部门数据）
          this.initMaintenanceView();
        } else {
          // 办美员工：统计数据 + 月度排名
          await Promise.all([
            this.loadStatistics(),
            this.loadRankings()
          ]);
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
          key: 'review',
          label: '待复核',
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
        // 维修员：统计该部门（责任方）的所有工单
        myOrders = allOrders.filter(order =>
          order.responsible_party === userDepartment
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

      // ========== 计算KPI统计数据（办美员工使用） ==========

      // 1. 提报工单数
      const totalOrders = myOrders.length;

      // 2. 已完成工单数
      const completedOrders = myOrders.filter(order =>
        order.status === 'Completed' || order.status === '已完成'
      ).length;

      // 3. 进行中工单数（排除已完成的所有工单）
      const inProgressOrders = myOrders.filter(order =>
        order.status !== 'Completed' && order.status !== '已完成'
      ).length;

      // 4. 完成率
      const completionRate = totalOrders > 0
        ? ((completedOrders / totalOrders) * 100).toFixed(1)
        : '0.0';

      // 5. 平均完成时长（小时）
      let avgCompletionTime = 0;
      const completedWithTime = myOrders.filter(order => {
        const isCompleted = order.status === 'Completed' || order.status === '已完成';
        return isCompleted && order.completed_at && order.created_at;
      });

      if (completedWithTime.length > 0) {
        const totalHours = completedWithTime.reduce((sum, order) => {
          const reportTime = order.created_at?.$date
            ? new Date(order.created_at.$date)
            : new Date(order.created_at);
          const completeTime = order.completed_at?.$date
            ? new Date(order.completed_at.$date)
            : new Date(order.completed_at);
          const hours = (completeTime - reportTime) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        avgCompletionTime = (totalHours / completedWithTime.length).toFixed(1);
      }

      this.setData({
        stats,
        staffKpiData: {
          totalOrders,
          completedOrders,
          completionRate: parseFloat(completionRate),
          inProgressOrders,
          avgCompletionTime: parseFloat(avgCompletionTime)
        },
        loading: false
      });

      // console.log('[Data] Statistics loaded:', stats);
      // console.log('[Data] KPI Data:', {
      //   totalOrders,
      //   completedOrders,
      //   completionRate: parseFloat(completionRate),
      //   inProgressOrders,
      //   avgCompletionTime: parseFloat(avgCompletionTime)
      // });

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
    this.setData({
      showAllRankings: true
    });
  },

  /**
   * 关闭全部排名弹窗
   */
  closeAllRankings() {
    this.setData({
      showAllRankings: false
    });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 阻止点击弹窗内容区域时关闭弹窗
  },

  // ========== 月度排名月份切换方法 ==========

  /**
   * 上一个月
   */
  prevMonth() {
    let { rankingYear, rankingMonth } = this.data;
    rankingMonth--;
    if (rankingMonth < 1) {
      rankingMonth = 12;
      rankingYear--;
    }
    this.setData({ rankingYear, rankingMonth });
    this.loadRankings();
  },

  /**
   * 下一个月
   */
  nextMonth() {
    let { rankingYear, rankingMonth } = this.data;
    rankingMonth++;
    if (rankingMonth > 12) {
      rankingMonth = 1;
      rankingYear++;
    }
    this.setData({ rankingYear, rankingMonth });
    this.loadRankings();
  },

  /**
   * 月份选择变化（picker直接选择）
   */
  onMonthPickerChange(e) {
    const value = e.detail.value; // 格式: "YYYY-MM"
    const [year, month] = value.split('-');
    this.setData({
      rankingYear: parseInt(year),
      rankingMonth: parseInt(month)
    });
    // 立即加载新月份的排名数据
    this.loadRankings();
  },

  /**
   * 加载指定月份的排名数据
   */
  async loadRankings() {
    try {
      const { rankingYear, rankingMonth, userId } = this.data;

      // 计算月份的开始和结束日期
      const startDate = `${rankingYear}-${String(rankingMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(rankingYear, rankingMonth, 0).getDate();
      const endDate = `${rankingYear}-${String(rankingMonth).padStart(2, '0')}-${lastDay}`;

      // console.log('[Data] Loading rankings for:', { rankingYear, rankingMonth, startDate, endDate });

      // 调用服务获取员工排名
      const res = await analyticsService.getEmployeeRanking(startDate, endDate);

      // 转换排名数据，标记当前用户
      const rankings = (res.data || [])
        .filter(item => item.totalCompleted > 0)
        .map((item, index) => ({
          rank: index + 1,
          name: item.employeeName,
          completedOrders: item.totalCompleted,
          avatar: item.avatar || '',
          isCurrentUser: item.employeeId === userId
        }));

      // 转换头像URL
      await convertCloudUrls(rankings, 'avatar');

      this.setData({ rankings });
      // console.log('[Data] Rankings loaded:', rankings.length);
    } catch (error) {
      console.error('[Data] Load rankings error:', error);
      this.setData({ rankings: [] });
    }
  },

  // ========== 行政经理专用方法 ==========

  /**
   * 初始化行政经理视图
   */
  initManagerView() {
    this.setData({ startDate: '', endDate: '', timeFilter: 'all' });
    this.fetchAllManagerData();
  },

  /**
   * 初始化维修员视图（完整看板，仅本部门数据）
   */
  initMaintenanceView() {
    this.setData({ startDate: '', endDate: '', timeFilter: 'all' });
    this.fetchDeptData();
  },

  /**
   * 加载维修员部门数据（客户端从已过滤工单计算所有图表统计）
   */
  async fetchDeptData() {
    wx.showLoading({ title: '加载中...' });
    try {
      const { startDate, endDate } = this.data;

      // 获取本部门工单（服务端已按 responsible_party 过滤）
      const allOrders = await workOrderService.getWorkOrders({});

      // 应用日期过滤（趋势图始终使用全量 allOrders）
      let orders = allOrders;
      if (startDate && endDate) {
        const start = new Date(startDate); start.setHours(0, 0, 0, 0);
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        orders = allOrders.filter(o => {
          const createdAt = o.created_at?.$date ? new Date(o.created_at.$date) : new Date(o.created_at);
          return createdAt >= start && createdAt <= end;
        });
      }

      // 1. KPI 数据
      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === 'Completed' || o.status === '已完成').length;
      const inProgressOrders = orders.filter(o => o.status !== 'Completed' && o.status !== '已完成').length;
      let avgCompletionTime = 0;
      const completedWithTime = orders.filter(o =>
        (o.status === 'Completed' || o.status === '已完成') && o.completed_at && o.created_at
      );
      if (completedWithTime.length > 0) {
        const totalHours = completedWithTime.reduce((sum, o) => {
          const reportTime = o.created_at?.$date ? new Date(o.created_at.$date) : new Date(o.created_at);
          const completeTime = o.completed_at?.$date ? new Date(o.completed_at.$date) : new Date(o.completed_at);
          return sum + (completeTime - reportTime) / (1000 * 60 * 60);
        }, 0);
        avgCompletionTime = parseFloat((totalHours / completedWithTime.length).toFixed(1));
      }

      // 2. 工单状态分布
      const STATUS_NAMES = {
        'Pending Repair': '已提报', 'In Progress': '维修中',
        'Repaired': '待复核', 'Needs Rework': '需返工', 'Completed': '已完成',
      };
      const STATUS_ORDER = ['已提报', '维修中', '待复核', '需返工', '已完成'];
      const STATUS_GRADIENTS = [
        { from: '#3B82F6', to: '#60A5FA' }, { from: '#0EA5E9', to: '#06B6D4' },
        { from: '#F59E0B', to: '#F97316' }, { from: '#EF4444', to: '#F87171' },
        { from: '#10B981', to: '#34D399' },
      ];
      const statusCounts = {};
      orders.forEach(o => {
        const name = STATUS_NAMES[o.status] || o.status;
        statusCounts[name] = (statusCounts[name] || 0) + 1;
      });
      const statusChartData = STATUS_ORDER
        .map(name => ({ name, value: statusCounts[name] || 0 }))
        .filter(item => item.value > 0);
      const statusChartLegend = statusChartData.map((item, idx) => ({
        name: item.name, count: item.value, dataIndex: idx,
        gradientFrom: (STATUS_GRADIENTS[idx] || STATUS_GRADIENTS[0]).from,
        gradientTo: (STATUS_GRADIENTS[idx] || STATUS_GRADIENTS[0]).to,
      }));

      // 3. 故障类型条形图
      const categoryCounts = {};
      orders.forEach(o => {
        const cat = o.order_category || '未分类';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      const barColors = ['#F97316', '#6366F1', '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B'];
      const sortedCategory = Object.entries(categoryCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      const categoryMax = sortedCategory[0]?.value || 1;
      const categoryTotal = sortedCategory.reduce((s, item) => s + item.value, 0);
      const categoryBarData = sortedCategory.map((item, idx) => ({
        name: item.name, value: item.value,
        percentage: categoryTotal > 0 ? Math.round(item.value / categoryTotal * 100) : 0,
        barWidth: Math.round(item.value / categoryMax * 80),
        color: barColors[idx % barColors.length],
      }));

      // 4. 楼层分布
      const floorCounts = {};
      orders.forEach(o => { if (o.floor) floorCounts[o.floor] = (floorCounts[o.floor] || 0) + 1; });
      const floorSortKey = name => {
        if (!name) return 9999;
        const s = String(name).trim().toUpperCase();
        if (s.startsWith('B')) return -(parseInt(s.slice(1)) || 0);
        return parseInt(s) || 9999;
      };
      const sortedFloors = Object.entries(floorCounts).sort((a, b) => floorSortKey(a[0]) - floorSortKey(b[0]));
      const floorChartData = {
        categories: sortedFloors.map(([name]) => name),
        values: sortedFloors.map(([, value]) => value),
      };

      // 5. 最近7天趋势（使用全量 allOrders，不受日期筛选影响）
      const today = new Date();
      const trendDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() - (6 - i)); return d;
      });
      const trendCategories = trendDays.map(d =>
        `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
      const trendReported = trendDays.map(d => {
        const s = new Date(d); s.setHours(0, 0, 0, 0);
        const e = new Date(d); e.setHours(23, 59, 59, 999);
        return allOrders.filter(o => {
          const t = o.created_at?.$date ? new Date(o.created_at.$date) : new Date(o.created_at);
          return t >= s && t <= e;
        }).length;
      });
      const trendCompleted = trendDays.map(d => {
        const s = new Date(d); s.setHours(0, 0, 0, 0);
        const e = new Date(d); e.setHours(23, 59, 59, 999);
        return allOrders.filter(o => {
          if (o.status !== 'Completed' && o.status !== '已完成' || !o.completed_at) return false;
          const t = o.completed_at?.$date ? new Date(o.completed_at.$date) : new Date(o.completed_at);
          return t >= s && t <= e;
        }).length;
      });

      this.setData({
        kpiData: { totalOrders, completedOrders, inProgressOrders, avgCompletionTime },
        statusChartData, statusChartLegend, selectedStatusIdx: -1,
        trendChartData: { categories: trendCategories, reported: trendReported, completed: trendCompleted },
        categoryBarData,
        floorChartData,
        responsibleChartData: [], responsibleChartLegend: [],
        rankings: [],
        loading: false,
        _lastFetchTime: Date.now(),
      });

      this.animateKPICards();
      setTimeout(() => this.initCharts(), 300);
      wx.hideLoading();
    } catch (error) {
      console.error('[Dept] Fetch data error:', error);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /**
   * Tab切换
   */
  /**
   * 时间过滤器切换
   */
  onTimeFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    const { isManager, isMaintenanceWorker } = this.data;

    if (filter === 'custom') {
      this.setData({
        showDatePicker: true,
        timeFilter: 'custom',
        customStartDate: '',
        customEndDate: ''
      });
    } else if (filter === 'all') {
      this.setData({ timeFilter: 'all', startDate: '', endDate: '' });
      if (isManager) {
        this.fetchAllManagerData();
      } else if (isMaintenanceWorker) {
        this.fetchDeptData();
      } else {
        this.loadStatistics();
      }
    } else {
      const { startDate, endDate } = dateUtils.getDateRange(filter);
      this.setData({
        timeFilter: filter,
        startDate: dateUtils.formatDate(startDate),
        endDate: dateUtils.formatDate(endDate)
      });
      if (isManager) {
        this.fetchAllManagerData();
      } else if (isMaintenanceWorker) {
        this.fetchDeptData();
      } else {
        this.loadStatistics();
      }
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
    this.setData({
      showDatePicker: false,
      customStartDate: '',
      customEndDate: ''
    });
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

    // 验证日期范围：开始日期不能大于结束日期
    const startDate = new Date(customStartDate);
    const endDate = new Date(customEndDate);

    if (startDate > endDate) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({
      timeFilter: 'custom',
      startDate: customStartDate,
      endDate: customEndDate,
      showDatePicker: false
    });

    const { isManager, isMaintenanceWorker } = this.data;
    if (isManager) {
      this.fetchAllManagerData();
    } else if (isMaintenanceWorker) {
      this.fetchDeptData();
    } else {
      this.loadStatistics();
    }
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

      // 并行调用所有分析服务（7个）
      const [
        kpiRes, employeeRes,
        statusRes, trendRes, categoryRes, responsibleRes,
        floorRes
      ] = await Promise.all([
        // Tab1 数据
        analyticsService.getOverview(startDate, endDate)
          .catch(err => ({ data: null })),
        analyticsService.getEmployeeRanking(startDate, endDate)
          .catch(err => ({ data: [] })),
        // Tab2 图表数据（5个图表）
        analyticsService.getByStatus(startDate, endDate)
          .catch(err => ({ data: [] })),
        // 一周工单趋势使用固定的最近7天日期，不受日期筛选控制
        analyticsService.getTrends(trendStartDate, trendEndDate)
          .catch(err => ({ data: { categories: [], reported: [], completed: [] } })),
        analyticsService.getByCategory(startDate, endDate)
          .catch(err => ({ data: [] })),
        analyticsService.getByResponsible(startDate, endDate)
          .catch(err => ({ data: [] })),
        analyticsService.getByFloor(startDate, endDate)
          .catch(err => ({ data: { categories: [], values: [] } }))
      ]);

      // 安全地提取数据，提供默认值
      const kpiData = kpiRes?.data || {
        totalOrders: 0,
        completedOrders: 0,
        completionRate: 0,
        inProgressOrders: 0,
        avgCompletionTime: 0
      };

      // 转换员工排名数据为统一的 rankings 格式
      // 过滤掉完成工单数为0的员工，只显示有完成工单的排名
      const rankings = (employeeRes?.data || [])
        .filter(item => item.totalCompleted > 0)
        .map((item, index) => ({
          rank: index + 1,
          name: item.employeeName,
          completedOrders: item.totalCompleted,
          avatar: item.avatar || '',
          isCurrentUser: false
        }));

      // 转换头像URL
      await convertCloudUrls(rankings, 'avatar');

      // 计算故障类型横向条形图数据
      const rawCategory = categoryRes?.data || [];
      const sortedCategory = [...rawCategory].sort((a, b) => b.value - a.value);
      const categoryTotal = sortedCategory.reduce((s, item) => s + item.value, 0);
      const categoryMax = sortedCategory[0]?.value || 1;
      const barColors = ['#F97316', '#6366F1', '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B'];
      const categoryBarData = sortedCategory.map((item, idx) => ({
        name: item.name,
        value: item.value,
        percentage: categoryTotal > 0 ? Math.round(item.value / categoryTotal * 100) : 0,
        barWidth: Math.round(item.value / categoryMax * 80),
        color: barColors[idx % barColors.length]
      }));

      // 更新数据
      this.setData({
        kpiData: kpiData,
        rankings: rankings,
        statusChartData: statusRes?.data || [],
        statusChartLegend: (() => {
          const STATUS_GRADIENTS = [
            { from: '#3B82F6', to: '#60A5FA' },
            { from: '#0EA5E9', to: '#06B6D4' },
            { from: '#F59E0B', to: '#F97316' },
            { from: '#EF4444', to: '#F87171' },
            { from: '#10B981', to: '#34D399' },
          ];
          const raw = statusRes?.data || [];
          const total = raw.reduce((s, i) => s + i.value, 0);
          return raw.map((item, idx) => ({
            name: item.name,
            count: item.value,
            dataIndex: idx,
            gradientFrom: (STATUS_GRADIENTS[idx] || STATUS_GRADIENTS[0]).from,
            gradientTo: (STATUS_GRADIENTS[idx] || STATUS_GRADIENTS[0]).to,
          })).filter(item => item.count > 0);
        })(),
        selectedStatusIdx: -1,
        trendChartData: trendRes?.data || { categories: [], reported: [], completed: [] },
        categoryChartData: rawCategory,
        categoryBarData: categoryBarData,
        responsibleChartData: responsibleRes?.data || [],
        responsibleChartLegend: (() => {
          const RESP_GRADIENTS = [
            { from: '#3B82F6', to: '#60A5FA' },
            { from: '#10B981', to: '#34D399' },
            { from: '#F59E0B', to: '#FBBF24' },
            { from: '#EF4444', to: '#F87171' },
            { from: '#8B5CF6', to: '#A78BFA' },
            { from: '#06B6D4', to: '#22D3EE' },
          ];
          const raw = responsibleRes?.data || [];
          return raw.map((item, idx) => ({
            name: item.name,
            count: item.value,
            dataIndex: idx,
            gradientFrom: (RESP_GRADIENTS[idx] || RESP_GRADIENTS[0]).from,
            gradientTo: (RESP_GRADIENTS[idx] || RESP_GRADIENTS[0]).to,
          })).filter(item => item.count > 0);
        })(),
        selectedResponsibleIdx: -1,
        floorChartData: floorRes?.data || { categories: [], values: [] },
        loading: false,
        _lastFetchTime: Date.now()  // 更新缓存时间戳
      });

      // 触发KPI卡片动画
      this.animateKPICards();

      // 延迟刷新图表（等待组件渲染完成）
      setTimeout(() => {
        this.initCharts();
      }, 300);

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
    // console.log('[Manager] Initializing 5 charts');

    // 1. 初始化状态环形图
    this.initStatusChart();
    // 2. 初始化趋势折线图
    this.initTrendChart();
    // 3. 初始化责任方饼图
    this.initResponsibleChart();
    // 5. 初始化楼层柱状图
    this.initFloorChart();

    // 标记图表已初始化
    this.setData({ chartsInitialized: true });
  },

  // 点击图例胶囊：高亮饼图对应切片
  onLegendTap(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.statusChartLegend[idx]
    if (!item || !this._statusChart) return

    const prev = this.data.selectedStatusIdx
    const next = prev === item.dataIndex ? -1 : item.dataIndex

    if (prev !== -1) {
      this._statusChart.dispatchAction({ type: 'pieUnSelect', seriesIndex: 0, dataIndex: prev })
    }
    if (next !== -1) {
      this._statusChart.dispatchAction({ type: 'pieSelect', seriesIndex: 0, dataIndex: next })
    }
    this.setData({ selectedStatusIdx: next })
  },

  // 点击责任方胶囊：高亮饼图对应切片
  onResponsibleLegendTap(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.responsibleChartLegend[idx]
    if (!item || !this._responsibleChart) return

    const prev = this.data.selectedResponsibleIdx
    const next = prev === item.dataIndex ? -1 : item.dataIndex

    if (prev !== -1) {
      this._responsibleChart.dispatchAction({ type: 'pieUnSelect', seriesIndex: 0, dataIndex: prev })
    }
    if (next !== -1) {
      this._responsibleChart.dispatchAction({ type: 'pieSelect', seriesIndex: 0, dataIndex: next })
    }
    this.setData({ selectedResponsibleIdx: next })
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
      this._statusChart = chart;

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
      this._responsibleChart = chart;

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
   * 加载空状态图标
   */
  async loadEmptyIcon() {
    try {
      const res = await wx.cloud.getTempFileURL({
        fileList: ['cloud://cloud1-7glfhm4r06e030bd.636c-cloud1-7glfhm4r06e030bd-1386591973/icons/03.png']
      });
      if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
        this.setData({ emptyIconUrl: res.fileList[0].tempFileURL });
      }
    } catch (e) {
      console.error('[Data] 加载空状态图标失败:', e);
    }
  },

  /**
   * 手动刷新
   */
  onRefresh() {
    this.fetchAllManagerData();
  }
});
