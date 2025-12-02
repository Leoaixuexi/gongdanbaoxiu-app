/**
 * Notifications Page
 * Display user's notifications
 */

const app = getApp();
const notificationService = require('../../services/notification');
const { formatRelativeTime } = require('../../utils/formatter');

Page({
  data: {
    notifications: [],
    loading: true,
    unreadOnly: false,
    unreadCount: 0,
    tabs: [
      { name: '全部', value: false },
      { name: '未读', value: true }
    ],
    activeTab: 0
  },

  /**
   * Lifecycle - Page Load
   */
  onLoad: function (options) {
    console.log('[Notifications] Page load');
    this.loadNotifications();
  },

  /**
   * Lifecycle - Page Show
   */
  onShow: function () {
    console.log('[Notifications] Page show');
    this.loadUnreadCount();
  },

  /**
   * Pull down to refresh
   */
  onPullDownRefresh: function () {
    console.log('[Notifications] Pull down refresh');
    this.loadNotifications();
    wx.stopPullDownRefresh();
  },

  /**
   * Load Notifications
   */
  loadNotifications: async function () {
    try {
      this.setData({ loading: true });

      const result = await notificationService.getUserNotifications(
        this.data.unreadOnly,
        50
      );

      // Process notifications to add display fields
      const notifications = result.notifications.map(notification => {
        return {
          ...notification,
          time_display: formatRelativeTime(notification.created_at)
        };
      });

      this.setData({
        notifications,
        unreadCount: result.unread_count,
        loading: false
      });

      console.log('[Notifications] Loaded:', notifications.length);

    } catch (error) {
      console.error('[Notifications] Load error:', error);
      this.setData({ loading: false });
      app.showError('加载通知失败');
    }
  },

  /**
   * Load Unread Count
   */
  loadUnreadCount: async function () {
    try {
      const count = await notificationService.getUnreadCount();
      this.setData({ unreadCount: count });
    } catch (error) {
      console.error('[Notifications] Load unread count error:', error);
    }
  },

  /**
   * Switch Tab
   */
  switchTab: function (e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.activeTab) return;

    const tab = this.data.tabs[index];
    this.setData({
      activeTab: index,
      unreadOnly: tab.value
    });

    this.loadNotifications();
  },

  /**
   * Handle Notification Tap
   */
  handleNotificationTap: async function (e) {
    const notification = e.currentTarget.dataset.notification;

    // Mark as read if unread
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification._id);

        // Update local data
        const notifications = this.data.notifications.map(n => {
          if (n._id === notification._id) {
            return { ...n, read: true, read_at: new Date() };
          }
          return n;
        });

        this.setData({
          notifications,
          unreadCount: Math.max(0, this.data.unreadCount - 1)
        });
      } catch (error) {
        console.error('[Notifications] Mark as read error:', error);
      }
    }

    // Navigate to related page if has order_id
    if (notification.data && notification.data.order_id) {
      wx.navigateTo({
        url: `/pages/work-order-detail/index?id=${notification.data.order_id}`
      });
    }
  },

  /**
   * Mark All As Read
   */
  markAllAsRead: async function () {
    try {
      wx.showLoading({ title: '标记中...', mask: true });

      await notificationService.markAllAsRead();

      wx.hideLoading();
      wx.showToast({
        title: '已全部标记为已读',
        icon: 'success'
      });

      // Refresh list
      this.loadNotifications();

    } catch (error) {
      wx.hideLoading();
      console.error('[Notifications] Mark all as read error:', error);
      app.showError('操作失败');
    }
  },

  /**
   * Delete Notification (future implementation)
   */
  handleDelete: function (e) {
    const notificationId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条通知吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        }
      }
    });
  }
});
