/**
 * 消息页面 - 基于UI设计图重新设计
 * 显示三个消息分类：通知公告、待办工单、提醒我的
 */

const notificationService = require('../../services/notification');
const { getNavBarInfo } = require('../../utils/navigation');

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
    reminderTime: '',

    // 防重复加载
    _isLoading: false,
    _lastLoadTime: 0
  },

  onLoad() {
    // console.log('[Notifications] Page load');
    // 计算自定义导航栏高度
    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight)
    });
  },

  onShow() {
    // console.log('[Notifications] Page show');
    // 设置自定义 tabBar 选中状态，并同步徽章数据
    const syncBadge = (tabBar, source) => {
      tabBar.setData({ selected: 1 });
      const app = getApp();
      if (app && app.globalData.unreadCounts) {
        const globalVersion = app.globalData._badgeVersion || 0;
        const globalCounts = app.globalData.unreadCounts;
        const appliedVersion = tabBar.data._appliedVersion || 0;
        const localTotal = tabBar.data.totalUnread || 0;
        const globalTotal = globalCounts.totalUnread || 0;
        if ((globalVersion > appliedVersion || localTotal !== globalTotal) && tabBar.applyBadge) {
          // console.log('[Notifications] Manual badge sync from ' + source + ': localTotal=' + localTotal + ', globalTotal=' + globalTotal);
          tabBar.applyBadge(globalCounts, globalVersion, source);
        }
      }
    };

    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      syncBadge(this.getTabBar(), 'notifications-onShow');
    } else {
      // TabBar 可能还未初始化，延迟重试
      setTimeout(() => {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          syncBadge(this.getTabBar(), 'notifications-onShow-delayed');
        }
      }, 100);
    }

    // 防止2秒内重复加载
    const now = Date.now();
    if (this.data._isLoading || (now - this.data._lastLoadTime < 2000)) {
      // console.log('[Notifications] Skip duplicate load');
      return;
    }
    // 加载消息数据
    this.loadMessageData();
  },

  /**
   * 加载消息数据
   */
  async loadMessageData() {
    if (this.data._isLoading) return;

    // console.log('[Notifications] Loading message data...');
    this.setData({ _isLoading: true });

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

        // 同步更新 TabBar 未读数
        this.updateTabBarUnreadCount();
      }

      this.setData({ _isLoading: false, _lastLoadTime: Date.now() });
    } catch (error) {
      console.error('[Notifications] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ _isLoading: false });
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
    // console.log('[Notifications] Navigate to list:', moduleId);

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
  },

  /**
   * 更新 TabBar 未读数 - 使用统一入口确保全局同步
   */
  updateTabBarUnreadCount() {
    const app = getApp();
    // 使用 app.refreshUnreadCounts 而不是 tabBar.updateUnreadCount
    // 这样可以确保所有页面的 TabBar 都同步更新，而不是只更新当前页面
    if (app && app.refreshUnreadCounts) {
      app.refreshUnreadCounts();
    }
  }
});
