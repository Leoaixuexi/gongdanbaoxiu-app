/**
 * 出库申请单 handlers
 */
const {
  db, _, getNextId,
  canRequestStockOut,
  canApproveStockOut,
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

/**
 * 生成 'CK-YYYYMMDD-XXXX' 出库流水编号
 */
async function generateOutRecordNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CK-${dateStr}-`;
  const { total } = await db.collection('material_records')
    .where({ record_number: db.RegExp({ regexp: `^${prefix}` }), type: 'out' })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

/**
 * 通知申请人（沿用 createBatchNotifications 直写 notifications 集合）
 */
async function notifyRequester(requesterUserId, type, title, message, payload) {
  try {
    await createBatchNotifications([requesterUserId], type, title, message, payload);
  } catch (err) {
    console.error('[StockOutRequest] notify requester fail', err);
  }
}

async function approveStockOutRequest({ data, user }) {
  if (!canApproveStockOut(user)) return { success: false, error: '无权限审核出库' };

  const { request_id, approved_quantity } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };
  const aqty = Number(approved_quantity);
  if (!Number.isInteger(aqty) || aqty < 1) {
    return { success: false, error: '实际出库数量需为 ≥1 的整数' };
  }

  // 取单
  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];
  if (req.status !== 'Pending') return { success: false, error: '单据已被处理' };

  if (aqty > req.requested_quantity) {
    return { success: false, error: `实际出库数量不能超过申请数量 ${req.requested_quantity}` };
  }

  // 取最新库存
  const { data: mats } = await db.collection('materials').where({ material_id: req.material_id }).get();
  if (!mats.length) return { success: false, error: '配件已被删除' };
  const material = mats[0];
  if (material.stock < aqty) {
    return { success: false, error: `库存不足，当前库存: ${material.stock}` };
  }

  const now = new Date();
  const recordId = await getNextId('material_records');
  const recordNumber = await generateOutRecordNumber();

  // 原子条件更新申请单：where(request_id, status=Pending) 防并发
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

  // 扣库存 + 写流水（并行）
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

  // 通知申请人（不阻塞主流程）
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

  // 取单仅为通知用
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

module.exports = {
  createStockOutRequest,
  approveStockOutRequest,
  rejectStockOutRequest,
};
