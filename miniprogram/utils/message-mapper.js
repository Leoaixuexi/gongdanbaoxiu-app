/**
 * 消息分类映射工具
 * 将后端的 event_type 映射到消息模块
 */

// event_type 到模块的映射
const EVENT_TO_MODULE = {
  'work_order_created': 'tasks',
  'status_changed': 'tasks',
  'sla_warning': 'reminders',
  'escalation': 'reminders',
  'system_notice': 'announcements'
}

// 模块配置
const MODULE_CONFIG = {
  announcements: {
    name: '通知公告',
    iconBgColor: 'bg-orange-100'
  },
  tasks: {
    name: '待办工单',
    iconBgColor: 'bg-purple-100'
  },
  reminders: {
    name: '提醒我的',
    iconBgColor: 'bg-blue-100'
  }
}

/**
 * 按模块分组消息
 * @param {Array} notifications - 消息列表
 * @returns {Object} 分组后的消息对象
 */
function groupMessagesByModule(notifications) {
  const grouped = {
    announcements: [],
    tasks: [],
    reminders: []
  }

  notifications.forEach(notification => {
    const moduleId = EVENT_TO_MODULE[notification.event_type] || 'announcements'
    grouped[moduleId].push(notification)
  })

  return grouped
}

/**
 * 按模块筛选消息
 * @param {Array} notifications - 消息列表
 * @param {String} moduleId - 模块 ID
 * @returns {Array} 筛选后的消息列表
 */
function filterMessagesByModule(notifications, moduleId) {
  return notifications.filter(notification => {
    const msgModuleId = EVENT_TO_MODULE[notification.event_type] || 'announcements'
    return msgModuleId === moduleId
  })
}

/**
 * 获取每个模块的统计信息
 * @param {Array} notifications - 消息列表
 * @returns {Object} 每个模块的统计数据
 */
function getModuleStats(notifications) {
  const grouped = groupMessagesByModule(notifications)

  return {
    announcements: {
      latestMessage: grouped.announcements[0] || null,
      unreadCount: grouped.announcements.filter(m => !m.read).length
    },
    tasks: {
      latestMessage: grouped.tasks[0] || null,
      unreadCount: grouped.tasks.filter(m => !m.read).length
    },
    reminders: {
      latestMessage: grouped.reminders[0] || null,
      unreadCount: grouped.reminders.filter(m => !m.read).length
    }
  }
}

module.exports = {
  EVENT_TO_MODULE,
  MODULE_CONFIG,
  groupMessagesByModule,
  filterMessagesByModule,
  getModuleStats
}
