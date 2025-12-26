/**
 * Index Page - Work Order List (Taro Design Style)
 * Main landing page with work order list
 */

const app = getApp();
const workOrderService = require('../../services/workOrder');
const auth = require('../../services/auth');
const dictionary = require('../../services/dictionary');
const { formatRelativeTime } = require('../../utils/formatter');

Page({
  data: {
    workOrders: [],
    loading: true,
    searchText: '',
    activeTab: '', // '', today, week, month, date - 默认未选中
    activeStatus: '', // 默认为空，onShow 时设置
    isNavigatingToSubPage: false, // 标记是否导航到子页面
    isDatePickerOpen: false,
    startDate: '',
    endDate: '',
    // 筛选弹窗
    isFilterOpen: false,
    filterRows: [
      { id: "floor", label: "楼层", hasArrow: true, value: '', placeholder: '' },
      { id: "owner", label: "责任方", hasArrow: true, value: '', placeholder: '' },
      { id: "category", label: "工单类别", hasArrow: true, value: '', placeholder: '' },
      { id: "reporter", label: "报修人", hasArrow: true, value: '', placeholder: '' },
      { id: "priority", label: "优先级", hasArrow: true, value: '', placeholder: '' }
    ],
    // 筛选选择器弹窗
    isPickerOpen: false,
    pickerTitle: '',
    pickerOptions: [],
    pickerSelectedValue: '',
    currentPickerId: '',
    // 报修人输入弹窗
    isReporterInputOpen: false,
    reporterInputValue: '',
    // 筛选选项数据源
    floorOptions: [],
    ownerOptions: [],
    categoryOptions: [],
    reporterOptions: [],
    priorityOptions: ['普通', '紧急'],
    // 自定义导航栏高度
    headerHeight: 0,
    // 用户角色信息
    userRole: null, // 2=行政经理, 3=维修员, 4=办美员工
    userDepartment: null,
    userId: null,
    isPropertyStaff: false,
    isMaintenanceWorker: false,
    isManager: false,
    // 动态状态按钮列表
    statusButtons: [],
    // 滚动到指定状态按钮
    scrollIntoView: ''
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
    this.loadDictionaries();
  },

  /**
   * 加载字典数据（楼层、责任方、工单类别、报修人）
   */
  loadDictionaries: async function () {
    try {
      // 并行获取字典数据和办美员工列表
      const [floors, categories, parties, staffResult] = await Promise.all([
        dictionary.getOptions('floor'),
        dictionary.getOptions('order_category'),
        dictionary.getOptions('responsible_party'),
        wx.cloud.callFunction({
          name: 'userAuth',
          data: { action: 'getPropertyStaffList' }
        })
      ]);

      const reporters = staffResult.result?.success ? staffResult.result.data : [];

      console.log('[Index] Dictionaries loaded:', { floors, categories, parties, reporters });

      this.setData({
        floorOptions: floors.length > 0 ? floors : this.data.floorOptions,
        categoryOptions: categories.length > 0 ? categories : this.data.categoryOptions,
        ownerOptions: parties.length > 0 ? parties : this.data.ownerOptions,
        reporterOptions: reporters.length > 0 ? reporters : this.data.reporterOptions
      });
    } catch (error) {
      console.error('[Index] Load dictionaries error:', error);
    }
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: async function () {
    console.log('[Index] Page show');

    // 页面滚动到顶部
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 0
    });

    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      });
    }

    // 判断是否从子页面返回
    const isBackFromSubPage = this.data.isNavigatingToSubPage;
    console.log('[Index] isBackFromSubPage:', isBackFromSubPage);
    // 重置标记
    if (isBackFromSubPage) {
      this.setData({ isNavigatingToSubPage: false });
    }

    // 获取用户角色信息
    try {
      const userInfo = await auth.getCurrentUser();
      if (userInfo) {
        const isPropertyStaff = userInfo.role_id === 4;
        const isMaintenanceWorker = userInfo.role_id === 3;
        const isManager = userInfo.role_id === 2;

        // 根据角色配置状态按钮
        const statusButtons = this.getStatusButtonsByRole(isPropertyStaff, isMaintenanceWorker, isManager);

        // 根据角色配置筛选行
        const filterRows = this.getFilterRowsByRole(isManager, isMaintenanceWorker);

        // 根据角色设置默认状态
        let defaultStatus = 'all';  // 经理默认为"全部"
        if (isMaintenanceWorker) {
          defaultStatus = 'pending_accept';  // 维修员默认为"待接单"
        } else if (isPropertyStaff) {
          defaultStatus = 'reported';  // 办美员工默认为"已提报"
        }

        // 判断是否需要重置状态
        // - 首次加载（currentStatus 为空）：重置为"全部"
        // - 从子页面返回（isBackFromSubPage）：保持当前状态
        // - tab 切换或其他情况：重置为"全部"
        const currentStatus = this.data.activeStatus;
        const shouldResetToDefault = !currentStatus || !isBackFromSubPage;

        this.setData({
          userRole: userInfo.role_id,
          userDepartment: userInfo.department,
          userId: userInfo.id,
          isPropertyStaff,
          isMaintenanceWorker,
          isManager,
          statusButtons,
          filterRows,
          activeTab: '',
          // 首次加载或从 tab 切换回来时，重置为"全部"；否则保持用户选择的状态
          activeStatus: shouldResetToDefault ? defaultStatus : currentStatus,
          scrollIntoView: shouldResetToDefault ? ('status-' + defaultStatus) : ('status-' + currentStatus)
        });

        console.log('[Index] User role:', {
          role_id: userInfo.role_id,
          department: userInfo.department,
          isPropertyStaff,
          isMaintenanceWorker,
          isManager
        });
      }
    } catch (error) {
      console.error('[Index] Get user info error:', error);
    }

    this.loadWorkOrders();
  },

  /**
   * 根据角色获取状态按钮配置
   */
  getStatusButtonsByRole: function (isPropertyStaff, isMaintenanceWorker, isManager) {
    if (isManager) {
      // 行政经理状态按钮
      return [
        { key: 'all', label: '全部', status: null },
        { key: 'reported', label: '已提报', status: 'Pending Repair' },
        { key: 'maintenance', label: '维修中', status: 'In Progress' },
        { key: 'repaired', label: '已修复', status: 'Repaired' },
        // 云函数没有单独的 "Pending Review" 状态：已修复即待复核
        { key: 'review', label: '待复核', status: 'Repaired' },
        { key: 'rework', label: '需返工', status: 'Needs Rework' },
        { key: 'completed', label: '已完成', status: 'Completed' }
      ];
    } else if (isPropertyStaff) {
      // 办美员工状态按钮
      return [
        { key: 'reported', label: '已提报', status: 'Pending Repair' },
        { key: 'maintenance', label: '维修中', status: 'In Progress' },
        { key: 'review', label: '待复核', status: 'Repaired' },
        { key: 'rework', label: '需返工', status: 'Needs Rework' },
        { key: 'completed', label: '已完成', status: 'Completed' }
      ];
    } else if (isMaintenanceWorker) {
      // 维修员状态按钮
      return [
        { key: 'pending_accept', label: '待接单', status: 'Pending Repair' },
        { key: 'maintenance', label: '维修中', status: 'In Progress' },
        { key: 'repaired', label: '已修复', status: 'Repaired' },
        { key: 'rework', label: '需返工', status: 'Needs Rework' },
        { key: 'completed', label: '已完成', status: 'Completed' }
      ];
    }
    return [];
  },

  /**
   * 根据角色获取筛选行配置
   * - 行政经理：显示所有筛选字段（楼层、责任方、工单类别、报修人、优先级）
   * - 办美员工：显示楼层、责任方、工单类别、优先级（隐藏报修人）
   * - 维修员：显示楼层、工单类别、优先级（隐藏责任方、报修人）
   */
  getFilterRowsByRole: function (isManager, isMaintenanceWorker) {
    const rows = [
      { id: "floor", label: "楼层", hasArrow: true, value: '', placeholder: '' }
    ];

    // 维修员隐藏责任方筛选
    if (!isMaintenanceWorker) {
      rows.push({ id: "owner", label: "责任方", hasArrow: true, value: '', placeholder: '' });
    }

    rows.push({ id: "category", label: "工单类别", hasArrow: true, value: '', placeholder: '' });

    // 只有行政经理显示报修人筛选
    if (isManager) {
      rows.push({ id: "reporter", label: "报修人", hasArrow: true, value: '', placeholder: '' });
    }

    rows.push({ id: "priority", label: "优先级", hasArrow: true, value: '', placeholder: '' });

    return rows;
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

      // Debug: 打印第一个工单的关键字段
      if (allOrders.length > 0) {
        console.log('[Index] First order debug:', {
          order_id: allOrders[0].order_id,
          order_number: allOrders[0].order_number,
          order_category: allOrders[0].order_category,
          report_time: allOrders[0].report_time
        });
      }

      // Filter by user role
      let filteredOrders = this.filterByUserRole(allOrders);

      // Filter by time range
      filteredOrders = this.filterByTimeRange(filteredOrders);

      // Calculate status counts BEFORE status filtering (so counts show all statuses)
      const statusCounts = this.calculateStatusCounts(filteredOrders);
      this.updateStatusButtonCounts(statusCounts);

      // Filter by status
      filteredOrders = this.filterByStatus(filteredOrders);

      // Filter by advanced criteria (from filter panel)
      filteredOrders = this.filterByAdvancedCriteria(filteredOrders);

      // Filter by search text
      if (this.data.searchText) {
        const searchLower = this.data.searchText.toLowerCase();
        filteredOrders = filteredOrders.filter(order => {
          const orderId = String(order.order_id || order.id || '').toLowerCase();
          const location = String(order.location || '').toLowerCase();
          const description = String(order.description || '').toLowerCase();
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
   * Filter orders by user role
   * 行政经理：看到所有工单
   * 办美员工：只看自己提报的工单
   * 维修员：只看责任方=自己部门的工单
   */
  filterByUserRole: function (orders) {
    const { isPropertyStaff, isMaintenanceWorker, isManager, userId, userDepartment } = this.data;

    if (isManager) {
      // 行政经理：显示所有工单
      return orders;
    } else if (isPropertyStaff && userId) {
      // 办美员工：只显示自己提报的工单
      return orders.filter(order => {
        return order.submitter && order.submitter.user_id === userId;
      });
    } else if (isMaintenanceWorker && userDepartment) {
      // 维修员：只显示责任方与自己部门匹配的工单（服务端也会做过滤，这里做兜底）
      return orders.filter(order => {
        return order.responsible_party === userDepartment;
      });
    }

    // 默认返回所有工单
    return orders;
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
    } else if (activeTab === 'date' && startDate && endDate) {
      // 自定义日期范围筛选
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      return orders.filter(order => {
        const createdAt = order.created_at;
        if (!createdAt) return false;
        const orderDate = createdAt.$date ? new Date(createdAt.$date) : new Date(createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }

    return orders;
  },

  /**
   * Filter orders by status
   */
  filterByStatus: function (orders) {
    const { activeStatus } = this.data;

    // 如果 activeStatus 为空或为 'all',返回所有工单
    if (!activeStatus || activeStatus === 'all') {
      return orders;
    }

    // 找到对应的状态按钮配置
    const statusButton = this.data.statusButtons.find(btn => btn.key === activeStatus);
    if (statusButton && statusButton.status) {
      const targetStatus = statusButton.status;
      return orders.filter(order => order.status === targetStatus);
    }

    return orders;
  },

  /**
   * Filter orders by advanced criteria (from filter panel)
   */
  filterByAdvancedCriteria: function (orders) {
    const { filterRows } = this.data;

    // Get filter values
    const floorFilter = filterRows.find(r => r.id === 'floor')?.value;
    const ownerFilter = filterRows.find(r => r.id === 'owner')?.value;
    const categoryFilter = filterRows.find(r => r.id === 'category')?.value;
    const reporterFilter = filterRows.find(r => r.id === 'reporter')?.value;
    const priorityFilter = filterRows.find(r => r.id === 'priority')?.value;

    console.log('[Index] Advanced filter criteria:', { floorFilter, ownerFilter, categoryFilter, reporterFilter, priorityFilter });

    // 如果所有筛选条件都为空,直接返回原始数据
    if (!floorFilter && !ownerFilter && !categoryFilter && !reporterFilter && !priorityFilter) {
      return orders;
    }

    const filteredOrders = orders.filter(order => {
      // Floor filter
      if (floorFilter && order.floor !== floorFilter) {
        return false;
      }

      // Owner (responsible_party) filter
      if (ownerFilter && order.responsible_party !== ownerFilter) {
        return false;
      }

      // Category (fault_type_name) filter
      if (categoryFilter && order.fault_type_name !== categoryFilter) {
        return false;
      }

      // Reporter (submitter name) filter - exact match
      if (reporterFilter && order.submitter?.name !== reporterFilter) {
        return false;
      }

      // Priority filter
      if (priorityFilter) {
        const isEmergency = order.priority === 'Emergency';
        if (priorityFilter === '紧急' && !isEmergency) {
          return false;
        }
        if (priorityFilter === '普通' && isEmergency) {
          return false;
        }
      }

      return true;
    });

    console.log('[Index] After advanced filter:', filteredOrders.length, 'orders');
    return filteredOrders;
  },

  /**
   * Enrich order data with display properties
   */
  enrichOrderData: function (order) {
    const statusColorMap = {
      'Pending Repair': 'blue',
      'In Progress': 'orange',
      'Repaired': 'amber',
      'Needs Rework': 'red',
      'Completed': 'green'
    };

    // 根据角色显示不同的状态文本
    const { isMaintenanceWorker, isManager } = this.data;
    let statusTextMap;

    if (isManager) {
      // 行政经理视角的状态文本
      statusTextMap = {
        'Pending Repair': '已提报',
        'In Progress': '维修中',
        'Repaired': '已修复',
        'Pending Review': '待复核',
        'Needs Rework': '需返工',
        'Completed': '已完成'
      };
    } else if (isMaintenanceWorker) {
      // 维修员视角的状态文本
      statusTextMap = {
        'Pending Repair': '待接单',
        'In Progress': '维修中',
        'Repaired': '已修复',
        'Needs Rework': '需返工',
        'Completed': '已完成'
      };
    } else {
      // 办美员工视角的状态文本
      statusTextMap = {
        'Pending Repair': '已提报',
        'In Progress': '维修中',
        'Repaired': '待复核',
        'Needs Rework': '需返工',
        'Completed': '已完成'
      };
    }

    // 根据角色设置不同的状态样式类
    let statusClassMap;
    if (isManager || isMaintenanceWorker) {
      // 行政经理和维修员：Repaired 显示为"已修复"样式
      statusClassMap = {
        'Pending Repair': 'status-reported',
        'In Progress': 'status-maintenance',
        'Repaired': 'status-repaired',
        'Pending Review': 'status-review',
        'Needs Rework': 'status-rework',
        'Completed': 'status-completed'
      };
    } else {
      // 办美员工：Repaired 显示为"待复核"样式
      statusClassMap = {
        'Pending Repair': 'status-reported',
        'In Progress': 'status-maintenance',
        'Repaired': 'status-review',
        'Needs Rework': 'status-rework',
        'Completed': 'status-completed'
      };
    }

    // Format created_at time for display
    let formattedTime = '未知时间';
    if (order.created_at) {
      const createdAt = order.created_at.$date ? new Date(order.created_at.$date) : new Date(order.created_at);
      const year = createdAt.getFullYear();
      const month = String(createdAt.getMonth() + 1).padStart(2, '0');
      const day = String(createdAt.getDate()).padStart(2, '0');
      const hour = String(createdAt.getHours()).padStart(2, '0');
      const minute = String(createdAt.getMinutes()).padStart(2, '0');
      formattedTime = `${year}-${month}-${day}\u2003${hour}:${minute}`;
    }

    // 过滤照片路径：保留 http/https 和 cloud:// 开头的有效路径
    let validPhotos = [];
    if (order.photos && Array.isArray(order.photos)) {
      validPhotos = order.photos.filter(photo => {
        return photo && (photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('cloud://'));
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
   * Clear Search Text
   */
  clearSearch: function () {
    this.setData({
      searchText: ''
    });
    this.loadWorkOrders();
  },

  /**
   * Handle Scan QR Code
   */
  handleScan: function () {
    wx.scanCode({
      success: (res) => {
        console.log('[Index] Scan result:', res);
        // 扫描结果作为工单编号，直接跳转到工单详情
        const orderNumber = res.result;
        if (orderNumber) {
          // 根据工单编号查找工单ID并跳转
          this.navigateToOrderByNumber(orderNumber);
        }
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
   * Navigate to Order by Order Number
   * 根据工单编号查找并跳转到工单详情
   */
  navigateToOrderByNumber: async function (orderNumber) {
    try {
      wx.showLoading({ title: '查找工单...', mask: true });

      // 调用服务查找工单
      const result = await workOrderService.getWorkOrderByNumber(orderNumber);

      wx.hideLoading();

      if (result && result.order_id) {
        // 标记正在导航到子页面
        this.setData({ isNavigatingToSubPage: true });
        // 找到工单，跳转到详情页
        wx.navigateTo({
          url: `/pages/work-order-detail/index?id=${result.order_id}`
        });
      } else {
        wx.showToast({
          title: '未找到该工单',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[Index] Find order by number failed:', error);
      wx.showToast({
        title: '查找工单失败',
        icon: 'none'
      });
    }
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
    this.setData({
      filterRows: resetFilterRows,
      reporterInputValue: ''
    });
  },

  /**
   * 确定筛选
   */
  handleConfirm: function () {
    this.closeFilterPanel();
    this.loadWorkOrders();
  },

  /**
   * 筛选行点击处理
   */
  onFilterRowTap: function (e) {
    const id = e.detail.id;
    const row = this.data.filterRows.find(r => r.id === id);
    if (!row) return;

    console.log('[Index] Filter row tap:', id, 'floorOptions:', this.data.floorOptions, 'ownerOptions:', this.data.ownerOptions, 'categoryOptions:', this.data.categoryOptions, 'reporterOptions:', this.data.reporterOptions);

    // 所有筛选项都使用选择器
    let options = [];
    let title = row.label;

    switch (id) {
      case 'floor':
        options = this.data.floorOptions;
        break;
      case 'owner':
        options = this.data.ownerOptions;
        break;
      case 'category':
        options = this.data.categoryOptions;
        break;
      case 'reporter':
        options = this.data.reporterOptions;
        break;
      case 'priority':
        options = this.data.priorityOptions;
        break;
    }

    console.log('[Index] Picker options for', id, ':', options);

    if (options.length === 0) {
      wx.showToast({ title: '暂无可选项', icon: 'none' });
      return;
    }

    this.setData({
      isPickerOpen: true,
      pickerTitle: title,
      pickerOptions: options,
      pickerSelectedValue: row.value || '',
      currentPickerId: id
    });
  },

  /**
   * 选择器选项点击
   */
  onPickerOptionTap: function (e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ pickerSelectedValue: value });
  },

  /**
   * 关闭选择器弹窗
   */
  closePickerModal: function () {
    this.setData({ isPickerOpen: false });
  },

  /**
   * 确认选择器选择
   */
  confirmPickerSelection: function () {
    const { currentPickerId, pickerSelectedValue, filterRows } = this.data;
    const updatedRows = filterRows.map(row => {
      if (row.id === currentPickerId) {
        return { ...row, value: pickerSelectedValue };
      }
      return row;
    });
    this.setData({
      filterRows: updatedRows,
      isPickerOpen: false
    });
  },

  /**
   * 报修人输入变化
   */
  onReporterInput: function (e) {
    this.setData({ reporterInputValue: e.detail.value });
  },

  /**
   * 关闭报修人输入弹窗
   */
  closeReporterInput: function () {
    this.setData({ isReporterInputOpen: false });
  },

  /**
   * 确认报修人输入
   */
  confirmReporterInput: function () {
    const { reporterInputValue, filterRows } = this.data;
    const updatedRows = filterRows.map(row => {
      if (row.id === 'reporter') {
        return { ...row, value: reporterInputValue };
      }
      return row;
    });
    this.setData({
      filterRows: updatedRows,
      isReporterInputOpen: false
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
    const index = e.currentTarget.dataset.index;
    const totalButtons = this.data.statusButtons.length;

    // 根据按钮位置决定滚动目标
    // 如果点击的是前半部分的按钮，滚动到第一个按钮（向左滚动显示左侧）
    // 如果点击的是后半部分的按钮，滚动到最后一个按钮（向右滚动显示右侧）
    let scrollTarget = 'status-' + status;
    if (index <= totalButtons / 2 - 1) {
      // 点击左侧按钮，滚动到第一个
      scrollTarget = 'status-' + this.data.statusButtons[0].key;
    } else {
      // 点击右侧按钮，滚动到最后一个
      scrollTarget = 'status-' + this.data.statusButtons[totalButtons - 1].key;
    }

    this.setData({
      activeStatus: status,
      scrollIntoView: scrollTarget
    });

    // 切换状态后，工单列表滚动到顶部
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 200
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

    // 验证日期范围：开始日期不能大于结束日期
    const start = new Date(this.data.startDate);
    const end = new Date(this.data.endDate);
    if (start > end) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none',
        duration: 2000
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

    // 标记正在导航到子页面
    this.setData({ isNavigatingToSubPage: true });

    wx.navigateTo({
      url: `/pages/work-order-detail/index?id=${id}`
    });
  },

  /**
   * Navigate to New Order
   */
  navigateToNewOrder: function () {
    // 标记正在导航到子页面
    this.setData({ isNavigatingToSubPage: true });

    wx.navigateTo({
      url: '/pages/property/submit/index'
    });
  },

  /**
   * 维修员接单
   */
  handleAcceptOrder: function (e) {
    const order = e.currentTarget.dataset.order;
    if (!order || !order.order_id) {
      wx.showToast({ title: '工单信息无效', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认接单',
      content: `确认接单工单 ${order.order_number || order.order_id} 吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '接单中...', mask: true });

            await workOrderService.updateWorkOrderStatus(
              parseInt(order.order_id),
              'In Progress',
              '维修员接单开始维修'
            );

            wx.hideLoading();
            wx.showToast({
              title: '接单成功',
              icon: 'success',
              duration: 1500
            });

            // 刷新列表
            setTimeout(() => {
              this.loadWorkOrders();
            }, 500);

          } catch (error) {
            wx.hideLoading();
            console.error('[Index] Accept order error:', error);
            wx.showToast({
              title: error.message || '接单失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * Calculate status counts for all orders
   */
  calculateStatusCounts: function(orders) {
    const counts = {
      all: orders.length,
      'Pending Repair': 0,
      'In Progress': 0,
      'Repaired': 0,
      'Completed': 0,
      'Needs Rework': 0
    };

    orders.forEach(order => {
      if (counts[order.status] !== undefined) {
        counts[order.status]++;
      }
    });

    return counts;
  },

  /**
   * Update status button counts display
   */
  updateStatusButtonCounts: function(counts) {
    const statusButtons = this.data.statusButtons.map(btn => {
      let count = 0;
      if (btn.status === null) {
        // "全部" button
        count = counts.all;
      } else {
        count = counts[btn.status] || 0;
      }
      return { ...btn, count };
    });

    this.setData({ statusButtons });
  }
});
