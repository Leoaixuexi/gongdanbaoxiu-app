/**
 * 物料管理 - 共享工具函数
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
 * 权限校验：是否可以访问物料管理
 * 管理员(1)、行政经理(2)、办美员工(4)、仓管员(5) 可访问
 * 维修员(3)排除
 */
function canAccessMaterial(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以管理物料（新增配件、入库、分类管理）
 * 管理员(1)、行政经理(2)、仓管员(5) 可管理
 * 办美员工(4) 已被收回（仅可申请出库）
 */
function canManageMaterial(user) {
  return user && [1, 2, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以提交出库申请
 * 管理员(1)、行政经理(2)、办美员工(4)、物资专员(5) 可申请
 */
function canRequestStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以审核出库申请
 * 管理员(1)、物资专员(5) 可审核
 */
function canApproveStockOut(user) {
  return user && [1, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 生成自增ID
 */
async function getNextId(collection) {
  let idField;
  if (collection === 'materials') idField = 'material_id';
  else if (collection === 'material_requests') idField = 'request_id';
  else idField = 'record_id';

  const { data } = await db.collection(collection)
    .orderBy(idField, 'desc')
    .limit(1)
    .get();

  if (data.length === 0) return 1;
  return (data[0][idField] || 0) + 1;
}

/**
 * 批量创建通知（直接写 notifications 集合，与 workOrderManager 保持一致）
 */
async function createBatchNotifications(userIds, type, title, message, data = {}) {
  if (!userIds || userIds.length === 0) return;

  const notifications = db.collection('notifications');

  const users = await db.collection('users')
    .where({ user_id: _.in(userIds) })
    .get();

  if (!users.data || users.data.length === 0) return;

  const promises = users.data.map(user =>
    notifications.add({
      data: {
        user_id: user.user_id,
        _openid: user.wechat_openid,
        type,
        title,
        message,
        data,
        read: false,
        sent_at: new Date(),
        read_at: null,
        created_at: new Date(),
      }
    })
  );

  await Promise.all(promises);
}

module.exports = {
  cloud,
  db,
  _,
  getEffectiveOpenId,
  getUserByOpenId,
  canAccessMaterial,
  canManageMaterial,
  canRequestStockOut,
  canApproveStockOut,
  getNextId,
  createBatchNotifications,
};
