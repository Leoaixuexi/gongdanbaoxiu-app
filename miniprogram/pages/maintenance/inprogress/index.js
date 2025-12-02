/**
 * In Progress Orders Page - T088 (Cloud Database Version)
 * List of work orders currently being worked on
 */

const app = getApp();
const workOrderService = require('../../../services/workOrder');
const auth = require('../../../services/auth');
const { DEFAULT_PAGE_SIZE, PRIORITY_DISPLAY_NAMES } = require('../../../utils/constants');
const { formatRelativeTime, formatDateTime } = require('../../../utils/formatter');

Page({
  data: {
    workOrders: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[InProgress] Page load');
    this.loadWorkOrders();
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: function () {
    console.log('[InProgress] Page show');
    // Refresh list when returning from detail page
    this.refreshList();
  },

  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    console.log('[InProgress] Pull down refresh');
    this.refreshList();
    wx.stopPullDownRefresh();
  },

  /**
   * Reach bottom - load more
   */
  onReachBottom: function () {
    console.log('[InProgress] Reach bottom');
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  /**
   * Load Work Orders
   */
  loadWorkOrders: async function (isLoadMore = false) {
    try {
      if (!isLoadMore) {
        this.setData({ loading: true });
      } else {
        this.setData({ loadingMore: true });
      }

      const userInfo = await auth.getCurrentUser();
      if (!userInfo) {
        throw new Error('User not authenticated');
      }

      // Get work orders from cloud database with status filter
      const allOrders = await workOrderService.getWorkOrders({
        status: 'In Progress'
      });

      // Process work orders to add display fields
      const processedOrders = allOrders.map(order => {
        return this.processWorkOrder(order);
      });

      // Sort by started_at descending
      processedOrders.sort((a, b) => {
        const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
        const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
        return dateB - dateA;
      });

      const totalCount = processedOrders.length;

      this.setData({
        workOrders: processedOrders,
        hasMore: false, // Cloud database returns all at once
        totalCount,
        loading: false,
        loadingMore: false
      });

      // Update page title with count
      wx.setNavigationBarTitle({
        title: `维修中 (${totalCount})`
      });

      console.log('[InProgress] Work orders loaded:', {
        count: processedOrders.length,
        totalCount
      });

    } catch (error) {
      console.error('[InProgress] Load work orders error:', error);
      this.setData({
        loading: false,
        loadingMore: false
      });
      app.showError('�}�Uh1%');
    }
  },

  /**
   * Process Work Order
   * Add display fields for UI
   */
  processWorkOrder: function (order) {
    // Priority display
    order.priority_display = PRIORITY_DISPLAY_NAMES[order.priority] || order.priority;

    // Calculate elapsed time since started
    if (order.started_at) {
      const startTime = new Date(order.started_at);
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours >= 24) {
        const days = Math.floor(diffHours / 24);
        const hours = diffHours % 24;
        order.elapsed_time = `��L ${days}) ${hours}�`;
      } else if (diffHours > 0) {
        order.elapsed_time = `��L ${diffHours}� ${diffMinutes}�`;
      } else {
        order.elapsed_time = `��L ${diffMinutes}�`;
      }

      order.started_at_display = formatDateTime(order.started_at);
    }

    // SLA deadline display
    if (order.sla_deadline) {
      const deadline = new Date(order.sla_deadline);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (diff < 0) {
        order.sla_display = '�';
        order.sla_urgent = true;
      } else if (hours < 2) {
        order.sla_display = `iY ${hours}� ${minutes}�`;
        order.sla_urgent = true;
      } else if (hours < 24) {
        order.sla_display = `iY ${hours}�`;
        order.sla_urgent = false;
      } else {
        const days = Math.floor(hours / 24);
        order.sla_display = `iY ${days})`;
        order.sla_urgent = false;
      }
    }

    return order;
  },

  /**
   * Refresh List
   */
  refreshList: function () {
    this.setData({
      page: 1,
      hasMore: true,
      workOrders: []
    });
    this.loadWorkOrders();
  },

  /**
   * Load More
   */
  loadMore: function () {
    const nextPage = this.data.page + 1;
    this.setData({ page: nextPage });
    this.loadWorkOrders(true);
  },

  /**
   * Navigate to Detail
   */
  navigateToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${id}`
    });
  }
});
