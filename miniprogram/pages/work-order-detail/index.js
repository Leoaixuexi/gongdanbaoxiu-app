/**
 * Work Order Detail Page - T077 + T090-T094 (Cloud Database Version)
 * Detailed view of single work order with repair actions
 */

const app = getApp();
const workOrderService = require('../../services/workOrder');
const materialService = require('../../services/materialService');
const auth = require('../../services/auth');
const { ROLES, PRIORITY_DISPLAY_NAMES, MAX_CONCURRENT_ORDERS_PER_TECHNICIAN } = require('../../utils/constants');
const { formatDateTime, formatRelativeTime, formatSLATimeRemaining, getSLAColorClass } = require('../../utils/formatter');
const { getButtonConfig, STATUS_TEXT_MAP, STEPPER_CONFIG } = require('../../config/workOrderButtons');
const { getNavBarInfo } = require('../../utils/navigation');

/**
 * 解析时间字段，返回时间戳
 */
function parseTimeField(timeValue) {
  if (!timeValue) return null;

  if (timeValue.$date) {
    return new Date(timeValue.$date).getTime();
  }
  if (typeof timeValue === 'string') {
    return new Date(timeValue).getTime();
  }
  if (typeof timeValue === 'number') {
    return timeValue;
  }
  if (timeValue instanceof Date) {
    return timeValue.getTime();
  }
  return null;
}

/**
 * 获取工单创建时间
 */
function getOrderStartTime(order) {
  // 优先使用 created_at 字段
  if (order.created_at) {
    const time = parseTimeField(order.created_at);
    if (time) return time;
  }

  // 从 status_history 获取
  if (order.status_history && Array.isArray(order.status_history) && order.status_history.length > 0) {
    const firstHistory = order.status_history.find(h => h.notes && h.notes.includes('工单创建'))
      || order.status_history[0];

    if (firstHistory && firstHistory.changed_at) {
      const time = parseTimeField(firstHistory.changed_at);
      if (time) return time;
    }
  }

  console.warn('[Detail] No created_at or status_history found, using current time');
  return Date.now();
}

/**
 * 获取工单完成时间
 */
function getOrderEndTime(order) {
  if (order.status !== 'Completed') return null;
  if (!order.status_history || !Array.isArray(order.status_history)) return null;

  const completedRecord = order.status_history.find(h => h.to_status === 'Completed');
  if (completedRecord && completedRecord.changed_at) {
    return parseTimeField(completedRecord.changed_at);
  }
  return null;
}

