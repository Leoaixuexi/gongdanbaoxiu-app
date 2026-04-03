/**
 * Index Page - Work Order List (Taro Design Style)
 * Main landing page with work order list
 */

const app = getApp();
const workOrderService = require('../../services/workOrder');
const auth = require('../../services/auth');
const dictionary = require('../../services/dictionary');
const userService = require('../../services/userService');
const { formatRelativeTime } = require('../../utils/formatter');
const { getStatusButtonsByRole, getFilterRowsByRole } = require('../../config/statusButtons');
const { getNavBarInfo } = require('../../utils/navigation');
const { filterByUserRole, filterByTimeRange, filterByStatus, filterByAdvancedCriteria } = require('./orderFilters');
const { enrichOrderData } = require('./orderEnricher');

Page({
  data: {
    workOrders: [],
    loading: true,
    preloadedIndex: 0, // 已预加载图片的工单索引
    searchText: '',
    activeTab: '', // '', today, week, month, date - 默认未选中
    activeStatus: '', // 默认为空，onShow 时设置
    isNavigatingToSubPage: false, // 标记是否导航到子页面
    isDatePickerOpen: false,
    // ===== 懒加载优化 =====
    allOrderIds: [],       // 全部工单ID（从后端获取）
    loadedCount: 0,        // 已加载详情的数量
    pageSize: 20,          // 每批加载数量
    hasMore: true,         // 是否还有更多
    isLoadingMore: false,  // 是否正在加载更多
    startDate: '',
    endDate: '',
    // van-calendar 日期范围（往前24个月，往后12个月）
    minDate: new Date(new Date().getFullYear() - 2, new Date().getMonth(), 1).getTime(),
    maxDate: new Date(new Date().getFullYear() + 1, new Date().getMonth() + 1, 0).getTime(),
    // 默认日期设为当前日期
    calendarDefaultDate: null,
    // 临时存储选择的日期范围
    tempStartDate: '',
    tempEndDate: '',
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
    pickerColumns: [],
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
    // 状态栏高度
    statusBarHeight: 0,
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
    scrollIntoView: '',
    // 触摸滑动相关
    touchStartX: 0,
    touchStartY: 0,
    // 防重复加载
    _isRefreshing: false,
    // 滚动位置相关
    scrollTop: 0,
    showBackToTop: false
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    // console.log('[Index] Page load');
    const { statusBarHeight } = getNavBarInfo();
    this.setData({
      statusBarHeight: Math.ceil(statusBarHeight)
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
        userService.getPropertyStaffList()
      ]);

      const reporters = staffResult.data || [];

      // console.log('[Index] Dictionaries loaded:', { floors, categories, parties, reporters });

      this.setData({
        floorOptions: floors.length > 0 ? floors : this.data.floorOptions,
        categoryOptions: categories.length > 0 ? categories : this.data.categoryOptions,
        ownerOptions: parties.length > 0 ? parties : this.data.ownerOptions,
        reporterOptions: reporters.length > 0 ? reporters : this.data.reporterOptions
      });
    } catch (error) {
      console.error('[Index] Load dictionaries error:', error);
      // 提示用户筛选选项加载失败
      wx.showToast({
        title: '筛选选项加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * Lifecycle - Page Unload
   * 清理定时器防止内存泄漏
   */
  onUnload: function () {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  },

  // 返回首页
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: async function () {
    // console.log('[Index] Page show');

    // 从子页面返回时不滚动到顶部，保持原位置
    if (!this.data.isNavigatingToSubPage) {
      wx.pageScrollTo({
        scrollTop: 0,
        duration: 0
      });
    }

    // 页面已从 TabBar 移除，不再设置 TabBar 状态

    // 判断是否从子页面返回
    const isBackFromSubPage = this.data.isNavigatingToSubPage;
    // console.log('[Index] isBackFromSubPage:', isBackFromSubPage);
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
        const statusButtons = getStatusButtonsByRole(isPropertyStaff, isMaintenanceWorker, isManager);

        // 根据角色配置筛选行
        const filterRows = getFilterRowsByRole(isManager, isMaintenanceWorker);

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

        // 构建数据对象，从子页面返回时不更新 statusButtons（保持原有计数）
        const dataToUpdate = {
          userRole: userInfo.role_id,
          userDepartment: userInfo.department,
          userId: userInfo.id,
          isPropertyStaff,
          isMaintenanceWorker,
          isManager,
          filterRows,
          // 首次加载或从 tab 切换回来时，重置为默认状态；否则保持用户选择的状态
          activeStatus: shouldResetToDefault ? defaultStatus : currentStatus,
          scrollIntoView: shouldResetToDefault ? ('status-' + defaultStatus) : ('status-' + currentStatus)
        };

        // 只在非返回场景时更新 statusButtons 和 activeTab
        if (!isBackFromSubPage) {
          dataToUpdate.statusButtons = statusButtons;
          dataToUpdate.activeTab = '';
        }

        this.setData(dataToUpdate);

        // console.log('[Index] User role:', {
        //   role_id: userInfo.role_id,
        //   department: userInfo.department,
        //   isPropertyStaff,
        //   isMaintenanceWorker,
        //   isManager
        // });
      }
    } catch (error) {
      console.error('[Index] Get user info error:', error);
    }

    // 从子页面返回时不刷新数据，保持原列表
    if (!isBackFromSubPage) {
      this.loadWorkOrders();
    }
  },

  /**
   * 根据角色获取状态按钮配置
   */
  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    // 非顶部时不刷新，直接停止下拉动画
    if (this.data.scrollTop > 10) {
      wx.stopPullDownRefresh();
      return;
    }
    if (this.data._isRefreshing) {
      wx.stopPullDownRefresh();
      return;
    }
    // console.log('[Index] Pull down refresh');
    this.setData({ _isRefreshing: true });
    this.loadWorkOrders().finally(() => {
      this.setData({ _isRefreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 滚动到底部时加载更多工单
   */
  onReachBottom: function () {
    // 先加载更多工单
    if (this.data.hasMore) {
      // console.log('[Index] Reach bottom, loading more orders');
      this.loadMoreOrders();
      return;
    }

    // 如果所有工单已加载，继续预加载图片
    const { workOrders, preloadedIndex } = this.data;
    if (preloadedIndex < workOrders.length) {
      // console.log('[Index] Reach bottom, loading more photos from index', preloadedIndex);
      this.preloadPhotoUrls(preloadedIndex, 5);
    }
  },

  /**
   * 页面滚动事件 - 记录滚动位置，控制回到顶部按钮显示
   */
  onPageScroll: function (e) {
    const scrollTop = e.scrollTop;
    const showBackToTop = scrollTop > 300;

    // 只在状态变化时更新，避免频繁 setData
    if (this.data.showBackToTop !== showBackToTop) {
      this.setData({ showBackToTop, scrollTop });
    } else if (Math.abs(this.data.scrollTop - scrollTop) > 50) {
      // 滚动距离较大时更新 scrollTop（用于下拉刷新判断）
      this.setData({ scrollTop });
    }
  },

  /**
   * 回到顶部
   */
  scrollToTop: function () {
    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
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
   * Load Work Orders - 两阶段懒加载优化
   * Stage 1: 快速获取统计数据，立即显示状态计数
   * Stage 2: 加载工单详情并应用筛选
   */
  loadWorkOrders: async function () {
    try {
      this.setData({ loading: true });

      // ===== Stage 1: 快速获取统计数据 =====
      // 并行获取统计和详情，但统计先返回可以立即更新UI
      const statsPromise = workOrderService.getOrderStatistics();
      const ordersPromise = workOrderService.getWorkOrders({});

      // 等待统计数据先返回，立即更新状态计数
      const stats = await statsPromise;
      // console.log('[Index] Stage 1 - Statistics received:', stats.total);

      // 从后端统计更新状态按钮计数（快速显示）
      this.updateStatusButtonCountsFromStats(stats.statistics);

      // ===== Stage 2: 加载工单详情 =====
      const allOrders = await ordersPromise;
      // console.log('[Index] Stage 2 - Orders received:', allOrders.length);

      const { isPropertyStaff, isMaintenanceWorker, isManager, userDepartment, userId,
              activeTab, startDate, endDate, filterRows } = this.data;

      // Filter by user role
      let filteredOrders = filterByUserRole(allOrders, { isPropertyStaff, isMaintenanceWorker, isManager, userDepartment, userId });

      // Filter by time range
      filteredOrders = filterByTimeRange(filteredOrders, { activeTab, startDate, endDate });

      // Filter by advanced criteria (from filter panel)
      filteredOrders = filterByAdvancedCriteria(filteredOrders, filterRows);

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

      // 计算状态计数（必须在搜索过滤之后、状态过滤之前）
      // 这样状态按钮的数量才能准确反映当前搜索结果
      const statusCounts = this.calculateStatusCounts(filteredOrders);
      this.updateStatusButtonCounts(statusCounts);

      // Filter by status (最后应用状态过滤，显示特定状态的工单)
      filteredOrders = filterByStatus(filteredOrders, { activeStatus: this.data.activeStatus, statusButtons: this.data.statusButtons });

      // Add display properties
      filteredOrders = filteredOrders.map(order => enrichOrderData(order, { isMaintenanceWorker, isManager }));

      // Sort by created_at descending (newest first)
      filteredOrders.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      // ===== 渐进式渲染：先显示前20条 =====
      const pageSize = this.data.pageSize;
      const firstBatch = filteredOrders.slice(0, pageSize);

      // 保存全部筛选后的工单ID用于后续加载
      this._allFilteredOrders = filteredOrders;

      this.setData({
        workOrders: firstBatch,
        loading: false,
        loadedCount: firstBatch.length,
        hasMore: filteredOrders.length > pageSize,
        preloadedIndex: 0
      });

      // 预加载所有已加载工单的图片（异步执行，不阻塞列表显示）
      this.preloadPhotoUrls(0, firstBatch.length);

      // console.log('[Index] Work orders loaded:', firstBatch.length, '/', filteredOrders.length);

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
   * 加载更多工单（触底加载）
   */
  loadMoreOrders: function () {
    const { loadedCount, pageSize, hasMore, isLoadingMore } = this.data;

    if (!hasMore || isLoadingMore) return;
    if (!this._allFilteredOrders) return;

    this.setData({ isLoadingMore: true });

    const nextBatch = this._allFilteredOrders.slice(loadedCount, loadedCount + pageSize);

    if (nextBatch.length > 0) {
      const newWorkOrders = [...this.data.workOrders, ...nextBatch];
      const newLoadedCount = loadedCount + nextBatch.length;

      this.setData({
        workOrders: newWorkOrders,
        loadedCount: newLoadedCount,
        hasMore: newLoadedCount < this._allFilteredOrders.length,
        isLoadingMore: false
      });

      // 继续预加载新加载工单的图片
      this.preloadPhotoUrls(loadedCount, nextBatch.length);

      // console.log('[Index] Loaded more orders:', newLoadedCount, '/', this._allFilteredOrders.length);
    } else {
      this.setData({
        hasMore: false,
        isLoadingMore: false
      });
    }
  },

  /**
   * 从后端统计数据快速更新状态按钮计数
   */
  updateStatusButtonCountsFromStats: function (statistics) {
    if (!statistics) return;

    const counts = {
      all: 0,
      'Pending Repair': statistics['Pending Repair'] || 0,
      'In Progress': statistics['In Progress'] || 0,
      'Repaired': statistics['Repaired'] || 0,
      'Completed': statistics['Completed'] || 0,
      'Needs Rework': statistics['Needs Rework'] || 0
    };

    // 计算总数
    counts.all = counts['Pending Repair'] + counts['In Progress'] +
                 counts['Repaired'] + counts['Completed'] + counts['Needs Rework'];

    this.updateStatusButtonCounts(counts);
  },

  /**
   * Filter orders by user role
   * 行政经理：可见所有工单（包括已完成）
   * 办美员工：共享可见所有工单，但"已完成"状态只能看自己提交的
   * 维修员：只看责任方=自己部门的工单
   */


  /**
   * 预加载图片临时 URL（分批加载）
   * @param {number} startIndex - 开始索引
   * @param {number} count - 预加载数量
   */
  preloadPhotoUrls: async function (startIndex = 0, count = 5) {
    try {
      const orders = this.data.workOrders;
      if (!orders || orders.length === 0) return;

      // 只处理指定范围内的工单
      const endIndex = Math.min(startIndex + count, orders.length);
      const ordersToLoad = orders.slice(startIndex, endIndex);

      // 收集需要转换的 cloud:// 图片
      const cloudFileIds = [];
      const fileIdToOrderMap = {};

      ordersToLoad.forEach((order, idx) => {
        const orderIndex = startIndex + idx;
        if (order.photos && order.photos.length > 0) {
          order.photos.forEach((photo, photoIndex) => {
            // 只处理未转换的 cloud:// 链接
            if (photo && photo.startsWith('cloud://')) {
              cloudFileIds.push(photo);
              fileIdToOrderMap[photo] = { orderIndex, photoIndex };
            }
          });
        }
      });

      if (cloudFileIds.length === 0) {
        // 没有需要转换的图片，但仍更新预加载索引
        this.setData({ preloadedIndex: endIndex });
        return;
      }

      // console.log('[Index] Preloading photos for orders', startIndex, '-', endIndex - 1, ':', cloudFileIds.length, 'photos');

      // 批量获取临时 URL（添加10秒超时）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 10000);
      });

      let result;
      try {
        result = await Promise.race([
          wx.cloud.getTempFileURL({ fileList: cloudFileIds }),
          timeoutPromise
        ]);
      } catch (err) {
        // 超时或请求失败，标记所有照片为错误状态
        console.error('[Index] getTempFileURL failed:', err);
        const errorUpdates = {};
        Object.keys(fileIdToOrderMap).forEach(fileId => {
          const mapping = fileIdToOrderMap[fileId];
          errorUpdates[`workOrders[${mapping.orderIndex}].photoError[${mapping.photoIndex}]`] = true;
        });
        this.setData(errorUpdates);
        this.setData({ preloadedIndex: endIndex });
        return;
      }

      if (result.fileList && result.fileList.length > 0) {
        const updates = {};
        const errorUpdates = {};
        const timestamp = Date.now(); // 添加时间戳，强制重新加载图片
        result.fileList.forEach(item => {
          const mapping = fileIdToOrderMap[item.fileID];
          if (!mapping) return;

          // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
          if (item.tempFileURL && item.status == 0) {
            const key = `workOrders[${mapping.orderIndex}].photos[${mapping.photoIndex}]`;
            // 添加时间戳参数，避免缓存导致加载失败后无法恢复
            updates[key] = item.tempFileURL + '?t=' + timestamp;
          } else {
            // 转换失败，标记为错误状态
            errorUpdates[`workOrders[${mapping.orderIndex}].photoError[${mapping.photoIndex}]`] = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          this.setData(updates);
          // console.log('[Index] Preloaded', Object.keys(updates).length, 'photo URLs');
        }
        if (Object.keys(errorUpdates).length > 0) {
          this.setData(errorUpdates);
        }
      }

      // 记录已预加载到的索引
      this.setData({ preloadedIndex: endIndex });
    } catch (error) {
      console.error('[Index] Preload photo URLs error:', error);
    }
  },

  // 批量更新机制 - 用于合并图片加载的setData调用
  _pendingPhotoUpdates: {},
  _photoUpdateTimer: null,

  /**
   * 调度批量更新（50ms防抖窗口）
   */
  _schedulePhotoUpdate: function () {
    if (this._photoUpdateTimer) return;
    this._photoUpdateTimer = setTimeout(() => {
      if (Object.keys(this._pendingPhotoUpdates).length > 0) {
        this.setData(this._pendingPhotoUpdates);
        this._pendingPhotoUpdates = {};
      }
      this._photoUpdateTimer = null;
    }, 50);
  },

  /**
   * 图片加载成功
   */
  onPhotoLoad: function (e) {
    const { orderIndex, photoIndex } = e.currentTarget.dataset;
    const key = `workOrders[${orderIndex}].photoLoaded[${photoIndex}]`;
    this._pendingPhotoUpdates[key] = true;
    this._schedulePhotoUpdate();
  },

  /**
   * 图片加载失败
   */
  onPhotoError: function (e) {
    const { orderIndex, photoIndex } = e.currentTarget.dataset;
    this._pendingPhotoUpdates[`workOrders[${orderIndex}].photoLoaded[${photoIndex}]`] = true;
    this._pendingPhotoUpdates[`workOrders[${orderIndex}].photoError[${photoIndex}]`] = true;
    this._schedulePhotoUpdate();
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

    // console.log('[Index] Filter row tap:', id, 'floorOptions:', this.data.floorOptions, 'ownerOptions:', this.data.ownerOptions, 'categoryOptions:', this.data.categoryOptions, 'reporterOptions:', this.data.reporterOptions);

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

    // console.log('[Index] Picker options for', id, ':', options);

    if (options.length === 0) {
      wx.showToast({ title: '暂无可选项', icon: 'none' });
      return;
    }

    this.setData({
      isPickerOpen: true,
      pickerColumns: options,
      pickerSelectedValue: row.value || '',
      currentPickerId: id
    });
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
  confirmPickerSelection: function (e) {
    const { currentPickerId, filterRows } = this.data;
    // custom-picker 组件返回 detail: { value: '选中的值', index: 选中的索引 }
    const selectedValue = e.detail.value;

    const updatedRows = filterRows.map(row => {
      if (row.id === currentPickerId) {
        return { ...row, value: selectedValue };
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
      const now = new Date().getTime();
      this.setData({
        isDatePickerOpen: true,
        calendarDefaultDate: [now, now],
        tempStartDate: '',
        tempEndDate: ''
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
   * 触摸开始 - 记录起始位置
   */
  onTouchStart: function (e) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY
    });
  },

  /**
   * 触摸结束 - 判断滑动方向并切换状态
   */
  onTouchEnd: function (e) {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - this.data.touchStartX;
    const deltaY = touchEndY - this.data.touchStartY;

    // 只有水平滑动距离 > 50px 且 水平距离 > 垂直距离 才触发切换
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      const statusButtons = this.data.statusButtons;
      const currentIndex = statusButtons.findIndex(btn => btn.key === this.data.activeStatus);

      if (deltaX < 0) {
        // 向左滑动 -> 切换到下一个状态
        if (currentIndex < statusButtons.length - 1) {
          this.switchToStatusByIndex(currentIndex + 1);
        }
      } else {
        // 向右滑动 -> 切换到上一个状态
        if (currentIndex > 0) {
          this.switchToStatusByIndex(currentIndex - 1);
        }
      }
    }
  },

  /**
   * 根据索引切换状态
   */
  switchToStatusByIndex: function (index) {
    const statusButtons = this.data.statusButtons;
    const targetStatus = statusButtons[index].key;
    const totalButtons = statusButtons.length;

    // 根据按钮位置决定滚动目标
    let scrollTarget = 'status-' + targetStatus;
    if (index <= totalButtons / 2 - 1) {
      scrollTarget = 'status-' + statusButtons[0].key;
    } else {
      scrollTarget = 'status-' + statusButtons[totalButtons - 1].key;
    }

    this.setData({
      activeStatus: targetStatus,
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
      isDatePickerOpen: false,
      tempStartDate: '',
      tempEndDate: ''
    });
  },

  onStartDateChange: function (e) {
    this.setData({
      tempStartDate: e.detail.value
    });
  },

  onEndDateChange: function (e) {
    this.setData({
      tempEndDate: e.detail.value
    });
  },

  confirmDatePicker: function () {
    if (!this.data.tempStartDate || !this.data.tempEndDate) {
      wx.showToast({
        title: '请选择完整日期范围',
        icon: 'none'
      });
      return;
    }

    // 验证日期
    if (new Date(this.data.tempStartDate) > new Date(this.data.tempEndDate)) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      });
      return;
    }

    this.setData({
      startDate: this.data.tempStartDate,
      endDate: this.data.tempEndDate,
      isDatePickerOpen: false,
      tempStartDate: '',
      tempEndDate: ''
    });

    this.loadWorkOrders();
  },

  /**
   * Navigate to Detail
   */
  navigateToDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    // console.log('[Index] Navigate to detail, order_id:', id);

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
   * 导出工单到Excel（仅行政经理可用）
   */
  handleExport: async function () {
    // 权限检查
    if (!this.data.isManager) {
      wx.showToast({ title: '无权限导出', icon: 'none' });
      return;
    }

    // 根据 activeStatus 的 key 找到对应的数据库状态值
    let dbStatus = null;
    if (this.data.activeStatus && this.data.activeStatus !== 'all') {
      const statusButton = this.data.statusButtons.find(btn => btn.key === this.data.activeStatus);
      if (statusButton) {
        dbStatus = statusButton.status;
      }
    }

    // 收集当前筛选条件
    const filters = {
      status: dbStatus,
      timeRange: {
        type: this.data.activeTab || '',
        startDate: this.data.startDate || '',
        endDate: this.data.endDate || ''
      },
      advancedFilters: {}
    };

    // 提取高级筛选条件
    this.data.filterRows.forEach(row => {
      if (row.value) {
        filters.advancedFilters[row.id] = row.value;
      }
    });

    // console.log('[Index] Export with filters:', filters);

    try {
      // 调用导出服务
      const result = await workOrderService.exportWorkOrders(filters);
      // console.log('[Index] Export result:', result);

      // 下载并打开文件
      await workOrderService.downloadAndOpenFile(result.downloadUrl, result.fileName);

      wx.showToast({
        title: `导出成功(${result.totalCount}条)`,
        icon: 'success'
      });
    } catch (error) {
      console.error('[Index] Export error:', error);
      // 针对无数据的情况给出更友好的提示
      const msg = error.message || '导出失败';
      if (msg.includes('没有符合条件')) {
        wx.showToast({ title: '当前筛选条件下无工单', icon: 'none', duration: 2000 });
      } else {
        wx.showToast({ title: msg, icon: 'none' });
      }
    }
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
