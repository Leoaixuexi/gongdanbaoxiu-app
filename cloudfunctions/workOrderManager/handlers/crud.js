/**
 * 工单管理 - CRUD 操作
 */

const {
  db,
  _,
  SLA_RULES,
  normalizeStatus,
  generateOrderNumber,
  parseReportDateTime,
  calculateSLADeadline,
  getUserByOpenId,
  getOrderCategories,
  getResponsibleParties,
  assignTechnician,
  createBatchNotifications,
  formatNotificationMessage,
  addStatusHistory,
  enhanceWorkOrder,
  getStatusVariants,
  writeAuditLog,
} = require('../helpers');

/**
 * 创建工单
 */
async function createWorkOrder(openid, orderData) {
  const workOrders = db.collection('work_orders');

  // 获取提交者信息
  const submitter = await getUserByOpenId(openid);
  if (!submitter) {
    throw new Error('用户不存在');
  }
  if (submitter.active === false) {
    throw new Error('账号已被停用');
  }

  // 角色校验：维修员不允许提报工单
  if (submitter.role_id === 3) {
    throw new Error('维修员不允许提报工单');
  }

  // 验证工单类别（从字典动态获取）
  const validCategories = await getOrderCategories();
  if (!orderData.order_category || !validCategories.includes(orderData.order_category)) {
    throw new Error('工单类别不正确');
  }

  // 验证责任方（从字典动态获取）
  const validParties = await getResponsibleParties();
  if (!orderData.responsible_party || !validParties.includes(orderData.responsible_party)) {
    throw new Error('责任方不正确');
  }

  // 自动分配维修员
  const technician = await assignTechnician();

  // 自动生成工单编号（服务端强制生成，忽略客户端传入）
  const orderNumber = await generateOrderNumber();

  // 计算 SLA 截止时间
  const now = new Date();
  const slaDeadline = calculateSLADeadline(orderData.priority, now);

  // 生成工单ID（避免 count+1 的并发冲突）
  // Generate a numeric ID with low collision probability (ms + random)
  const orderId = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

  let reportTime = now;
  if (orderData.report_date && orderData.report_time) {
    reportTime = parseReportDateTime(orderData.report_date, orderData.report_time);
  }

  // 构建工单数据
  const newOrder = {
    order_id: orderId,
    order_number: orderNumber,
    floor: orderData.floor,
    location: orderData.location,
    order_category: orderData.order_category,
    responsible_party: orderData.responsible_party,
    priority: orderData.priority,
    description: orderData.description,
    photos: orderData.photos || [],
    remark: orderData.remark || null,
    report_time: reportTime,
    status: 'Pending Repair',
    submitter: {
      user_id: submitter.user_id,
      openid: submitter.wechat_openid,
      name: submitter.name,
      phone: submitter.contact_phone,
      role_id: submitter.role_id
    },
    assigned_technician: {
      user_id: technician.user_id,
      openid: technician.wechat_openid,
      name: technician.name,
      phone: technician.contact_phone,
      avatar: technician.avatar || ''
    },
    created_at: now,
    assigned_at: now,
    started_at: null,
    repaired_at: null,
    reviewed_at: null,
    completed_at: null,
    sla_deadline: slaDeadline,
    is_overdue: false,
    rework_count: 0,
    updated_at: now,
    status_history: [
      addStatusHistory(null, 'Pending Repair', submitter, '工单创建')
    ]
  };

  // 插入数据库
  const result = await workOrders.add({
    data: newOrder
  });

  // 通知责任方对应部门的维修员
  if (orderData.responsible_party) {
    const targetUsers = await db.collection('users')
      .where({
        department: orderData.responsible_party,
        role_id: 3,  // 只通知维修员
        active: true
      })
      .get();

    if (targetUsers.data && targetUsers.data.length > 0) {
      // 应用层二次过滤，确保 department 精确匹配（防止云数据库查询返回意外结果）
      const validUsers = targetUsers.data.filter(user =>
        user.department && user.department === orderData.responsible_party
      );

      console.log('[WorkOrder] Creating notification - responsible_party:', orderData.responsible_party);
      console.log('[WorkOrder] Valid target users:', validUsers.map(u => ({
        user_id: u.user_id,
        department: u.department
      })));

      if (validUsers.length > 0) {
        // 排除提交工单的用户自己
        const userIds = validUsers
          .map(user => user.user_id)
          .filter(id => id !== submitter.user_id);

        if (userIds.length > 0) {
          const notificationMessage = formatNotificationMessage(
            orderData.floor,
            orderData.location,
            orderData.description,
            '，请确认并安排维修。'
          );

          await createBatchNotifications(
            userIds,
            'work_order_new',
            `工单编号：${orderNumber}`,
            notificationMessage,
            {
              order_id: orderId,
              order_number: orderNumber,
              floor: orderData.floor,
              location: orderData.location
            }
          );
        }
      }
    }
  }

  return {
    ...newOrder,
    _id: result._id
  };
}

/**
 * 获取工单列表
 */
