/**
 * 测试通知云函数
 * 用于创建测试通知数据
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action = 'create', user_id } = event;

  try {
    switch (action) {
      case 'create': {
        // 创建测试通知
        if (!user_id) {
          return {
            success: false,
            error: 'user_id is required'
          };
        }

        const notifications = db.collection('notifications');

        // 创建几条测试通知
        const testNotifications = [
          {
            user_id: user_id,
            type: 'work_order_created',
            event_type: 'work_order_created',
            title: '新工单通知',
            message: '您有一个新的维修工单需要处理',
            data: {
              order_id: '12345'
            },
            read: false,
            created_at: new Date(),
            sent_at: new Date()
          },
          {
            user_id: user_id,
            type: 'status_changed',
            event_type: 'status_changed',
            title: '工单状态变更',
            message: '工单 #12345 的状态已更新为"处理中"',
            data: {
              order_id: '12345'
            },
            read: false,
            created_at: new Date(Date.now() - 3600000), // 1小时前
            sent_at: new Date(Date.now() - 3600000)
          },
          {
            user_id: user_id,
            type: 'sla_warning',
            event_type: 'sla_warning',
            title: 'SLA预警',
            message: '工单 #12346 即将超时，请尽快处理',
            data: {
              order_id: '12346'
            },
            read: true,
            created_at: new Date(Date.now() - 7200000), // 2小时前
            sent_at: new Date(Date.now() - 7200000),
            read_at: new Date(Date.now() - 3600000)
          }
        ];

        const results = [];
        for (const notification of testNotifications) {
          const result = await notifications.add({ data: notification });
          results.push(result);
        }

        return {
          success: true,
          message: `创建了 ${results.length} 条测试通知`,
          ids: results.map(r => r._id)
        };
      }

      case 'clear': {
        // 清空用户的所有通知
        if (!user_id) {
          return {
            success: false,
            error: 'user_id is required'
          };
        }

        const notifications = db.collection('notifications');
        const { stats } = await notifications.where({ user_id }).remove();

        return {
          success: true,
          message: `删除了 ${stats.removed} 条通知`,
          removed: stats.removed
        };
      }

      default:
        return {
          success: false,
          error: 'Unknown action. Use "create" or "clear"'
        };
    }
  } catch (error) {
    console.error('[TestNotifications] Error:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
};
