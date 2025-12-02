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
    query = query.where({ status: filters.status });
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

  // Define headers
  const headers = [
    { key: 'work_order_number', label: '工单编号' },
    { key: 'floor', label: '楼层' },
    { key: 'location', label: '位置' },
    { key: 'fault_type_name', label: '故障类型' },
    { key: 'priority', label: '优先级' },
    { key: 'status', label: '状态' },
    { key: 'description', label: '故障描述' },
    { key: 'submitter_name', label: '提交人' },
    { key: 'assigned_to_name', label: '维修员' },
    { key: 'created_at', label: '创建时间' },
    { key: 'assigned_at', label: '分配时间' },
    { key: 'started_at', label: '开始时间' },
    { key: 'completed_at', label: '完成时间' },
    { key: 'reviewed_at', label: '审核时间' }
  ];

  // Convert to CSV
  const csv = arrayToCSV(data, headers);

  return {
    csv,
    filename: `工单报表_${formatDate(new Date()).replace(/[: ]/g, '_')}.csv`,
    count: data.length
  };
}

/**
 * Export SLA report
 */
async function exportSLAReport(filters = {}) {
  const workOrders = db.collection('work_orders');

  // Get incomplete orders
  const { data } = await workOrders.where({
    status: _.in(['Pending Repair', 'In Progress', 'Repaired'])
  }).limit(1000).get();

  // Calculate SLA for each order
  const ordersWithSLA = data.map(order => {
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
      ...order,
      sla_limit: slaLimit,
      elapsed_hours: elapsedHours.toFixed(2),
      remaining_hours: remainingHours.toFixed(2),
      sla_status: slaStatus,
      deadline: formatDate(new Date(deadlineMs))
    };
  });

  const headers = [
    { key: 'work_order_number', label: '工单编号' },
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
    { key: 'last_login', label: '最后登录' }
  ];

  const csv = arrayToCSV(data, headers);

  return {
    csv,
    filename: `用户报表_${formatDate(new Date()).replace(/[: ]/g, '_')}.csv`,
    count: data.length
  };
}

/**
 * Main function
 */
exports.main = async (event, context) => {
  const { action, filters = {} } = event;

  console.log(`[ExportReport] Action: ${action}`);

  try {
    switch (action) {
      case 'exportWorkOrders':
        return await exportWorkOrders(filters);

      case 'exportSLAReport':
        return await exportSLAReport(filters);

      case 'exportUserReport':
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
