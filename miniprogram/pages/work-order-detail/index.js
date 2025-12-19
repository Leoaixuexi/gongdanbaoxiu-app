/**
 * Work Order Detail Page - T077 + T090-T094 (Cloud Database Version)
 * Detailed view of single work order with repair actions
 */

const app = getApp();
const workOrderService = require('../../services/workOrder');
const auth = require('../../services/auth');
const { ROLES, PRIORITY_DISPLAY_NAMES, MAX_CONCURRENT_ORDERS_PER_TECHNICIAN } = require('../../utils/constants');
const { formatDateTime, formatRelativeTime, formatSLATimeRemaining, getSLAColorClass } = require('../../utils/formatter');

Page({
  data: {
    workOrder: null,
    loading: true,
    orderId: null,
    priorityDisplay: '',
    createdTime: '',
    reportTime: '',
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
      'Repaired': '已修复',
      'Under Review': '待复核',
      'Completed': '已完成',
      'Needs Rework': '需返工'
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
    // Repair completion form - T091-T092
    showRepairForm: false,
    repairStatus: 'Repaired',
    completionNotes: '',
    repairPhotos: [],
    uploadingPhotos: false,
    submittingRepair: false,
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
      { value: 'Repaired', label: '已修复', color: '#10B981' },
      { value: 'Completed', label: '已完成', color: '#059669' },
      { value: 'Needs Rework', label: '需返工', color: '#EF4444' }
    ]
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Detail] Page load with options:', options);
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: statusBarHeight + navBarHeight
    });
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
    console.log('[Detail] Page show');
  },

  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    console.log('[Detail] Pull down refresh');
    this.loadWorkOrder();
    wx.stopPullDownRefresh();
  },

  /**
   * Share functionality
   */
  onShareAppMessage: function () {
    const workOrder = this.data.workOrder;
    return {
      title: `工单 ${workOrder.order_number} - ${workOrder.order_category || '报修'}`,
      path: `/pages/work-order-detail/index?id=${workOrder.order_id}`,
      imageUrl: workOrder.photos && workOrder.photos.length > 0
        ? workOrder.photos[0]
        : ''
    };
  },

  /**
   * Load Work Order from Cloud Database
   */
  loadWorkOrder: async function () {
    try {
      this.setData({ loading: true });

      console.log('[Detail] Loading work order with ID:', this.data.orderId);

      const workOrder = await workOrderService.getWorkOrderById(this.data.orderId);

      if (!workOrder) {
        throw new Error('Work order not found');
      }

      console.log('[Detail] Work order data received:', workOrder);

      // Process work order data
      const processedOrder = this.processWorkOrder(workOrder);

      // Get current user info
      const userInfo = await auth.getCurrentUser();
      console.log('[Detail] Current user:', userInfo);

      // Determine user permissions
      // 物业经理和物业员工（巡检员）享有相同的按钮权限
      const isPropertyStaff = userInfo.role_id === ROLES.PROPERTY_STAFF || userInfo.role_id === ROLES.PROPERTY_MANAGER;
      const isMaintenanceWorker = userInfo.role_id === ROLES.MAINTENANCE_STAFF;

      // Determine action buttons visibility with null checks
      const isPropertyManager = userInfo.role_id === ROLES.PROPERTY_MANAGER;

      // Debug: 打印用户和工单信息
      console.log('[Detail] Permission check:', {
        userRoleId: userInfo.role_id,
        userId: userInfo.id,
        isPropertyStaff,
        isPropertyManager,
        submitterUserId: workOrder.submitter?.user_id,
        orderStatus: processedOrder.status
      });

      // 修改按钮：只在"已提报"状态显示
      // 物业经理可操作所有工单，巡检员只能操作自己提交的
      // 注意：userInfo.id 和 submitter.user_id 需要统一比较
      const currentUserId = userInfo.id || userInfo.user_id;
      const submitterUserId = workOrder.submitter?.user_id;
      const isSubmitter = currentUserId && submitterUserId && currentUserId === submitterUserId;

      const canEdit = (isPropertyManager || (isPropertyStaff && isSubmitter)) &&
        processedOrder.status === 'Pending Repair';

      // 判断是否为分配的维修员 - 使用统一的 currentUserId
      const assignedTechnicianId = processedOrder.assigned_technician?.user_id;
      const isAssignedTechnician = isMaintenanceWorker &&
        assignedTechnicianId && currentUserId &&
        assignedTechnicianId === currentUserId;

      console.log('[Detail] Technician check:', {
        currentUserId,
        assignedTechnicianId,
        isMaintenanceWorker,
        isAssignedTechnician
      });

      // 接单/开始返工：维修员 && 分配给自己 && (待维修/需返工)
      const canAcceptOrder = isMaintenanceWorker &&
        isAssignedTechnician &&
        (processedOrder.status === 'Pending Repair' || processedOrder.status === 'Needs Rework');

      // 完成维修：维修员 && 分配给自己 && 维修中
      const canUpdate = isMaintenanceWorker &&
        isAssignedTechnician &&
        processedOrder.status === 'In Progress';

      // 验收：提交者 && 待复核（Repaired）
      const canReview = isPropertyStaff && isSubmitter && processedOrder.status === 'Repaired';

      // 统一显示：所有状态特定按钮都不显示
      const canStart = false;
      // canUpdate / canReview are computed above

      // 根据状态和角色计算按钮显示
      const status = processedOrder.status;
      let showThreeDots = false;
      let showEditBtn = false;
      let showAcceptBtn = false;
      let showConfirmRepairBtn = false;
      let showUrgeRepairBtn = false;
      let showUrgeReviewBtn = false;
      let showReviewedBtn = false;
      let showDeleteInMenu = false;
      let showNeedsReworkInMenu = false;
      let showEmptyMenu = false;

      if (status === 'Pending Repair') {
        // 已提报/待接单状态
        if (isPropertyManager || isPropertyStaff) {
          showThreeDots = true;
          showEditBtn = canEdit; // 只有提交者或经理可编辑
          showDeleteInMenu = true;
        } else if (isAssignedTechnician) {
          showAcceptBtn = true;
          // 维修员无三个点菜单
        }
      } else if (status === 'In Progress') {
        // 维修中状态
        if (isAssignedTechnician) {
          showThreeDots = true;
          showConfirmRepairBtn = true;
          showEmptyMenu = true;
        } else if (isPropertyManager || isPropertyStaff) {
          showThreeDots = true;
          showUrgeRepairBtn = true;
          showDeleteInMenu = true;
        }
      } else if (status === 'Repaired') {
        // 已修复状态
        if (isAssignedTechnician) {
          showThreeDots = true;
          showUrgeReviewBtn = true;
          showEmptyMenu = true;
        } else if (isPropertyManager) {
          showThreeDots = true;
          showUrgeReviewBtn = true;
          showDeleteInMenu = true;
        } else if (isPropertyStaff && isSubmitter) {
          // 物业员工（提交者）- 待复核
          showThreeDots = true;
          showReviewedBtn = true;
          showDeleteInMenu = true;
          showNeedsReworkInMenu = true;
        }
      } else if (status === 'Needs Rework') {
        // 需重修状态
        if (isAssignedTechnician) {
          showThreeDots = true;
          showConfirmRepairBtn = true;
          showEmptyMenu = true;
        } else if (isPropertyManager || isPropertyStaff) {
          showThreeDots = true;
          showUrgeRepairBtn = true;
          showDeleteInMenu = true;
        }
      } else if (status === 'Completed') {
        // 已完成状态
        showThreeDots = true;
        showEmptyMenu = true;
      }

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
      });

      // Start work order duration timer after data is set
      this.startDurationTimer();

      console.log('[Detail] Work order loaded successfully');

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
    // Ensure photos field exists (handle both photos and photos_json)
    if (!order.photos && order.photos_json) {
      order.photos = order.photos_json;
    }
    // Ensure photos is always an array
    if (!order.photos) {
      order.photos = [];
    }

    console.log('[processWorkOrder] Photos:', order.photos);
    console.log('[processWorkOrder] Photos length:', order.photos.length);
    console.log('[processWorkOrder] Full order:', order);

    // Priority display
    const priorityDisplay = PRIORITY_DISPLAY_NAMES[order.priority] || order.priority;
    this.setData({ priorityDisplay });

    // Created time
    const createdTime = formatDateTime(order.created_at);
    this.setData({ createdTime });

    // Report time (故障发生时间)
    if (order.report_time) {
      const reportTime = formatDateTime(order.report_time);
      this.setData({ reportTime });
    }

    // Assigned time
    if (order.assigned_at) {
      const assignedTime = formatDateTime(order.assigned_at);
      this.setData({ assignedTime });
    }

    // T175 - Enhanced SLA deadline display with progress and real-time updates
    if (order.time_remaining !== undefined && order.time_remaining !== null) {
      this.updateSLADisplay(order);
      // Start real-time countdown timer
      this.startSLATimer();
    }

    // Process status history
    console.log('[Detail] Raw status_history:', order.status_history);
    console.log('[Detail] status_history length:', order.status_history?.length);
    console.log('[Detail] Raw status_history JSON:', JSON.stringify(order.status_history, null, 2));

    // Generate timeline data for timeline-item component
    let timelineData = [];

    if (order.status_history && Array.isArray(order.status_history)) {
      console.log('[Detail] Processing', order.status_history.length, 'status history items');
      // Add status text mapping
      const statusTextMap = {
        'Pending Repair': '已提报',
        'Pending Assignment': '待接单',
        'In Progress': '维修中',
        'Repaired': '已修复',
        'Completed': '已完成',
        'Needs Rework': '需返工',
        'Under Review': '待复核',
        // 中文状态也添加映射（以防万一）
        '已提报': '已提报',
        '待接单': '待接单',
        '维修中': '维修中',
        '已修复': '已修复',
        '待复核': '待复核',
        '已完成': '已完成',
        '需返工': '需返工'
      };

      order.status_history = order.status_history.map(item => {
        return {
          ...item,
          time_display: formatDateTime(item.changed_at),
          to_status_text: statusTextMap[item.to_status] || item.to_status
        };
      });

      // Convert status_history to timeline data format
      timelineData = order.status_history.map((item, index) => {
        // 处理描述文字，去掉"工单创建"字样
        let description = item.notes || '无';
        if (description === '工单创建') {
          description = '';
        }

        return {
          id: String(index + 1),
          title: item.to_status_text || item.to_status,
          description: description,
          timestamp: item.time_display || formatDateTime(item.changed_at),
          user: item.changed_by ? {
            name: item.changed_by.name || '系统',
            avatar: item.changed_by.avatar || ''
          } : null
        };
      });

      console.log('[Detail] Processed status_history:', order.status_history);
      console.log('[Detail] Generated timelineData:', timelineData);
    } else {
      console.log('[Detail] No status_history found or not an array');
    }

    this.setData({ timelineData });

    // Generate stepper data for work-order-stepper component
    const steps = ['已提报', '维修中', '已修复', '待复核', '已完成'];
    const statusStepMap = {
      'Pending Repair': 0,
      'Pending Assignment': 0,
      'In Progress': 1,
      'Repaired': 2,
      'Under Review': 3,
      'Completed': 4,
      'Needs Rework': 1 // 返工状态对应维修中
    };

    const currentStep = statusStepMap[order.status] || 0;

    // 处理工单创建时间，确保转换为时间戳
    let startTime = Date.now();
    let timeSource = 'fallback'; // 用于调试

    // 优先使用 created_at 字段
    if (order.created_at) {
      console.log('[Detail] Raw created_at:', order.created_at);
      console.log('[Detail] created_at type:', typeof order.created_at);

      if (order.created_at.$date) {
        // MongoDB Date 格式
        startTime = new Date(order.created_at.$date).getTime();
        timeSource = 'created_at.$date';
      } else if (typeof order.created_at === 'string') {
        // 字符串格式
        startTime = new Date(order.created_at).getTime();
        timeSource = 'created_at.string';
      } else if (typeof order.created_at === 'number') {
        // 已经是时间戳
        startTime = order.created_at;
        timeSource = 'created_at.timestamp';
      } else if (order.created_at instanceof Date) {
        // Date 对象
        startTime = order.created_at.getTime();
        timeSource = 'created_at.Date';
      }
    }
    // 如果没有 created_at，从 status_history 的第一条记录获取
    else if (order.status_history && Array.isArray(order.status_history) && order.status_history.length > 0) {
      // status_history 是按时间倒序排列的，最后一条是最早的（工单创建时间）
      // 但从日志来看，第一条就是工单创建记录，所以我们找 notes ���含"工单创建"的记录
      let firstHistory = order.status_history.find(h => h.notes && h.notes.includes('工单创建'));

      // 如果没找到"工单创建"记录，使用第一条
      if (!firstHistory) {
        firstHistory = order.status_history[0];
      }

      if (firstHistory && firstHistory.changed_at) {
        console.log('[Detail] Using status_history changed_at:', firstHistory.changed_at);
        console.log('[Detail] History notes:', firstHistory.notes);
        startTime = new Date(firstHistory.changed_at).getTime();
        timeSource = 'status_history';
      } else {
        console.warn('[Detail] No created_at or status_history.changed_at found, using current time');
      }
    } else {
      console.warn('[Detail] No created_at or status_history found, using current time');
    }

    console.log('[Detail] Time source:', timeSource);
    console.log('[Detail] Converted startTime:', startTime);
    console.log('[Detail] startTime date:', new Date(startTime).toLocaleString());
    console.log('[Detail] Current time:', Date.now());
    console.log('[Detail] Time diff (seconds):', Math.floor((Date.now() - startTime) / 1000));

    // 获取完成时间（从 status_history 中查找 Completed 状态的记录）
    let endTime = null;
    if (order.status === 'Completed' && order.status_history && Array.isArray(order.status_history)) {
      const completedRecord = order.status_history.find(h => h.to_status === 'Completed');
      if (completedRecord && completedRecord.changed_at) {
        if (completedRecord.changed_at.$date) {
          endTime = new Date(completedRecord.changed_at.$date).getTime();
        } else if (typeof completedRecord.changed_at === 'string') {
          endTime = new Date(completedRecord.changed_at).getTime();
        } else if (typeof completedRecord.changed_at === 'number') {
          endTime = completedRecord.changed_at;
        }
        console.log('[Detail] Found endTime:', endTime, new Date(endTime).toLocaleString());
      }
    }

    this.setData({
      stepperData: {
        steps: steps,
        currentStep: currentStep,
        startTime: startTime,
        endTime: endTime
      }
    });

    return order;
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

              // Update status to In Progress
              await workOrderService.updateWorkOrderStatus(
                parseInt(this.data.orderId),
                'In Progress',
                '维修员接单开始维修'
              );

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
   * Handle Repair Status Change
   */
  onRepairStatusChange: function (e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ repairStatus: index === 0 ? 'Repaired' : 'Needs Rework' });
  },

  /**
   * Handle Completion Notes Input
   */
  onNotesInput: function (e) {
    this.setData({ completionNotes: e.detail.value });
  },

  /**
   * Choose Repair Photos
   */
  chooseRepairPhotos: function () {
    const maxPhotos = 9;
    const currentCount = this.data.repairPhotos.length;

    if (currentCount >= maxPhotos) {
      wx.showToast({
        title: `最多上传${maxPhotos}张照片`,
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: maxPhotos - currentCount,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        const tempFilePaths = res.tempFilePaths;

        this.setData({ uploadingPhotos: true });

        try {
          const uploadedUrls = [];

          for (const filePath of tempFilePaths) {
            // Upload to cloud storage
            const cloudPath = `work-orders/${this.data.orderId}/repair-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath,
              filePath
            });
            uploadedUrls.push(uploadResult.fileID);
          }

          this.setData({
            repairPhotos: [...this.data.repairPhotos, ...uploadedUrls],
            uploadingPhotos: false
          });

          wx.showToast({
            title: '照片上传成功',
            icon: 'success'
          });

        } catch (error) {
          console.error('[Detail] Upload photos error:', error);
          this.setData({ uploadingPhotos: false });
          wx.showToast({
            title: '照片上传失败',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * Remove Repair Photo
   */
  removeRepairPhoto: function (e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.repairPhotos;
    photos.splice(index, 1);
    this.setData({ repairPhotos: photos });
  },

  /**
   * Cancel Repair Form
   */
  cancelRepairForm: function () {
    this.setData({
      showRepairForm: false,
      repairStatus: 'Repaired',
      completionNotes: '',
      repairPhotos: []
    });
  },

  /**
   * Submit Repair Completion - T091-T092-T093 (Cloud Database Version)
   */
  submitRepairCompletion: async function () {
    // Validate form
    if (this.data.repairStatus === 'Needs Rework' && !this.data.completionNotes.trim()) {
      wx.showModal({
        title: '请填写返工说明',
        content: '选择"需返工"时必须填写返工说明',
        showCancel: false
      });
      return;
    }

    // Check if photos are still uploading
    if (this.data.uploadingPhotos) {
      wx.showToast({
        title: '照片上传中，请稍候',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认提交',
      content: `确认将工单状态更新为"${this.data.repairStatus === 'Repaired' ? '已维修' : '需返工'}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ submittingRepair: true });

            // Call cloud function to complete repair
            await workOrderService.completeRepair(
              parseInt(this.data.orderId),
              this.data.repairStatus,
              this.data.completionNotes.trim(),
              this.data.repairPhotos
            );

            this.setData({ submittingRepair: false });

            // Success feedback - T093
            wx.showToast({
              title: '提交成功',
              icon: 'success',
              duration: 2000
            });

            // Reset form
            this.setData({
              showRepairForm: false,
              repairStatus: 'Repaired',
              completionNotes: '',
              repairPhotos: []
            });

            // 跳转到工作台页面
            setTimeout(() => {
              wx.switchTab({
                url: '/pages/workbench/index'
              });
            }, 1500);

          } catch (error) {
            this.setData({ submittingRepair: false });
            console.error('[Detail] Submit repair error:', error);

            // Error feedback - T093
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
        }
      }
    });
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
      console.log('[Detail] Cannot update duration - no workOrder or created_at');
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
    console.log('[Detail] Work order duration:', duration);
    this.setData({ workOrderDuration: duration });
  },

  /**
   * Start Duration Timer
   */
  startDurationTimer: function () {
    console.log('[Detail] Starting duration timer');

    // Stop existing timer
    this.stopDurationTimer();

    // Update immediately
    this.updateWorkOrderDuration();

    // Update every second
    const interval = setInterval(() => {
      this.updateWorkOrderDuration();
    }, 1000);

    this.setData({ durationTimerInterval: interval });
    console.log('[Detail] Duration timer started');
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
   * Handle Approve - T106-T107
   */
  handleApprove: function () {
    this.setData({
      showReviewForm: true,
      reviewDecision: 'Completed'
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
   * Handle Urge Repair - 催维修
   */
  handleUrgeRepair: function () {
    wx.showModal({
      title: '催维修',
      content: '确认向维修员发送催促通知吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 发送催促通知给维修员
          wx.showToast({
            title: '催促通知已发送',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * Handle Urge Review - 催复核
   */
  handleUrgeReview: function () {
    wx.showModal({
      title: '催复核',
      content: '确认向物业员工发送催促复核通知吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 发送催促通知给物业员工
          wx.showToast({
            title: '催促通知已发送',
            icon: 'success'
          });
        }
      }
    });
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
   * Submit Review - T107-T108 (Cloud Database Version)
   */
  submitReview: async function () {
    // Validate notes required if rejecting
    if (this.data.reviewDecision === 'Needs Rework' && !this.data.reviewNotes.trim()) {
      wx.showModal({
        title: '请填写审核意见',
        content: '拒绝工单时必须填写审核意见说明原因',
        showCancel: false
      });
      return;
    }

    // Show confirmation
    const actionText = this.data.reviewDecision === 'Completed' ? '批准' : '拒绝';
    const confirmText = this.data.reviewDecision === 'Completed'
      ? '确认批准此工单吗？工单将标记为已完成。'
      : '确认拒绝此工单吗？工单将退回给维修人员返工。';

    wx.showModal({
      title: `确认${actionText}`,
      content: confirmText,
      success: async (res) => {
        if (res.confirm) {
          try {
            this.setData({ submittingReview: true });

            // T108 - Call cloud function to review order
            await workOrderService.reviewWorkOrder(
              parseInt(this.data.orderId),
              this.data.reviewDecision,
              this.data.reviewNotes.trim()
            );

            this.setData({ submittingReview: false });

            // Success feedback - T108
            wx.showToast({
              title: `${actionText}成功`,
              icon: 'success',
              duration: 2000
            });

            // Reset form
            this.setData({
              showReviewForm: false,
              reviewDecision: '',
              reviewNotes: ''
            });

            // Refresh work order data - T108
            setTimeout(() => {
              this.loadWorkOrder();
            }, 500);

            // Navigate to review list after 2 seconds - T108
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

            // Error feedback with retry - T108
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

        this.setData({ workOrder: updatedOrder });
        this.updateSLADisplay(updatedOrder);
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
