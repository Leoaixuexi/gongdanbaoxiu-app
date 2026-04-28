/**
 * Cloud Function: Send Notification
 * Purpose: Send subscription messages and manage notifications
 *
 * Actions:
 * - send: Send subscription message
 * - sendBatch: Send to multiple users
 * - getTemplates: Get notification templates
 * - getUserNotifications: Get user's notifications
 * - markAsRead: Mark notification as read
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// Notification Templates Configuration
// TODO: Replace with actual template IDs from WeChat MP Platform
const NOTIFICATION_TEMPLATES = {
  ORDER_ASSIGNED: {
    id: 'TEMPLATE_ID_ORDER_ASSIGNED',
    name: '工单分配通知',
    page: 'pages/work-order-detail/index',
    // Fields: thing1=工单编号, thing2=故障类型, thing3=位置, date4=分配时间
  },
  ORDER_STARTED: {
    id: 'TEMPLATE_ID_ORDER_STARTED',
    name: '维修开始通知',
    page: 'pages/work-order-detail/index',
    // Fields: character_string1=工单编号, thing2=维修员, date3=开始时间
  },
  ORDER_COMPLETED: {
    id: 'TEMPLATE_ID_ORDER_COMPLETED',
    name: '维修完成通知',
    page: 'pages/work-order-detail/index',
    // Fields: character_string1=工单编号, phrase2=状态, date3=完成时间
  },
  ORDER_REVIEWED: {
    id: 'TEMPLATE_ID_ORDER_REVIEWED',
    name: '验收完成通知',
    page: 'pages/work-order-detail/index',
    // Fields: character_string1=工单编号, phrase2=验收结果, thing3=意见
  },
  ORDER_REWORK: {
    id: 'TEMPLATE_ID_ORDER_REWORK',
    name: '返工通知',
    page: 'pages/work-order-detail/index',
    // Fields: character_string1=工单编号, thing2=返工原因, date3=时间
  }
};

/**
 * Get user by user_id
 */
async function getUserById(userId) {
  const users = db.collection('users');
  const { data } = await users.where({ user_id: userId }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * Get user by openid (cloud context)
 */
async function getUserByOpenId(openid) {
  // 防护：openid 不能为空
  if (!openid) {
    console.error('[getUserByOpenId] openid is empty');
    return null;
  }
  const users = db.collection('users');
  const { data } = await users.where({ wechat_openid: openid }).get();
  // 确保返回的用户 wechat_openid 精确匹配（防止空值匹配问题）
  const validUsers = data.filter(u => u.wechat_openid && u.wechat_openid === openid);
  return validUsers.length > 0 ? validUsers[0] : null;
}

/**
 * Save notification to database
 */
async function saveNotification(userId, type, title, message, data = {}) {
  const notifications = db.collection('notifications');
  const user = await getUserById(userId);

  if (!user) {
    console.error('[SaveNotification] User not found:', userId);
    return null;
  }

  try {
    const notification = {
      user_id: userId,
      _openid: user.wechat_openid,
      type,
      title,
      message,
      data,
      read: false,
      sent_at: new Date(),
      read_at: null,
      created_at: new Date()
    };

    const result = await notifications.add({ data: notification });
    return { ...notification, _id: result._id };
  } catch (error) {
    console.error('[SaveNotification] Error:', error);
    return null;
  }
}

/**
 * Send subscription message
 */
async function sendSubscriptionMessage(openid, templateId, data, page) {
  try {
    // In development, we can't actually send subscription messages
    // This would work in production with proper template IDs
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: page || 'pages/index/index',
      data: data,
      templateId: templateId,
      miniprogramState: 'developer' // Change to 'formal' for production
    });

    return {
      success: true,
      errCode: result.errCode,
      errMsg: result.errMsg
    };
  } catch (error) {
    console.error('[SendSubscriptionMessage] Error:', error);
    // Even if subscription message fails, we still save to database
    return {
      success: false,
      error: error.message,
      errCode: error.errCode
    };
  }
}

