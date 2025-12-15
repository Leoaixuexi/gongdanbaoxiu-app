/**
 * 消息页面 - 基于UI设计图重新设计
 * 显示三个消息分类：通知公告、待办工单、提醒我的
 */

Page({
  data: {
    headerHeight: 0,
    // 通知公告
    notificationCount: 3,
    notificationSubtitle: '系统维护通知',
    notificationTime: '2小时前',
    // 待办工单
    workorderCount: 5,
    workorderSubtitle: '办公楼一层空调维修',
    workorderTime: '4小时前',
    // 提醒我的
    reminderCount: 1,
    reminderSubtitle: '检查安全通道',
    reminderTime: '1天前'
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
   * TODO: 接入真实后端数据
   */
  loadMessageData() {
    // 目前使用模拟数据，后续可接入真实API
    console.log('[Notifications] Loading message data...');

    // 模拟加载数据 - 当接入后端时，取消注释以下代码
    // try {
    //   const notifications = await notificationService.getUserNotifications();
    //   this.setData({
    //     notificationCount: notifications.unreadCount,
    //     notificationSubtitle: notifications.latestMessage,
    //     notificationTime: notifications.latestTime,
    //     ...
    //   });
    // } catch (error) {
    //   console.error('[Notifications] Load error:', error);
    // }
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
