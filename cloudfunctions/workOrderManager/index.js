/**
 * 工单管理云函数
 * 处理工单的增删改查、状态流转、分配等操作
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// Status normalization (support legacy Chinese statuses stored in DB)
const STATUS_MAP = {
  '已提报': 'Pending Repair',
  '待接单': 'Pending Repair',
  'Pending Repair': 'Pending Repair',
  '维修中': 'In Progress',
  'In Progress': 'In Progress',
  '已修复': 'Repaired',
  '已维修': 'Repaired',
  'Repaired': 'Repaired',
  '需重修': 'Needs Rework',
  '需返工': 'Needs Rework',
  'Needs Rework': 'Needs Rework',
  '已完成': 'Completed',
  'Completed': 'Completed',
};

function normalizeStatus(status) {
  if (!status) return status;
  return STATUS_MAP[status] || status;
}

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

// SLA 规则（小时）
const SLA_RULES = {
  'Emergency': 2,
  'High': 24,
  'Normal': 72,
  'Low': 168
};

/**
 * 生成工单编号
 */
function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  return `WO${year}${month}${day}${random}`;
}

/**
 * 计算 SLA 截止时间
 */
function calculateSLADeadline(priority, createdAt = new Date()) {
  const hours = SLA_RULES[priority] || SLA_RULES['Normal'];
  const deadline = new Date(createdAt);
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
}

/**
 * 获取用户信息
 */
