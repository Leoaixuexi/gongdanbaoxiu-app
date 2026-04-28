/**
 * 出库管理服务
 * 封装 stockOutManager 云函数调用
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

/**
 * 提交出库申请
 */
const createStockOutRequest = async (params) => {
  return callCloud('stockOutManager', {
    action: 'createStockOutRequest',
    data: params,
  }, { loadingText: '提交中...' });
};

/**
 * 审核通过出库（=执行出库）
 */
const approveStockOutRequest = async (request_id, approved_quantity) => {
  return callCloud('stockOutManager', {
    action: 'approveStockOutRequest',
    data: { request_id, approved_quantity },
  }, { loadingText: '审核中...' });
};

/**
 * 驳回出库申请
 */
const rejectStockOutRequest = async (request_id, reject_reason) => {
  return callCloud('stockOutManager', {
    action: 'rejectStockOutRequest',
    data: { request_id, reject_reason },
  }, { loadingText: '提交中...' });
};

/**
 * 撤回自己的出库申请
 */
const cancelStockOutRequest = async (request_id) => {
  return callCloud('stockOutManager', {
    action: 'cancelStockOutRequest',
    data: { request_id },
  }, { loadingText: '撤回中...' });
};

/**
 * 出库申请列表（多条件 + 分页）
 */
const listStockOutRequests = async (params = {}) => {
  return callCloudSilent('stockOutManager', {
    action: 'listStockOutRequests',
    data: { page: 1, pageSize: 20, ...params },
  });
};

/**
 * 出库申请详情
 */
const getStockOutRequest = async (request_id) => {
  return callCloudSilent('stockOutManager', {
    action: 'getStockOutRequest',
    data: { request_id },
  });
};

/**
 * 按 material_id 查找配件（出库审核取最新库存用）
 */
const getMaterialById = async (material_id) => {
  return callCloudSilent('stockOutManager', {
    action: 'getMaterialById',
    data: { material_id }
  });
};

/**
 * 物资搜索列表（用于 form 物资 picker）
 */
const listMaterials = async (keyword = '', page = 1, pageSize = 50) => {
  return callCloudSilent('stockOutManager', {
    action: 'listMaterials',
    data: { keyword, page, pageSize }
  });
};

module.exports = {
  createStockOutRequest,
  approveStockOutRequest,
  rejectStockOutRequest,
  cancelStockOutRequest,
  listStockOutRequests,
  getStockOutRequest,
  getMaterialById,
  listMaterials,
};
