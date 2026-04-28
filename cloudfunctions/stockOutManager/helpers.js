/**
 * 出库管理 - 共享工具函数
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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

async function getUserByOpenId(openid) {
  const { data } = await db.collection('users').where({ wechat_openid: openid }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 进入 stock-out 模块：管理员/经理/办美/仓管员（维修员排除）
 */
function canAccessStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 提交出库申请：1/2/4/5 都可
 */
function canRequestStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 审核+执行出库：仅管理员 + 仓管员
 */
function canApproveStockOut(user) {
  return user && [1, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 自增 ID 生成器
 */
async function getNextId(collection) {
  const idFieldMap = {
    'material_requests': 'request_id',
    'material_records': 'record_id',
  };
  const idField = idFieldMap[collection];
  if (!idField) throw new Error(`getNextId: 未知 collection ${collection}`);

  const { data } = await db.collection(collection)
    .orderBy(idField, 'desc')
    .limit(1)
    .get();

  if (data.length === 0) return 1;
  return (data[0][idField] || 0) + 1;
}

/**
 * 批量创建通知（沿用项目通知模式：直写 notifications 集合）
 */
async function createBatchNotifications(userIds, type, title, message, data = {}) {
  if (!userIds || !userIds.length) return;
  const now = new Date();
  const docs = userIds.map(user_id => ({
    user_id,
    type,
    title,
    message,
    data,
    is_read: false,
    created_at: now,
  }));
  for (const doc of docs) {
    await db.collection('notifications').add({ data: doc });
  }
}

module.exports = {
  cloud,
  db,
  _,
  getEffectiveOpenId,
  getUserByOpenId,
  canAccessStockOut,
  canRequestStockOut,
  canApproveStockOut,
  getNextId,
  createBatchNotifications,
};
