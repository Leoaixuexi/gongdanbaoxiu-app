/**
 * 工单管理 - 共享工具函数和常量
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 角色枚举
const ROLE = {
  ADMIN: 1,
  MANAGER: 2,
  TECHNICIAN: 3,
  STAFF: 4,
};

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
  '需返工': 'Needs Rework',
  'Needs Rework': 'Needs Rework',
  '已完成': 'Completed',
  'Completed': 'Completed',
};

// SLA 规则（小时）
const SLA_RULES = {
  'Emergency': 2,
  'High': 24,
  'Normal': 72,
  'Low': 168
};

/**
 * 工单类别选项兜底值
 */
const DEFAULT_ORDER_CATEGORIES = ['电梯维修', '水电维修', '消防维修', '空调维修', '其他'];

/**
 * 责任方选项兜底值
 */
const DEFAULT_RESPONSIBLE_PARTIES = ['信泰物业', '工程总包', '业主', '第三方'];

function normalizeStatus(status) {
  if (!status) return status;
  return STATUS_MAP[status] || status;
}

function getEffectiveOpenId(wxContext, event) {
  const { test_openid, adminToken } = event || {};

  // 测试模式：需同时满足以下条件才启用：
  // 1. 传入 test_openid
  // 2. 环境变量 ALLOW_TEST_OPENID 设为 'true'（生产环境应删除此变量）
  // 3. adminToken 匹配环境变量 ADMIN_TOKEN
  const requiredAdminToken = process.env.ADMIN_TOKEN;
  const canUseTestOpenid = !!(
    test_openid &&
    process.env.ALLOW_TEST_OPENID === 'true' &&
    requiredAdminToken &&
    adminToken === requiredAdminToken
  );

  return canUseTestOpenid ? test_openid : wxContext.OPENID;
}

/**
 * 生成工单编号（格式: YYYYMMDDXXXXX，全局递增）
 */