async function getWorkOrders(openid, filters = {}) {
  const workOrders = db.collection('work_orders');

  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const page = Math.max(parseInt(filters.page || 1, 10), 1);
  const limit = parseInt(filters.limit || 100, 10);
  const fetchAll = filters.fetchAll === true;

  const conditions = {};

  // 根据角色过滤
  if (user.role_id === 3) {
    // 维修员只能看到责任方与自己部门匹配的工单
    if (user.department) {
      conditions.responsible_party = user.department;
    }
  }
  // 行政经理(2)、办美员工(4)、管理员(1) 可见所有工单（不附加条件）

  // 应用过滤条件（兼容老数据中文状态）
  if (filters.status) {
    conditions.status = _.in(getStatusVariants(filters.status));
  }

  if (filters.priority) {
    conditions.priority = filters.priority;
  }

  const pageSize = Math.min(Math.max(limit, 1), 100);
  const offset = (page - 1) * pageSize;

  // count 与首页数据并发拉取，省一次 RTT
  const [{ total }, firstPage] = await Promise.all([
    workOrders.where(conditions).count(),
    workOrders.where(conditions).orderBy('created_at', 'desc').skip(fetchAll ? 0 : offset).limit(fetchAll ? 100 : pageSize).get(),
  ]);

  let data;
  if (fetchAll && total > 100) {
    // 已有首批 100 条，剩余分批并发拉取
    const batchSize = 100;
    const remainingBatches = Math.ceil(total / batchSize) - 1;
    const restBatches = await Promise.all(
      Array.from({ length: remainingBatches }, (_, i) =>
        workOrders.where(conditions).orderBy('created_at', 'desc').skip((i + 1) * batchSize).limit(batchSize).get()
      )
    );
    data = firstPage.data.concat(...restBatches.map(r => r.data));
  } else {
    data = firstPage.data;
  }

  return {
    orders: data.map(enhanceWorkOrder),
    total,
    page,
    limit: fetchAll ? total : pageSize,
    totalPages: fetchAll ? 1 : (total > 0 ? Math.ceil(total / pageSize) : 0),
  };
}

/**
 * 更新工单信息（仅允许待维修阶段修改）
 */
async function updateWorkOrderDetails(openid, orderId, updates = {}) {
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

  const { data: orders } = await workOrders.where({ order_id: numericOrderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const currentStatus = normalizeStatus(order.status);

  // 编辑权限：管理员任意状态；行政经理/办美员工仅"已提报"；维修员禁止
  const canEdit =
    user.role_id === 1 ||
    user.role_id === 2 ||
    user.role_id === 4;

  if (!canEdit) {
    throw new Error('无权限修改该工单');
  }

  if (user.role_id !== 1 && currentStatus !== 'Pending Repair') {
    throw new Error('仅已提报工单允许修改');
  }

  const floor = typeof updates.floor === 'string' ? updates.floor.trim() : order.floor;
  const location = typeof updates.location === 'string' ? updates.location.trim() : order.location;
  const orderCategory = typeof updates.order_category === 'string' ? updates.order_category.trim() : order.order_category;
  const responsibleParty = typeof updates.responsible_party === 'string' ? updates.responsible_party.trim() : order.responsible_party;
  const priority = typeof updates.priority === 'string' ? updates.priority.trim() : order.priority;
  const description = typeof updates.description === 'string' ? updates.description.trim() : order.description;
  const remark = typeof updates.remark === 'string' ? updates.remark.trim() : (order.remark || '');

  const photos = Array.isArray(updates.photos)
    ? updates.photos.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()).slice(0, 9)
    : (order.photos || []);

  if (!floor) throw new Error('请填写楼层');
  if (!location) throw new Error('请填写具体位置');
  // 验证工单类别（从字典动态获取）
  const validCategoriesForUpdate = await getOrderCategories();
  if (!orderCategory || !validCategoriesForUpdate.includes(orderCategory)) throw new Error('工单类别不正确');
  // 验证责任方（从字典动态获取）
  const validPartiesForUpdate = await getResponsibleParties();
  if (!responsibleParty || !validPartiesForUpdate.includes(responsibleParty)) throw new Error('责任方不正确');
  if (!priority || !Object.prototype.hasOwnProperty.call(SLA_RULES, priority)) throw new Error('优先级不正确');
  if (!description) throw new Error('请填写问题描述');
  if (!photos || photos.length === 0) throw new Error('请至少上传一张现场照片');

  let reportTime = order.report_time || order.created_at || new Date();
  if (updates.report_date && updates.report_time) {
    reportTime = parseReportDateTime(updates.report_date, updates.report_time);
  }

  const now = new Date();
  await workOrders.doc(order._id).update({
    data: {
      floor,
      location,
      order_category: orderCategory,
      responsible_party: responsibleParty,
      priority,
      report_time: reportTime,
      description,
      photos,
      remark: remark || null,
      updated_at: now,
      status_history: _.push(addStatusHistory(currentStatus, currentStatus, user, '工单信息修改')),
    }
  });

  await writeAuditLog({
    user,
    action: 'update_details',
    order_id: numericOrderId,
    before: {
      floor: order.floor,
      location: order.location,
      order_category: order.order_category,
      responsible_party: order.responsible_party,
      priority: order.priority,
      description: order.description,
    },
    after: {
      floor, location, order_category: orderCategory, responsible_party: responsibleParty, priority, description,
    },
  });

  return {
    order_id: numericOrderId,
    status: currentStatus,
  };
}

module.exports = {
  createWorkOrder,
  getWorkOrders,
  updateWorkOrderDetails,
};