/**
 * Main function
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data: eventData = {} } = event;

  console.log(`[SendNotification] Action: ${action}`);

  try {
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取微信身份，请在小程序内操作' };
    }

    // 优先通过 openid 获取用户
    let currentUser = await getUserByOpenId(openid);

    // 测试阶段备用方案：如果 openid 匹配不到，使用前端传递的 user_id
    if (!currentUser && eventData.user_id) {
      console.log('[SendNotification] Fallback to user_id:', eventData.user_id);
      currentUser = await getUserById(eventData.user_id);
    }

    if (!currentUser) {
      return { success: false, error: '用户不存在' };
    }
    if (currentUser.active === false) {
      return { success: false, error: '账号已被停用' };
    }

    // Admin-only actions (prevents arbitrary users from sending/reading others' notifications)
    const adminOnlyActions = new Set(['send', 'sendBatch', 'getTemplates']);
    if (adminOnlyActions.has(action) && currentUser.role_id !== 1) {
      return { success: false, error: '无权限执行该操作' };
    }

    switch (action) {
      case 'send': {
        // Send single notification
        const { user_id, type, title, message, template_data, page } = eventData;

        if (!user_id || !type || !title || !message) {
          return {
            success: false,
            error: 'user_id, type, title, and message are required'
          };
        }

        // Get user
        const user = await getUserById(user_id);
        if (!user) {
          return {
            success: false,
            error: 'User not found'
          };
        }

        // Save to database
        const notification = await saveNotification(
          user_id,
          type,
          title,
          message,
          eventData.data || {}
        );

        // Try to send subscription message (if template configured)
        let sendResult = { success: true };
        if (template_data && NOTIFICATION_TEMPLATES[type]) {
          sendResult = await sendSubscriptionMessage(
            user.wechat_openid,
            NOTIFICATION_TEMPLATES[type].id,
            template_data,
            page || NOTIFICATION_TEMPLATES[type].page
          );
        }

        return {
          success: true,
          notification_id: notification?._id,
          subscription_sent: sendResult.success,
          subscription_error: sendResult.error
        };
      }

      case 'sendBatch': {
        // Send to multiple users
        const { user_ids, type, title, message, template_data, page } = eventData;

        if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
          return {
            success: false,
            error: 'user_ids array is required'
          };
        }

        const results = [];
        for (const userId of user_ids) {
          try {
            const result = await exports.main({
              action: 'send',
              data: { user_id: userId, type, title, message, template_data, page, data: eventData.data }
            }, context);
            results.push({ user_id: userId, ...result });
          } catch (error) {
            results.push({ user_id: userId, success: false, error: error.message });
          }
        }

        const successCount = results.filter(r => r.success).length;
        return {
          success: true,
          total: user_ids.length,
          succeeded: successCount,
          failed: user_ids.length - successCount,
          results
        };
      }

      case 'getTemplates': {
        // Get available notification templates
        return {
          success: true,
          templates: NOTIFICATION_TEMPLATES
        };
      }

      case 'getUserNotifications': {
        // Get user's notifications
        const { unread_only = false, limit = 20 } = eventData;
        const user_id = currentUser.user_id;

        const notifications = db.collection('notifications');

        // 构建查询条件（合并到单个 where 调用）
        const queryCondition = { user_id };
        if (unread_only) {
          queryCondition.read = false;
        }

        // 移除 orderBy 避免云数据库索引问题
        const { data } = await notifications
          .where(queryCondition)
          .limit(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100))
          .get();

        // 在应用层按 created_at 降序排序
        const sortedData = data.sort((a, b) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return {
          success: true,
          notifications: sortedData,
          total: sortedData.length,
          unread_count: sortedData.filter(n => !n.read).length
        };
      }

      case 'markAsRead': {
        // Mark notification as read
        const { notification_id } = eventData;

        if (!notification_id) {
          return {
            success: false,
            error: 'notification_id is required'
          };
        }

        const notifications = db.collection('notifications');

        // Verify ownership (always use cloud context user)
        const { data: docData } = await notifications.doc(notification_id).get();
        if (!docData || docData.user_id !== currentUser.user_id) {
          return { success: false, error: 'Notification not found or access denied' };
        }

        await notifications.doc(notification_id).update({
          data: {
            read: true,
            read_at: new Date()
          }
        });

        return {
          success: true,
          message: 'Notification marked as read'
        };
      }

      case 'markAllAsRead': {
        // Mark all user's notifications as read
        const user_id = currentUser.user_id;

        const notifications = db.collection('notifications');
        const { stats } = await notifications
          .where({
            user_id,
            read: false
          })
          .update({
            data: {
              read: true,
              read_at: new Date()
            }
          });

        return {
          success: true,
          updated: stats.updated
        };
      }

      case 'getUnreadCount': {
        // Get user's unread notification count
        const user_id = currentUser.user_id;

        const notifications = db.collection('notifications');
        const { total } = await notifications.where({
          user_id,
          read: false
        }).count();

        return {
          success: true,
          unread_count: total
        };
      }

      case 'deleteNotification': {
        // Delete a notification
        const { notification_id } = eventData;

        if (!notification_id) {
          return {
            success: false,
            error: 'notification_id is required'
          };
        }

        const notifications = db.collection('notifications');

        // Verify ownership
        const { data: docData } = await notifications.doc(notification_id).get();
        if (!docData || docData.user_id !== currentUser.user_id) {
          return { success: false, error: 'Notification not found or access denied' };
        }

        await notifications.doc(notification_id).remove();

        return {
          success: true,
          message: 'Notification deleted'
        };
      }

      case 'hideAnnouncement': {
        // 隐藏公告（用户级别，不真正删除公告）
        const { announcement_id } = eventData;

        if (!announcement_id) {
          return {
            success: false,
            error: 'announcement_id is required'
          };
        }

        const hiddenCollection = db.collection('user_hidden_announcements');

        // 检查是否已隐藏
        const { data: existing } = await hiddenCollection.where({
          user_id: currentUser.user_id,
          announcement_id: announcement_id
        }).get();

        if (existing.length > 0) {
          return { success: true, message: 'Already hidden' };
        }

        // 插入隐藏记录
        await hiddenCollection.add({
          data: {
            user_id: currentUser.user_id,
            announcement_id: announcement_id,
            hidden_at: new Date()
          }
        });

        return {
          success: true,
          message: 'Announcement hidden'
        };
      }

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
          available_actions: ['send', 'sendBatch', 'getTemplates', 'getUserNotifications', 'markAsRead', 'markAllAsRead', 'getUnreadCount', 'deleteNotification', 'hideAnnouncement']
        };
    }
  } catch (error) {
    console.error('[SendNotification] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