async function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  try {
    // 查询全局最大序列号
    const workOrders = db.collection('work_orders');
    const { data } = await workOrders
      .orderBy('order_number', 'desc')
      .limit(1)
      .get();

    let sequence = 1;
    if (data.length > 0 && data[0].order_number) {
      // 提取最后5位数字作为序列号
      const lastNumber = data[0].order_number;
      const match = lastNumber.match(/(\d{5})$/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `${dateStr}${String(sequence).padStart(5, '0')}`;
  } catch (error) {
    console.error('[generateOrderNumber] Error:', error);
    // 回退方案：使用时间戳生成唯一编号
    const timestamp = Date.now();
    const fallbackSequence = timestamp % 100000;
    console.warn('[generateOrderNumber] Using fallback:', `${dateStr}${String(fallbackSequence).padStart(5, '0')}`);
    return `${dateStr}${String(fallbackSequence).padStart(5, '0')}`;
  }
}

/**
 * 解析前端传入的报修日期+时间（北京时间），明确指定 +08:00 避免时区漂移
 */
function parseReportDateTime(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00+08:00`);
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
 * 从字典获取工单类别选项
 */
async function getOrderCategories() {
  try {
    const { data } = await db.collection('dictionaries').where({
      dict_key: 'order_category'
    }).get();

    if (data.length > 0 && data[0].items && data[0].items.length > 0) {
      return data[0].items
        .filter(item => item.enabled !== false)
        .map(item => item.value);
    }
  } catch (error) {
    console.error('[WorkOrder] Error fetching order_category dictionary:', error);
  }
  return DEFAULT_ORDER_CATEGORIES;
}

/**
 * 从字典获取责任方选项
 */
async function getResponsibleParties() {
  try {
    const { data } = await db.collection('dictionaries').where({
      dict_key: 'responsible_party'
    }).get();

    if (data.length > 0 && data[0].items && data[0].items.length > 0) {
      return data[0].items
        .filter(item => item.enabled !== false)
        .map(item => item.value);
    }
  } catch (error) {
    console.error('[WorkOrder] Error fetching responsible_party dictionary:', error);
  }
  return DEFAULT_RESPONSIBLE_PARTIES;
}

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
 * 批量创建通知
 */
async function createBatchNotifications(userIds, type, title, message, data = {}) {
  if (!userIds || userIds.length === 0) return;

  const notifications = db.collection('notifications');

  try {
    // 获取所有用户信息
    const users = await db.collection('users')
      .where({
        user_id: _.in(userIds)
      })
      .get();

    if (!users.data || users.data.length === 0) return;

    // 批量创建通知
    const promises = users.data.map(user =>
      notifications.add({
        data: {
          user_id: user.user_id,
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
      })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('[CreateBatchNotifications] Error:', error);
  }
}

/**
 * 格式化通知消息内容
 * 格式：楼层+位置+故障描述+后缀（无空格）
 */
function formatNotificationMessage(floor, location, description, suffix) {
  return `${floor}${location}${description}${suffix}`;
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
      name: changedBy.name,
      avatar: changedBy.avatar || ''
    },
    changed_at: new Date(),
    notes
  };
}

/**
 * 刷新工单中status_history的用户头像（获取最新头像）
 */
async function refreshStatusHistoryAvatars(order) {
  if (!order || !order.status_history || order.status_history.length === 0) {
    return order;
  }

  // 收集所有唯一的user_id
  const userIds = [...new Set(
    order.status_history
      .filter(item => item.changed_by && item.changed_by.user_id)
      .map(item => item.changed_by.user_id)
  )];

  if (userIds.length === 0) {
    return order;
  }

  // 批量查询用户最新信息
  const users = db.collection('users');
  const { data: usersData } = await users.where({
    user_id: _.in(userIds)
  }).field({
    user_id: true,
    avatar: true
  }).get();

  // 创建user_id到avatar的映射
  const avatarMap = {};
  usersData.forEach(user => {
    avatarMap[user.user_id] = user.avatar || '';
  });

  // 转换 cloud:// 格式的头像URL为临时可访问URL
  const cloudAvatars = Object.values(avatarMap).filter(url => url && url.startsWith('cloud://'));
  if (cloudAvatars.length > 0) {
    try {
      const { fileList } = await cloud.getTempFileURL({
        fileList: cloudAvatars
      });
      const urlMap = {};
      fileList.forEach(item => {
        // 使用宽松比较，因为微信API可能返回字符串"0"或数字0
        if (item.tempFileURL && item.status == 0) {
          urlMap[item.fileID] = item.tempFileURL;
        }
      });
      // 更新avatarMap中的URL
      Object.keys(avatarMap).forEach(userId => {
        if (urlMap[avatarMap[userId]]) {
          avatarMap[userId] = urlMap[avatarMap[userId]];
        }
      });
    } catch (e) {
      console.error('[refreshStatusHistoryAvatars] Convert avatar URLs error:', e);
    }
  }

  // 更新status_history中的头像
  order.status_history = order.status_history.map(item => {
    if (item.changed_by && item.changed_by.user_id && avatarMap[item.changed_by.user_id] !== undefined) {
      return {
        ...item,
        changed_by: {
          ...item.changed_by,
          avatar: avatarMap[item.changed_by.user_id]
        }
      };
    }
    return item;
  });

  return order;
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

/**
 * 工单查看权限：管理员看全部 / 维修员看本部门 / 办美和经理看物业类提交
 */
function canViewOrder(user, order) {
  if (!user || !order) return false;
  const submitterRoleId = order.submitter?.role_id ?? ROLE.STAFF;
  if (user.role_id === ROLE.ADMIN) return true;
  if (user.role_id === ROLE.TECHNICIAN) return order.responsible_party === user.department;
  if ([ROLE.MANAGER, ROLE.STAFF].includes(user.role_id)) {
    return [ROLE.MANAGER, ROLE.STAFF].includes(submitterRoleId);
  }
  return false;
}

/**
 * 写入审计日志（失败不影响主流程）
 */
async function writeAuditLog({ user, action, order_id, before, after, extra }) {
  try {
    await db.collection('audit_logs').add({
      data: {
        user_id: user?.user_id || null,
        user_name: user?.name || '',
        action,
        order_id: order_id || null,
        before: before ?? null,
        after: after ?? null,
        extra: extra || null,
        created_at: new Date(),
      }
    });
  } catch (e) {
    console.error('[writeAuditLog] error:', e);
  }
}

function getStatusVariants(targetStatus) {
  const normalized = normalizeStatus(targetStatus);
  const variants = new Set([normalized]);
  Object.entries(STATUS_MAP).forEach(([raw, norm]) => {
    if (norm === normalized) variants.add(raw);
  });
  return [...variants];
}

module.exports = {
  cloud,
  db,
  _,
  ROLE,
  STATUS_MAP,
  SLA_RULES,
  DEFAULT_ORDER_CATEGORIES,
  DEFAULT_RESPONSIBLE_PARTIES,
  normalizeStatus,
  getEffectiveOpenId,
  generateOrderNumber,
  parseReportDateTime,
  calculateSLADeadline,
  getUserByOpenId,
  getUserById,
  getOrderCategories,
  getResponsibleParties,
  assignTechnician,
  createNotification,
  createBatchNotifications,
  formatNotificationMessage,
  addStatusHistory,
  refreshStatusHistoryAvatars,
  calculateWorkOrderDuration,
  enhanceWorkOrder,
  normalizeNotes,
  normalizePhotoUrls,
  getStatusVariants,
  canViewOrder,
  writeAuditLog,
};
