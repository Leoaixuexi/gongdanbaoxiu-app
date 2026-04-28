/**
 * 出库管理云函数（路由分发）
 */
const {
  cloud, getEffectiveOpenId, getUserByOpenId, canAccessStockOut,
} = require('./helpers');

async function generateRequestNumber() {
  const { db } = require('./helpers');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CKSQ-${dateStr}-`;
  const { total } = await db.collection('material_requests')
    .where({ request_number: db.RegExp({ regexp: `^${prefix}` }) })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

async function notifyApprovers(payload) {
  try {
    const { db, _, createBatchNotifications } = require('./helpers');
    const { data: approvers } = await db.collection('users')
      .where({ role_id: _.in([1, 5]), active: true })
      .limit(100)
      .get();
    if (!approvers.length) {
      console.warn('[StockOut] no approvers active');
      return;
    }
    const userIds = approvers.map(u => u.user_id);
    await createBatchNotifications(
      userIds,
      'stock_out_pending',
      '新的出库申请待审核',
      `${payload.requester_name} 申请 ${payload.material_name} × ${payload.quantity}（${payload.region}）`,
      payload
    );
  } catch (err) {
    console.error('[StockOut] notify approvers fail', err);
  }
}

async function createStockOutRequest({ data, user }) {
  const { canRequestStockOut, db, getNextId } = require('./helpers');
  if (!canRequestStockOut(user)) return { success: false, error: '无权限提交出库申请' };

  const { material_id, requested_quantity, region, scene, remark = '' } = data;

  if (!material_id) return { success: false, error: '请选择物资' };
  const qty = Number(requested_quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999999) {
    return { success: false, error: '申请数量需为 1-999999 的整数' };
  }
  if (!region || !scene) return { success: false, error: '区域和场景必填' };
  if (remark && remark.length > 200) return { success: false, error: '备注不能超过 200 字' };

  const { data: mats } = await db.collection('materials').where({ material_id }).get();
  if (!mats.length) return { success: false, error: '配件不存在' };
  const material = mats[0];

  const requestId = await getNextId('material_requests');
  const requestNumber = await generateRequestNumber();
  const now = new Date();

  await db.collection('material_requests').add({
    data: {
      request_id: requestId,
      request_number: requestNumber,
      material_id,
      material_name: material.name,
      material_number: material.material_number || '',
      material_image: (material.images && material.images[0]) || '',
      category: material.category || '',
      spec: material.spec || '',
      model: material.model || '',
      unit: material.unit || '',
      requester: { user_id: user.user_id, name: user.name, role_id: user.role_id },
      requested_quantity: qty,
      region, scene, remark,
      status: 'Pending',
      reviewer: null,
      approved_quantity: null,
      out_record_id: null,
      reject_reason: null,
      created_at: now,
      updated_at: now,
      approved_at: null,
      rejected_at: null,
      cancelled_at: null,
    }
  });

  notifyApprovers({
    request_number: requestNumber,
    material_name: material.name,
    requester_name: user.name,
    quantity: qty,
    region,
  });

  return {
    success: true,
    request_id: requestId,
    request_number: requestNumber,
    message: '已提交，等待审核',
  };
}

const ROUTES = {
  ping: async () => ({ success: true, message: 'stockOutManager pong' }),
  createStockOutRequest,
  // Task 3-8 加入：
  // approveStockOutRequest, rejectStockOutRequest,
  // cancelStockOutRequest, listStockOutRequests, getStockOutRequest,
  // getMaterialById, listMaterials
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) return { success: false, error: '无法获取微信身份' };

  console.log(`[StockOutManager] Action: ${action}, OpenID: ${openid}`);

  try {
    const user = await getUserByOpenId(openid);
    if (!user) return { success: false, error: '用户不存在' };

    if (!canAccessStockOut(user)) {
      return { success: false, error: '无权限访问出库管理' };
    }

    const handler = ROUTES[action];
    if (!handler) return { success: false, error: `未知操作: ${action}` };

    return await handler({ data, user, openid, event });
  } catch (error) {
    console.error('[StockOutManager] Error:', error);
    return { success: false, error: error.message };
  }
};
