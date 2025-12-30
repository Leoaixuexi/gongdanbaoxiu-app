/**
 * 工单服务（云数据库版本）
 * 直接调用云函数，使用 cloudCall 统一封装
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

/**
 * 创建工单
 * @param {Object} orderData - 工单数据
 * @returns {Promise<Object>} 创建的工单
 */
const createWorkOrder = async (orderData) => {
  console.log('[WorkOrder] Creating work order:', orderData);
  const result = await callCloud('workOrderManager', {
    action: 'create',
    data: orderData
  }, { loadingText: '提交中...' });
  console.log('[WorkOrder] Work order created:', result.order);
  return result.order;
};

/**
 * 获取工单列表
 * @param {Object} filters - 筛选条件
 * @returns {Promise<Object>} 工单列表
 */
const listWorkOrders = async (filters = {}) => {
  console.log('[WorkOrder] Getting work orders with filters:', filters);
  const result = await callCloudSilent('workOrderManager', {
    action: 'list',
    data: { filters }
  });
  console.log('[WorkOrder] Got orders:', result.total);
  return {
    orders: result.orders || [],
    total: result.total || 0,
    page: result.page || 1,
    limit: result.limit || (filters.limit || 100),
    totalPages: result.totalPages || 0,
  };
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
  console.log('[WorkOrder] Getting work order:', orderId);
  const result = await callCloudSilent('workOrderManager', {
    action: 'getById',
    data: { order_id: orderId }
  });
  console.log('[WorkOrder] Got order:', result.order);
  return result.order;
};

/**
 * 根据工单编号获取工单
 * @param {String} orderNumber - 工单编号
 * @returns {Promise<Object>} 工单详情
 */
const getWorkOrderByNumber = async (orderNumber) => {
  console.log('[WorkOrder] Getting work order by number:', orderNumber);
  const result = await callCloudSilent('workOrderManager', {
    action: 'getByNumber',
    data: { order_number: orderNumber }
  });
  console.log('[WorkOrder] Got order by number:', result.order);
  return result.order;
};

/**
 * 检查工单编号是否已存在（不需要权限校验）
 * @param {String} orderNumber - 工单编号
 * @returns {Promise<boolean>} 是否存在
 */
const checkOrderNumberExists = async (orderNumber) => {
  console.log('[WorkOrder] Checking order number exists:', orderNumber);
  const result = await callCloudSilent('workOrderManager', {
    action: 'checkOrderNumberExists',
    data: { order_number: orderNumber }
  });
  return result.exists;
};

/**
 * 更新工单状态
 * @param {Number} orderId - 工单ID
 * @param {String} status - 新状态
 * @param {String} notes - 备注
 * @returns {Promise<Object>} 更新结果
 */
const updateWorkOrderStatus = async (orderId, status, notes = '') => {
  console.log('[WorkOrder] Updating status:', orderId, status);
  const result = await callCloud('workOrderManager', {
    action: 'updateStatus',
    data: { order_id: orderId, status, notes }
  }, { loadingText: '更新中...' });
  console.log('[WorkOrder] Status updated');
  return result;
};

/**
 * 获取故障类型列表
 * @returns {Promise<Array>} 故障类型列表
 */
const getFaultTypes = async () => {
  console.log('[WorkOrder] Getting fault types');
  const result = await callCloudSilent('workOrderManager', {
    action: 'getFaultTypes'
  });
  console.log('[WorkOrder] Got fault types:', result.fault_types.length);
  return result.fault_types;
};

/**
 * 根据状态获取工单统计
 * @returns {Promise<Object>} 工单统计
 */
const getWorkOrderStats = async () => {
  const allOrders = await getWorkOrders();
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
      case 'Pending Repair': stats.pending++; break;
      case 'In Progress': stats.inProgress++; break;
      case 'Repaired': stats.repaired++; break;
      case 'Completed': stats.completed++; break;
      case 'Needs Rework': stats.needsRework++; break;
    }
    if (order.is_overdue) stats.overdue++;
  });

  return stats;
};

/**
 * 完成维修
 * @param {Number} orderId - 工单ID
 * @param {String} completionNotes - 完成描述（选填）
 * @returns {Promise<Object>} 更新结果
 */
const completeRepair = async (orderId, completionNotes) => {
  console.log('[WorkOrder] Completing repair:', orderId);
  const result = await callCloud('workOrderManager', {
    action: 'completeRepair',
    data: { order_id: orderId, completion_notes: completionNotes }
  }, { loadingText: '提交中...' });
  console.log('[WorkOrder] Repair completed');
  return result;
};

/**
 * 审核工单
 * @param {Number} orderId - 工单ID
 * @param {String} status - 状态（'Completed' 或 'Needs Rework'）
 * @param {String} reviewNotes - 审核备注
 * @returns {Promise<Object>} 更新结果
 */
const reviewWorkOrder = async (orderId, status, reviewNotes) => {
  console.log('[WorkOrder] Reviewing work order:', orderId, status);
  const result = await callCloud('workOrderManager', {
    action: 'reviewOrder',
    data: { order_id: orderId, status, review_notes: reviewNotes }
  }, { loadingText: '提交中...' });
  console.log('[WorkOrder] Review submitted');
  return result;
};

/**
 * 更新工单信息（仅待维修可编辑）
 * @param {Number} orderId - 工单ID
 * @param {Object} updates - 更新字段
 * @returns {Promise<Object>} 更新结果
 */
const updateWorkOrderDetails = async (orderId, updates) => {
  console.log('[WorkOrder] Updating work order details:', orderId, updates);
  const result = await callCloud('workOrderManager', {
    action: 'updateDetails',
    data: { order_id: orderId, updates: updates || {} }
  }, { loadingText: '保存中...' });
  return result;
};

/**
 * 删除工单
 * @param {Number} orderId - 工单ID
 * @returns {Promise<Object>} 删除结果
 */
const deleteWorkOrder = async (orderId) => {
  console.log('[WorkOrder] Deleting work order:', orderId);
  const result = await callCloudSilent('workOrderManager', {
    action: 'delete',
    data: { order_id: orderId }
  });
  console.log('[WorkOrder] Work order deleted');
  return result;
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  listWorkOrders,
  getWorkOrderById,
  getWorkOrderByNumber,
  checkOrderNumberExists,
  updateWorkOrderStatus,
  updateWorkOrderDetails,
  deleteWorkOrder,
  getFaultTypes,
  getWorkOrderStats,
  completeRepair,
  reviewWorkOrder
};
