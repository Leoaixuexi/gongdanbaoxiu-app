/**
 * 时间格式化工具函数
 * 为消息组件提供时间格式化支持
 *
 * 这个文件是为了适配从 xiaoxi 项目迁移过来的消息组件
 * 它将源项目的 getTimeAgo 函数映射到当前项目的 formatRelativeTime
 */

const { formatRelativeTime } = require('./formatter.js')

/**
 * 格式化相对时间（用于消息组件）
 * @param {Date|string|number} date 时间对象、时间戳或ISO字符串
 * @returns {string} 相对时间字符串（如"刚刚"、"5分钟前"等）
 */
function getTimeAgo(date) {
  try {
    // 如果已经是 Date 对象，直接使用
    if (date instanceof Date) {
      return formatRelativeTime(date)
    }

    // 如果是时间戳（数字）或 ISO 字符串，转换为 Date
    const dateObj = new Date(date)

    if (isNaN(dateObj.getTime())) {
      console.error('[TimeFormatter] Invalid date:', date)
      return '--'
    }

    return formatRelativeTime(dateObj)
  } catch (error) {
    console.error('[TimeFormatter] Error formatting time:', error)
    return '--'
  }
}

/**
 * 格式化日期时间
 * @param {Date|string|number} date 时间对象
 * @returns {string} 格式化的日期时间
 */
function formatDateTime(date) {
  try {
    const dateObj = date instanceof Date ? date : new Date(date)

    if (isNaN(dateObj.getTime())) {
      return '--'
    }

    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    const hours = String(dateObj.getHours()).padStart(2, '0')
    const minutes = String(dateObj.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    console.error('[TimeFormatter] Error formatting dateTime:', error)
    return '--'
  }
}

module.exports = {
  getTimeAgo,
  formatDateTime
}
