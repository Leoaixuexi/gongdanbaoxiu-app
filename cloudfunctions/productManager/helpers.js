/**
 * 商品（耗品）管理 - 共享工具函数
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取有效的 OpenID
 */
function getEffectiveOpenId(wxContext, event) {
  const { test_openid, adminToken } = event || {};
  const requiredAdminToken = process.env.ADMIN_TOKEN;
  const canUseTestOpenid = !!(
    test_openid &&
    process.env.ALLOW_TEST_OPENID === 'true' &&
    requiredAdminToken &&
    adminToken === requiredAdminToken
  );
  return canUseTestOpenid ? test_openid : wxContext.OPENID;
}

/**
 * 获取用户信息
 */
async function getUserByOpenId(openid) {
  const { data } = await db.collection('users').where({ wechat_openid: openid }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 权限校验：是否可以访问商品管理
 * 管理员(1)、行政经理(2)、办美员工(4)、仓管员(5) 可访问
 * 维修员(3)排除
 */
function canAccessProduct(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以管理商品（新增、入库、改、删）
 * 管理员(1)、行政经理(2)、仓管员(5) 可管理
 */
function canManageProduct(user) {
  return user && [1, 2, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 生成自增ID
 */
async function getNextId(collection) {
  const idField = collection === 'products' ? 'product_id' : 'record_id';

  const { data } = await db.collection(collection)
    .orderBy(idField, 'desc')
    .limit(1)
    .get();

  if (data.length === 0) return 1;
  return (data[0][idField] || 0) + 1;
}

module.exports = {
  cloud,
  db,
  _,
  getEffectiveOpenId,
  getUserByOpenId,
  canAccessProduct,
  canManageProduct,
  getNextId,
};
