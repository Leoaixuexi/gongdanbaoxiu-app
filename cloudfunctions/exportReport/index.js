/**
 * Cloud Function: Export Report
 * 导出工单报表为CSV格式
 *
 * Actions:
 * - exportWorkOrders: 导出工单列表
 * - exportSLAReport: 导出SLA统计报告
 * - exportUserReport: 导出用户报告
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
  '需返工': 'Needs Rework',
  'Needs Rework': 'Needs Rework',
  '已完成': 'Completed',
  'Completed': 'Completed',
};

const STATUS_DISPLAY_NAMES = {
  'Pending Repair': '待维修',
  'In Progress': '维修中',
  'Repaired': '已维修',
  'Needs Rework': '需返工',
  'Completed': '已完成',
};

function normalizeStatus(status) {
  if (!status) return status;
  return STATUS_MAP[status] || status;
}

function getStatusVariants(status) {
  const normalized = normalizeStatus(status);
  const variants = Object.keys(STATUS_MAP).filter(k => STATUS_MAP[k] === normalized);
  return variants.length > 0 ? variants : [status];
}

async function getCurrentUserAndPermissions(openid) {
  const users = db.collection('users');
  const roles = db.collection('roles');

  const { data: userData } = await users.where({ wechat_openid: openid }).get();
  const user = userData && userData.length > 0 ? userData[0] : null;
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const { data: roleData } = await roles.where({ role_id: user.role_id }).get();
  const role = roleData && roleData.length > 0 ? roleData[0] : null;
  const permissions = role?.permissions || {};

  return { user, permissions };
}

function hasModulePermission(permissions, moduleKey) {
  const modules = permissions?.modules;
  if (!modules) return false;
  if (Array.isArray(modules)) return modules.includes(moduleKey);
  if (typeof modules === 'object') return modules[moduleKey] === true;
  return false;
}

/**
 * Convert array of objects to CSV format
 */
