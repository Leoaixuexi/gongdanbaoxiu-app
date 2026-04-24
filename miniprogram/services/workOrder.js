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
  const { orders } = await listWorkOrders({ ...filters, fetchAll: true });
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
 * 公开获取工单详情（无需登录，用于分享链接）
 * @param {Number} orderId - 工单ID
 * @returns {Promise<Object>} { order, isPublicView }
 */
const getWorkOrderByIdPublic = async (orderId) => {
  console.log('[WorkOrder] Getting work order (public):', orderId);
  const result = await callCloudSilent('workOrderManager', {
    action: 'getByIdPublic',
    data: { order_id: orderId }
  });
  console.log('[WorkOrder] Got order (public):', result.order);
  return {
    order: result.order,
    isPublicView: result.isPublicView
  };
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
 * 维修员接单（封装 updateWorkOrderStatus → In Progress）
 */
const acceptOrder = (orderId) =>
  updateWorkOrderStatus(parseInt(orderId, 10), 'In Progress', '维修员接单开始维修');

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
 * 完成维修
 * @param {Number} orderId - 工单ID
 * @param {String} completionNotes - 完成描述（选填）
 * @returns {Promise<Object>} 更新结果
 */
const completeRepair = async (orderId, completionNotes, partsUsed = []) => {
  console.log('[WorkOrder] Completing repair:', orderId, 'parts:', partsUsed.length);
  const result = await callCloud('workOrderManager', {
    action: 'completeRepair',
    data: { order_id: orderId, completion_notes: completionNotes, parts_used: partsUsed }
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

/**
 * 获取工单统计和ID列表（懒加载第一阶段）
 * 返回轻量数据：状态统计 + 工单ID列表
 * @returns {Promise<Object>} { statistics, orderIds, total }
 */
const getOrderStatistics = async () => {
  console.log('[WorkOrder] Getting order statistics');
  const result = await callCloudSilent('workOrderManager', {
    action: 'getStatistics'
  });
  console.log('[WorkOrder] Got statistics:', result.total);
  return {
    statistics: result.statistics || {},
    orderIds: result.orderIds || [],
    total: result.total || 0
  };
};

/**
 * 根据ID列表获取工单详情（懒加载第二阶段）
 * @param {Array<Number>} ids - 工单ID列表
 * @returns {Promise<Array>} 工单详情列表
 */
const getOrdersByIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }
  console.log('[WorkOrder] Getting orders by ids:', ids.length);
  const result = await callCloudSilent('workOrderManager', {
    action: 'getOrdersByIds',
    data: { ids }
  });
  console.log('[WorkOrder] Got orders by ids:', result.orders?.length);
  return result.orders || [];
};

/**
 * 导出工单为Excel
 * @param {Object} filters - 筛选条件
 * @param {String} filters.status - 状态筛选
 * @param {Object} filters.timeRange - 时间范围 { type, startDate, endDate }
 * @param {Object} filters.advancedFilters - 高级筛选条件
 * @returns {Promise<Object>} { downloadUrl, fileName, totalCount }
 */
const exportWorkOrders = async (filters = {}) => {
  console.log('[WorkOrder] Exporting work orders with filters:', filters);
  const result = await callCloud('workOrderManager', {
    action: 'exportWorkOrders',
    data: { filters }
  }, { loadingText: '正在导出...', timeout: 60000 });
  console.log('[WorkOrder] Export completed:', result.fileName, result.totalCount);
  return {
    downloadUrl: result.downloadUrl,
    fileID: result.fileID,
    fileName: result.fileName,
    totalCount: result.totalCount
  };
};

/**
 * 下载并打开导出的文件
 * @param {String} downloadUrl - 下载地址
 * @param {String} fileName - 文件名
 * @returns {Promise<void>}
 */
const downloadAndOpenFile = async (downloadUrl, fileName) => {
  console.log('[WorkOrder] Downloading file:', fileName);

  // 下载文件
  const downloadRes = await new Promise((resolve, reject) => {
    wx.downloadFile({
      url: downloadUrl,
      success: resolve,
      fail: reject
    });
  });

  if (downloadRes.statusCode !== 200) {
    throw new Error('文件下载失败');
  }

  const tempFilePath = downloadRes.tempFilePath;
  console.log('[WorkOrder] File downloaded to:', tempFilePath);

  // 保存到本地并重命名
  const fs = wx.getFileSystemManager();
  const savedFilePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

  // 先删除已存在的文件
  try {
    fs.unlinkSync(savedFilePath);
  } catch (e) {
    // 文件不存在，忽略错误
  }

  await new Promise((resolve, reject) => {
    fs.saveFile({
      tempFilePath,
      filePath: savedFilePath,
      success: resolve,
      fail: reject
    });
  });

  console.log('[WorkOrder] File saved to:', savedFilePath);

  // 打开文件预览
  await new Promise((resolve, reject) => {
    wx.openDocument({
      filePath: savedFilePath,
      showMenu: true,
      fileType: 'xlsx',
      success: resolve,
      fail: reject
    });
  });

  console.log('[WorkOrder] File opened successfully');
};

/**
 * 催接单
 */
const urgeAccept = async (orderId) => {
  console.log('[WorkOrder] Urging accept:', orderId);
  const result = await callCloud('workOrderManager', {
    action: 'urgeAccept',
    data: { order_id: orderId }
  }, { loadingText: '发送中...' });
  return result;
};

/**
 * 催维修
 */
const urgeRepair = async (orderId) => {
  console.log('[WorkOrder] Urging repair:', orderId);
  const result = await callCloud('workOrderManager', {
    action: 'urgeRepair',
    data: { order_id: orderId }
  }, { loadingText: '发送中...' });
  return result;
};

/**
 * 催复核
 */
const urgeReview = async (orderId) => {
  console.log('[WorkOrder] Urging review:', orderId);
  const result = await callCloud('workOrderManager', {
    action: 'urgeReview',
    data: { order_id: orderId }
  }, { loadingText: '发送中...' });
  return result;
};

module.exports = {
  createWorkOrder,
  getWorkOrders,
  listWorkOrders,
  getWorkOrderById,
  getWorkOrderByIdPublic,
  getWorkOrderByNumber,
  checkOrderNumberExists,
  updateWorkOrderStatus,
  acceptOrder,
  updateWorkOrderDetails,
  deleteWorkOrder,
  getFaultTypes,
  completeRepair,
  reviewWorkOrder,
  // 懒加载优化
  getOrderStatistics,
  getOrdersByIds,
  // 导出功能
  exportWorkOrders,
  downloadAndOpenFile,
  // 催单
  urgeAccept,
  urgeRepair,
  urgeReview
};
