/**
 * 通知服务（云数据库版本）
 * 管理用户通知
 */

const { callCloudSilent } = require('../utils/cloudCall');

/**
 * 获取当前用户ID
 */
function getCurrentUserId() {
  try {
    const userInfo = wx.getStorageSync('user_info');
    return userInfo?.user_id || userInfo?.id || null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取用户通知列表
 * @param {Boolean} unreadOnly - 只获取未读通知
 * @param {Number} limit - 限制数量
 * @returns {Promise<Object>} 通知列表
 */
const getUserNotifications = async (unreadOnly = false, limit = 20) => {
  console.log('[Notification] Getting user notifications');
  const userId = getCurrentUserId();
  const result = await callCloudSilent('sendNotification', {
    action: 'getUserNotifications',
    data: { user_id: userId, unread_only: unreadOnly, limit }
  });
  console.log('[Notification] Got notifications:', result.total);
  return result;
};

/**
 * 标记通知为已读
 * @param {String} notificationId - 通知ID
 * @returns {Promise<Object>} 操作结果
 */
const markAsRead = async (notificationId) => {
  console.log('[Notification] Marking as read:', notificationId);
  const userId = getCurrentUserId();
  return await callCloudSilent('sendNotification', {
    action: 'markAsRead',
    data: { notification_id: notificationId, user_id: userId }
  });
};

/**
 * 标记所有通知为已读
 * @returns {Promise<Object>} 操作结果
 */
const markAllAsRead = async () => {
  console.log('[Notification] Marking all as read');
  const userId = getCurrentUserId();
  return await callCloudSilent('sendNotification', {
    action: 'markAllAsRead',
    data: { user_id: userId }
  });
};

/**
 * 获取未读通知数量
 * @returns {Promise<Number>} 未读数量
 */
const getUnreadCount = async () => {
  try {
    const userId = getCurrentUserId();
    const result = await callCloudSilent('sendNotification', {
      action: 'getUnreadCount',
      data: { user_id: userId }
    });
    return result.unread_count;
  } catch (error) {
    console.error('[Notification] Get unread count error:', error);
    return 0; // Return 0 on error instead of throwing
  }
};

/**
 * 获取分类未读数量（用于 TabBar 显示）
 * 返回三个模块的未读数及总和
 * @returns {Promise<Object>} { notificationCount, workorderCount, reminderCount, totalUnread }
 */
const getCategorizedUnreadCount = async () => {
  try {
    const result = await getUserNotifications(true, 100);

    if (!result || !result.success || !result.notifications) {
      return { notificationCount: 0, workorderCount: 0, reminderCount: 0, totalUnread: 0 };
    }

    const notifications = result.notifications;

    // 待办工单：type 包含 work_order 或 order_，但不是 urge_ 开头
    const workorderCount = notifications.filter(notif => {
      return notif.type && (
        notif.type.includes('work_order') ||
        notif.type.includes('order_')
      ) && !notif.type.startsWith('urge_');
    }).length;

    // 提醒我的：type 以 urge_ 开头
    const reminderCount = notifications.filter(notif => {
      return notif.type && notif.type.startsWith('urge_');
    }).length;

    // 通知公告：除了待办工单和提醒我的以外的其他通知
    const notificationCount = notifications.filter(notif => {
      if (!notif.type) return true;
      const isWorkorder = (notif.type.includes('work_order') || notif.type.includes('order_')) && !notif.type.startsWith('urge_');
      const isReminder = notif.type.startsWith('urge_');
      return !isWorkorder && !isReminder;
    }).length;

    const totalUnread = notificationCount + workorderCount + reminderCount;

    console.log('[Notification] Categorized unread:', { notificationCount, workorderCount, reminderCount, totalUnread });

    return { notificationCount, workorderCount, reminderCount, totalUnread };

  } catch (error) {
    console.error('[Notification] Get categorized unread count error:', error);
    return { notificationCount: 0, workorderCount: 0, reminderCount: 0, totalUnread: 0 };
  }
};

/**
 * 发送通知（内部使用）
 * @param {Number} userId - 用户ID
 * @param {String} type - 通知类型
 * @param {String} title - 标题
 * @param {String} message - 消息内容
 * @param {Object} data - 附加数据
 * @returns {Promise<Object>} 发送结果
 */
const sendNotification = async (userId, type, title, message, data = {}) => {
  try {
    console.log('[Notification] Sending notification to user:', userId);
    return await callCloudSilent('sendNotification', {
      action: 'send',
      data: { user_id: userId, type, title, message, data }
    });
  } catch (error) {
    console.error('[Notification] Send notification error:', error);
    // Don't throw - notification failure shouldn't break the main flow
    return { success: false, error: error.message };
  }
};

/**
 * 删除通知
 * @param {String} notificationId - 通知ID
 * @returns {Promise<Object>} 操作结果
 */
const deleteNotification = async (notificationId) => {
  console.log('[Notification] Deleting notification:', notificationId);
  return await callCloudSilent('sendNotification', {
    action: 'deleteNotification',
    data: { notification_id: notificationId }
  });
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getCategorizedUnreadCount,
  sendNotification,
  deleteNotification
};