Page({
  data: {
    workOrder: null,
    loading: true,
    orderId: null,
    priorityDisplay: '',
    createdTime: '',
    reportTime: '',
    reportDate: '',
    reportTimeOnly: '',
    assignedTime: '',
    // Tab state
    activeTab: 'info',
    // Timeline data for service tab
    timelineData: [],
    // Status text mapping (6 steps)
    statusTextMap: {
      'Pending Repair': '已提报',
      'Pending Assignment': '待接单',
      'In Progress': '维修中',
      'Repaired': '待复核',
      'Under Review': '待复核',
      'Completed': '已完成',
      'Needs Rework': '需返工'
    },
    // Status color mapping (matches work order list filter button colors)
    statusColorMap: {
      '已提报': '#2563eb',
      '待接单': '#ea580c',
      '维修中': '#0891b2',
      '待复核': '#7c3aed',
      '待复核': '#dc2626',
      '已完成': '#059669',
      '需返工': '#334155'
    },
    // Status CSS class mapping (matches work order list card styles)
    statusClassMap: {
      '已提报': 'status-reported',
      '待接单': 'status-reported',
      '维修中': 'status-maintenance',
      '待复核': 'status-review',
      '待复核': 'status-review',
      '已完成': 'status-completed',
      '需返工': 'status-rework'
    },
    // Stepper data for work-order-stepper component
    stepperData: null,
    // Work order duration
    workOrderDuration: '',
    durationTimerInterval: null,
    // T175 - Enhanced SLA Display
    slaDisplay: '',
    slaColorClass: '',
    slaPercentageUsed: 0,
    slaProgressWidth: '0%',
    slaWarningMessage: '',
    slaTimerInterval: null,
    isPropertyStaff: false,
    isMaintenanceWorker: false,
    isPropertyManager: false,
    isSubmitter: false,
    canEdit: false,
    canStart: false,
    canUpdate: false,
    canReview: false, // T106
    canAcceptOrder: false, // 维修员接单权限
    // 新增按钮权限变量
    showThreeDots: false, // 显示三个点按钮
    showEditBtn: false, // 显示修改按钮
    showAcceptBtn: false, // 显示接单按钮
    showConfirmRepairBtn: false, // 显示确认修复按钮
    showUrgeRepairBtn: false, // 显示催维修按钮
    showUrgeReviewBtn: false, // 显示催复核按钮
    showReviewedBtn: false, // 显示已复核按钮
    // 三个点菜单内容
    showDeleteInMenu: false, // 菜单显示删除
    showNeedsReworkInMenu: false, // 菜单显示需重修
    showEmptyMenu: false, // 菜单显示空白卡片
    showUrgeAcceptInMenu: false, // 菜单显示催接单
    showTransferToChargeBtn: false, // 显示「转收费工单」按钮
    // Repair completion form - T091-T092
    showRepairForm: false,
    completionNotes: '',
    submittingRepair: false,

    // 配件选择
    selectedParts: [],        // [{material_id, material_name, unit, quantity, stock}]
    showPartsPicker: false,
    partsSearchKey: '',
    availableParts: [],       // 从云端加载的配件列表
    filteredParts: [],        // 经 partsSearchKey 过滤后的可选列表
    partsLoading: false,
    // Review form - T107
    showReviewForm: false,
    reviewDecision: '',
    reviewNotes: '',
    submittingReview: false,
    headerHeight: 0,
    // More actions popup
    showMoreActions: false,
    showStatusPicker: false,
    selectedStatus: '',
    availableStatuses: [
      { value: 'Pending Repair', label: '已提报', color: '#6B7280' },
      { value: 'In Progress', label: '维修中', color: '#3B82F6' },
      { value: 'Repaired', label: '待复核', color: '#10B981' },
      { value: 'Completed', label: '已完成', color: '#059669' },
      { value: 'Needs Rework', label: '需返工', color: '#EF4444' }
    ],
    // 防重复刷新
    _isRefreshing: false,
    // 只读模式（未登录用户通过分享链接访问）
    isReadOnlyMode: false
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    // console.log('[Detail] Page load with options:', options);
    // 计算自定义导航栏高度
    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight)
    });

    // 加载工单
    if (options.id) {
      this.setData({ orderId: options.id });
      this.loadWorkOrder();
    } else {
      app.showError('工单ID无效');
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: function () {
    // console.log('[Detail] Page show');
  },

  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    if (this.data._isRefreshing) {
      wx.stopPullDownRefresh();
      return;
    }
    // console.log('[Detail] Pull down refresh');
    this.setData({ _isRefreshing: true });
    this.loadWorkOrder().finally(() => {
      this.setData({ _isRefreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  /**
   * Share functionality - 微信原生分享
   */
  onShareAppMessage: function () {
    // 分享后关闭弹窗
    this.setData({ showMoreActions: false });

    const workOrder = this.data.workOrder;
    const floor = workOrder.floor || '';
    const location = workOrder.location || '';
    const description = workOrder.description || '工单详情';
    // 微信分享标题限制32字符，需要截断
    const title = `${floor}-${location}-${description}`.substring(0, 32);
    
    return {
      title: title,
      path: `/pages/work-order-detail/index?id=${workOrder.order_id}`,
      imageUrl: workOrder.photos && workOrder.photos.length > 0 ? workOrder.photos[0] : ''
    };
  },

  /**
   * Load Work Order from Cloud Database
   */
  loadWorkOrder: async function () {
    try {
      this.setData({ loading: true });

      // 检查登录状态
      const isLoggedIn = await auth.isAuthenticated();

      let workOrder;

      if (isLoggedIn) {
        // 已登录：使用原有接口
        workOrder = await workOrderService.getWorkOrderById(this.data.orderId);
      } else {
        // 未登录：使用公开只读接口
        const result = await workOrderService.getWorkOrderByIdPublic(this.data.orderId);
        workOrder = result.order;
      }

      if (!workOrder) {
        throw new Error('Work order not found');
      }

      // Process work order data
      const processedOrder = this.processWorkOrder(workOrder);

      // 未登录用户：设置只读模式，隐藏所有操作按钮
      if (!isLoggedIn) {
        this.setData({
          workOrder: processedOrder,
          loading: false,
          isReadOnlyMode: true,
          showActions: false,
          showThreeDots: false,
          showEditBtn: false,
          showAcceptBtn: false,
          showConfirmRepairBtn: false,
          showUrgeRepairBtn: false,
          showUrgeReviewBtn: false,
          showReviewedBtn: false,
          showDeleteInMenu: false,
          showNeedsReworkInMenu: false,
          showEmptyMenu: false,
          showUrgeAcceptInMenu: false,
        });
        this.startDurationTimer();
        return;
      }

      // 已登录用户：原有权限逻辑
      const userInfo = await auth.getCurrentUser();

      // Determine user permissions
      // 行政经理和办美员工享有相同的按钮权限
      const isPropertyStaff = userInfo.role_id === ROLES.PROPERTY_STAFF || userInfo.role_id === ROLES.PROPERTY_MANAGER;
      const isMaintenanceWorker = userInfo.role_id === ROLES.MAINTENANCE_STAFF;

      // Determine action buttons visibility with null checks
      const isPropertyManager = userInfo.role_id === ROLES.PROPERTY_MANAGER;
      const isAdmin = userInfo.role_id === ROLES.ADMIN;

      // 修改按钮：只在已提交状态显示
      // 行政经理可操作所有工单，办美员工可操作所有工单（等同提交人权限）
      // 注意：userInfo.id 和 submitter.user_id 需要统一比较
      const currentUserId = userInfo.id || userInfo.user_id;
      const submitterUserId = workOrder.submitter?.user_id;
      const isSubmitter = currentUserId && submitterUserId && currentUserId === submitterUserId;

      // 办美员工拥有等同提交人的权限（可操作所有工单，包括经理提交的）
      const hasSubmitterPermission = isSubmitter || (userInfo.role_id === ROLES.PROPERTY_STAFF);

      // 编辑权限：管理员任意状态可编辑；经理/办美员工仅"已提报"
      const canEdit = isAdmin ||
        ((isPropertyManager || userInfo.role_id === ROLES.PROPERTY_STAFF) &&
          processedOrder.status === 'Pending Repair');

      // 判断维修员是否有权限操作该工单 - 使用部门匹配（新权限模型）
      const userDepartment = userInfo.department;
      const isTechnicianWithAccess = isMaintenanceWorker &&
        userDepartment && processedOrder.responsible_party &&
        userDepartment === processedOrder.responsible_party;

      // 保留旧变量名以兼容后续代码
      const isAssignedTechnician = isTechnicianWithAccess;

      // console.log('[Detail] Technician check:', {
      //   currentUserId,
      //   userDepartment,
      //   responsibleParty: processedOrder.responsible_party,
      //   isMaintenanceWorker,
      //   isAssignedTechnician
      // });

      // 接单/开始返工：维修员 && 分配给自己 && (待维修/需返工)
      const canAcceptOrder = isMaintenanceWorker &&
        isAssignedTechnician &&
        (processedOrder.status === 'Pending Repair' || processedOrder.status === 'Needs Rework');

      // 完成维修：维修员 && 分配给自己 && 维修中
      const canUpdate = isMaintenanceWorker &&
        isAssignedTechnician &&
        processedOrder.status === 'In Progress';

      // 验收：管理员和办美员工可验收所有工单（行政经理已不再具备验收权限）
      const canReview = (isAdmin || userInfo.role_id === ROLES.PROPERTY_STAFF) &&
        processedOrder.status === 'Repaired';

      // 统一显示：所有状态特定按钮都不显示
      const canStart = false;
      // canUpdate / canReview are computed above

      // 使用配置表获取按钮显示状态
      const status = processedOrder.status;
      const buttonConfig = getButtonConfig(status, {
        isAdmin,
        isPropertyManager,
        isPropertyStaff,
        isSubmitter: hasSubmitterPermission,  // 办美员工视为拥有提交人权限
        isAssignedTechnician
      });

      // 转收费工单按钮：经理/办美员工 + 已提报(待维修)状态
      const showTransferToChargeBtn = (isPropertyManager || isPropertyStaff) &&
        processedOrder.status === 'Pending Repair';

      // 从配置中提取按钮状态，showEditBtn 需要结合 canEdit
      // 若可转单则强制显示三点按钮，作为入口
      const showThreeDots = (buttonConfig.showThreeDots || false) || showTransferToChargeBtn;
      const showEditBtn = buttonConfig.showEditBtn ? canEdit : false;
      const showAcceptBtn = buttonConfig.showAcceptBtn || false;
      const showConfirmRepairBtn = buttonConfig.showConfirmRepairBtn || false;
      const showUrgeRepairBtn = buttonConfig.showUrgeRepairBtn || false;
      const showUrgeReviewBtn = buttonConfig.showUrgeReviewBtn || false;
      const showReviewedBtn = buttonConfig.showReviewedBtn || false;
      const showDeleteInMenu = buttonConfig.showDeleteInMenu || false;
      const showNeedsReworkInMenu = buttonConfig.showNeedsReworkInMenu || false;
      const showEmptyMenu = buttonConfig.showEmptyMenu || false;
      const showUrgeAcceptInMenu = buttonConfig.showUrgeAcceptInMenu || false;

      const showActions = showThreeDots || showEditBtn || showAcceptBtn || showConfirmRepairBtn ||
        showUrgeRepairBtn || showUrgeReviewBtn || showReviewedBtn;

      this.setData({
        workOrder: processedOrder,
        loading: false,
        isPropertyStaff,
        isMaintenanceWorker,
        isPropertyManager,
        isSubmitter,
        canEdit,
        canStart,
        canUpdate,
        canReview,
        canAcceptOrder,
        showActions,
        // 新增按钮权限
        showThreeDots,
        showEditBtn,
        showAcceptBtn,
        showConfirmRepairBtn,
        showUrgeRepairBtn,
        showUrgeReviewBtn,
        showReviewedBtn,
        showDeleteInMenu,
        showNeedsReworkInMenu,
        showEmptyMenu,
        showUrgeAcceptInMenu,
        showTransferToChargeBtn,
      });

      // Start work order duration timer after data is set
      this.startDurationTimer();

      // console.log('[Detail] Work order loaded successfully');

    } catch (error) {
      console.error('[Detail] Load work order error:', error);
      console.error('[Detail] Error details:', error.message, error.stack);
      this.setData({
        loading: false,
        workOrder: null
      });
      wx.showModal({
        title: '加载失败',
        content: `加载工单失败: ${error.message || '未知错误'}`,
        showCancel: false
      });
    }
  },

  /**
   * Process Work Order
   * Add display fields for UI
   */
  processWorkOrder: function (order) {
    // Ensure photos field exists
    if (!order.photos && order.photos_json) {
      order.photos = order.photos_json;
    }
    if (!order.photos) {
      order.photos = [];
    }

    // 收集所有需要更新的数据
    const dataToUpdate = {};

    // 初始化照片加载状态
    const photoLoaded = {};
    const photoError = {};
    order.photos.forEach((_, idx) => {
      photoLoaded[idx] = false;
      photoError[idx] = false;
    });
    dataToUpdate.photoLoaded = photoLoaded;
    dataToUpdate.photoError = photoError;

    // 预加载图片临时URL
    this.preloadPhotoUrls(order.photos);

    // 处理基础显示字段
    dataToUpdate.priorityDisplay = PRIORITY_DISPLAY_NAMES[order.priority] || order.priority;
    dataToUpdate.createdTime = formatDateTime(order.created_at);

    // 处理报修时间
    if (order.report_time) {
      const reportDate = new Date(order.report_time);
      dataToUpdate.reportTime = formatDateTime(order.report_time);
      dataToUpdate.reportDate = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(reportDate.getDate()).padStart(2, '0')}`;
      dataToUpdate.reportTimeOnly = `${String(reportDate.getHours()).padStart(2, '0')}:${String(reportDate.getMinutes()).padStart(2, '0')}`;
    }

    // 处理分配时间
    if (order.assigned_at) {
      dataToUpdate.assignedTime = formatDateTime(order.assigned_at);
    }

    // 处理 SLA 显示
    if (order.time_remaining !== undefined && order.time_remaining !== null) {
      this.updateSLADisplay(order);
      this.startSLATimer();
    }

    // 处理状态历史和时间线数据
    dataToUpdate.timelineData = this.processStatusHistory(order);

    // 处理步骤数据
    dataToUpdate.stepperData = {
      steps: STEPPER_CONFIG.steps,
      currentStep: STEPPER_CONFIG.statusStepMap[order.status] || 0,
      startTime: getOrderStartTime(order),
      endTime: getOrderEndTime(order)
    };

    // 统一 setData
    this.setData(dataToUpdate);

    return order;
  },

  /**
   * 处理状态历史，生成时间线数据
   */
  processStatusHistory: function (order) {
    if (!order.status_history || !Array.isArray(order.status_history)) {
      return [];
    }

    // 添加显示字段
    order.status_history = order.status_history.map(item => ({
      ...item,
      time_display: formatDateTime(item.changed_at),
      to_status_text: STATUS_TEXT_MAP[item.to_status] || item.to_status
    }));

    // 转换为时间线数据格式
    return order.status_history.map((item, index) => {
      const description = item.notes === '工单创建' ? '' : (item.notes || '');
      const statusText = item.to_status_text || item.to_status;

      return {
        id: String(index + 1),
        title: statusText,
        titleColor: this.data.statusColorMap[statusText] || '#374151',
        statusClass: this.data.statusClassMap[statusText] || '',
        description: description,
        timestamp: item.time_display || formatDateTime(item.changed_at),
        user: item.changed_by ? {
          name: item.changed_by.name || '系统',
          avatar: item.changed_by.avatar || ''
        } : null
      };
    });
  },

  /**
   * Preview Photo
   */
  previewPhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.workOrder.photos;

    wx.previewImage({
      urls: photos,
      current: photos[index]
    });
  },

  /**
   * 图片加载成功
   */
  onPhotoLoad: function (e) {
    const index = e.currentTarget.dataset.index;
    const key = `photoLoaded[${index}]`;
    this.setData({
      [key]: true
    });
  },

  /**
   * 图片加载失败
   */
  onPhotoError: function (e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      [`photoLoaded[${index}]`]: true,
      [`photoError[${index}]`]: true
    });
  },

  /**
   * 预加载图片临时URL
   */
  preloadPhotoUrls: async function (photos) {
    if (!photos || photos.length === 0) return;

    // 未登录用户（只读模式）跳过前端转换，云函数已处理
    if (this.data.isReadOnlyMode) return;

    try {
      // 收集所有 cloud:// 开头的图片 FileID
      const cloudFileIds = photos.filter(photo => photo && photo.startsWith('cloud://'));

      if (cloudFileIds.length === 0) return;

      // console.log('[Detail] Preloading', cloudFileIds.length, 'cloud photos');

      // 批量获取临时 URL
      const result = await wx.cloud.getTempFileURL({
        fileList: cloudFileIds
      });

      if (result.fileList && result.fileList.length > 0) {
        // 创建 fileID 到临时 URL 的映射
        const urlMap = {};
        const timestamp = Date.now(); // 添加时间戳，强制重新加载图片
        result.fileList.forEach(item => {
          // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
          if (item.tempFileURL && item.status == 0) {
            // 添加时间戳参数，避免缓存导致加载失败后无法恢复
            urlMap[item.fileID] = item.tempFileURL + '?t=' + timestamp;
          }
        });

        // 更新工单数据中的图片 URL
        const workOrder = this.data.workOrder;
        if (workOrder && workOrder.photos) {
          const newPhotos = workOrder.photos.map(photo => urlMap[photo] || photo);
          this.setData({
            'workOrder.photos': newPhotos
          });
          // console.log('[Detail] Preloaded photo URLs');
        }
      }
    } catch (error) {
      console.error('[Detail] Preload photo URLs error:', error);
    }
  },

  stopPropagation: function () {
    // Prevent overlay click handlers from firing.
  },

  /**
   * Handle Edit - 跳转到独立编辑页面
   */
  handleEdit: function () {
    wx.navigateTo({
      url: `/pages/work-order-edit/index?id=${this.data.orderId}`
    });
  },

  /**
   * 转收费工单 - 把当前工单加入收费工单 store 并跳转
   */
  handleTransferToCharge: function () {
    const wo = this.data.workOrder;
    if (!wo) return;
    this.setData({ showMoreActions: false });
    const store = require('../charge-order/store');
    const added = store.addFromWorkOrder(wo);
    const id = added.id;
    wx.showToast({ title: '已转为收费工单', icon: 'success' });
    setTimeout(() => {
      wx.navigateTo({ url: `/pages/charge-order/detail?id=${id}` });
    }, 500);
  },

  /**
   * Handle More - 显示更多操作菜单
   */
  handleMore: function () {
    this.setData({ showMoreActions: true });
  },

  /**
   * Close More Actions Popup
   */
  closeMoreActions: function () {
    this.setData({ showMoreActions: false });
  },

  /**
   * Handle Delete - 删除工单
   */
  handleDelete: function () {
    this.setData({ showMoreActions: false });
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此工单吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#FF3B30',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...', mask: true });
            await workOrderService.deleteWorkOrder(parseInt(this.data.orderId));
            wx.hideLoading();
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1500
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error) {
            wx.hideLoading();
            console.error('[Detail] Delete error:', error);
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * Handle Toggle Status - 显示状态选择器
   */
  handleToggleStatus: function () {
    this.setData({
      showMoreActions: false,
      showStatusPicker: true,
      selectedStatus: this.data.workOrder?.status || ''
    });
  },

  /**
   * Close Status Picker
   */
  closeStatusPicker: function () {
    this.setData({
      showStatusPicker: false,
      selectedStatus: ''
    });
  },

  /**
   * Select Status - 选择新状态并更新
   */
  selectStatus: async function (e) {
    const newStatus = e.currentTarget.dataset.status;
    const currentStatus = this.data.workOrder?.status;

    if (newStatus === currentStatus) {
      this.setData({ showStatusPicker: false });
      return;
    }

    const statusLabel = this.data.availableStatuses.find(s => s.value === newStatus)?.label || newStatus;

    wx.showModal({
      title: '确认切换状态',
      content: `确定要将工单状态切换为"${statusLabel}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '更新中...', mask: true });
            await workOrderService.updateWorkOrderStatus(
              parseInt(this.data.orderId),
              newStatus,
              `手动切换状态为${statusLabel}`
            );
            wx.hideLoading();
            this.setData({ showStatusPicker: false });
            wx.showToast({
              title: '状态已更新',
              icon: 'success'
            });
            // Refresh work order data
            setTimeout(() => {
              this.loadWorkOrder();
            }, 500);
          } catch (error) {
            wx.hideLoading();
            console.error('[Detail] Update status error:', error);
            wx.showToast({
              title: error.message || '更新失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * Handle Accept Order - 维修员接单
   */
  handleAcceptOrder: async function () {
    try {
      wx.showModal({
        title: '确认接单',
        content: '确认接单并开始维修吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              wx.showLoading({
                title: '接单中...',
                mask: true
              });

              await workOrderService.acceptOrder(this.data.orderId);

              wx.hideLoading();

              // Success feedback
              wx.showToast({
                title: '接单成功',
                icon: 'success',
                duration: 2000
              });

              // Refresh work order data
              setTimeout(() => {
                this.loadWorkOrder();
              }, 500);

            } catch (error) {
              wx.hideLoading();
              console.error('[Detail] Accept order error:', error);

              // Error feedback
              const errorMsg = error.message || '接单失败，请稍后重试';
              wx.showModal({
                title: '接单失败',
                content: errorMsg,
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (retryRes) => {
                  if (retryRes.confirm) {
                    this.handleAcceptOrder();
                  }
                }
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('[Detail] Accept order check error:', error);
      wx.showModal({
        title: '操作失败',
        content: '无法接单，请稍后重试',
        showCancel: false
      });
    }
  },

  /**
   * Handle Start Repair - T090 (Cloud Database Version)
   */
  handleStart: async function () {
    try {
      // Show confirmation modal
      wx.showModal({
        title: '开始维修',
        content: '确认开始维修此工单吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              // Update status to In Progress
              await workOrderService.updateWorkOrderStatus(
                parseInt(this.data.orderId),
                'In Progress',
                '开始维修'
              );

              // Success feedback - T093
              wx.showToast({
                title: '已开始维修',
                icon: 'success',
                duration: 2000
              });

              // Refresh work order data - T094
              setTimeout(() => {
                this.loadWorkOrder();
              }, 500);

              // Navigate to workbench page after 2 seconds
              setTimeout(() => {
                wx.switchTab({
                  url: '/pages/index/index'
                });
              }, 2000);

            } catch (error) {
              wx.hideLoading();
              console.error('[Detail] Start error:', error);

              // Error feedback - T093
              const errorMsg = error.message || '开始维修失败';
              wx.showModal({
                title: '操作失败',
                content: errorMsg,
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (retryRes) => {
                  if (retryRes.confirm) {
                    this.handleStart();
                  }
                }
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('[Detail] Check concurrent orders error:', error);
      wx.showModal({
        title: '检查失败',
        content: '无法检查当前工单状态，请稍后重试',
        showCancel: false
      });
    }
  },

  /**
   * Handle Update Status - T091-T092
   * Shows repair completion form
   */
  handleUpdate: function () {
    this.setData({ showRepairForm: true });
  },

  /**
   * Handle Completion Notes Input
   */
  onNotesInput: function (e) {
    this.setData({ completionNotes: e.detail.value });
  },

  /**
   * Cancel Repair Form
   */
  cancelRepairForm: function () {
    this.setData({
      showRepairForm: false,
      completionNotes: '',
      selectedParts: []
    });
  },

  // ==== 配件选择相关方法 ====

  openPartsPicker: async function () {
    this.setData({ showPartsPicker: true, partsLoading: true, partsSearchKey: '' });
    try {
      const res = await materialService.listMaterials('', 1, 200);
      const selectedDocIds = new Set((this.data.selectedParts || []).map(p => p._doc_id));
      const list = (res.materials || []).map(m => ({
        ...m,
        _added: selectedDocIds.has(m._id)
      }));
      this.setData({
        availableParts: list,
        filteredParts: list,
        partsLoading: false
      });
    } catch (e) {
      console.error('[Detail] Load parts error:', e);
      this.setData({ partsLoading: false });
      wx.showToast({ title: '加载配件失败', icon: 'none' });
    }
  },

  closePartsPicker: function () {
    this.setData({ showPartsPicker: false });
  },

  onPartsSearchInput: function (e) {
    const key = (e.detail.value || '').trim().toLowerCase();
    this.setData({ partsSearchKey: key });
    this._filterParts(key);
  },

  _filterParts: function (key) {
    const { availableParts } = this.data;
    if (!key) {
      this.setData({ filteredParts: availableParts });
      return;
    }
    const filtered = availableParts.filter(m => {
      const name = (m.name || '').toLowerCase();
      const number = (m.material_number || '').toLowerCase();
      const spec = (m.spec || '').toLowerCase();
      const model = (m.model || '').toLowerCase();
      return name.indexOf(key) >= 0
        || number.indexOf(key) >= 0
        || spec.indexOf(key) >= 0
        || model.indexOf(key) >= 0;
    });
    this.setData({ filteredParts: filtered });
  },

  onPickPart: function (e) {
    const part = e.currentTarget.dataset.part;
    if (!part || part.stock <= 0) return;

    // 使用云数据库原生 _id 作为唯一标识（material_id 可能重复）
    const partDocId = part._id;
    const existingIdx = this.data.selectedParts.findIndex(p => p._doc_id === partDocId);

    if (existingIdx >= 0) {
      // 已存在：自动 +1（库存不足提示）
      const existing = this.data.selectedParts[existingIdx];
      if (existing.quantity >= existing.stock) {
        wx.showToast({ title: `库存仅 ${existing.stock}`, icon: 'none' });
        return;
      }
      const newSelected = [...this.data.selectedParts];
      newSelected[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
      this.setData({ selectedParts: newSelected, showPartsPicker: false });
      wx.showToast({ title: `数量 +1`, icon: 'none', duration: 1000 });
    } else {
      // 新增
      const newSelected = [...this.data.selectedParts, {
        _doc_id: partDocId,
        material_id: part.material_id,
        material_name: part.name,
        unit: part.unit || '个',
        quantity: 1,
        stock: part.stock
      }];
      this.setData({ selectedParts: newSelected, showPartsPicker: false });
    }
  },

  onRemovePart: function (e) {
    const idx = e.currentTarget.dataset.index;
    const newSelected = this.data.selectedParts.filter((_, i) => i !== idx);
    this.setData({ selectedParts: newSelected });
  },

  onAdjustPartQty: function (e) {
    const idx = e.currentTarget.dataset.index;
    const delta = e.currentTarget.dataset.delta;
    const part = this.data.selectedParts[idx];
    if (!part) return;
    const newQty = part.quantity + Number(delta);
    if (newQty < 1) return;
    if (newQty > part.stock) {
      wx.showToast({ title: `库存仅 ${part.stock}`, icon: 'none' });
      return;
    }
    const newSelected = [...this.data.selectedParts];
    newSelected[idx] = { ...part, quantity: newQty };
    this.setData({ selectedParts: newSelected });
  },

  /**
   * Submit Repair Completion - T091-T092-T093 (Cloud Database Version)
   */
  submitRepairCompletion: async function () {
    try {
      // 提交前再次校验：出库数量 ≤ 库存
      const overflow = (this.data.selectedParts || []).find(p => p.quantity > p.stock);
      if (overflow) {
        wx.showToast({ title: `${overflow.material_name} 数量超过库存`, icon: 'none' });
        return;
      }

      this.setData({ submittingRepair: true });

      // 构造 parts_used 参数（仅传必要字段）
      const partsUsed = (this.data.selectedParts || []).map(p => ({
        _doc_id: p._doc_id,
        material_id: p.material_id,
        quantity: p.quantity
      }));

      // Call cloud function to complete repair (固定状态为 Repaired)
      await workOrderService.completeRepair(
        parseInt(this.data.orderId),
        this.data.completionNotes.trim(),
        partsUsed
      );

      this.setData({ submittingRepair: false });

      // Success feedback
      wx.showToast({
        title: '提交成功',
        icon: 'success',
        duration: 2000
      });

      // Reset form
      this.setData({
        showRepairForm: false,
        completionNotes: '',
        selectedParts: []
      });

      // 跳转到工作台页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }, 1500);

    } catch (error) {
      this.setData({ submittingRepair: false });
      console.error('[Detail] Submit repair error:', error);

      // Error feedback
      const errorMsg = error.message || '提交失败，请重试';
      wx.showModal({
        title: '提交失败',
        content: errorMsg,
        showCancel: true,
        cancelText: '取消',
        confirmText: '重试',
        success: (retryRes) => {
          if (retryRes.confirm) {
            this.submitRepairCompletion();
          }
        }
      });
    }
  },

  /**
   * Tab Switch - 点击切换
   */
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });
  },

  /**
   * Stop Propagation
   */
  stopPropagation: function () {
    // Prevent event bubbling for modal
  },

  /**
   * Calculate and Update Work Order Duration
   */
  updateWorkOrderDuration: function () {
    const workOrder = this.data.workOrder;
    if (!workOrder || !workOrder.created_at) {
      // console.log('[Detail] Cannot update duration - no workOrder or created_at');
      return;
    }

    const now = Date.now();
    const createdAt = workOrder.created_at.$date ? new Date(workOrder.created_at.$date) : new Date(workOrder.created_at);
    const diff = now - createdAt.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const duration = `${days}天${hours}时${minutes}分${seconds}秒`;
    // console.log('[Detail] Work order duration:', duration);
    this.setData({ workOrderDuration: duration });
  },

  /**
   * Start Duration Timer
   */
  startDurationTimer: function () {
    // console.log('[Detail] Starting duration timer');

    // Stop existing timer
    this.stopDurationTimer();

    // Update immediately
    this.updateWorkOrderDuration();

    // Update every minute instead of every second (性能优化)
    const interval = setInterval(() => {
      this.updateWorkOrderDuration();
    }, 60000);

    this.setData({ durationTimerInterval: interval });
    // console.log('[Detail] Duration timer started');
  },

  /**
   * Stop Duration Timer
   */
  stopDurationTimer: function () {
    if (this.data.durationTimerInterval) {
      clearInterval(this.data.durationTimerInterval);
      this.setData({ durationTimerInterval: null });
    }
  },

  /**
   * Navigate Back
   */
  navigateBack: function () {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    });
  },

  /**
   * Handle Approve - 已复核确认
   */
  handleApprove: function () {
    wx.showModal({
      title: '确认复核',
      content: '是否确认复核通过？',
      confirmText: '确认',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '提交中...', mask: true });

            // 调用复核接口，批准工单（不需要审核意见）
            await workOrderService.reviewWorkOrder(
              parseInt(this.data.orderId),
              'Completed',
              '' // 空的审核意见
            );

            wx.hideLoading();

            // 成功反馈
            wx.showToast({
              title: '复核成功',
              icon: 'success',
              duration: 2000
            });

            // 刷新工单数据
            setTimeout(() => {
              this.loadWorkOrder();
            }, 500);

            // 2秒后返回
            setTimeout(() => {
              wx.navigateBack({
                fail: () => {
                  wx.switchTab({
                    url: '/pages/index/index'
                  });
                }
              });
            }, 2000);

          } catch (error) {
            wx.hideLoading();
            console.error('[Detail] Approve error:', error);

            // 错误反馈
            const errorMsg = error.message || '提交失败，请重试';
            wx.showModal({
              title: '提交失败',
              content: errorMsg,
              showCancel: true,
              cancelText: '取消',
              confirmText: '重试',
              success: (retryRes) => {
                if (retryRes.confirm) {
                  this.handleApprove();
                }
              }
            });
          }
        }
      }
    });
  },

  /**
   * Handle Reject - T106-T107
   */
  handleReject: function () {
    this.setData({
      showMoreActions: false,
      showReviewForm: true,
      reviewDecision: 'Needs Rework'
    });
  },

  /**
   * Handle Urge Accept - 催接单
   */
  handleUrgeAccept: async function () {
    this.setData({ showMoreActions: false });

    // 确认弹窗
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '催接单',
        content: '确定要发送催接单通知吗？',
        confirmText: '确定',
        cancelText: '取消',
        success: (res) => resolve(res.confirm)
      });
    });

    if (!confirmed) return;

    try {
      const result = await workOrderService.urgeAccept(parseInt(this.data.orderId));

      if (result.throttled) {
        wx.showModal({
          title: '提示',
          content: result.message,
          showCancel: false
        });
        return;
      }

      wx.showToast({
        title: '催接单通知已发送',
        icon: 'success',
        duration: 2000
      });

    } catch (error) {
      console.error('[Detail] Urge accept error:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    }
  },

  /**
   * Handle Urge Repair - 催维修
   */
  handleUrgeRepair: async function () {
    try {
      const result = await workOrderService.urgeRepair(parseInt(this.data.orderId));

      if (result.throttled) {
        wx.showModal({
          title: '提示',
          content: result.message,
          showCancel: false
        });
        return;
      }

      wx.showToast({
        title: '催促通知已发送',
        icon: 'success',
        duration: 2000
      });

    } catch (error) {
      console.error('[Detail] Urge repair error:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    }
  },

  /**
   * Handle Urge Review - 催复核
   */
  handleUrgeReview: async function () {
    try {
      const result = await workOrderService.urgeReview(parseInt(this.data.orderId));

      if (result.throttled) {
        wx.showModal({
          title: '提示',
          content: result.message,
          showCancel: false
        });
        return;
      }

      wx.showToast({
        title: '催促通知已发送',
        icon: 'success',
        duration: 2000
      });

    } catch (error) {
      console.error('[Detail] Urge review error:', error);
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      });
    }
  },

  /**
   * Handle Review Notes Input - T107
   */
  onReviewNotesInput: function (e) {
    this.setData({ reviewNotes: e.detail.value });
  },

  /**
   * Cancel Review Form - T107
   */
  cancelReviewForm: function () {
    this.setData({
      showReviewForm: false,
      reviewDecision: '',
      reviewNotes: ''
    });
  },

  /**
   * Submit Review - 提交需返工
   */
  submitReview: async function () {
    // 验证返工原因必填
    if (!this.data.reviewNotes.trim()) {
      wx.showToast({
        title: '请填写返工原因',
        icon: 'none'
      });
      return;
    }

    // 确认对话框
    wx.showModal({
      title: '确认需返工',
      content: '确认将此工单退回给维修人员返工吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ submittingReview: true });

            // 调用复核接口，标记为需返工
            await workOrderService.reviewWorkOrder(
              parseInt(this.data.orderId),
              'Needs Rework',
              this.data.reviewNotes.trim()
            );

            this.setData({ submittingReview: false });

            // 成功反馈
            wx.showToast({
              title: '已退回返工',
              icon: 'success',
              duration: 2000
            });

            // 重置表单
            this.setData({
              showReviewForm: false,
              reviewDecision: '',
              reviewNotes: ''
            });

            // 刷新工单数据
            setTimeout(() => {
              this.loadWorkOrder();
            }, 500);

            // 2秒后返回
            setTimeout(() => {
              wx.navigateBack({
                fail: () => {
                  wx.switchTab({
                    url: '/pages/index/index'
                  });
                }
              });
            }, 2000);

          } catch (error) {
            this.setData({ submittingReview: false });
            console.error('[Detail] Submit review error:', error);

            // 错误反馈
            const errorMsg = error.message || '提交失败，请重试';
            wx.showModal({
              title: '提交失败',
              content: errorMsg,
              showCancel: true,
              cancelText: '取消',
              confirmText: '重试',
              success: (retryRes) => {
                if (retryRes.confirm) {
                  this.submitReview();
                }
              }
            });
          }
        }
      }
    });
  },

  /**
   * T175 - Update SLA Display
   * Calculate and update SLA countdown display with color coding and progress
   */
  updateSLADisplay: function (order) {
    const timeRemaining = order.time_remaining || 0;
    const percentageUsed = order.percentage_used || 0;
    const isOverdue = order.is_overdue || false;

    // Format display text
    const slaDisplay = formatSLATimeRemaining(timeRemaining);

    // Get color class based on status
    const slaColorClass = getSLAColorClass(isOverdue, percentageUsed);

    // Calculate progress bar width (capped at 100%)
    const progressWidth = Math.min(percentageUsed, 100);
    const slaProgressWidth = `${progressWidth}%`;

    // Generate warning message
    let slaWarningMessage = '';
    if (isOverdue) {
      slaWarningMessage = '⚠️ 工单已超期，请尽快处理';
    } else if (percentageUsed >= 80) {
      slaWarningMessage = '⏰ 工单即将超期，请注意时间';
    } else if (percentageUsed >= 50) {
      slaWarningMessage = '提示：已使用一半以上时间';
    }

    this.setData({
      slaDisplay,
      slaColorClass,
      slaPercentageUsed: percentageUsed,
      slaProgressWidth,
      slaWarningMessage
    });
  },

  /**
   * T175 - Start SLA Timer
   * Update countdown every minute
   */
  startSLATimer: function () {
    // Clear existing timer
    this.stopSLATimer();

    // Update every minute (60000ms)
    const interval = setInterval(() => {
      const workOrder = this.data.workOrder;
      if (workOrder && workOrder.time_remaining !== undefined) {
        // Decrease time remaining by 1 minute
        const updatedTimeRemaining = workOrder.time_remaining - 60000;

        // Recalculate percentage used (assuming total SLA time is available)
        let updatedPercentageUsed = this.data.slaPercentageUsed;
        if (workOrder.sla_deadline && workOrder.created_at) {
          const totalTime = new Date(workOrder.sla_deadline).getTime() - new Date(workOrder.created_at).getTime();
          const timeUsed = totalTime - updatedTimeRemaining;
          updatedPercentageUsed = (timeUsed / totalTime) * 100;
        }

        // Update work order data
        const updatedOrder = {
          ...workOrder,
          time_remaining: updatedTimeRemaining,
          percentage_used: updatedPercentageUsed,
          is_overdue: updatedTimeRemaining <= 0
        };

        // 计算SLA显示数据（原updateSLADisplay逻辑）
        const isOverdue = updatedTimeRemaining <= 0;
        const slaDisplay = formatSLATimeRemaining(updatedTimeRemaining);
        const slaColorClass = getSLAColorClass(isOverdue, updatedPercentageUsed);
        const progressWidth = Math.min(updatedPercentageUsed, 100);
        const slaProgressWidth = `${progressWidth}%`;

        let slaWarningMessage = '';
        if (isOverdue) {
          slaWarningMessage = '⚠️ 工单已超期，请尽快处理';
        } else if (updatedPercentageUsed >= 80) {
          slaWarningMessage = '⏰ 工单即将超期，请注意时间';
        } else if (updatedPercentageUsed >= 50) {
          slaWarningMessage = '提示：已使用一半以上时间';
        }

        // 合并setData，将2次调用合并为1次
        this.setData({
          workOrder: updatedOrder,
          slaDisplay,
          slaColorClass,
          slaPercentageUsed: updatedPercentageUsed,
          slaProgressWidth,
          slaWarningMessage
        });
      }
    }, 60000);

    this.setData({ slaTimerInterval: interval });
  },

  /**
   * Stop SLA Timer
   */
  stopSLATimer: function () {
    if (this.data.slaTimerInterval) {
      clearInterval(this.data.slaTimerInterval);
      this.setData({ slaTimerInterval: null });
    }
  },

  /**
   * onUnload - Clean up timer when leaving page
   */
  onUnload: function () {
    this.stopSLATimer();
    this.stopDurationTimer();
  },

  /**
   * onHide - Stop timer when page is hidden
   */
  onHide: function () {
    this.stopSLATimer();
    this.stopDurationTimer();
  },

});
