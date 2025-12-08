/**
 * Index Page - Work Order List (Taro Design Style)
 * Main landing page with work order list
 */

const app = getApp();
const workOrderService = require('../../services/workOrder');
const auth = require('../../services/auth');
const { formatRelativeTime } = require('../../utils/formatter');

Page({
  data: {
    workOrders: [],
    loading: true,
    searchText: '',
    activeTab: '', // '', today, week, month, date - 默认未选中
    activeStatus: 'reported', // reported, maintenance, review, completed - 默认显示已提报
    isDatePickerOpen: false,
    startDate: '',
    endDate: '',
    // 筛选弹窗
    isFilterOpen: false,
    filterRows: [
      { id: "floor", label: "楼层", hasArrow: true, value: '', placeholder: '' },
      { id: "owner", label: "责任方", hasArrow: true, value: '', placeholder: '' },
      { id: "category", label: "工单类别", hasArrow: true, value: '', placeholder: '' },
      { id: "reporter", label: "报修人", placeholder: "人名/简拼", value: '', hasArrow: false },
      { id: "priority", label: "优先级", hasArrow: true, value: '', placeholder: '' }
    ],
    // 自定义导航栏高度
    headerHeight: 0
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Index] Page load');
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    // 导航栏内容高度 88rpx 转换为 px
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: Math.ceil(statusBarHeight + navBarHeight)
    });
    this.checkAuth();
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: function () {
    console.log('[Index] Page show');
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      });
    }
    // 重置日期选择为默认状态
    this.setData({
      activeTab: '',
      activeStatus: 'reported'
    });
    this.loadWorkOrders();
  },

  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    console.log('[Index] Pull down refresh');
    this.loadWorkOrders();
    wx.stopPullDownRefresh();
  },

  /**
   * Check Authentication
   */
  checkAuth: async function () {
    try {
      const isAuth = await auth.isAuthenticated();
      if (!isAuth) {
        wx.showToast({
          title: '请先登录',
          icon: 'none',
          duration: 2000
        });
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login'
          });
        }, 2000);
      }
    } catch (error) {
      console.error('[Index] Check auth error:', error);
    }
  },

  /**
   * Load Work Orders from Cloud Database
   */
  loadWorkOrders: async function () {
    try {
      this.setData({ loading: true });

      // Get work orders from cloud database
      const allOrders = await workOrderService.getWorkOrders({});

      // Filter by time range
      let filteredOrders = this.filterByTimeRange(allOrders);

      // Filter by status
      filteredOrders = this.filterByStatus(filteredOrders);

      // Filter by search text
      if (this.data.searchText) {
        const searchLower = this.data.searchText.toLowerCase();
        filteredOrders = filteredOrders.filter(order => {
          const orderId = (order.order_id || order.id || '').toLowerCase();
          const location = (order.location || '').toLowerCase();
          const description = (order.description || '').toLowerCase();
          return orderId.includes(searchLower) ||
                 location.includes(searchLower) ||
                 description.includes(searchLower);
        });
      }

      // Add display properties
      filteredOrders = filteredOrders.map(order => this.enrichOrderData(order));

      // Sort by created_at descending (newest first)
      filteredOrders.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      this.setData({
        workOrders: filteredOrders,
        loading: false
      });

      console.log('[Index] Work orders loaded:', filteredOrders.length);
      if (filteredOrders.length > 0) {
        console.log('[Index] First order sample:', {
          order_id: filteredOrders[0].order_id,
          order_number: filteredOrders[0].order_number,
          _id: filteredOrders[0]._id,
          status: filteredOrders[0].status
        });
      }

    } catch (error) {
      console.error('[Index] Load work orders error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载工单失败',
        icon: 'none'
      });
    }
  },

  /**
   * Filter orders by time range
   */
  filterByTimeRange: function (orders) {
    const now = new Date();
    const { activeTab, startDate, endDate } = this.data;

    // 如果未选中任何时间筛选,返回所有工单
    if (!activeTab || activeTab === '') {
      return orders;
    }

    if (activeTab === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return orders.filter(order => {
        const createdAt = order.created_at;
        if (!createdAt) return false;
        const orderDate = createdAt.$date ? new Date(createdAt.$date) : new Date(createdAt);
        return orderDate >= today;
      });
    } else if (activeTab === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orders.filter(order => {
        const createdAt = order.created_at;
        if (!createdAt) return false;
        const orderDate = createdAt.$date ? new Date(createdAt.$date) : new Date(createdAt);
        return orderDate >= weekAgo;
      });
    } else if (activeTab === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return orders.filter(order => {
        const createdAt = order.created_at;
        if (!createdAt) return false;
        const orderDate = createdAt.$date ? new Date(createdAt.$date) : new Date(createdAt);
        return orderDate >= monthAgo;
      });
    }

    return orders;
  },

  /**
   * Filter orders by status
   */
  filterByStatus: function (orders) {
    const { activeStatus } = this.data;

    // 如果 activeStatus 为空,返回所有工单
    if (!activeStatus) {
      return orders;
    }

    const statusMap = {
      'reported': 'Pending Repair',
      'maintenance': 'In Progress',
      'review': 'Repaired',
      'completed': 'Completed'
    };

    const targetStatus = statusMap[activeStatus];
    if (targetStatus) {
      return orders.filter(order => order.status === targetStatus);
    }

    return orders;
  },

  /**
   * Enrich order data with display properties
   */
  enrichOrderData: function (order) {
    const statusColorMap = {
      'Pending Repair': 'blue',
      'In Progress': 'orange',
      'Repaired': 'amber',
      'Completed': 'green'
    };

    const statusTextMap = {
      'Pending Repair': '已提报',
      'In Progress': '维修中',
      'Repaired': '待复核',
      'Completed': '已完成'
    };

    const statusClassMap = {
      'Pending Repair': 'status-reported',
      'In Progress': 'status-maintenance',
      'Repaired': 'status-review',
      'Completed': 'status-completed'
    };

    // Format created_at time for display
    let formattedTime = '未知时间';
    if (order.created_at) {
      const createdAt = order.created_at.$date ? new Date(order.created_at.$date) : new Date(order.created_at);
      const year = createdAt.getFullYear();
      const month = String(createdAt.getMonth() + 1).padStart(2, '0');
      const day = String(createdAt.getDate()).padStart(2, '0');
      const hour = String(createdAt.getHours()).padStart(2, '0');
      const minute = String(createdAt.getMinutes()).padStart(2, '0');
      formattedTime = `${year}-${month}-${day}   ${hour}:${minute}`;
    }

    // 过滤照片路径：只保留 http/https 开头的路径，过滤掉 cloud:// 路径
    let validPhotos = [];
    if (order.photos && Array.isArray(order.photos)) {
      validPhotos = order.photos.filter(photo => {
        return photo && (photo.startsWith('http://') || photo.startsWith('https://'));
      });
    }

    return {
      ...order,
      statusColor: statusColorMap[order.status] || 'gray',
      statusText: statusTextMap[order.status] || order.status,
      statusClass: statusClassMap[order.status] || 'status-processing',
      created_at: formattedTime,
      photos: validPhotos
    };
  },

  /**
   * Search Input Handler
   */
  onSearchInput: function (e) {
    this.setData({
      searchText: e.detail.value
    });
    // Debounce search
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.loadWorkOrders();
    }, 500);
  },

  /**
   * Handle Scan QR Code
   */
  handleScan: function () {
    wx.scanCode({
      success: (res) => {
        console.log('[Index] Scan result:', res);
        // Use scan result as search text
        this.setData({
          searchText: res.result
        });
        this.loadWorkOrders();
      },
      fail: (err) => {
        console.error('[Index] Scan failed:', err);
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * Handle Filter - 打开筛选弹窗
   */
  handleFilter: function () {
    this.setData({ isFilterOpen: true });
    // 隐藏自定义 TabBar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        hidden: true
      });
    }
  },

  /**
   * 关闭筛选弹窗
   */
  closeFilterPanel: function () {
    this.setData({ isFilterOpen: false });
    // 显示自定义 TabBar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        hidden: false
      });
    }
  },

  /**
   * 点击背景关闭弹窗
   */
  handleBackdropTap: function () {
    this.closeFilterPanel();
  },

  /**
   * 重置筛选条件
   */
  handleReset: function () {
    const resetFilterRows = this.data.filterRows.map(row => ({
      ...row,
      value: ''
    }));
    this.setData({ filterRows: resetFilterRows });
  },

  /**
   * 确定筛选
   */
  handleConfirm: function () {
    this.closeFilterPanel();
    // TODO: 实际应用筛选条件
    wx.showToast({
      title: '筛选条件已应用',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * Handle Tab Change
   */
  handleTabChange: function (e) {
    const tab = e.currentTarget.dataset.tab;

    // 如果点击的是当前已选中的标签,则取消选中
    if (this.data.activeTab === tab) {
      this.setData({
        activeTab: ''
      });
      this.loadWorkOrders();
      return;
    }

    // 否则选中新的标签
    this.setData({
      activeTab: tab
    });

    if (tab === 'date') {
      this.setData({
        isDatePickerOpen: true
      });
    } else {
      this.loadWorkOrders();
    }
  },

  /**
   * Handle Status Change
   */
  handleStatusChange: function (e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      activeStatus: status
    });
    this.loadWorkOrders();
  },

  /**
   * Date Picker Handlers
   */
  closeDatePicker: function () {
    this.setData({
      isDatePickerOpen: false
    });
  },

  stopPropagation: function () {
    // Prevent event bubbling
  },

  onStartDateChange: function (e) {
    this.setData({
      startDate: e.detail.value
    });
  },

  onEndDateChange: function (e) {
    this.setData({
      endDate: e.detail.value
    });
  },

  cancelDatePicker: function () {
    this.setData({
      startDate: '',
      endDate: '',
      activeTab: '',
      isDatePickerOpen: false
    });
    this.loadWorkOrders();
  },

  confirmDatePicker: function () {
    if (!this.data.startDate || !this.data.endDate) {
      wx.showToast({
        title: '请选择开始和结束日期',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isDatePickerOpen: false
    });
    this.loadWorkOrders();
  },

  /**
   * Navigate to Detail
   */
  navigateToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    console.log('[Index] Navigate to detail, order_id:', id);

    if (!id) {
      wx.showToast({
        title: '工单ID无效',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${id}`
    });
  },

  /**
   * Navigate to New Order
   */
  navigateToNewOrder: function () {
    wx.navigateTo({
      url: '/pages/property/submit/index'
    });
  }
});
