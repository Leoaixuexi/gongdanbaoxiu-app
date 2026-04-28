/**
 * 工单管理 - 催促/通知操作
 */

const {
  db,
  _,
  normalizeStatus,
  getUserByOpenId,
  createNotification,
  createBatchNotifications,
} = require('../helpers');

/**
 * 催接单 - 催促维修员尽快接单
 * @param {string} openid - 微信openid
 * @param {number} orderId - 工单ID
 * @returns {Promise<Object>} 催促结果
 */
async function urgeAccept(openid, orderId) {
  const workOrders = db.collection('work_orders');

  // 1. 权限校验：行政经理(2)或办美员工(4)或管理员(1)
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }
  if (![1, 2, 4].includes(user.role_id)) {
    throw new Error('无权限催接单');
  }

  // 2. 获取工单
  const { data: orders } = await workOrders.where({ order_id: orderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }
  const order = orders[0];

  // 3. 状态校验：已提报
  const status = normalizeStatus(order.status);
  if (status !== 'Pending Repair') {
    throw new Error('只能对已提报状态的工单催接单');
  }

  // 检查是否有责任方
  if (!order.responsible_party) {
    throw new Error('工单未设置责任方');
  }

  // 4. 频控检查：查询1小时内是否已发送过（按工单ID检查）
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { data: existingReminders } = await db.collection('notifications')
    .where({
      'data.order_id': orderId,
      'data.reminder_type': 'urge_accept_order',
      sent_at: _.gte(oneHourAgo)
    })
    .limit(1)
    .get();

  if (existingReminders.length > 0) {
    const triggeredBy = existingReminders[0].data?.triggered_by?.name || '其他用户';
    return {
      throttled: true,
      triggeredBy: triggeredBy,
      message: `报修人：${triggeredBy}，已催过，你需要等1小时才能操作`
    };
  }

  // 5. 创建提醒通知 - 发给责任方部门的所有维修员
  const targetUsers = await db.collection('users')
    .where({
      department: order.responsible_party,
      role_id: 3,  // 只通知维修员
      active: true
    })
    .get();

  // 应用层二次过滤，确保 department 精确匹配（防止云数据库查询返回意外结果）
  const validUsers = (targetUsers.data || []).filter(u =>
    u.department && u.department === order.responsible_party
  );

  if (validUsers.length === 0) {
    throw new Error('该责任方部门暂无维修员');
  }

  const title = '催接单提醒';
  const message = `该工单所属${order.responsible_party}负责，现已被催接单，请维修师傅尽快接单处理！`;
  const userIds = validUsers.map(u => u.user_id);

  await createBatchNotifications(
    userIds,
    'urge_accept_order',
    title,
    message,
    {
      order_id: orderId,
      order_number: order.order_number,
      floor: order.floor,
      location: order.location,
      description: order.description,
      reminder_type: 'urge_accept_order',
      triggered_by: {
        user_id: user.user_id,
        name: user.name
      }
    }
  );

  return {
    throttled: false,
    message: '催接单通知已发送'
  };
}

/**
 * 催维修 - 催促维修员尽快维修
 * @param {string} openid - 微信openid
 * @param {number} orderId - 工单ID
 * @returns {Promise<Object>} 催促结果
 */
