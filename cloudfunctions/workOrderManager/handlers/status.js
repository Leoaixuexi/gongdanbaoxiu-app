/**
 * 工单管理 - 状态流转处理
 */

const {
  db,
  _,
  ROLE,
  normalizeStatus,
  getUserByOpenId,
  createNotification,
  createBatchNotifications,
  formatNotificationMessage,
  addStatusHistory,
  normalizeNotes,
  calculateWorkOrderDuration,
  writeAuditLog,
} = require('../helpers');

// 状态前置白名单（管理员可跳过）
const STATUS_TRANSITIONS = {
  'Pending Repair': ['In Progress'],
  'In Progress': ['Repaired'],
  'Needs Rework': ['In Progress'],
  'Repaired': ['Completed', 'Needs Rework'],
};

// 维修员同时维修中工单上限
const MAX_CONCURRENT_ORDERS_PER_TECHNICIAN = 5;

/**
 * 更新工单状态
 */
async function updateOrderStatus(openid, orderId, newStatus, notes = '') {
  const workOrders = db.collection('work_orders');
  const user = await getUserByOpenId(openid);

  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const numericOrderId = parseInt(orderId, 10);
  if (Number.isNaN(numericOrderId)) {
    throw new Error('工单ID不正确');
  }

  // 获取工单
  const { data: orders } = await workOrders.where({ order_id: numericOrderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const oldStatus = normalizeStatus(order.status);
  const targetStatus = normalizeStatus(newStatus);

  // 权限检查：管理员或维修员（部门匹配）可操作；行政经理/办美员工不再可接单
  const isAdmin = user.role_id === ROLE.ADMIN;
  const isTechnicianWithAccess = user.role_id === ROLE.TECHNICIAN && order.responsible_party === user.department;

  if (!(isAdmin || isTechnicianWithAccess)) {
    throw new Error('权限不足');
  }

  // 状态流转校验
  if (!isAdmin) {
    // 维修员只允许"接单/开始维修"类操作
    const allowedFrom = new Set(['Pending Repair', 'Needs Rework']);
    if (targetStatus !== 'In Progress' || !allowedFrom.has(oldStatus)) {
      throw new Error('不允许的状态变更，请使用对应的操作入口');
    }
  }

  // 接单并发数限制（维修员从 Pending/Needs Rework 进入 In Progress）
  if (user.role_id === ROLE.TECHNICIAN && targetStatus === 'In Progress') {
    const { total: activeCount } = await workOrders.where({
      'assigned_technician.user_id': user.user_id,
      status: 'In Progress'
    }).count();
    if (activeCount >= MAX_CONCURRENT_ORDERS_PER_TECHNICIAN) {
      throw new Error(`您已有 ${activeCount} 条维修中工单，超过同时维修上限（${MAX_CONCURRENT_ORDERS_PER_TECHNICIAN}）`);
    }
  }

  // 准备更新数据
  const now = new Date();
  const updateData = {
    status: targetStatus,
    updated_at: now,
    status_history: _.push(addStatusHistory(oldStatus, targetStatus, user, notes)),
  };
  if (targetStatus === 'In Progress' && !order.started_at) {
    updateData.started_at = now;
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  await writeAuditLog({
    user,
    action: 'update_status',
    order_id: numericOrderId,
    before: { status: oldStatus },
    after: { status: targetStatus },
    extra: notes ? { notes } : null,
  });

  // 状态变更通知（管理员/经理手动切换时主动告知相关方）
  try {
    if (targetStatus === 'In Progress' && order.submitter?.user_id) {
      await createNotification(
        order.submitter.user_id,
        'order_in_progress',
        `工单编号：${order.order_number}`,
        formatNotificationMessage(order.floor, order.location, order.description, '，已开始维修。'),
        { order_id: numericOrderId, order_number: order.order_number, floor: order.floor, location: order.location }
      );
    } else if (targetStatus === 'Completed') {
      const recipients = new Set();
      if (order.submitter?.user_id) recipients.add(order.submitter.user_id);
      if (order.assigned_technician?.user_id) recipients.add(order.assigned_technician.user_id);
      if (recipients.size > 0) {
        await createBatchNotifications(
          [...recipients],
          'order_completed',
          `工单编号：${order.order_number}`,
          formatNotificationMessage(order.floor, order.location, order.description, '，工单已完结。'),
          { order_id: numericOrderId, order_number: order.order_number, floor: order.floor, location: order.location }
        );
      }
    }
  } catch (e) {
    console.error('[updateOrderStatus] notify error:', e);
  }

  return {
    success: true,
    order_id: numericOrderId,
    old_status: oldStatus,
    new_status: targetStatus
  };
}

/**
 * 完成维修
 */
async function completeRepair(openid, orderId, completionNotes, partsUsed) {
  const workOrders = db.collection('work_orders');
  const materials = db.collection('materials');
  const materialRecords = db.collection('material_records');
  const user = await getUserByOpenId(openid);

  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const numericOrderId = parseInt(orderId, 10);
  if (Number.isNaN(numericOrderId)) {
    throw new Error('工单ID不正确');
  }

  // 获取工单
  const { data: orders } = await workOrders.where({ order_id: numericOrderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const oldStatus = normalizeStatus(order.status);
  const targetStatus = 'Repaired'; // 固定为待复核状态
  const notes = normalizeNotes(completionNotes);

  // 权限检查：管理员，或维修员且部门与责任方匹配
  const isAdmin = user.role_id === 1;
  const isTechnicianWithAccess = user.role_id === 3 && order.responsible_party === user.department;
  if (!(isAdmin || isTechnicianWithAccess)) {
    throw new Error('只有责任方部门的维修员可以完成维修');
  }

  // 状态检查：只有"维修中"或"需返工"的工单可以完成
  if (oldStatus !== 'In Progress' && oldStatus !== 'Needs Rework') {
    throw new Error('只有维修中或需返工的工单可以完成');
  }

  // ==== 配件出库 + 工单更新（事务保证一致性）====
  const validParts = Array.isArray(partsUsed)
    ? partsUsed.filter(p => p && p.material_id && Number(p.quantity) > 0)
    : [];
  const partsSnapshot = []; // 写入工单的快照

  // 预先校验配件存在并锁定库存值（并发加载，事务内 update 用 inc 防并发）
  const loadedMaterials = await Promise.all(
    validParts.map(p => materials.where({ material_id: p.material_id }).get().then(r => r.data[0]))
  );
  for (let i = 0; i < validParts.length; i++) {
    const mat = loadedMaterials[i];
    if (!mat) throw new Error('配件不存在');
    const qty = Number(validParts[i].quantity);
    if (mat.stock < qty) {
      throw new Error(`配件"${mat.name}"库存不足（当前 ${mat.stock}）`);
    }
    partsSnapshot.push({
      material_id: mat.material_id,
      material_name: mat.name,
      unit: mat.unit || '个',
      quantity: qty,
    });
  }

  // 预生成 record_id 起点（事务内不再查询，避免事务超时）
  let nextRecordId = 1;
  if (validParts.length > 0) {
    const { data: lastRec } = await materialRecords.orderBy('record_id', 'desc').limit(1).get();
    nextRecordId = lastRec.length > 0 ? lastRec[0].record_id + 1 : 1;
  }

  const now = new Date();
  const usageArea = order.location || '';

  const updateData = {
    status: targetStatus,
    updated_at: now,
    completion_notes: notes || null,
    repaired_at: now,
    parts_used: partsSnapshot,
    status_history: _.push(addStatusHistory(oldStatus, targetStatus, user, notes))
  };

  // 用事务原子化"扣库存 + 写出库记录 + 更新工单"
  await db.runTransaction(async transaction => {
    // 1) 对每个配件：二次校验库存 → 扣减 → 写出库记录
    for (let i = 0; i < validParts.length; i++) {
      const m = loadedMaterials[i];
      const qty = Number(validParts[i].quantity);

      const matDoc = await transaction.collection('materials').doc(m._id).get();
      if (!matDoc.data || matDoc.data.stock < qty) {
        await transaction.rollback(`配件"${m.name}"库存不足`);
        return;
      }

      await transaction.collection('materials').doc(m._id).update({
        data: { stock: _.inc(-qty), updated_at: now }
      });

      await transaction.collection('material_records').add({
        data: {
          record_id: nextRecordId++,
          material_id: m.material_id,
          material_name: m.name,
          material_number: m.material_number || '',
          category: m.category || '',
          spec: m.spec || '',
          model: m.model || '',
          usage_area: usageArea,
          material_image: (m.images && m.images[0]) || '',
          type: 'out',
          quantity: qty,
          operator: { user_id: user.user_id, name: user.name },
          remark: `工单 ${order.order_number || numericOrderId} 维修领用`,
          work_order_id: numericOrderId,
          created_at: now,
        }
      });
    }

    // 2) 更新工单
    await transaction.collection('work_orders').doc(order._id).update({
      data: updateData
    });
  });

  await writeAuditLog({
    user,
    action: 'complete_repair',
    order_id: numericOrderId,
    before: { status: oldStatus },
    after: { status: targetStatus },
    extra: { parts_used: partsSnapshot, completion_notes: notes || null },
  });

  // 场景2：发送通知给提交者
  const notificationMessage = formatNotificationMessage(
    order.floor,
    order.location,
    order.description,
    '，维修完成，请到场复核。'
  );

  await createNotification(
    order.submitter.user_id,
    'order_repaired',
    `工单编号：${order.order_number}`,
    notificationMessage,
    {
      order_id: numericOrderId,
      order_number: order.order_number,
      floor: order.floor,
      location: order.location
    }
  );

  return {
    order_id: numericOrderId,
    old_status: oldStatus,
    new_status: targetStatus
  };
}

/**
 * 审核工单
 */
async function reviewOrder(openid, orderId, status, reviewNotes) {
  const workOrders = db.collection('work_orders');
  const user = await getUserByOpenId(openid);

  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const numericOrderId = parseInt(orderId, 10);
  if (Number.isNaN(numericOrderId)) {
    throw new Error('工单ID不正确');
  }

  // 获取工单
  const { data: orders } = await workOrders.where({ order_id: numericOrderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const oldStatus = normalizeStatus(order.status);
  const targetStatus = normalizeStatus(status);
  const notes = normalizeNotes(reviewNotes);

  // 权限检查：管理员可审核任意工单；办美员工可审核所有工单
  const canReview = user.role_id === 1 || user.role_id === 4;
  if (!canReview) {
    throw new Error('无权限审核工单');
  }

  // 状态检查：只有"待复核"的工单可以审核
  if (oldStatus !== 'Repaired') {
    throw new Error('只有待复核的工单可以审核');
  }

  // 准备更新数据
  const updateData = {
    status: targetStatus,
    updated_at: new Date(),
    review_notes: notes || null,
    status_history: _.push(addStatusHistory(oldStatus, targetStatus, user, notes))
  };

  // 根据状态设置时间
  if (targetStatus === 'Completed') {
    const now = new Date();
    updateData.completed_at = now;
    updateData.reviewed_at = now;

    const duration = calculateWorkOrderDuration({
      status: 'Completed',
      created_at: order.created_at,
      completed_at: now
    });
    updateData.total_duration_seconds = duration.totalSeconds;
  } else if (targetStatus === 'Needs Rework') {
    // 返工原因是非必填的
    updateData.rework_count = _.inc(1);
  } else {
    throw new Error('审核状态不正确');
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  await writeAuditLog({
    user,
    action: 'review_order',
    order_id: numericOrderId,
    before: { status: oldStatus },
    after: { status: targetStatus },
    extra: notes ? { review_notes: notes } : null,
  });

  // 发送通知给责任方对应部门的维修员
  if (order.responsible_party) {
    const targetUsers = await db.collection('users')
      .where({ department: order.responsible_party, role_id: 3, active: true })
      .get();

    if (targetUsers.data && targetUsers.data.length > 0) {
      // 应用层二次过滤，确保 department 精确匹配（防止云数据库查询返回意外结果）
      const validUsers = targetUsers.data.filter(u =>
        u.department && u.department === order.responsible_party
      );
      const userIds = validUsers.map(u => u.user_id);

      if (targetStatus === 'Completed') {
        // 场景3：复核通过
        const notificationMessage = formatNotificationMessage(
          order.floor,
          order.location,
          order.description,
          '，复核通过，辛苦了！'
        );

        await createBatchNotifications(
          userIds,
          'order_reviewed_pass',
          `工单编号：${order.order_number}`,
          notificationMessage,
          {
            order_id: numericOrderId,
            order_number: order.order_number,
            floor: order.floor,
            location: order.location
          }
        );
      } else if (targetStatus === 'Needs Rework') {
        // 场景4：需要返工
        const notificationMessage = formatNotificationMessage(
          order.floor,
          order.location,
          order.description,
          '，现场复核未通过，请返工。'
        );

        await createBatchNotifications(
          userIds,
          'order_needs_rework',
          `工单编号：${order.order_number}`,
          notificationMessage,
          {
            order_id: numericOrderId,
            order_number: order.order_number,
            floor: order.floor,
            location: order.location
          }
        );
      }
    }
  }

  return {
    order_id: numericOrderId,
    old_status: oldStatus,
    new_status: targetStatus
  };
}

module.exports = {
  updateOrderStatus,
  completeRepair,
  reviewOrder,
};
