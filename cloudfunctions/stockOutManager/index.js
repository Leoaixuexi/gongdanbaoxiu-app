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

async function generateOutRecordNumber() {
  const { db } = require('./helpers');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CK-${dateStr}-`;
  const { total } = await db.collection('material_records')
    .where({ record_number: db.RegExp({ regexp: `^${prefix}` }), type: 'out' })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

async function notifyRequester(requesterUserId, type, title, message, payload) {
  try {
    const { createBatchNotifications } = require('./helpers');
    await createBatchNotifications([requesterUserId], type, title, message, payload);
  } catch (err) {
    console.error('[StockOut] notify requester fail', err);
  }
}

async function approveStockOutRequest({ data, user }) {
  const { canApproveStockOut, db, _, getNextId } = require('./helpers');
  if (!canApproveStockOut(user)) return { success: false, error: '无权限审核出库' };

  const { request_id, approved_quantity } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };
  const aqty = Number(approved_quantity);
  if (!Number.isInteger(aqty) || aqty < 1) {
    return { success: false, error: '实际出库数量需为 ≥1 的整数' };
  }

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];
  if (req.status !== 'Pending') return { success: false, error: '单据已被处理' };

  if (aqty > req.requested_quantity) {
    return { success: false, error: `实际出库数量不能超过申请数量 ${req.requested_quantity}` };
  }

  const { data: mats } = await db.collection('materials').where({ material_id: req.material_id }).get();
  if (!mats.length) return { success: false, error: '配件已被删除' };
  const material = mats[0];
  if (material.stock < aqty) {
    return { success: false, error: `库存不足，当前库存: ${material.stock}` };
  }

  const now = new Date();
  const recordId = await getNextId('material_records');
  const recordNumber = await generateOutRecordNumber();

  const updateRes = await db.collection('material_requests')
    .where({ request_id, status: 'Pending' })
    .update({
      data: {
        status: 'Approved',
        reviewer: { user_id: user.user_id, name: user.name },
        approved_quantity: aqty,
        out_record_id: recordId,
        approved_at: now,
        updated_at: now,
      }
    });

  if (updateRes.stats.updated === 0) {
    return { success: false, error: '单据已被审核' };
  }

  await Promise.all([
    db.collection('materials').doc(material._id).update({
      data: { stock: _.inc(-aqty), updated_at: now }
    }),
    db.collection('material_records').add({
      data: {
        record_id: recordId,
        record_number: recordNumber,
        material_id: req.material_id,
        material_name: req.material_name,
        material_number: req.material_number || '',
        category: req.category || '',
        spec: req.spec || '',
        model: req.model || '',
        usage_area: material.usage_area || '',
        material_image: req.material_image || '',
        type: 'out',
        quantity: aqty,
        operator: { user_id: user.user_id, name: user.name },
        request_id: req.request_id,
        region: req.region,
        scene: req.scene,
        remark: req.remark || '',
        created_at: now,
      }
    })
  ]);

  notifyRequester(
    req.requester.user_id,
    'stock_out_approved',
    '出库申请已通过',
    `${req.material_name} × ${aqty} 已出库`,
    {
      request_id: req.request_id,
      request_number: req.request_number,
      material_name: req.material_name,
      approved_quantity: aqty,
      reviewer_name: user.name,
    }
  );

  return {
    success: true,
    record_id: recordId,
    record_number: recordNumber,
    message: '出库成功',
  };
}

async function rejectStockOutRequest({ data, user }) {
  const { canApproveStockOut, db } = require('./helpers');
  if (!canApproveStockOut(user)) return { success: false, error: '无权限驳回' };

  const { request_id, reject_reason } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };
  if (!reject_reason || !reject_reason.trim()) return { success: false, error: '请填写驳回原因' };
  if (reject_reason.length > 200) return { success: false, error: '驳回原因不能超过 200 字' };

  const now = new Date();
  const updateRes = await db.collection('material_requests')
    .where({ request_id, status: 'Pending' })
    .update({
      data: {
        status: 'Rejected',
        reviewer: { user_id: user.user_id, name: user.name },
        reject_reason,
        rejected_at: now,
        updated_at: now,
      }
    });

  if (updateRes.stats.updated === 0) {
    return { success: false, error: '单据已被处理' };
  }

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (reqs.length) {
    notifyRequester(
      reqs[0].requester.user_id,
      'stock_out_rejected',
      '出库申请被驳回',
      `${reqs[0].material_name} - ${reject_reason}`,
      {
        request_id: reqs[0].request_id,
        request_number: reqs[0].request_number,
        material_name: reqs[0].material_name,
        reject_reason,
        reviewer_name: user.name,
      }
    );
  }

  return { success: true, message: '已驳回' };
}

async function cancelStockOutRequest({ data, user }) {
  const { db } = require('./helpers');
  const { request_id } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];

  if (req.requester.user_id !== user.user_id) {
    return { success: false, error: '只能撤回自己提交的申请' };
  }
  if (req.status !== 'Pending') return { success: false, error: '仅待审核单据可撤回' };

  const now = new Date();
  const updateRes = await db.collection('material_requests')
    .where({ request_id, status: 'Pending' })
    .update({
      data: {
        status: 'Cancelled',
        cancelled_at: now,
        updated_at: now,
      }
    });

  if (updateRes.stats.updated === 0) {
    return { success: false, error: '单据已被处理' };
  }
  return { success: true, message: '已撤回' };
}

async function listStockOutRequests({ data, user }) {
  const { canAccessStockOut, db, _ } = require('./helpers');
  if (!canAccessStockOut(user)) return { success: false, error: '无权限' };

  const {
    status, requester_user_id, material_id,
    region, scene, date_from, date_to, keyword,
    page = 1, pageSize = 20,
  } = data;

  const conditions = {};
  if (user.role_id === 4) {
    conditions['requester.user_id'] = user.user_id;
  } else if (requester_user_id) {
    conditions['requester.user_id'] = requester_user_id;
  }

  if (Array.isArray(status) && status.length) {
    conditions.status = _.in(status);
  } else if (typeof status === 'string' && status) {
    conditions.status = status;
  }
  if (material_id) conditions.material_id = material_id;
  if (region) conditions.region = region;
  if (scene) conditions.scene = scene;

  if (date_from && date_to) {
    conditions.created_at = _.and(_.gte(new Date(date_from)), _.lte(new Date(date_to)));
  } else if (date_from) {
    conditions.created_at = _.gte(new Date(date_from));
  } else if (date_to) {
    conditions.created_at = _.lte(new Date(date_to));
  }
  if (keyword) {
    conditions.material_name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  const query = db.collection('material_requests').where(conditions);
  const [countRes, listRes] = await Promise.all([
    query.count(),
    query.orderBy('created_at', 'desc').skip((page - 1) * pageSize).limit(pageSize).get(),
  ]);

  return {
    success: true,
    requests: listRes.data,
    total: countRes.total,
    page, pageSize,
  };
}

const ROUTES = {
  ping: async () => ({ success: true, message: 'stockOutManager pong' }),
  createStockOutRequest,
  approveStockOutRequest,
  rejectStockOutRequest,
  cancelStockOutRequest,
  listStockOutRequests,
  // Task 7-8 加入：
  // getStockOutRequest, getMaterialById, listMaterials
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
