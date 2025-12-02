/**
 * 工单服务（云数据库版本）
 * 直接调用云函数，无需后端 API
 */

/**
 * 创建工单
 * @param {Object} orderData - 工单数据
 * @returns {Promise<Object>} 创建的工单
 */
const createWorkOrder = async (orderData) => {
  try {
    console.log('[WorkOrder] Creating work order:', orderData);

    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'create',
        data: orderData
      }
    });

    wx.hideLoading();

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '创建工单失败');
    }

    console.log('[WorkOrder] Work order created:', result.result.order);
    return result.result.order;

  } catch (error) {
    wx.hideLoading();
    console.error('[WorkOrder] Create error:', error);
    throw error;
  }
};

/**
 * 获取工单列表
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Array>} 工单列表
 */
const getWorkOrders = async (filters = {}) => {
  try {
    console.log('[WorkOrder] Getting work orders with filters:', filters);

    // 获取当前用户ID
    const storage = require('./storage');
    const { STORAGE_KEYS } = require('../utils/constants');
    const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'list',
        data: {
          user_id: userInfo?.id || userInfo?.user_id, // 传递user_id
          filters
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取工单列表失败');
    }

    console.log('[WorkOrder] Got orders:', result.result.total);
    return result.result.orders;

  } catch (error) {
    console.error('[WorkOrder] Get orders error:', error);
    throw error;
  }
};

/**
 * 获取单个工单详情
 * @param {Number} orderId - 工单ID
 * @returns {Promise<Object>} 工单详情
 */
const getWorkOrderById = async (orderId) => {
  try {
    console.log('[WorkOrder] Getting work order:', orderId);

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'getById',
        data: {
          order_id: orderId
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取工单详情失败');
    }

    console.log('[WorkOrder] Got order:', result.result.order);
    return result.result.order;

  } catch (error) {
    console.error('[WorkOrder] Get order error:', error);
    throw error;
  }
};

/**
 * 更新工单状态
 * @param {Number} orderId - 工单ID
 * @param {String} status - 新状态
 * @param {String} notes - 备注
 * @returns {Promise<Object>} 更新结果
 */
const updateWorkOrderStatus = async (orderId, status, notes = '') => {
  try {
    console.log('[WorkOrder] Updating status:', orderId, status);

    wx.showLoading({
      title: '更新中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'updateStatus',
        data: {
          order_id: orderId,
          status,
          notes
        }
      }
    });

    wx.hideLoading();

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '更新工单状态失败');
    }

    console.log('[WorkOrder] Status updated');
    return result.result;

  } catch (error) {
    wx.hideLoading();
    console.error('[WorkOrder] Update status error:', error);
    throw error;
  }
};

/**
 * 获取故障类型列表
 * @returns {Promise<Array>} 故障类型列表
 */
const getFaultTypes = async () => {
  try {
    console.log('[WorkOrder] Getting fault types');

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'getFaultTypes'
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取故障类型失败');
    }

    console.log('[WorkOrder] Got fault types:', result.result.fault_types.length);
    return result.result.fault_types;

  } catch (error) {
    console.error('[WorkOrder] Get fault types error:', error);
    throw error;
  }
};

/**
 * 根据状态获取工单统计
 * @returns {Promise<Object>} 工单统计
 */
const getWorkOrderStats = async () => {
  try {
    // 获取所有工单
    const allOrders = await getWorkOrders();

    // 按状态分组统计
    const stats = {
      total: allOrders.length,
      pending: 0,
      inProgress: 0,
      repaired: 0,
      completed: 0,
      needsRework: 0,
      overdue: 0
    };

    allOrders.forEach(order => {
      switch (order.status) {
        case 'Pending Repair':
          stats.pending++;
          break;
        case 'In Progress':
          stats.inProgress++;
          break;
        case 'Repaired':
          stats.repaired++;
          break;
        case 'Completed':
          stats.completed++;
          break;
        case 'Needs Rework':
          stats.needsRework++;
          break;
      }

      if (order.is_overdue) {
        stats.overdue++;
      }
    });

    return stats;

  } catch (error) {
    console.error('[WorkOrder] Get stats error:', error);
    throw error;
  }
};

/**
 * 完成维修
 * @param {Number} orderId - 工单ID
 * @param {String} status - 状态（'Repaired' 或 'Needs Rework'）
 * @param {String} completionNotes - 完成备注
 * @param {Array} repairPhotos - 维修照片数组
 * @returns {Promise<Object>} 更新结果
 */
const completeRepair = async (orderId, status, completionNotes, repairPhotos) => {
  try {
    console.log('[WorkOrder] Completing repair:', orderId, status);

    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'completeRepair',
        data: {
          order_id: orderId,
          status,
          completion_notes: completionNotes,
          repair_photos: repairPhotos
        }
      }
    });

    wx.hideLoading();

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '完成维修失败');
    }

    console.log('[WorkOrder] Repair completed');
    return result.result;

  } catch (error) {
    wx.hideLoading();
    console.error('[WorkOrder] Complete repair error:', error);
    throw error;
  }
};

/**
 * 审核工单
 * @param {Number} orderId - 工单ID
 * @param {String} status - 状态（'Completed' 或 'Needs Rework'）
 * @param {String} reviewNotes - 审核备注
 * @returns {Promise<Object>} 更新结果
 */
const reviewWorkOrder = async (orderId, status, reviewNotes) => {
  try {
    console.log('[WorkOrder] Reviewing work order:', orderId, status);

    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'reviewOrder',
        data: {
          order_id: orderId,
          status,
          review_notes: reviewNotes
        }
      }
    });

    wx.hideLoading();

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '审核工单失败');
    }

    console.log('[WorkOrder] Review submitted');
    return result.result;

  } catch (error) {
    wx.hideLoading();
    console.error('[WorkOrder] Review error:', error);
    throw error;
  }
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  getWorkOrderById,
  updateWorkOrderStatus,
  getFaultTypes,
  getWorkOrderStats,
  completeRepair,
  reviewWorkOrder
};
