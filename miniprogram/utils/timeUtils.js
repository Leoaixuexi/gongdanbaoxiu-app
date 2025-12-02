/**
 * 时间工具函数
 * 用于工单用时计算和格式化
 */

/**
 * 计算两个时间之间的时长
 * @param {Date|String} startTime - 开始时间
 * @param {Date|String} endTime - 结束时间（不传则使用当前时间）
 * @returns {Object} 时长对象 { days, hours, minutes, seconds, totalSeconds, formatted }
 */
function calculateDuration(startTime, endTime = null) {
  if (!startTime) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      formatted: '0分钟'
    };
  }

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();

  // 计算总秒数
  const totalSeconds = Math.floor((end - start) / 1000);

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
  const formatted = formatDuration(days, hours, minutes, seconds);

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
 * 格式化时长为易读字符串
 * @param {Number} days - 天数
 * @param {Number} hours - 小时数
 * @param {Number} minutes - 分钟数
 * @param {Number} seconds - 秒数
 * @returns {String} 格式化字符串
 */
function formatDuration(days, hours, minutes, seconds) {
  const parts = [];

  if (days > 0) {
    parts.push(`${days}天`);
  }
  if (hours > 0) {
    parts.push(`${hours}小时`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}分钟`);
  }

  // 如果总时长小于1分钟，显示秒数
  if (parts.length === 0) {
    if (seconds > 0) {
      parts.push(`${seconds}秒`);
    } else {
      parts.push('0分钟');
    }
  }

  return parts.join('');
}

/**
 * 计算工单总用时
 * @param {Object} workOrder - 工单对象
 * @returns {Object} 时长对象
 */
function calculateWorkOrderDuration(workOrder) {
  if (!workOrder) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      formatted: '0分钟',
      status: 'not_started'
    };
  }

  const { status, created_at, completed_at } = workOrder;

  // 已完成的工单：从创建到完成的时间
  if (status === 'Completed' && completed_at) {
    return {
      ...calculateDuration(created_at, completed_at),
      status: 'completed'
    };
  }

  // 进行中的工单：从创建到当前的时间
  if (status === 'In Progress' || status === 'Repaired' || status === 'Needs Rework') {
    return {
      ...calculateDuration(created_at),
      status: 'in_progress'
    };
  }

  // 待维修的工单：从创建到当前的时间
  if (status === 'Pending Repair') {
    return {
      ...calculateDuration(created_at),
      status: 'pending'
    };
  }

  return {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
    formatted: '0分钟',
    status: 'unknown'
  };
}

/**
 * 计算工单各阶段用时
 * @param {Object} workOrder - 工单对象
 * @returns {Object} 各阶段时长
 */
function calculateWorkOrderPhases(workOrder) {
  if (!workOrder) {
    return {
      waitingTime: null,      // 等待维修时长
      repairTime: null,       // 维修时长
      reviewTime: null,       // 审核时长
      totalTime: null         // 总时长
    };
  }

  const {
    created_at,
    assigned_at,
    started_at,
    repaired_at,
    reviewed_at,
    completed_at
  } = workOrder;

  // 等待维修时长：从创建到开始维修
  const waitingTime = started_at
    ? calculateDuration(created_at, started_at)
    : null;

  // 维修时长：从开始维修到维修完成
  const repairTime = started_at && repaired_at
    ? calculateDuration(started_at, repaired_at)
    : null;

  // 审核时长：从维修完成到审核通过
  const reviewTime = repaired_at && completed_at
    ? calculateDuration(repaired_at, completed_at)
    : null;

  // 总时长：从创建到完成
  const totalTime = completed_at
    ? calculateDuration(created_at, completed_at)
    : calculateDuration(created_at); // 未完成则计算到当前时间

  return {
    waitingTime,
    repairTime,
    reviewTime,
    totalTime
  };
}

/**
 * 格式化日期时间
 * @param {Date|String} dateTime - 日期时间
 * @param {String} format - 格式（datetime, date, time）
 * @returns {String} 格式化字符串
 */
function formatDateTime(dateTime, format = 'datetime') {
  if (!dateTime) return '';

  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hours}:${minutes}`;
    case 'datetime':
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    case 'full':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
}

/**
 * 获取相对时间描述
 * @param {Date|String} dateTime - 日期时间
 * @returns {String} 相对时间描述（如：刚刚、5分钟前、1小时前）
 */
function getRelativeTime(dateTime) {
  if (!dateTime) return '';

  const now = new Date();
  const date = new Date(dateTime);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) {
    return '刚刚';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}分钟前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}小时前`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}天前`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}个月前`;
  }

  const years = Math.floor(months / 12);
  return `${years}年前`;
}

module.exports = {
  calculateDuration,
  formatDuration,
  calculateWorkOrderDuration,
  calculateWorkOrderPhases,
  formatDateTime,
  getRelativeTime
};
