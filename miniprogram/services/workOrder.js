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
const listWorkOrders = async (filters = {}) => {
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
          // 服务端只信任云函数上下文 openid，这里不再传 user_id（避免被篡改越权）
          filters
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取工单列表失败');
    }

    const listResult = result.result;
    console.log('[WorkOrder] Got orders:', listResult.total);
    return {
      orders: listResult.orders || [],
      total: listResult.total || 0,
      page: listResult.page || 1,
      limit: listResult.limit || (filters.limit || 100),
      totalPages: listResult.totalPages || 0,
    };

  } catch (error) {
    console.error('[WorkOrder] Get orders error:', error);
    throw error;
  }
};

const getWorkOrders = async (filters = {}) => {
  const { orders } = await listWorkOrders(filters);
  return orders;
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
 * 根据工单编号获取工单
 * @param {String} orderNumber - 工单编号
 * @returns {Promise<Object>} 工单详情
 */
const getWorkOrderByNumber = async (orderNumber) => {
  try {
    console.log('[WorkOrder] Getting work order by number:', orderNumber);

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'getByNumber',
        data: {
          order_number: orderNumber
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取工单失败');
    }

    console.log('[WorkOrder] Got order by number:', result.result.order);
    return result.result.order;

  } catch (error) {
    console.error('[WorkOrder] Get order by number error:', error);
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
 * @param {String} completionNotes - 完成描述（选填）
 * @returns {Promise<Object>} 更新结果
 */
const completeRepair = async (orderId, completionNotes) => {
  try {
    console.log('[WorkOrder] Completing repair:', orderId);

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
          completion_notes: completionNotes
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

/**
 * 更新工单信息（仅待维修可编辑）
 * @param {Number} orderId - 工单ID
 * @param {Object} updates - 更新字段
 * @returns {Promise<Object>} 更新结果
 */
const updateWorkOrderDetails = async (orderId, updates) => {
  try {
    console.log('[WorkOrder] Updating work order details:', orderId, updates);

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'updateDetails',
        data: {
          order_id: orderId,
          updates: updates || {}
        }
      }
    });

    wx.hideLoading();

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '保存失败');
    }

    return result.result;
  } catch (error) {
    wx.hideLoading();
    console.error('[WorkOrder] Update details error:', error);
    throw error;
  }
};

/**
 * 删除工单
 * @param {Number} orderId - 工单ID
 * @returns {Promise<Object>} 删除结果
 */
const deleteWorkOrder = async (orderId) => {
  try {
    console.log('[WorkOrder] Deleting work order:', orderId);

    const result = await wx.cloud.callFunction({
      name: 'workOrderManager',
      data: {
        action: 'delete',
        data: {
          order_id: orderId
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '删除工单失败');
    }

    console.log('[WorkOrder] Work order deleted');
    return result.result;

  } catch (error) {
    console.error('[WorkOrder] Delete error:', error);
    throw error;
  }
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  listWorkOrders,
  getWorkOrderById,
  getWorkOrderByNumber,
  updateWorkOrderStatus,
  updateWorkOrderDetails,
  deleteWorkOrder,
  getFaultTypes,
  getWorkOrderStats,
  completeRepair,
  reviewWorkOrder
};
