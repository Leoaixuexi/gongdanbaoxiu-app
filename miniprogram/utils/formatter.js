/**
 * Date/Time Formatter Utility
 * Provides Chinese-localized date/time formatting functions
 */

const padZero = (num) => {
  return num < 10 ? `0${num}` : `${num}`;
};

const formatDate = (date, format = 'YYYY-MM-DD') => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      console.error('[Formatter] Invalid date:', date);
      return '--';
    }
    const year = d.getFullYear();
    const month = padZero(d.getMonth() + 1);
    const day = padZero(d.getDate());
    const hour = padZero(d.getHours());
    const minute = padZero(d.getMinutes());
    const second = padZero(d.getSeconds());
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second);
  } catch (error) {
    console.error('[Formatter] Error formatting date:', error);
    return '--';
  }
};

const formatTime = (date) => formatDate(date, 'HH:mm:ss');
const formatDateTime = (date) => formatDate(date, 'YYYY-MM-DD HH:mm:ss');

const formatRelativeTime = (date) => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--';
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 0) return formatDateTime(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days === 1) return `昨天 ${formatTime(date)}`;
    if (days < 7) return `${days}天前`;
    if (now.getFullYear() === d.getFullYear()) return formatDate(date, 'MM-DD HH:mm');
    return formatDate(date, 'YYYY-MM-DD');
  } catch (error) {
    return '--';
  }
};

const formatDuration = (ms) => {
  try {
    if (typeof ms !== 'number' || ms < 0) return '--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours % 24 > 0) parts.push(`${hours % 24}小时`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`);
    if (parts.length === 0) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${remainingSeconds}秒` : '0秒';
    }
    return parts.join('');
  } catch (error) {
    return '--';
  }
};

const formatFileSize = (bytes) => {
  try {
    if (typeof bytes !== 'number' || bytes < 0) return '--';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)}${units[unitIndex]}`;
  } catch (error) {
    return '--';
  }
};

const formatPhone = (phone, mask = false) => {
  try {
    if (!phone) return '--';
    const cleaned = phone.replace(/D/g, '');
    if (cleaned.length !== 11) return phone;
    if (mask) return `${cleaned.substr(0, 3)}****${cleaned.substr(7)}`;
    return `${cleaned.substr(0, 3)} ${cleaned.substr(3, 4)} ${cleaned.substr(7)}`;
  } catch (error) {
    return phone;
  }
};

const formatCurrency = (amount) => {
  try {
    if (typeof amount !== 'number') return '--';
    return `¥${amount.toFixed(2)}`;
  } catch (error) {
    return '--';
  }
};

const truncate = (text, maxLength = 50) => {
  try {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.substr(0, maxLength)}...`;
  } catch (error) {
    return text;
  }
};

/**
 * Format SLA time remaining for display
 * @param {number} timeRemaining - Time remaining in milliseconds (negative if overdue)
 * @returns {string} Formatted string like "剩余 2小时30分" or "已超期 3小时"
 */
const formatSLATimeRemaining = (timeRemaining) => {
  try {
    if (typeof timeRemaining !== 'number') return '--';

    const absTime = Math.abs(timeRemaining);
    const totalMinutes = Math.floor(absTime / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (timeRemaining <= 0) {
      // Overdue
      if (days > 0) {
        return `已超期 ${days}天`;
      } else if (hours > 0) {
        return `已超期 ${hours}小时`;
      } else {
        return `已超期 ${minutes}分钟`;
      }
    } else {
      // Time remaining
      if (days > 0) {
        return `剩余 ${days}天`;
      } else if (hours > 0 && minutes > 0) {
        return `剩余 ${hours}小时${minutes}分`;
      } else if (hours > 0) {
        return `剩余 ${hours}小时`;
      } else {
        return `剩余 ${minutes}分钟`;
      }
    }
  } catch (error) {
    console.error('[Formatter] Error formatting SLA time:', error);
    return '--';
  }
};

/**
 * Get SLA status color class based on percentage used and overdue status
 * @param {boolean} isOverdue - Whether the order is overdue
 * @param {number} percentageUsed - Percentage of SLA time used (0-100+)
 * @returns {string} Color class: 'green', 'yellow', 'orange', 'red'
 */
const getSLAColorClass = (isOverdue, percentageUsed) => {
  if (isOverdue) return 'red';
  if (percentageUsed >= 80) return 'orange';
  if (percentageUsed >= 50) return 'yellow';
  return 'green';
};

/**
 * Get SLA badge text based on status
 * @param {string} slaStatus - SLA status: 'ok', 'warning', 'overdue'
 * @param {boolean} isOverdue - Whether the order is overdue
 * @returns {string} Badge text
 */
const getSLABadgeText = (slaStatus, isOverdue) => {
  if (isOverdue) return '超期';
  if (slaStatus === 'warning') return '即将超期';
  return '';
};

/**
 * Format time remaining as compact display for cards
 * @param {number} timeRemaining - Time remaining in milliseconds
 * @returns {string} Compact format like "2h" or "-3h"
 */
const formatSLACompact = (timeRemaining) => {
  try {
    if (typeof timeRemaining !== 'number') return '--';

    const absTime = Math.abs(timeRemaining);
    const hours = Math.floor(absTime / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const prefix = timeRemaining <= 0 ? '-' : '';

    if (days > 0) {
      return `${prefix}${days}天`;
    } else if (hours > 0) {
      return `${prefix}${hours}小时`;
    } else {
      const minutes = Math.floor(absTime / (1000 * 60));
      return `${prefix}${minutes}分钟`;
    }
  } catch (error) {
    return '--';
  }
};

module.exports = {
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  formatFileSize,
  formatPhone,
  formatCurrency,
  truncate,
  formatSLATimeRemaining,
  getSLAColorClass,
  getSLABadgeText,
  formatSLACompact,
};
