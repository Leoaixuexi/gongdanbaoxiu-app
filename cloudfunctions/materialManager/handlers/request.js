/**
 * 出库申请单 handlers
 */
const {
  db, _, getNextId,
  canRequestStockOut,
  createBatchNotifications,
} = require('../helpers');

/**
 * 生成 'CKSQ-YYYYMMDD-XXXX' 申请单业务编号
 */
async function generateRequestNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CKSQ-${dateStr}-`;
  const { total } = await db.collection('material_requests')
    .where({ request_number: db.RegExp({ regexp: `^${prefix}` }) })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

/**
 * 通知所有 role_id IN [1,5] 且 active 的用户（异步，不阻塞主流程）
 */
async function notifyApprovers(payload) {
  try {
    const { data: approvers } = await db.collection('users')
      .where({ role_id: _.in([1, 5]), active: true })
      .limit(100)
      .get();

    if (!approvers.length) {
      console.warn('[StockOutRequest] no approvers active, skip notify');
      return;
    }

    const userIds = approvers.map(u => u.user_id);
    const title = `出库申请待审核：${payload.request_number}`;
    const message = `${payload.requester_name} 申请领用 ${payload.material_name} × ${payload.quantity}，请及时审核。`;

    await createBatchNotifications(
      userIds,
      'stock_out_pending',
      title,
      message,
      payload
    );
  } catch (err) {
    console.error('[StockOutRequest] notify approvers fail', err);
  }
}

async function createStockOutRequest({ data, user }) {
  if (!canRequestStockOut(user)) return { success: false, error: '无权限提交出库申请' };

  const { material_id, requested_quantity, region, scene, remark = '' } = data;

  // 字段校验
  if (!material_id) return { success: false, error: '请选择物资' };
  const qty = Number(requested_quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999999) {
    return { success: false, error: '申请数量需为 1-999999 的整数' };
  }
  if (!region || !scene) return { success: false, error: '区域和场景必填' };
  if (remark && remark.length > 200) return { success: false, error: '备注不能超过 200 字' };

  // 取物资快照
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
      // 物资快照
      material_id,
      material_name: material.name,
      material_number: material.material_number || '',
      material_image: (material.images && material.images[0]) || '',
      category: material.category || '',
      spec: material.spec || '',
      model: material.model || '',
      unit: material.unit || '',
      // 申请信息
      requester: { user_id: user.user_id, name: user.name, role_id: user.role_id },
      requested_quantity: qty,
      region,
      scene,
      remark,
      // 状态
      status: 'Pending',
      // 审核字段先 null
      reviewer: null,
      approved_quantity: null,
      out_record_id: null,
      reject_reason: null,
      // 时间字段
      created_at: now,
      updated_at: now,
      approved_at: null,
      rejected_at: null,
      cancelled_at: null,
    }
  });

  // 通知审核人（不阻塞主流程）
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

module.exports = {
  createStockOutRequest,
  // 其他 action 在后续 Task 4-8 加入
};
