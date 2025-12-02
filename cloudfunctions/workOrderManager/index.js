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
  let startTime = new Date(created_at);
  let endTime;

  // 已完成的工单：从创建到完成的时间
  if (status === '已完成' && completed_at) {
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

  // 如果工单已完成且有存储的总用时，使用存储的值
  if (workOrder.status === '已完成' && workOrder.total_duration_seconds) {
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
    status_text: workOrder.status,
    // 标记是否需要前端读秒
    needs_live_timer: workOrder.status !== '已完成'
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

  // 获取下一个 order_id
  const { total } = await workOrders.count();
  const orderId = total + 1;

  // 处理报修时间
  let reportTime = now;
  if (orderData.report_date && orderData.report_time) {
    reportTime = new Date(`${orderData.report_date} ${orderData.report_time}`);
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
    status: '已提报',
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
      addStatusHistory(null, '已提报', submitter, '工单创建')
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

  // 获取工单
  const { data: orders } = await workOrders.where({ order_id: orderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const oldStatus = order.status;

  // 权限检查
  const canUpdate =
    user.role_id === 1 || // 管理员
    user.role_id === 2 || // 物业经理
    (user.role_id === 3 && order.assigned_technician.user_id === user.user_id); // 分配的维修员

  if (!canUpdate) {
    throw new Error('权限不足');
  }

  // 准备更新数据
  const updateData = {
    status: newStatus,
    updated_at: new Date(),
    status_history: _.push(addStatusHistory(oldStatus, newStatus, user, notes))
  };

  // 根据状态更新时间字段
  switch (newStatus) {
    case '维修中':
      updateData.started_at = new Date();
      break;
    case '已修复':
      updateData.repaired_at = new Date();
      break;
    case '已完成':
      updateData.completed_at = new Date();
      updateData.reviewed_at = new Date();
      break;
    case '需重修':
      updateData.rework_count = _.inc(1);
      break;
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  // 发送通知
  if (newStatus === '已修复') {
    // 通知提交者工单已维修完成
    await createNotification(
      order.submitter.user_id,
      'order_repaired',
      '工单维修完成',
      `工单 ${order.order_number} 已维修完成，请验收`,
      {
        order_id: orderId,
        order_number: order.order_number
      }
    );
  } else if (newStatus === '需重修') {
    // 通知维修员需要返工
    await createNotification(
      order.assigned_technician.user_id,
      'order_rework',
      '工单需要返工',
      `工单 ${order.order_number} 验收不通过，需要返工`,
      {
        order_id: orderId,
        order_number: order.order_number
      }
    );
  }

  return {
    success: true,
    order_id: orderId,
    old_status: oldStatus,
    new_status: newStatus
  };
}

/**
 * 获取工单列表
 */
async function getWorkOrders(openidOrUserId, filters = {}) {
  const workOrders = db.collection('work_orders');

  // 尝试通过openid或user_id获取用户
  let user = await getUserByOpenId(openidOrUserId);
  if (!user && typeof openidOrUserId === 'number') {
    user = await getUserById(openidOrUserId);
  }

  if (!user) {
    throw new Error('用户不存在');
  }

  let query = workOrders.orderBy('created_at', 'desc');

  // 根据角色过滤
  if (user.role_id === 3) {
    // 维修员只能看到分配给自己的工单
    query = query.where({
      'assigned_technician.user_id': user.user_id
    });
  } else if (user.role_id === 4) {
    // 物业员工只能看到自己提交的工单
    query = query.where({
      'submitter.user_id': user.user_id
    });
  }
  // 管理员和物业经理可以看到所有工单

  // 应用其他过滤条件
  if (filters.status) {
    query = query.where({ status: filters.status });
  }

  if (filters.priority) {
    query = query.where({ priority: filters.priority });
  }

  const { data } = await query.limit(filters.limit || 100).get();

  // 增强工单数据（添加计算字段）
  return data.map(order => enhanceWorkOrder(order));
}

/**
 * 完成维修
 */
async function completeRepair(openid, orderId, status) {
  const workOrders = db.collection('work_orders');
  const user = await getUserByOpenId(openid);

  if (!user) {
    throw new Error('用户不存在');
  }

  // 获取工单
  const { data: orders } = await workOrders.where({ order_id: orderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const oldStatus = order.status;

  // 权限检查：只有分配的维修员可以完成维修
  if (user.role_id !== 3 || order.assigned_technician.user_id !== user.user_id) {
    throw new Error('只有分配的维修员可以完成维修');
  }

  // 状态检查：只有"维修中"的工单可以完成
  if (oldStatus !== '维修中') {
    throw new Error('只有维修中的工单可以完成');
  }

  // 准备更新数据
  const updateData = {
    status,
    updated_at: new Date(),
    status_history: _.push(addStatusHistory(oldStatus, status, user, ''))
  };

  // 根据状态设置时间
  if (status === '已修复') {
    updateData.repaired_at = new Date();
  } else if (status === '需重修') {
    updateData.rework_count = _.inc(1);
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  // 发送通知给提交者
  if (status === '已修复') {
    await createNotification(
      order.submitter.user_id,
      'order_repaired',
      '工单维修完成',
      `工单 ${order.order_number} 已维修完成，请验收`,
      {
        order_id: orderId,
        order_number: order.order_number
      }
    );
  }

  return {
    order_id: orderId,
    old_status: oldStatus,
    new_status: status
  };
}

/**
 * 审核工单
 */
async function reviewOrder(openid, orderId, status) {
  const workOrders = db.collection('work_orders');
  const user = await getUserByOpenId(openid);

  if (!user) {
    throw new Error('用户不存在');
  }

  // 获取工单
  const { data: orders } = await workOrders.where({ order_id: orderId }).get();
  if (orders.length === 0) {
    throw new Error('工单不存在');
  }

  const order = orders[0];
  const oldStatus = order.status;

  // 权限检查：只有提交者可以审核
  if (order.submitter.user_id !== user.user_id) {
    throw new Error('只有工单提交者可以审核');
  }

  // 状态检查：只有"已修复"的工单可以审核
  if (oldStatus !== '已修复') {
    throw new Error('只有已修复的工单可以审核');
  }

  // 准备更新数据
  const updateData = {
    status,
    updated_at: new Date(),
    status_history: _.push(addStatusHistory(oldStatus, status, user, ''))
  };

  // 根据状态设置时间
  if (status === '已完成') {
    const now = new Date();
    updateData.completed_at = now;
    updateData.reviewed_at = now;

    // 计算并保存总用时（秒）
    const createdAt = new Date(order.created_at);
    const totalDurationSeconds = Math.floor((now - createdAt) / 1000);
    updateData.total_duration_seconds = totalDurationSeconds;
  } else if (status === '需重修') {
    updateData.rework_count = _.inc(1);
  }

  // 更新工单
  await workOrders.doc(order._id).update({
    data: updateData
  });

  // 发送通知
  if (status === '已完成') {
    // 通知维修员工单已完成
    await createNotification(
      order.assigned_technician.user_id,
      'order_completed',
      '工单验收通过',
      `工单 ${order.order_number} 验收通过，已完成`,
      {
        order_id: orderId,
        order_number: order.order_number
      }
    );
  } else if (status === '需重修') {
    // 通知维修员需要返工
    await createNotification(
      order.assigned_technician.user_id,
      'order_rework',
      '工单需要返工',
      `工单 ${order.order_number} 验收不通过，需要返工`,
      {
        order_id: orderId,
        order_number: order.order_number
      }
    );
  }

  return {
    order_id: orderId,
    old_status: oldStatus,
    new_status: status
  };
}

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {}, test_openid } = event;

  // 测试模式：允许在控制台测试时指定 openid
  const openid = test_openid || wxContext.OPENID;

  console.log(`[WorkOrderManager] Action: ${action}, OpenID: ${openid}${test_openid ? ' (TEST MODE)' : ''}`);

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
        // 支持通过openid或user_id获取工单
        const userIdentifier = data.user_id || openid;
        const orders = await getWorkOrders(userIdentifier, data.filters || {});
        return {
          success: true,
          orders,
          total: orders.length
        };

      case 'getById':
        console.log('[getById] Querying with order_id:', data.order_id, 'type:', typeof data.order_id);
        const workOrders = db.collection('work_orders');

        // Try to query by order_id first
        let { data: orderData } = await workOrders.where({
          order_id: parseInt(data.order_id)
        }).get();

        console.log('[getById] Query result count:', orderData.length);

        // If not found, try querying all and log for debugging
        if (orderData.length === 0) {
          const { data: allOrders } = await workOrders.limit(10).get();
          console.log('[getById] Sample orders in DB:', allOrders.map(o => ({
            order_id: o.order_id,
            order_number: o.order_number,
            _id: o._id
          })));

          return {
            success: false,
            error: '工单不存在'
          };
        }

        return {
          success: true,
          order: enhanceWorkOrder(orderData[0])
        };

      case 'getFaultTypes':
        const faultTypes = db.collection('fault_types');
        const { data: types } = await faultTypes.where({
          active: true
        }).get();

        return {
          success: true,
          fault_types: types
        };

      case 'completeRepair':
        const completeResult = await completeRepair(
          openid,
          data.order_id,
          data.status
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
          data.status
        );
        return {
          success: true,
          ...reviewResult,
          message: '审核提交成功'
        };

      case 'addTestPhotos':
        // 临时测试接口：给指定工单添加测试图片
        const workOrdersTest = db.collection('work_orders');

        // 使用提供的真实图片URL，或使用测试占位符
        // 使用微信公众号素材库的图片，这些图片小程序可以直接访问
        const testPhotos = data.photos || [
          'https://mmbiz.qpic.cn/mmbiz_jpg/demo1.jpg',
          'https://mmbiz.qpic.cn/mmbiz_jpg/demo2.jpg'
        ];

        await workOrdersTest.where({
          order_id: data.order_id
        }).update({
          data: {
            photos: testPhotos
          }
        });

        return {
          success: true,
          message: '测试图片已添加',
          photos: testPhotos
        };

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
          available_actions: ['create', 'updateStatus', 'list', 'getById', 'getFaultTypes', 'completeRepair', 'reviewOrder', 'addTestPhotos']
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
