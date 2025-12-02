/**
 * Dashboard Page - Admin Manager Overview
 * T127-T131: KPI cards, filters, work order list, auto-refresh
 */

const api = require('../../../services/api');
const { WORK_ORDER_STATUSES, PRIORITIES, STATUS_DISPLAY_NAMES, PRIORITY_DISPLAY_NAMES } = require('../../../utils/constants');
const { formatTime } = require('../../../utils/formatter');

Page({
  data: {
    // Overview statistics
    overview: {
      totalActiveOrders: 0,
      avgResponseTime: 0,
      avgResolutionTime: 0,
      overdueRate: 0,
      firstTimeFixRate: 0,
      completionRate: 0
    },

    // Work orders list
    workOrders: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,

    // UI state
    loading: false,
    showFilters: false,
    lastRefreshTime: '',

    // Filter options
    statusOptions: [
      { label: '全部', value: '' },
      { label: STATUS_DISPLAY_NAMES['Pending Repair'], value: 'Pending Repair' },
      { label: STATUS_DISPLAY_NAMES['In Progress'], value: 'In Progress' },
      { label: STATUS_DISPLAY_NAMES['Repaired'], value: 'Repaired' },
      { label: STATUS_DISPLAY_NAMES['Completed'], value: 'Completed' }
    ],
    statusIndex: 0,

    priorityOptions: [
      { label: '全部', value: '' },
      { label: PRIORITY_DISPLAY_NAMES['Low'], value: 'Low' },
      { label: PRIORITY_DISPLAY_NAMES['Normal'], value: 'Normal' },
      { label: PRIORITY_DISPLAY_NAMES['High'], value: 'High' },
      { label: PRIORITY_DISPLAY_NAMES['Emergency'], value: 'Emergency' }
    ],
    priorityIndex: 0,

    faultTypeOptions: [{ id: null, name: '全部' }],
    faultTypeIndex: 0,

    // Filter values
    filters: {
      status: '',
      priority: '',
      faultTypeId: null,
      floor: '',
      startDate: '',
      endDate: ''
    },

    // Auto-refresh
    refreshInterval: null,
    REFRESH_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
  },

  /**
   * Page lifecycle - Load initial data
   */
  onLoad() {
    console.log('[Dashboard] Page loaded');
    this.loadInitialData();
    this.startAutoRefresh();
  },

  /**
   * Page lifecycle - Refresh data when shown
   */
  onShow() {
    console.log('[Dashboard] Page shown');
    // Refresh if coming back from detail page
    if (this.data.workOrders.length > 0) {
      this.loadWorkOrders();
    }
  },

  /**
   * Page lifecycle - Clean up auto-refresh
   */
  onUnload() {
    console.log('[Dashboard] Page unloaded');
    this.stopAutoRefresh();
  },

  /**
   * Pull-to-refresh handler
   */
  onPullDownRefresh() {
    console.log('[Dashboard] Pull to refresh');
    this.loadInitialData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * Load initial data (overview + work orders + fault types)
   */
  async loadInitialData() {
    try {
      this.setData({ loading: true });

      // Load data in parallel
      await Promise.all([
        this.loadOverview(),
        this.loadWorkOrders(),
        this.loadFaultTypes()
      ]);

      this.updateRefreshTime();
    } catch (error) {
      console.error('[Dashboard] Error loading initial data:', error);
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * T127: Load overview statistics from API
   */
  async loadOverview() {
    try {
      const response = await api.get('/analytics/overview', {}, { hideLoading: true });

      if (response && response.data) {
        this.setData({
          overview: {
            totalActiveOrders: response.data.totalActiveOrders || 0,
            avgResponseTime: response.data.avgResponseTime || 0,
            avgResolutionTime: response.data.avgResolutionTime || 0,
            overdueRate: response.data.overdueRate || 0,
            firstTimeFixRate: response.data.firstTimeFixRate || 0,
            completionRate: response.data.completionRate || 0
          }
        });

        console.log('[Dashboard] Overview loaded:', response.data);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading overview:', error);
      throw error;
    }
  },

  /**
   * T131: Load work orders with filters applied
   */
  async loadWorkOrders() {
    try {
      const { page, pageSize, filters } = this.data;

      // Build query parameters
      const params = {
        page,
        limit: pageSize
      };

      // Apply filters
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.faultTypeId) params.fault_type_id = filters.faultTypeId;
      if (filters.floor) params.floor = filters.floor;
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;

      console.log('[Dashboard] Loading work orders with params:', params);

      const response = await api.get('/workorders', params, { hideLoading: true });

      if (response && response.data) {
        const totalPages = Math.ceil(response.pagination.total / pageSize);

        this.setData({
          workOrders: response.data,
          total: response.pagination.total,
          totalPages
        });

        console.log('[Dashboard] Work orders loaded:', response.data.length);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading work orders:', error);
      throw error;
    }
  },

  /**
   * Load fault types for filter dropdown
   */
  async loadFaultTypes() {
    try {
      const response = await api.get('/fault-types', {}, { hideLoading: true });

      if (response && response.data) {
        const faultTypeOptions = [
          { id: null, name: '全部' },
          ...response.data
        ];

        this.setData({ faultTypeOptions });
        console.log('[Dashboard] Fault types loaded:', response.data.length);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading fault types:', error);
      // Non-critical error, don't throw
    }
  },

  /**
   * T130: Toggle filter section visibility
   */
  toggleFilters() {
    this.setData({
      showFilters: !this.data.showFilters
    });
  },

  /**
   * T130: Filter change handlers
   */
  handleStatusChange(e) {
    const statusIndex = parseInt(e.detail.value);
    const status = this.data.statusOptions[statusIndex].value;

    this.setData({
      statusIndex,
      'filters.status': status
    });
  },

  handlePriorityChange(e) {
    const priorityIndex = parseInt(e.detail.value);
    const priority = this.data.priorityOptions[priorityIndex].value;

    this.setData({
      priorityIndex,
      'filters.priority': priority
    });
  },

  handleFaultTypeChange(e) {
    const faultTypeIndex = parseInt(e.detail.value);
    const faultTypeId = this.data.faultTypeOptions[faultTypeIndex].id;

    this.setData({
      faultTypeIndex,
      'filters.faultTypeId': faultTypeId
    });
  },

  handleFloorInput(e) {
    this.setData({
      'filters.floor': e.detail.value
    });
  },

  handleStartDateChange(e) {
    this.setData({
      'filters.startDate': e.detail.value
    });
  },

  handleEndDateChange(e) {
    this.setData({
      'filters.endDate': e.detail.value
    });
  },

  /**
   * T131: Apply filters and reload work orders
   */
  async handleApplyFilters() {
    console.log('[Dashboard] Applying filters:', this.data.filters);

    // Reset to page 1
    this.setData({ page: 1 });

    // Reload work orders with filters
    await this.loadWorkOrders();

    wx.showToast({
      title: '筛选已应用',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * T131: Clear all filters
   */
  async handleClearFilters() {
    console.log('[Dashboard] Clearing filters');

    this.setData({
      statusIndex: 0,
      priorityIndex: 0,
      faultTypeIndex: 0,
      filters: {
        status: '',
        priority: '',
        faultTypeId: null,
        floor: '',
        startDate: '',
        endDate: ''
      },
      page: 1
    });

    // Reload work orders without filters
    await this.loadWorkOrders();

    wx.showToast({
      title: '筛选已清除',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * Pagination handlers
   */
  async handlePrevPage() {
    if (this.data.page <= 1) return;

    this.setData({ page: this.data.page - 1 });
    await this.loadWorkOrders();

    // Scroll to top
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  async handleNextPage() {
    if (this.data.page >= this.data.totalPages) return;

    this.setData({ page: this.data.page + 1 });
    await this.loadWorkOrders();

    // Scroll to top
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  /**
   * Navigate to work order detail page
   */
  handleWorkOrderTap(e) {
    const { id } = e.detail;

    if (!id) {
      console.warn('[Dashboard] No work order ID');
      return;
    }

    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${id}`
    });
  },

  /**
   * Navigate to analytics page
   */
  navigateToAnalytics() {
    wx.navigateTo({
      url: '/pages/admin-manager/analytics/index'
    });
  },

  /**
   * T137: Manual refresh button handler
   */
  async handleManualRefresh() {
    console.log('[Dashboard] Manual refresh triggered');
    await this.loadInitialData();

    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * T137: Start auto-refresh interval (every 5 minutes)
   */
  startAutoRefresh() {
    console.log('[Dashboard] Starting auto-refresh');

    // Clear existing interval if any
    this.stopAutoRefresh();

    // Set new interval
    const refreshInterval = setInterval(() => {
      console.log('[Dashboard] Auto-refresh triggered');
      this.loadInitialData();
    }, this.data.REFRESH_INTERVAL_MS);

    this.setData({ refreshInterval });
  },

  /**
   * T137: Stop auto-refresh interval
   */
  stopAutoRefresh() {
    const { refreshInterval } = this.data;

    if (refreshInterval) {
      console.log('[Dashboard] Stopping auto-refresh');
      clearInterval(refreshInterval);
      this.setData({ refreshInterval: null });
    }
  },

  /**
   * Update last refresh time display
   */
  updateRefreshTime() {
    const now = new Date();
    const lastRefreshTime = formatTime(now);
    this.setData({ lastRefreshTime });
  }
});
