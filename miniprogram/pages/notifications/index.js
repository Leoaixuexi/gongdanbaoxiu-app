/**
 * 消息页面 - 基于UI设计图重新设计
 * 显示三个消息分类：通知公告、待办工单、提醒我的
 */

const notificationService = require('../../services/notification');

Page({
  data: {
    headerHeight: 0,
    // 通知公告
    notificationCount: 0,
    notificationSubtitle: '暂无通知',
    notificationTime: '',
    // 待办工单
    workorderCount: 0,
    workorderSubtitle: '暂无待办事项',
    workorderTime: '',
    // 提醒我的
    reminderCount: 0,
    reminderSubtitle: '暂无提醒',
    reminderTime: ''
  },

  onLoad() {
    console.log('[Notifications] Page load');
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: statusBarHeight + navBarHeight
    });
  },

  onShow() {
    console.log('[Notifications] Page show');
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      });
    }
    // 加载消息数据
    this.loadMessageData();
  },

  /**
   * 加载消息数据
   */
  async loadMessageData() {
    console.log('[Notifications] Loading message data...');

    try {
      // 获取所有通知（未读）
      const result = await notificationService.getUserNotifications(true, 50);

      if (result && result.success && result.notifications) {
        // 筛选工单通知（待办工单） - 排除提醒类
        const workOrderNotifications = result.notifications.filter(notif => {
          return notif.type && (
            notif.type.includes('work_order') ||
            notif.type.includes('order_')
          ) && !notif.type.startsWith('urge_');  // 关键：排除提醒类
        });

        // 筛选提醒通知（提醒我的）
        const reminderNotifications = result.notifications.filter(notif => {
          return notif.type && notif.type.startsWith('urge_');
        });

        // 更新待办工单数据
        if (workOrderNotifications.length > 0) {
          const latestNotif = workOrderNotifications[0];
          this.setData({
            workorderCount: workOrderNotifications.length,
            workorderSubtitle: latestNotif.message || '有新的待办工单',
            workorderTime: this.formatTime(latestNotif.sent_at)
          });
        } else {
          this.setData({
            workorderCount: 0,
            workorderSubtitle: '暂无待办事项',
            workorderTime: ''
          });
        }

        // 更新提醒我的数据
        if (reminderNotifications.length > 0) {
          const latestNotif = reminderNotifications[0];
          this.setData({
            reminderCount: reminderNotifications.length,
            reminderSubtitle: latestNotif.message || '有新的提醒',
            reminderTime: this.formatTime(latestNotif.sent_at)
          });
        } else {
          this.setData({
            reminderCount: 0,
            reminderSubtitle: '暂无提醒',
            reminderTime: ''
          });
        }
      }
    } catch (error) {
      console.error('[Notifications] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 格式化时间为相对时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '';

    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < hour) {
      const minutes = Math.floor(diff / minute);
      return minutes <= 1 ? '刚刚' : `${minutes}分钟前`;
    } else if (diff < day) {
      const hours = Math.floor(diff / hour);
      return `${hours}小时前`;
    } else if (diff < 7 * day) {
      const days = Math.floor(diff / day);
      return `${days}天前`;
    } else {
      return `${time.getMonth() + 1}月${time.getDate()}日`;
    }
  },

  /**
   * 导航到消息列表页面
   */
  navigateToList(e) {
    const moduleId = e.currentTarget.dataset.module;
    console.log('[Notifications] Navigate to list:', moduleId);

    // 模块名称映射
    const moduleNames = {
      'notification': '通知公告',
      'workorder': '待办事项',
      'reminder': '提醒我的'
    };

    wx.navigateTo({
      url: `/pages/message-list/index?moduleId=${moduleId}&moduleName=${moduleNames[moduleId]}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadMessageData();
    wx.stopPullDownRefresh();
  }
});