async function urgeRepair(openid, orderId) {
  const workOrders = db.collection('work_orders');

  // 1. 权限校验：物业人员（role_id 2或4）或管理员(1)
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }
  if (![1, 2, 4].includes(user.role_id)) {
    throw new Error('无权限催促维修');
  }

  // 2. 获取工单
  const { data: orders } = await workOrders.where({ order_id: orderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }
  const order = orders[0];

  // 3. 状态校验：维修中 或 需返工
  const status = normalizeStatus(order.status);
  if (!['In Progress', 'Needs Rework'].includes(status)) {
    throw new Error('工单状态不允许催维修');
  }

  // 检查是否有责任方
  if (!order.responsible_party) {
    throw new Error('工单未设置责任方');
  }

  // 4. 频控检查：查询1小时内是否已发送过（按工单ID检查）
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { data: existingReminders } = await db.collection('notifications')
    .where({
      'data.order_id': orderId,
      'data.reminder_type': 'urge_repair',
      sent_at: _.gte(oneHourAgo)
    })
    .limit(1)
    .get();

  if (existingReminders.length > 0) {
    const triggeredBy = existingReminders[0].data?.triggered_by?.name || '其他用户';
    return {
      throttled: true,
      triggeredBy: triggeredBy,
      message: `报修人：${triggeredBy}，已催过，你需要等1小时才能操作`
    };
  }

  // 5. 创建提醒通知 - 发给责任方部门的所有维修员
  const targetUsers = await db.collection('users')
    .where({
      department: order.responsible_party,
      role_id: 3,  // 只通知维修员
      active: true
    })
    .get();

  // 应用层二次过滤，确保 department 精确匹配（防止云数据库查询返回意外结果）
  const validUsers = (targetUsers.data || []).filter(u =>
    u.department && u.department === order.responsible_party
  );

  if (validUsers.length === 0) {
    throw new Error('该责任方部门暂无维修员');
  }

  const title = `工单编号：${order.order_number}`;
  const message = `${order.floor}${order.location}${order.description}，需要尽快维修。`;
  const userIds = validUsers.map(u => u.user_id);

  await createBatchNotifications(
    userIds,
    'urge_repair',
    title,
    message,
    {
      order_id: orderId,
      order_number: order.order_number,
      floor: order.floor,
      location: order.location,
      fault_type: order.description,
      reminder_type: 'urge_repair',
      triggered_by: {
        user_id: user.user_id,
        name: user.name
      }
    }
  );

  return {
    throttled: false,
    message: '催促通知已发送'
  };
}

/**
 * 催复核 - 催促提交者尽快复核
 * @param {string} openid - 微信openid
 * @param {number} orderId - 工单ID
 * @returns {Promise<Object>} 催促结果
 */
async function urgeReview(openid, orderId) {
  const workOrders = db.collection('work_orders');

  // 1. 权限校验：维修员(3)、行政经理(2)或管理员(1)
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }
  if (![1, 2, 3].includes(user.role_id)) {
    throw new Error('无权限催促复核');
  }

  // 2. 获取工单并校验状态
  const { data: orders } = await workOrders.where({ order_id: orderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }
  const order = orders[0];

  const status = normalizeStatus(order.status);
  if (status !== 'Repaired') {
    throw new Error('工单状态不允许催复核');
  }

  // 检查是否有提交者信息
  if (!order.submitter || !order.submitter.user_id) {
    throw new Error('工单提交者信息不完整');
  }

  // 3. 频控检查：查询1小时内是否已发送过
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { data: existingReminders } = await db.collection('notifications')
    .where({
      'data.order_id': orderId,
      'data.reminder_type': 'urge_review',
      user_id: order.submitter.user_id,
      sent_at: _.gte(oneHourAgo)
    })
    .limit(1)
    .get();

  if (existingReminders.length > 0) {
    const triggeredBy = existingReminders[0].data?.triggered_by?.name || '其他用户';
    return {
      throttled: true,
      triggeredBy: triggeredBy,
      message: `报修人：${triggeredBy}，已催过，你需要等1小时才能操作`
    };
  }

  // 4. 创建提醒通知
  const title = `工单编号 ${order.order_number}`;
  const message = `${order.floor} ${order.location}${order.description}，维修已完成，请尽快复核。`;

  await createNotification(
    order.submitter.user_id,
    'urge_review',
    title,
    message,
    {
      order_id: orderId,
      order_number: order.order_number,
      floor: order.floor,
      location: order.location,
      fault_type: order.description,
      reminder_type: 'urge_review',
      triggered_by: {
        user_id: user.user_id,
        name: user.name
      }
    }
  );

  return {
    throttled: false,
    message: '催促通知已发送'
  };
}

module.exports = {
  urgeAccept,
  urgeRepair,
  urgeReview,
};
