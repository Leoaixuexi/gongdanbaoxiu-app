/**
 * 物料管理服务
 * 封装 materialManager 云函数调用
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

/**
 * 获取配件列表
 */
const listMaterials = async (keyword = '', page = 1, pageSize = 20) => {
  return callCloudSilent('materialManager', {
    action: 'listMaterials',
    data: { keyword, page, pageSize }
  });
};

/**
 * 新增配件
 */
const addMaterial = async (materialData) => {
  return callCloud('materialManager', {
    action: 'addMaterial',
    data: materialData
  }, { loadingText: '添加中...' });
};

/**
 * 配件入库
 */
const stockIn = async (material_id, quantity, remark = '', location = '') => {
  return callCloud('materialManager', {
    action: 'stockIn',
    data: { material_id, quantity, remark, location }
  }, { loadingText: '入库中...' });
};

/**
 * 配件出库
 */
const stockOut = async (material_id, quantity, remark = '') => {
  return callCloud('materialManager', {
    action: 'stockOut',
    data: { material_id, quantity, remark }
  }, { loadingText: '出库中...' });
};

/**
 * 按 material_number 查找配件（扫码入库用）
 * @returns {Promise<{success: boolean, material: object | null}>}
 */
const getMaterialByNumber = async (material_number) => {
  return callCloudSilent('materialManager', {
    action: 'getMaterialByNumber',
    data: { material_number }
  });
};

/**
 * 获取出入库记录
 * @param {string} type - 'in' | 'out' | '' (全部)
 */
const listRecords = async (type = '', page = 1, pageSize = 20) => {
  return callCloudSilent('materialManager', {
    action: 'listRecords',
    data: { type, page, pageSize }
  });
};

/**
 * 更新配件信息
 */
const updateMaterial = async (materialData) => {
  return callCloud('materialManager', {
    action: 'updateMaterial',
    data: materialData
  }, { loadingText: '保存中...' });
};

/**
 * 删除配件
 */
const deleteMaterial = async (material_id) => {
  return callCloud('materialManager', {
    action: 'deleteMaterial',
    data: { material_id }
  }, { loadingText: '删除中...' });
};

/**
 * 获取指定配件的出入库记录（用于详情页）
 */
const getMaterialRecords = async (material_id) => {
  return callCloudSilent('materialManager', {
    action: 'listRecords',
    data: { material_id, pageSize: 50 }
  });
};

/**
 * 获取配件累计出入库统计
 */
const getMaterialStats = async (material_id) => {
  return callCloudSilent('materialManager', {
    action: 'getMaterialStats',
    data: { material_id }
  });
};

/**
 * 获取库存预警列表
 */
const getWarnings = async () => {
  return callCloudSilent('materialManager', {
    action: 'getWarnings'
  });
};

/**
 * 按 material_id 查找配件（出库审核取最新库存用）
 */
const getMaterialById = async (material_id) => {
  return callCloudSilent('materialManager', {
    action: 'getMaterialById',
    data: { material_id }
  });
};

/**
 * 提交出库申请
 */
const createStockOutRequest = async (params) => {
  return callCloud('materialManager', {
    action: 'createStockOutRequest',
    data: params,
  }, { loadingText: '提交中...' });
};

/**
 * 审核通过出库（=执行出库）
 */
const approveStockOutRequest = async (request_id, approved_quantity) => {
  return callCloud('materialManager', {
    action: 'approveStockOutRequest',
    data: { request_id, approved_quantity },
  }, { loadingText: '审核中...' });
};

/**
 * 驳回出库申请
 */
const rejectStockOutRequest = async (request_id, reject_reason) => {
  return callCloud('materialManager', {
    action: 'rejectStockOutRequest',
    data: { request_id, reject_reason },
  }, { loadingText: '提交中...' });
};

/**
 * 撤回自己的出库申请
 */
const cancelStockOutRequest = async (request_id) => {
  return callCloud('materialManager', {
    action: 'cancelStockOutRequest',
    data: { request_id },
  }, { loadingText: '撤回中...' });
};

/**
 * 出库申请列表（多条件 + 分页）
 */
const listStockOutRequests = async (params = {}) => {
  return callCloudSilent('materialManager', {
    action: 'listStockOutRequests',
    data: { page: 1, pageSize: 20, ...params },
  });
};

/**
 * 出库申请详情
 */
const getStockOutRequest = async (request_id) => {
  return callCloudSilent('materialManager', {
    action: 'getStockOutRequest',
    data: { request_id },
  });
};

module.exports = {
  listMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  stockIn,
  stockOut,
  getMaterialByNumber,
  getMaterialById,
  listRecords,
  getWarnings,
  getMaterialStats,
  getMaterialRecords,
  createStockOutRequest,
  approveStockOutRequest,
  rejectStockOutRequest,
  cancelStockOutRequest,
  listStockOutRequests,
  getStockOutRequest,
};
