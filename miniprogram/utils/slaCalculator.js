/**
 * SLA Calculator Utility
 * 计算工单SLA（服务级别协议）和倒计时
 *
 * SLA规则：
 * - Emergency (紧急): 2小时
 * - High (高): 4小时
 * - Normal (普通): 8小时
 * - Low (低): 24小时
 */

// SLA时限配置（单位：小时）
const SLA_LIMITS = {
  'Emergency': 2,
  'High': 4,
  'Normal': 8,
  'Low': 24
};

// SLA状态
const SLA_STATUS = {
  NORMAL: 'normal',       // 正常
  WARNING: 'warning',     // 警告（剩余时间<25%）
  CRITICAL: 'critical',   // 紧急（剩余时间<10%）
  OVERDUE: 'overdue'      // 超期
};

/**
 * 获取工单SLA时限（小时）
 * @param {string} priority - 优先级 (Emergency/High/Normal/Low)
 * @returns {number} SLA时限（小时）
 */
function getSLALimit(priority) {
  return SLA_LIMITS[priority] || SLA_LIMITS['Normal'];
}

/**
 * 计算SLA剩余时间
 * @param {Date|string} createdAt - 工单创建时间
 * @param {string} priority - 优先级
 * @param {Date|string} completedAt - 完成时间（可选）
 * @returns {Object} SLA信息
 */
function calculateSLA(createdAt, priority, completedAt = null) {
  const created = new Date(createdAt);
  const now = completedAt ? new Date(completedAt) : new Date();
  const slaLimit = getSLALimit(priority);

  // 计算已用时间（小时）
  const elapsedMs = now - created;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // 计算SLA截止时间
  const deadlineMs = created.getTime() + (slaLimit * 60 * 60 * 1000);
  const deadline = new Date(deadlineMs);

  // 计算剩余时间（毫秒）
  const remainingMs = deadlineMs - now.getTime();
  const remainingHours = remainingMs / (1000 * 60 * 60);

  // 计算完成百分比
  const percentage = Math.min(100, (elapsedHours / slaLimit) * 100);
  const remainingPercentage = Math.max(0, 100 - percentage);

  // 判断SLA状态
  let status = SLA_STATUS.NORMAL;
  if (remainingMs < 0) {
    status = SLA_STATUS.OVERDUE;
  } else if (remainingPercentage < 10) {
    status = SLA_STATUS.CRITICAL;
  } else if (remainingPercentage < 25) {
    status = SLA_STATUS.WARNING;
  }

  return {
    slaLimit,                    // SLA时限（小时）
    elapsedHours,                // 已用时间（小时）
    remainingHours,              // 剩余时间（小时）
    remainingMs,                 // 剩余时间（毫秒）
    percentage,                  // 完成百分比
    remainingPercentage,         // 剩余百分比
    status,                      // SLA状态
    deadline,                    // 截止时间
    isOverdue: remainingMs < 0   // 是否超期
  };
}

/**
 * 格式化倒计时显示
 * @param {number} remainingMs - 剩余毫秒数
 * @returns {string} 格式化的倒计时字符串
 */
