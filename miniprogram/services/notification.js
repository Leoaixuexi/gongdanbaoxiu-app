/**
 * 通知服务（云数据库版本）
 * 管理用户通知
 */

/**
 * 获取用户通知列表
 * @param {Boolean} unreadOnly - 只获取未读通知
 * @param {Number} limit - 限制数量
 * @returns {Promise<Object>} 通知列表
 */
const getUserNotifications = async (unreadOnly = false, limit = 20) => {
  try {
    console.log('[Notification] Getting user notifications');

    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'getUserNotifications',
        data: {
          user_id: wx.getStorageSync('user_info')?.user_id,
          unread_only: unreadOnly,
          limit
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取通知失败');
    }

    console.log('[Notification] Got notifications:', result.result.total);
    return result.result;

  } catch (error) {
    console.error('[Notification] Get notifications error:', error);
    throw error;
  }
};

/**
 * 标记通知为已读
 * @param {String} notificationId - 通知ID
 * @returns {Promise<Object>} 操作结果
 */
const markAsRead = async (notificationId) => {
  try {
    console.log('[Notification] Marking as read:', notificationId);

    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'markAsRead',
        data: {
          notification_id: notificationId,
          user_id: wx.getStorageSync('user_info')?.user_id
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '标记失败');
    }

    return result.result;

  } catch (error) {
    console.error('[Notification] Mark as read error:', error);
    throw error;
  }
};

/**
 * 标记所有通知为已读
 * @returns {Promise<Object>} 操作结果
 */
const markAllAsRead = async () => {
  try {
    console.log('[Notification] Marking all as read');

    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'markAllAsRead',
        data: {
          user_id: wx.getStorageSync('user_info')?.user_id
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '标记失败');
    }

    return result.result;

  } catch (error) {
    console.error('[Notification] Mark all as read error:', error);
    throw error;
  }
};

/**
 * 获取未读通知数量
 * @returns {Promise<Number>} 未读数量
 */
const getUnreadCount = async () => {
  try {
    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'getUnreadCount',
        data: {
          user_id: wx.getStorageSync('user_info')?.user_id
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '获取未读数量失败');
    }

    return result.result.unread_count;

  } catch (error) {
    console.error('[Notification] Get unread count error:', error);
    return 0; // Return 0 on error instead of throwing
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

    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'send',
        data: {
          user_id: userId,
          type,
          title,
          message,
          data
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '发送通知失败');
    }

    return result.result;

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
  try {
    console.log('[Notification] Deleting notification:', notificationId);

    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'deleteNotification',
        data: {
          notification_id: notificationId
        }
      }
    });

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '删除失败');
    }

    return result.result;

  } catch (error) {
    console.error('[Notification] Delete notification error:', error);
    throw error;
  }
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  sendNotification,
  deleteNotification
};
