/**
 * Pending Repairs List Page - T076
 * List of work orders assigned to maintenance worker
 */

const app = getApp();
const api = require('../../../services/api');
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
    pageSize: DEFAULT_PAGE_SIZE
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Pending] Page load');
    this.loadWorkOrders();
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: function () {
    console.log('[Pending] Page show');
    // Refresh list when returning from detail page
    this.refreshList();
  },

  /**
   * Pull down to refresh - T078
   */
  onPullDownRefresh: function () {
    console.log('[Pending] Pull down refresh');
    this.refreshList();
    wx.stopPullDownRefresh();
  },

  /**
   * Reach bottom - load more
   */
  onReachBottom: function () {
    console.log('[Pending] Reach bottom');
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

      const params = {
        page: this.data.page,
        page_size: this.data.pageSize,
        assigned_to: userInfo.id,
        status: 'Pending Repair',
        sort_by: 'priority,created_at',
        sort_order: 'desc,desc'
      };

      const response = await api.get('/workorders', params);

      // Process work orders to add display fields
      const processedOrders = (response.data || []).map(order => {
        return this.processWorkOrder(order);
      });

      const workOrders = isLoadMore
        ? [...this.data.workOrders, ...processedOrders]
        : processedOrders;

      const hasMore = response.pagination
        ? response.pagination.current_page < response.pagination.total_pages
        : false;

      this.setData({
        workOrders,
        hasMore,
        loading: false,
        loadingMore: false
      });

      console.log('[Pending] Work orders loaded:', {
        count: workOrders.length,
        hasMore
      });

    } catch (error) {
      console.error('[Pending] Load work orders error:', error);
      this.setData({
        loading: false,
        loadingMore: false
      });
      app.showError(' }åU1%');
    }
  },

  /**
   * Process Work Order
   * Add display fields for UI
   */
  processWorkOrder: function (order) {
    // Priority display
    order.priority_display = PRIORITY_DISPLAY_NAMES[order.priority] || order.priority;

    // SLA deadline display
    if (order.sla_deadline) {
      const deadline = new Date(order.sla_deadline);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (diff < 0) {
        order.sla_display = 'ò…ö';
        order.sla_urgent = true;
      } else if (hours < 2) {
        order.sla_display = `iY ${hours}ö ${minutes}Ÿ`;
        order.sla_urgent = true;
      } else if (hours < 24) {
        order.sla_display = `iY ${hours}ö`;
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
