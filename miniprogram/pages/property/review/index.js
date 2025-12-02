/**
 * Review Page - T105
 * List of work orders pending review by property staff
 */

const app = getApp();
const api = require('../../../services/api');
const auth = require('../../../services/auth');
const { DEFAULT_PAGE_SIZE } = require('../../../utils/constants');
const { formatDateTime } = require('../../../utils/formatter');

Page({
  data: {
    workOrders: [],
    loading: true,
    loadingMore: false,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    hasMore: false,
    userInfo: null
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Review] Page load');
    this.loadUserInfo();
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: function () {
    console.log('[Review] Page show - reload data');
    // Reload data when returning to page
    this.setData({
      workOrders: [],
      page: 1
    });
    this.loadWorkOrders();
  },

  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    console.log('[Review] Pull down refresh');
    this.setData({
      workOrders: [],
      page: 1
    });
    this.loadWorkOrders();
    wx.stopPullDownRefresh();
  },

  /**
   * Reach bottom - load more
   */
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  /**
   * Load User Info
   */
  loadUserInfo: async function () {
    try {
      const userInfo = await auth.getCurrentUser();
      this.setData({ userInfo });
      
      // Check if user has review permission
      const canReview = await auth.hasPermission('review_work_orders');
      
      if (!canReview && userInfo.role_id !== 4) { // Not property staff
        wx.showModal({
          title: '权限不足',
          content: '您没有权限访问此页面',
          showCancel: false,
          success: () => {
            wx.navigateBack({
              fail: () => {
                wx.switchTab({
                  url: '/pages/index/index'
                });
              }
            });
          }
        });
        return;
      }
      
      this.loadWorkOrders();
    } catch (error) {
      console.error('[Review] Load user info error:', error);
      this.setData({ loading: false });
      app.showError('加载用户信息失败');
    }
  },

  /**
   * Load Work Orders - T105
   */
  loadWorkOrders: async function () {
    try {
      this.setData({ loading: true });

      const userInfo = this.data.userInfo;
      if (!userInfo) {
        throw new Error('User info not available');
      }

      // Query parameters
      const params = {
        status: 'Repaired',
        submitted_by: userInfo.id,
        page: this.data.page,
        limit: this.data.pageSize,
        sort_by: 'repaired_at',
        sort_order: 'DESC'
      };

      const response = await api.get('/workorders', params);
      
      const workOrders = response.data || response.workorders || [];
      const total = response.total || 0;
      const hasMore = workOrders.length >= this.data.pageSize;

      // Process work orders
      const processed = workOrders.map(order => this.processWorkOrder(order));

      // Append to existing list if loading more
      const allOrders = this.data.page === 1
        ? processed
        : [...this.data.workOrders, ...processed];

      this.setData({
        workOrders: allOrders,
        total,
        hasMore,
        loading: false,
        loadingMore: false
      });

      // Update page title with count
      wx.setNavigationBarTitle({
        title: `待审核工单 (${total})`
      });

      console.log('[Review] Work orders loaded:', allOrders.length);

    } catch (error) {
      console.error('[Review] Load work orders error:', error);
      this.setData({
        loading: false,
        loadingMore: false
      });
      app.showError('加载工单失败');
    }
  },

  /**
   * Process Work Order
   * Add display fields
   */
  processWorkOrder: function (order) {
    // Format repaired time
    const repairedTime = order.repaired_at
      ? formatDateTime(order.repaired_at)
      : '--';

    return {
      ...order,
      repairedTime
    };
  },

  /**
   * Load More
   */
  loadMore: function () {
    if (this.data.loadingMore || !this.data.hasMore) {
      return;
    }

    this.setData({
      page: this.data.page + 1,
      loadingMore: true
    });

    this.loadWorkOrders();
  },

  /**
   * Navigate to Detail Page
   */
  navigateToDetail: function (e) {
    const { id } = e.detail;
    
    if (!id) {
      console.warn('[Review] No work order ID provided');
      return;
    }

    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${id}`
    });
  }
});