function arrayToCSV(data, headers) {
  if (!data || data.length === 0) {
    return '';
  }

  // Generate header row
  const headerRow = headers.map(h => `"${h.label}"`).join(',');

  // Generate data rows
  const dataRows = data.map(item => {
    return headers.map(h => {
      let value = item[h.key];

      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }

      // Handle dates
      if (value instanceof Date) {
        value = formatDate(value);
      }

      // Handle objects
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }

      // Escape quotes and wrap in quotes
      value = String(value).replace(/"/g, '""');
      return `"${value}"`;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Format date to YYYY-MM-DD HH:MM:SS
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Export work orders
 */
async function exportWorkOrders(filters = {}) {
  const workOrders = db.collection('work_orders');

  // Build query
  let query = workOrders.where({});

  // Apply filters
  if (filters.status) {
    query = query.where({ status: _.in(getStatusVariants(filters.status)) });
  }
  if (filters.priority) {
    query = query.where({ priority: filters.priority });
  }
  if (filters.start_date && filters.end_date) {
    query = query.where({
      created_at: _.gte(new Date(filters.start_date)).and(_.lte(new Date(filters.end_date)))
    });
  }

  // Get data (limit 1000 records)
  const { data } = await query.limit(1000).get();

  const rows = (data || []).map(order => {
    const status = normalizeStatus(order.status);
    return {
      order_number: order.order_number,
      order_id: order.order_id,
      floor: order.floor,
      location: order.location,
      order_category: order.order_category,
      responsible_party: order.responsible_party,
      priority: order.priority,
      status: STATUS_DISPLAY_NAMES[status] || status,
      description: order.description,
      submitter_name: order.submitter?.name || '',
      submitter_phone: order.submitter?.phone || '',
      technician_name: order.assigned_technician?.name || '',
      technician_phone: order.assigned_technician?.phone || '',
      created_at: order.created_at,
      report_time: order.report_time,
      assigned_at: order.assigned_at,
      started_at: order.started_at,
      repaired_at: order.repaired_at,
      reviewed_at: order.reviewed_at,
      completed_at: order.completed_at,
      sla_deadline: order.sla_deadline,
      is_overdue: order.is_overdue,
      rework_count: order.rework_count,
    };
  });

  // Define headers
  const headers = [
    { key: 'order_number', label: '工单编号' },
    { key: 'order_id', label: '工单ID' },
    { key: 'floor', label: '楼层' },
    { key: 'location', label: '位置' },
    { key: 'order_category', label: '工单类别' },
    { key: 'responsible_party', label: '责任方' },
    { key: 'priority', label: '优先级' },
    { key: 'status', label: '状态' },
    { key: 'description', label: '故障描述' },
    { key: 'submitter_name', label: '提交人' },
    { key: 'submitter_phone', label: '提交人电话' },
    { key: 'technician_name', label: '维修员' },
    { key: 'technician_phone', label: '维修员电话' },
    { key: 'created_at', label: '创建时间' },
    { key: 'report_time', label: '报修时间' },
    { key: 'assigned_at', label: '分配时间' },
    { key: 'started_at', label: '开始时间' },
    { key: 'repaired_at', label: '维修完成时间' },
    { key: 'reviewed_at', label: '验收时间' },
    { key: 'completed_at', label: '结单时间' },
    { key: 'sla_deadline', label: 'SLA截止时间' },
    { key: 'is_overdue', label: '是否超期' },
    { key: 'rework_count', label: '返工次数' },
  ];

  // Convert to CSV
  const csv = arrayToCSV(rows, headers);

  return {
    csv,
    filename: `工单报表_${formatDate(new Date()).replace(/[: ]/g, '_')}.csv`,
    count: rows.length
  };
}

/**
 * Export SLA report
 */
async function exportSLAReport(filters = {}) {
  const workOrders = db.collection('work_orders');

  // Get incomplete orders
  const { data } = await workOrders.where({
    status: _.in([
      ...getStatusVariants('Pending Repair'),
      ...getStatusVariants('In Progress'),
      ...getStatusVariants('Repaired'),
    ])
  }).limit(1000).get();

  // Calculate SLA for each order
  const ordersWithSLA = (data || []).map(order => {
    const slaLimit = getSLALimit(order.priority);
    const created = new Date(order.created_at);
    const now = new Date();
    const elapsedMs = now - created;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const deadlineMs = created.getTime() + (slaLimit * 60 * 60 * 1000);
    const remainingMs = deadlineMs - now.getTime();
    const remainingHours = remainingMs / (1000 * 60 * 60);

    let slaStatus = 'normal';
    if (remainingMs < 0) {
      slaStatus = 'overdue';
    } else if (remainingHours < slaLimit * 0.1) {
      slaStatus = 'critical';
    } else if (remainingHours < slaLimit * 0.25) {
      slaStatus = 'warning';
    }

    return {
      order_number: order.order_number,
      order_id: order.order_id,
      floor: order.floor,
      location: order.location,
      priority: order.priority,
      status: STATUS_DISPLAY_NAMES[normalizeStatus(order.status)] || normalizeStatus(order.status),
      sla_limit: slaLimit,
      elapsed_hours: elapsedHours.toFixed(2),
      remaining_hours: remainingHours.toFixed(2),
      sla_status: slaStatus,
      deadline: formatDate(new Date(deadlineMs))
    };
  });

  const headers = [
    { key: 'order_number', label: '工单编号' },
    { key: 'order_id', label: '工单ID' },
    { key: 'floor', label: '楼层' },
    { key: 'location', label: '位置' },
    { key: 'priority', label: '优先级' },
    { key: 'status', label: '状态' },
    { key: 'sla_limit', label: 'SLA时限(小时)' },
    { key: 'elapsed_hours', label: '已用时(小时)' },
    { key: 'remaining_hours', label: '剩余时(小时)' },
    { key: 'sla_status', label: 'SLA状态' },
    { key: 'deadline', label: 'SLA截止时间' },
    { key: 'created_at', label: '创建时间' }
  ];

  const csv = arrayToCSV(ordersWithSLA, headers);

  return {
    csv,
    filename: `SLA报表_${formatDate(new Date()).replace(/[: ]/g, '_')}.csv`,
    count: ordersWithSLA.length
  };
}

/**
 * Get SLA limit based on priority
 */
function getSLALimit(priority) {
  const limits = {
    'Emergency': 2,
    'High': 4,
    'Normal': 8,
    'Low': 24
  };
  return limits[priority] || 8;
}

/**
 * Export user report
 */
async function exportUserReport() {
  const users = db.collection('users');
  const { data } = await users.limit(1000).get();

  const rows = (data || []).map(user => ({
    user_id: user.user_id,
    username: user.username,
    name: user.name,
    role_id: user.role_id,
    department: user.department,
    contact_phone: user.contact_phone,
    email: user.email,
    active: user.active,
    created_at: user.created_at,
    last_login_at: user.last_login_at || user.last_login,
  }));

  const headers = [
    { key: 'user_id', label: '用户ID' },
    { key: 'username', label: '用户名' },
    { key: 'name', label: '姓名' },
    { key: 'role_id', label: '角色ID' },
    { key: 'department', label: '部门' },
    { key: 'contact_phone', label: '联系电话' },
    { key: 'email', label: '邮箱' },
    { key: 'active', label: '状态' },
    { key: 'created_at', label: '创建时间' },
    { key: 'last_login_at', label: '最后登录' }
  ];

  const csv = arrayToCSV(rows, headers);

  return {
    csv,
    filename: `用户报表_${formatDate(new Date()).replace(/[: ]/g, '_')}.csv`,
    count: rows.length
  };
}

/**
 * Main function
 */
exports.main = async (event, context) => {
  const { action, filters = {} } = event;

  console.log(`[ExportReport] Action: ${action}`);

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取微信身份，请在小程序内操作' };
    }

    const { permissions } = await getCurrentUserAndPermissions(openid);

    switch (action) {
      case 'exportWorkOrders':
        if (!hasModulePermission(permissions, 'view_analytics')) {
          return { success: false, error: '无权限导出工单报表' };
        }
        return await exportWorkOrders(filters);

      case 'exportSLAReport':
        if (!hasModulePermission(permissions, 'view_analytics')) {
          return { success: false, error: '无权限导出SLA报表' };
        }
        return await exportSLAReport(filters);

      case 'exportUserReport':
        if (!hasModulePermission(permissions, 'manage_users')) {
          return { success: false, error: '无权限导出用户报表' };
        }
        return await exportUserReport();

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`
        };
    }
  } catch (error) {
    console.error('[ExportReport] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
