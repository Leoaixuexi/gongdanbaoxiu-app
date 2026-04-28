/**
 * 商品（耗品）管理服务
 * 封装 productManager 云函数调用
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

/**
 * 获取商品列表
 */
const listProducts = async (keyword = '', page = 1, pageSize = 20) => {
  return callCloudSilent('productManager', {
    action: 'listProducts',
    data: { keyword, page, pageSize }
  });
};

/**
 * 新增商品
 */
const addProduct = async (productData) => {
  return callCloud('productManager', {
    action: 'addProduct',
    data: productData
  }, { loadingText: '添加中...' });
};

/**
 * 商品入库
 */
const stockIn = async (product_id, quantity, remark = '', location = '') => {
  return callCloud('productManager', {
    action: 'stockIn',
    data: { product_id, quantity, remark, location }
  }, { loadingText: '入库中...' });
};

/**
 * 商品出库
 */
const stockOut = async (product_id, quantity, remark = '') => {
  return callCloud('productManager', {
    action: 'stockOut',
    data: { product_id, quantity, remark }
  }, { loadingText: '出库中...' });
};

/**
 * 按 product_code 查找商品（扫码入库用）
 * @returns {Promise<{success: boolean, product: object | null}>}
 */
const getProductByCode = async (product_code) => {
  return callCloudSilent('productManager', {
    action: 'getProductByCode',
    data: { product_code }
  });
};

/**
 * 获取出入库记录
 * @param {string} type - 'in' | 'out' | '' (全部)
 */
const listRecords = async (type = '', page = 1, pageSize = 20) => {
  return callCloudSilent('productManager', {
    action: 'listRecords',
    data: { type, page, pageSize }
  });
};

/**
 * 更新商品信息
 */
const updateProduct = async (productData) => {
  return callCloud('productManager', {
    action: 'updateProduct',
    data: productData
  }, { loadingText: '保存中...' });
};

/**
 * 删除商品
 */
const deleteProduct = async (product_id) => {
  return callCloud('productManager', {
    action: 'deleteProduct',
    data: { product_id }
  }, { loadingText: '删除中...' });
};

/**
 * 获取指定商品的出入库记录（用于详情页）
 */
const getProductRecords = async (product_id) => {
  return callCloudSilent('productManager', {
    action: 'listRecords',
    data: { product_id, pageSize: 50 }
  });
};

/**
 * 获取商品累计出入库统计
 */
const getProductStats = async (product_id) => {
  return callCloudSilent('productManager', {
    action: 'getProductStats',
    data: { product_id }
  });
};

/**
 * 获取库存预警列表
 */
const getWarnings = async () => {
  return callCloudSilent('productManager', {
    action: 'getWarnings'
  });
};

module.exports = {
  listProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  stockIn,
  stockOut,
  getProductByCode,
  listRecords,
  getWarnings,
  getProductStats,
  getProductRecords,
};
