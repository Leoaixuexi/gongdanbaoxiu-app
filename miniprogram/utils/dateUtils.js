/**
 * 日期工具函数
 * 用于物业经理数据分析页面的日期范围处理
 */

/**
 * 获取预设时间范围
 * @param {string} filterType - 时间过滤类型: 'yesterday' | 'today' | 'week' | 'month' | 'custom'
 * @returns {Object} {startDate: Date, endDate: Date}
 */
function getDateRange(filterType) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filterType) {
    case 'all':
      return {
        startDate: null,
        endDate: null
      };

    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday,
        endDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
      };

    case 'today':
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      };

    case 'week':
      const weekStart = new Date(today);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 周一为一周开始
      weekStart.setDate(today.getDate() + diff);
      return {
        startDate: weekStart,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      };

    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: monthStart,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      };

    default:
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
      };
  }
}

/**
 * 格式化日期为字符串
 * @param {Date} date - 日期对象
 * @param {string} format - 格式: 'YYYY-MM-DD' | 'MM-DD' | 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM-DD':
      return `${month}-${day}`;
    case 'YYYY-MM-DD HH:mm:ss':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * 解析日期字符串为Date对象
 * @param {string} dateStr - 日期字符串
 * @returns {Date} Date对象
 */
function parseDate(dateStr) {
  return new Date(dateStr);
}

/**
 * 获取日期范围内的所有日期（用于生成折线图X轴）
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {Array<string>} 日期数组 (MM-DD格式)
 */
function getDatesInRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(formatDate(current, 'MM-DD'));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 验证日期范围
 * @param {Date} startDate - 开始日期
 * @param {Date} endDate - 结束日期
 * @returns {boolean} 是否有效
 */
function validateDateRange(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
    return false;
  }
  return startDate <= endDate;
}

module.exports = {
  getDateRange,
  formatDate,
  parseDate,
  getDatesInRange,
  validateDateRange
};
