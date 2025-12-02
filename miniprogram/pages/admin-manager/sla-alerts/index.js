/**
 * SLA Alerts Page
 * 显示所有需要关注的SLA告警工单
 */

const workOrderService = require('../../../services/workOrder');
const slaCalculator = require('../../../utils/slaCalculator');
const auth = require('../../../services/auth');

Page({
  data: {
    loading: false,
    refreshing: false,
    allOrders: [],
    filteredOrders: [],
    currentFilter: 'all',

    // Filter tabs
    filterTabs: [
      { value: 'all', label: '全部', icon: '📋', count: 0 },
      { value: 'critical', label: '紧急', icon: '🔴', count: 0 },
      { value: 'warning', label: '警告', icon: '⚠️', count: 0 },
      { value: 'overdue', label: '超期', icon: '⏰', count: 0 }
    ],

    // Statistics
    stats: {
      total: 0,
      critical: 0,
      warning: 0,
      overdue: 0,
      normal: 0
    },

    // Alert summary
    alertSummary: '加载中...',

    // Empty state
    emptyIcon: '✅',
    emptyText: '太棒了！暂无SLA告警',

    // Mapping
    priorityMap: {
      'Emergency': '紧急',
      'High': '高',
      'Normal': '普通',
      'Low': '低'
    },
    statusMap: {
      'Pending Repair': '待维修',
      'In Progress': '维修中',
      'Repaired': '已维修',
      'Completed': '已完成',
      'Closed': '已关闭'
    }
  },

  onLoad() {
    this.checkPermissions();
    this.loadOrders();
  },

  onShow() {
    // Refresh when page shows
    if (this.data.allOrders.length > 0) {
      this.recalculateSLA();
    }
  },

  onPullDownRefresh() {
    this.onRefresh();
  },

  /**
   * Check permissions
   */
  async checkPermissions() {
    try {
      const hasPermission = await auth.hasPermission('view_analytics');
      if (!hasPermission) {
        wx.showModal({
          title: '权限不足',
          content: '您没有权限查看SLA告警',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    } catch (error) {
      console.error('[SLA Alerts] Check permissions error:', error);
    }
  },

  /**
   * Load work orders
   */
  async loadOrders() {
    this.setData({ loading: true });

    try {
      // Get all incomplete work orders
      const orders = await workOrderService.getWorkOrders({
        status_in: ['Pending Repair', 'In Progress', 'Repaired']
      });

      // Calculate SLA for each order
      const ordersWithSLA = slaCalculator.calculateWorkOrdersSLA(orders);

      // Get alert orders (warning, critical, overdue)
      const alertOrders = ordersWithSLA.filter(order => {
        return ['warning', 'critical', 'overdue'].includes(order.sla.status);
      });

      // Calculate statistics
      const stats = {
        total: alertOrders.length,
        critical: alertOrders.filter(o => o.sla.status === 'critical').length,
        warning: alertOrders.filter(o => o.sla.status === 'warning').length,
        overdue: alertOrders.filter(o => o.sla.status === 'overdue').length,
        normal: ordersWithSLA.filter(o => o.sla.status === 'normal').length
      };

      // Update filter tabs count
      const filterTabs = this.data.filterTabs.map(tab => {
        if (tab.value === 'all') {
          tab.count = stats.total;
        } else {
          tab.count = stats[tab.value];
        }
        return tab;
      });

      // Generate alert summary
      let alertSummary = '';
      if (stats.total === 0) {
        alertSummary = '所有工单状态良好';
      } else {
        const parts = [];
        if (stats.critical > 0) parts.push(`${stats.critical}个紧急`);
        if (stats.warning > 0) parts.push(`${stats.warning}个警告`);
        if (stats.overdue > 0) parts.push(`${stats.overdue}个超期`);
        alertSummary = parts.join('，');
      }

      this.setData({
        allOrders: alertOrders,
        filteredOrders: alertOrders,
        stats,
        filterTabs,
        alertSummary,
        loading: false,
        refreshing: false
      });

      wx.stopPullDownRefresh();

      console.log('[SLA Alerts] Loaded:', {
        total: orders.length,
        alerts: alertOrders.length,
        stats
      });

    } catch (error) {
      console.error('[SLA Alerts] Load orders error:', error);
      this.setData({
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();

      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * Recalculate SLA (when page shows)
   */
  recalculateSLA() {
    const ordersWithSLA = slaCalculator.calculateWorkOrdersSLA(this.data.allOrders);

    this.setData({
      allOrders: ordersWithSLA
    });

    this.filterOrders();
  },

  /**
   * Filter change handler
   */
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.value;
    this.setData({
      currentFilter: filter
    });
    this.filterOrders();
  },

  /**
   * Filter orders based on current filter
   */
  filterOrders() {
    const { allOrders, currentFilter } = this.data;

    let filtered = allOrders;
    let emptyIcon = '✅';
    let emptyText = '太棒了！暂无SLA告警';

    if (currentFilter !== 'all') {
      filtered = allOrders.filter(order => order.sla.status === currentFilter);

      if (currentFilter === 'critical') {
        emptyIcon = '🎉';
        emptyText = '暂无紧急告警';
      } else if (currentFilter === 'warning') {
        emptyIcon = '😊';
        emptyText = '暂无警告工单';
      } else if (currentFilter === 'overdue') {
        emptyIcon = '👏';
        emptyText = '暂无超期工单';
      }
    }

    this.setData({
      filteredOrders: filtered,
      emptyIcon,
      emptyText
    });
  },

  /**
   * Refresh handler
   */
  onRefresh() {
    this.setData({ refreshing: true });
    this.loadOrders();
  },

  /**
   * Navigate to work order detail
   */
  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${orderId}`
    });
  }
});