async function getUserByOpenId(openid) {
  const users = db.collection('users');
  const { data } = await users.where({ wechat_openid: openid }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 获取用户信息（通过 user_id）
 */
async function getUserById(userId) {
  const users = db.collection('users');
  const { data } = await users.where({ user_id: userId }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 工单类别选项
 */
const ORDER_CATEGORIES = ['电梯维修', '水电维修', '消防维修', '空调维修', '其他'];

/**
 * 责任方选项
 */
const RESPONSIBLE_PARTIES = ['物业公司', '业主', '第三方'];

/**
 * 自动分配维修员
 */
async function assignTechnician() {
  const users = db.collection('users');

  // 获取所有维修员（role_id = 3）
  const { data: technicians } = await users.where({
    role_id: 3,
    active: true
  }).get();

  if (technicians.length === 0) {
    throw new Error('没有可用的维修员');
  }

  // 简单策略：随机分配
  const randomIndex = Math.floor(Math.random() * technicians.length);
  return technicians[randomIndex];
}

/**
 * 创建通知
 */
async function createNotification(userId, type, title, message, data = {}) {
  const notifications = db.collection('notifications');
  const user = await getUserById(userId);

  if (!user) return;

  try {
    await notifications.add({
      data: {
        user_id: userId,
        _openid: user.wechat_openid,
        type,
        title,
        message,
        data,
        read: false,
        sent_at: new Date(),
        read_at: null,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('[CreateNotification] Error:', error);
  }
}

/**
 * 记录状态变更历史
 */
function addStatusHistory(fromStatus, toStatus, changedBy, notes = '') {
  return {
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: {
      user_id: changedBy.user_id,
      name: changedBy.name
    },
    changed_at: new Date(),
    notes
  };
}

/**
 * 计算工单总用时
 */
function calculateWorkOrderDuration(workOrder) {
  if (!workOrder) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      formatted: '0分钟'
    };
  }

  const { status, created_at, completed_at } = workOrder;
  const normalizedStatus = normalizeStatus(status);
  let startTime = new Date(created_at);
  let endTime;

  // 已完成的工单：从创建到完成的时间
  if (normalizedStatus === 'Completed' && completed_at) {
    endTime = new Date(completed_at);
  } else {
    // 未完成的工单：从创建到当前的时间
    endTime = new Date();
  }

  // 计算总秒数
  const totalSeconds = Math.floor((endTime - startTime) / 1000);

  if (totalSeconds < 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      formatted: '0分钟'
    };
  }

  // 计算各单位
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  // 格式化输出
  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (minutes > 0) parts.push(`${minutes}分钟`);

  if (parts.length === 0) {
    if (seconds > 0) {
      parts.push(`${seconds}秒`);
    } else {
      parts.push('0分钟');
    }
  }

  const formatted = parts.join('');

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    formatted
  };
}

/**
 * 增强工单数据（添加计算字段）
 */
function enhanceWorkOrder(workOrder) {
  if (!workOrder) return null;

  let duration;

  const normalizedStatus = normalizeStatus(workOrder.status);

  // 如果工单已完成且有存储的总用时，使用存储的值
  if (normalizedStatus === 'Completed' && workOrder.total_duration_seconds) {
    const totalSeconds = workOrder.total_duration_seconds;
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;

    // 格式化输出
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (parts.length === 0) {
      if (seconds > 0) {
        parts.push(`${seconds}秒`);
      } else {
        parts.push('0分钟');
      }
    }

    duration = {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds,
      formatted: parts.join('')
    };
  } else {
    // 否则实时计算
    duration = calculateWorkOrderDuration(workOrder);
  }

  // 返回增强后的工单数据
  return {
    ...workOrder,
    // 添加计算字段
    duration: duration.formatted,
    duration_details: {
      days: duration.days,
      hours: duration.hours,
      minutes: duration.minutes,
      seconds: duration.seconds,
      totalSeconds: duration.totalSeconds
    },
    // 添加显示用的字段别名
    submitter_name: workOrder.submitter?.name || '',
    technician_name: workOrder.assigned_technician?.name || '',
    // Always expose normalized status to the mini-program
    status: normalizedStatus,
    status_text: normalizedStatus,
    // 标记是否需要前端读秒
    needs_live_timer: normalizedStatus !== 'Completed'
  };
}


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

  // 验证工单类别
  if (!orderData.order_category || !ORDER_CATEGORIES.includes(orderData.order_category)) {
    throw new Error('工单类别不正确');
  }

  // 验证责任方
  if (!orderData.responsible_party || !RESPONSIBLE_PARTIES.includes(orderData.responsible_party)) {
    throw new Error('责任方不正确');
  }

  // 自动分配维修员
  const technician = await assignTechnician();

  // 生成工单编号（如果没有提供）
  const orderNumber = orderData.order_number || generateOrderNumber();

  // 计算 SLA 截止时间
  const now = new Date();
  const slaDeadline = calculateSLADeadline(orderData.priority, now);

  // 生成工单ID（避免 count+1 的并发冲突）
  // Generate a numeric ID with low collision probability (ms + random)
  const orderId = (Date.now() * 1000) + Math.floor(Math.random() * 1000);

  // 处理报修时间（前端传来的是北京时间，需要正确解析）
  let reportTime = now;
  if (orderData.report_date && orderData.report_time) {
    // 使用 ISO 格式并指定为中国时区 (+08:00)
    reportTime = new Date(`${orderData.report_date}T${orderData.report_time}:00+08:00`);
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
      phone: submitter.contact_phone
    },
    assigned_technician: {
      user_id: technician.user_id,
      openid: technician.wechat_openid,
      name: technician.name,
      phone: technician.contact_phone
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

  // 发送通知给维修员
  await createNotification(
    technician.user_id,
    'order_assigned',
    '新工单分配',
    `您有一个新的${orderData.priority === 'Emergency' ? '紧急' : ''}维修工单：${orderNumber}`,
    {
      order_id: orderId,
      order_number: orderNumber,
      priority: orderData.priority,
      location: `${orderData.floor}-${orderData.location}`
    }
  );

  return {
    ...newOrder,
    _id: result._id
  };
}

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

  // 权限检查
  const isAdmin = user.role_id === 1;
  const isManager = user.role_id === 2;
  const isAssignedTechnician = user.role_id === 3 && order.assigned_technician.user_id === user.user_id;

  const canUpdate = isAdmin || isManager || isAssignedTechnician;

  if (!canUpdate) {
    throw new Error('权限不足');
  }

  // 物业经理可以手动切换任意状态，维修员只能接单/开始维修
  if (!isAdmin && !isManager) {
    // 维修员只允许"接单/开始维修"类操作
    const allowedFrom = new Set(['Pending Repair', 'Needs Rework']);
    if (targetStatus !== 'In Progress' || !allowedFrom.has(oldStatus)) {
      throw new Error('不允许的状态变更，请使用对应的操作入口');
    }
  }

  // 准备更新数据
  const updateData = {
    status: targetStatus,
    updated_at: new Date(),
    status_history: _.push(addStatusHistory(oldStatus, targetStatus, user, notes)),
    started_at: new Date(),
  };

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  return {
    success: true,
    order_id: numericOrderId,
    old_status: oldStatus,
    new_status: targetStatus
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

  const isSubmitter = order.submitter?.user_id === user.user_id;
  const canEdit =
    user.role_id === 1 ||
    user.role_id === 2 ||
    (user.role_id === 4 && isSubmitter);

  if (!canEdit) {
    throw new Error('无权限修改该工单');
  }

  if (currentStatus !== 'Pending Repair') {
    throw new Error('仅待维修工单允许修改');
  }

  const floor = typeof updates.floor === 'string' ? updates.floor.trim() : order.floor;
  const location = typeof updates.location === 'string' ? updates.location.trim() : order.location;
  const orderCategory = typeof updates.order_category === 'string' ? updates.order_category.trim() : order.order_category;
  const responsibleParty = typeof updates.responsible_party === 'string' ? updates.responsible_party.trim() : order.responsible_party;
  const priority = typeof updates.priority === 'string' ? updates.priority.trim() : order.priority;
  const description = typeof updates.description === 'string' ? updates.description.trim() : order.description;
  const remark = typeof updates.remark === 'string' ? updates.remark.trim() : (order.remark || '');

  const photos = Array.isArray(updates.photos)
    ? updates.photos.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()).slice(0, 3)
    : (order.photos || []);

  if (!floor) throw new Error('请填写楼层');
  if (!location) throw new Error('请填写具体位置');
  if (!orderCategory || !ORDER_CATEGORIES.includes(orderCategory)) throw new Error('工单类别不正确');
  if (!responsibleParty || !RESPONSIBLE_PARTIES.includes(responsibleParty)) throw new Error('责任方不正确');
  if (!priority || !Object.prototype.hasOwnProperty.call(SLA_RULES, priority)) throw new Error('优先级不正确');
  if (!description || description.length < 10) throw new Error('问题描述至少需要10个字符');
  if (!photos || photos.length === 0) throw new Error('请至少上传一张现场照片');

  // 处理报修时间（允许修改）
  let reportTime = order.report_time || order.created_at || new Date();
  if (updates.report_date && updates.report_time) {
    reportTime = new Date(`${updates.report_date} ${updates.report_time}`);
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

  return {
    order_id: numericOrderId,
    status: currentStatus,
  };
}

/**
 * 获取工单列表
 */
function getStatusVariants(targetStatus) {
  const normalized = normalizeStatus(targetStatus);
  const variants = new Set([normalized]);
  Object.entries(STATUS_MAP).forEach(([raw, norm]) => {
    if (norm === normalized) variants.add(raw);
  });
  return [...variants];
}

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
  const limit = Math.min(Math.max(parseInt(filters.limit || 100, 10), 1), 100);
  const offset = (page - 1) * limit;

  const conditions = {};

  // 根据角色过滤
  if (user.role_id === 3) {
    // 维修员只能看到分配给自己的工单
    conditions['assigned_technician.user_id'] = user.user_id;
  } else if (user.role_id === 4) {
    // 物业员工只能看到自己提交的工单
    conditions['submitter.user_id'] = user.user_id;
  }
  // 管理员和物业经理可以看到所有工单

  // 应用过滤条件（兼容老数据中文状态）
  if (filters.status) {
    conditions.status = _.in(getStatusVariants(filters.status));
  }

  if (filters.priority) {
    conditions.priority = filters.priority;
  }

  const [{ total }, { data }] = await Promise.all([
    workOrders.where(conditions).count(),
    workOrders
      .where(conditions)
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get(),
  ]);

  return {
    orders: data.map(order => enhanceWorkOrder(order)),
    total,
    page,
    limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  };
}

/**
 * 完成维修
 */
function normalizeNotes(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizePhotoUrls(value, maxLen = 9) {
  if (!Array.isArray(value)) return [];
  const urls = value
    .filter(v => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean);
  return urls.slice(0, maxLen);
}

async function completeRepair(openid, orderId, status, completionNotes, repairPhotos) {
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
  const notes = normalizeNotes(completionNotes);
  const photos = normalizePhotoUrls(repairPhotos);

  // 权限检查：只有分配的维修员可以完成维修
  if (user.role_id !== 3 || order.assigned_technician.user_id !== user.user_id) {
    throw new Error('只有分配的维修员可以完成维修');
  }

  // 状态检查：只有"维修中"或"需重修"的工单可以完成
  if (oldStatus !== 'In Progress' && oldStatus !== 'Needs Rework') {
    throw new Error('只有维修中或需重修的工单可以完成');
  }

  // 准备更新数据
  const updateData = {
    status: targetStatus,
    updated_at: new Date(),
    completion_notes: notes || null,
    repair_photos: photos,
    status_history: _.push(addStatusHistory(oldStatus, targetStatus, user, notes))
  };

  // 根据状态设置时间
  if (targetStatus === 'Repaired') {
    updateData.repaired_at = new Date();
  } else if (targetStatus === 'Needs Rework') {
    if (!notes) {
      throw new Error('返工时必须填写维修说明');
    }
    updateData.rework_count = _.inc(1);
  } else {
    throw new Error('维修完成状态不正确');
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  // 发送通知给提交者
  if (targetStatus === 'Repaired') {
    await createNotification(
      order.submitter.user_id,
      'order_repaired',
      '工单维修完成',
      `工单 ${order.order_number} 已维修完成，请验收`,
      {
        order_id: numericOrderId,
        order_number: order.order_number
      }
    );
  }

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

  // 权限检查：只有提交者可以审核
  if (order.submitter.user_id !== user.user_id) {
    throw new Error('只有工单提交者可以审核');
  }

  // 状态检查：只有"已修复"的工单可以审核
  if (oldStatus !== 'Repaired') {
    throw new Error('只有已修复的工单可以审核');
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
    if (!notes) {
      throw new Error('返工时必须填写审核意见');
    }
    updateData.rework_count = _.inc(1);
  } else {
    throw new Error('审核状态不正确');
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  // 发送通知
  if (targetStatus === 'Completed') {
    // 通知维修员工单已完成
    await createNotification(
      order.assigned_technician.user_id,
      'order_completed',
      '工单验收通过',
      `工单 ${order.order_number} 验收通过，已完成`,
      {
        order_id: numericOrderId,
        order_number: order.order_number
      }
    );
  } else if (targetStatus === 'Needs Rework') {
    // 通知维修员需要返工
    await createNotification(
      order.assigned_technician.user_id,
      'order_rework',
      '工单需要返工',
      `工单 ${order.order_number} 验收不通过，需要返工`,
      {
        order_id: numericOrderId,
        order_number: order.order_number
      }
    );
  }

  return {
    order_id: numericOrderId,
    old_status: oldStatus,
    new_status: targetStatus
  };
}

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) {
    return {
      success: false,
      error: '无法获取微信身份，请在小程序内操作',
    };
  }

  console.log(`[WorkOrderManager] Action: ${action}, OpenID: ${openid}`);

  try {
    switch (action) {
      case 'create':
        const newOrder = await createWorkOrder(openid, data);
        return {
          success: true,
          order: newOrder,
          message: '工单创建成功'
        };

      case 'updateStatus':
        const result = await updateOrderStatus(
          openid,
          data.order_id,
          data.status,
          data.notes
        );
        return {
          success: true,
          ...result,
          message: '工单状态更新成功'
        };

      case 'list':
        // 只信任云函数上下文的 openid，避免客户端伪造 user_id 越权查询
        return {
          success: true,
          ...(await getWorkOrders(openid, data.filters || {})),
        };

      case 'getById':
        {
          const currentUser = await getUserByOpenId(openid);
          if (!currentUser) {
            return { success: false, error: '用户不存在' };
          }

          const orderId = parseInt(data.order_id, 10);
          if (Number.isNaN(orderId)) {
            return { success: false, error: '工单ID不正确' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orderData } = await workOrders.where({ order_id: orderId }).get();
          if (orderData.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const order = orderData[0];

          // 访问控制：提交者 / 负责人 / 管理员 / 物业经理可查看
          const canView =
            currentUser.role_id === 1 ||
            currentUser.role_id === 2 ||
            (currentUser.role_id === 3 && order.assigned_technician?.user_id === currentUser.user_id) ||
            (currentUser.role_id === 4 && order.submitter?.user_id === currentUser.user_id);

          if (!canView) {
            return { success: false, error: '无权限查看该工单' };
          }

          return {
            success: true,
            order: enhanceWorkOrder(order),
          };
        }

      case 'getByNumber':
        {
          const currentUser = await getUserByOpenId(openid);
          if (!currentUser) {
            return { success: false, error: '用户不存在' };
          }

          const orderNumber = data.order_number;
          if (!orderNumber) {
            return { success: false, error: '工单编号不正确' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orderData } = await workOrders.where({ order_number: orderNumber }).get();
          if (orderData.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const order = orderData[0];

          // 访问控制：提交者 / 负责人 / 管理员 / 物业经理可查看
          const canView =
            currentUser.role_id === 1 ||
            currentUser.role_id === 2 ||
            (currentUser.role_id === 3 && order.assigned_technician?.user_id === currentUser.user_id) ||
            (currentUser.role_id === 4 && order.submitter?.user_id === currentUser.user_id);

          if (!canView) {
            return { success: false, error: '无权限查看该工单' };
          }

          return {
            success: true,
            order: enhanceWorkOrder(order),
          };
        }

      case 'getFaultTypes':
        const faultTypes = db.collection('fault_types');
        const { data: types } = await faultTypes.where({
          active: true
        }).get();

        return {
          success: true,
          fault_types: types
        };

      case 'updateDetails':
        {
          const result = await updateWorkOrderDetails(
            openid,
            data.order_id,
            data.updates || {}
          );
          return {
            success: true,
            ...result,
            message: '工单信息更新成功'
          };
        }

      case 'completeRepair':
        const completeResult = await completeRepair(
          openid,
          data.order_id,
          data.status,
          data.completion_notes,
          data.repair_photos
        );
        return {
          success: true,
          ...completeResult,
          message: '维修完成提交成功'
        };

      case 'reviewOrder':
        const reviewResult = await reviewOrder(
          openid,
          data.order_id,
          data.status,
          data.review_notes
        );
        return {
          success: true,
          ...reviewResult,
          message: '审核提交成功'
        };

      case 'delete':
        {
          // 只有物业经理可以删除工单
          const deleteUser = await getUserByOpenId(openid);
          if (!deleteUser) {
            return { success: false, error: '用户未注册' };
          }
          if (deleteUser.role_id !== 2) { // 2 = 物业经理
            return { success: false, error: '只有物业经理才能删除工单' };
          }

          const workOrders = db.collection('work_orders');
          const { data: orders } = await workOrders.where({
            order_id: parseInt(data.order_id)
          }).get();

          if (orders.length === 0) {
            return { success: false, error: '工单不存在' };
          }

          const orderToDelete = orders[0];
          // 只允许删除待维修状态的工单
          const normalizedStatus = normalizeStatus(orderToDelete.status);
          if (normalizedStatus !== 'Pending Repair') {
            return { success: false, error: '只能删除待维修状态的工单' };
          }

          await workOrders.doc(orderToDelete._id).remove();

          console.log(`[WorkOrderManager] Order ${data.order_id} deleted by user ${deleteUser.user_id}`);

          return {
            success: true,
            message: '工单已删除'
          };
        }

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: ['create', 'updateStatus', 'updateDetails', 'list', 'getById', 'getFaultTypes', 'completeRepair', 'reviewOrder']
        };
    }

  } catch (error) {
    console.error('[WorkOrderManager] Error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