function formatCountdown(remainingMs) {
  if (remainingMs < 0) {
    const overduems = Math.abs(remainingMs);
    const hours = Math.floor(overduems / (1000 * 60 * 60));
    const minutes = Math.floor((overduems % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `超期${days}天${remainingHours}小时`;
    } else if (hours > 0) {
      return `超期${hours}小时${minutes}分钟`;
    } else {
      return `超期${minutes}分钟`;
    }
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}天${remainingHours}小时`;
  } else if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

/**
 * 格式化截止时间显示
 * @param {Date} deadline - 截止时间
 * @returns {string} 格式化的截止时间
 */
function formatDeadline(deadline) {
  const year = deadline.getFullYear();
  const month = String(deadline.getMonth() + 1).padStart(2, '0');
  const day = String(deadline.getDate()).padStart(2, '0');
  const hours = String(deadline.getHours()).padStart(2, '0');
  const minutes = String(deadline.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 获取SLA状态的颜色
 * @param {string} status - SLA状态
 * @returns {string} 颜色值
 */
function getSLAColor(status) {
  const colors = {
    [SLA_STATUS.NORMAL]: '#34C759',      // 绿色
    [SLA_STATUS.WARNING]: '#FF9500',     // 橙色
    [SLA_STATUS.CRITICAL]: '#FF3B30',    // 红色
    [SLA_STATUS.OVERDUE]: '#8E8E93'      // 灰色
  };

  return colors[status] || colors[SLA_STATUS.NORMAL];
}

/**
 * 获取SLA状态的图标
 * @param {string} status - SLA状态
 * @returns {string} Emoji图标
 */
function getSLAIcon(status) {
  const icons = {
    [SLA_STATUS.NORMAL]: '✅',
    [SLA_STATUS.WARNING]: '⚠️',
    [SLA_STATUS.CRITICAL]: '🔴',
    [SLA_STATUS.OVERDUE]: '⏰'
  };

  return icons[status] || icons[SLA_STATUS.NORMAL];
}

/**
 * 获取SLA状态的文本描述
 * @param {string} status - SLA状态
 * @returns {string} 状态描述
 */
function getSLAStatusText(status) {
  const texts = {
    [SLA_STATUS.NORMAL]: '正常',
    [SLA_STATUS.WARNING]: '警告',
    [SLA_STATUS.CRITICAL]: '紧急',
    [SLA_STATUS.OVERDUE]: '超期'
  };

  return texts[status] || texts[SLA_STATUS.NORMAL];
}

/**
 * 批量计算工单列表的SLA
 * @param {Array} workOrders - 工单列表
 * @returns {Array} 包含SLA信息的工单列表
 */
function calculateWorkOrdersSLA(workOrders) {
  return workOrders.map(order => {
    const sla = calculateSLA(
      order.created_at,
      order.priority,
      order.status === 'Completed' ? order.completed_at : null
    );

    return {
      ...order,
      sla: {
        ...sla,
        countdown: formatCountdown(sla.remainingMs),
        deadlineText: formatDeadline(sla.deadline),
        statusText: getSLAStatusText(sla.status),
        statusColor: getSLAColor(sla.status),
        statusIcon: getSLAIcon(sla.status)
      }
    };
  });
}

/**
 * 获取需要告警的工单列表
 * @param {Array} workOrders - 工单列表
 * @param {Array} statuses - 要筛选的状态 ['warning', 'critical', 'overdue']
 * @returns {Array} 需要告警的工单
 */
function getAlertWorkOrders(workOrders, statuses = ['warning', 'critical', 'overdue']) {
  const ordersWithSLA = calculateWorkOrdersSLA(workOrders);

  return ordersWithSLA.filter(order => {
    // 只告警未完成的工单
    if (order.status === 'Completed' || order.status === 'Closed') {
      return false;
    }

    return statuses.includes(order.sla.status);
  });
}

/**
 * 生成SLA统计报告
 * @param {Array} workOrders - 工单列表
 * @returns {Object} 统计报告
 */
function generateSLAReport(workOrders) {
  const ordersWithSLA = calculateWorkOrdersSLA(workOrders);

  const stats = {
    total: workOrders.length,
    normal: 0,
    warning: 0,
    critical: 0,
    overdue: 0,
    onTime: 0,           // 按时完成
    delayed: 0           // 延期完成
  };

  ordersWithSLA.forEach(order => {
    stats[order.sla.status]++;

    // 统计完成状态
    if (order.status === 'Completed') {
      if (order.sla.isOverdue) {
        stats.delayed++;
      } else {
        stats.onTime++;
      }
    }
  });

  // 计算百分比
  stats.normalPercentage = (stats.normal / stats.total * 100).toFixed(1);
  stats.warningPercentage = (stats.warning / stats.total * 100).toFixed(1);
  stats.criticalPercentage = (stats.critical / stats.total * 100).toFixed(1);
  stats.overduePercentage = (stats.overdue / stats.total * 100).toFixed(1);

  if (stats.onTime + stats.delayed > 0) {
    stats.onTimeRate = (stats.onTime / (stats.onTime + stats.delayed) * 100).toFixed(1);
  } else {
    stats.onTimeRate = '0.0';
  }

  return stats;
}

module.exports = {
  SLA_LIMITS,
  SLA_STATUS,
  getSLALimit,
  calculateSLA,
  formatCountdown,
  formatDeadline,
  getSLAColor,
  getSLAIcon,
  getSLAStatusText,
  calculateWorkOrdersSLA,
  getAlertWorkOrders,
  generateSLAReport
};
