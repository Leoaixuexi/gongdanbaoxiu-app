/**
 * 消息列表页 - 基于UI设计图重新设计
 * 显示特定模块的消息列表（通知公告、待办工单、提醒我的）
 * 支持滑动显示删除和取消操作
 */

Page({
  data: {
    moduleId: '',
    moduleName: '',
    messages: [],
    loading: true,
    refreshing: false,
    statusBarHeight: 0,
    headerHeight: 0
  },

  // 滑动相关变量
  touchStartX: 0,
  touchStartY: 0,
  currentSwipedIndex: -1,

  onLoad(options) {
    const { moduleId, moduleName } = options;
    console.log('[Message List] Page load, moduleId:', moduleId, 'moduleName:', moduleName);

    // 计算导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;

    this.setData({
      moduleId: moduleId || 'notification',
      moduleName: moduleName || '消息列表',
      statusBarHeight,
      headerHeight: statusBarHeight + navBarHeight
    });

    this.loadMessages();
  },

  onShow() {
    console.log('[Message List] Page show');
  },

  /**
   * 加载消息列表
   */
  async loadMessages() {
    this.setData({ loading: true });

    try {
      await this.delay(500);
      const mockData = this.getMockMessages(this.data.moduleId);

      // 添加 swiped 状态
      const messagesWithState = mockData.map(m => ({ ...m, swiped: false }));

      this.setData({
        messages: messagesWithState,
        loading: false,
        refreshing: false
      });

      console.log('[Message List] Loaded:', mockData.length, 'messages');

    } catch (error) {
      console.error('[Message List] Load error:', error);
      this.setData({ loading: false, refreshing: false });

      wx.showToast({
        title: '加载失败',
        icon: 'error',
        duration: 2000
      });
    }
  },

  /**
   * 获取模拟消息数据
   */
  getMockMessages(moduleId) {
    const mockDataMap = {
      'notification': [
        { id: '1', title: '系统维护通知', content: '系统将于2024年1月15日凌晨2:00-6:00进行例行维护，届时系统将暂停服务，请提前做好准...', timeText: '2025-12-08 21:00', isRead: false },
        { id: '2', title: '新功能上线公告', content: '全新的消息通知功能已上线，支持实时推送和历史消息查看，欢迎体验。', timeText: '2025-12-08 18:30', isRead: false },
        { id: '3', title: '节假日安排通知', content: '根据国家法定节假日安排，春节放假时间为1月20日至1月27日，共8天。', timeText: '2025-12-07 14:20', isRead: false },
        { id: '4', title: '安全培训通知', content: '定于本周五下午3点在会议室进行消防安全培训，请全体员工准时参加。', timeText: '2025-12-06 09:15', isRead: true },
        { id: '5', title: '办公区域调整公告', content: '因办公区域调整，三楼部分工位将进行重新分配，请相关同事配合搬迁工作。', timeText: '2025-12-05 16:45', isRead: true }
      ],
      'workorder': [
        { id: '1', title: '办公楼一层空调维修', content: '一层大厅空调制热效果差，需要检修。工单编号：WO20240115001', timeText: '2025-12-08 19:30', isRead: false },
        { id: '2', title: '会议室投影仪故障', content: '302会议室投影仪无法正常开机，请尽快处理。工单编号：WO20240115002', timeText: '2025-12-08 17:00', isRead: false },
        { id: '3', title: '电梯年度检验', content: 'A栋电梯需进行年度安全检验，请安排技术人员配合。工单编号：WO20240114001', timeText: '2025-12-08 13:20', isRead: false },
        { id: '4', title: '消防设备巡检', content: '本月消防设备巡检任务已分配，请于本周内完成。工单编号：WO20240113001', timeText: '2025-12-07 10:30', isRead: false },
        { id: '5', title: '门禁系统升级', content: '门禁系统软件升级，需配合进行现场调试。工单编号：WO20240112001', timeText: '2025-12-07 08:45', isRead: false }
      ],
      'reminder': [
        { id: '1', title: '检查安全通道', content: '请检查B栋安全通道是否畅通，确保无杂物堆放。', timeText: '2025-12-07 15:00', isRead: false },
        { id: '2', title: '设备保养提醒', content: '中央空调系统已到保养周期，请联系供应商安排保养。', timeText: '2025-12-06 11:20', isRead: true },
        { id: '3', title: '合同到期提醒', content: '保洁服务合同将于下月15日到期，请及时处理续约事宜。', timeText: '2025-12-05 09:00', isRead: true },
        { id: '4', title: '缴费提醒', content: '本月物业费缴纳截止日期为25日，请及时通知业主。', timeText: '2025-12-04 14:30', isRead: true }
      ]
    };

    return mockDataMap[moduleId] || [];
  },

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 返回上一页
   */
  handleBack() {
    wx.navigateBack();
  },

  /**
   * 触摸开始
   */
  onTouchStart(e) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  },

  /**
   * 触摸移动
   */
  onTouchMove(e) {
    // 阻止默认行为
  },

  /**
   * 触摸结束
   */
  onTouchEnd(e) {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - this.touchStartX;
    const deltaY = touchEndY - this.touchStartY;
    const index = e.currentTarget.dataset.index;

    // 确保是水平滑动
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      const messages = this.data.messages;

      if (deltaX < 0) {
        // 向左滑动 - 显示操作按钮
        // 先收起其他已滑动的项
        messages.forEach((m, i) => {
          m.swiped = (i === index);
        });
        this.currentSwipedIndex = index;
      } else {
        // 向右滑动 - 收起操作按钮
        messages[index].swiped = false;
        this.currentSwipedIndex = -1;
      }

      this.setData({ messages });
    }
  },

  /**
   * 取消操作（收起滑动）
   */
  handleCancel(e) {
    const messageId = e.currentTarget.dataset.id;
    const messages = this.data.messages.map(m => {
      if (m.id === messageId) {
        return { ...m, swiped: false };
      }
      return m;
    });
    this.setData({ messages });
    this.currentSwipedIndex = -1;
  },

  /**
   * 删除消息
   */
  handleDelete(e) {
    const messageId = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: (res) => {
        if (res.confirm) {
          const messages = this.data.messages.filter(m => m.id !== messageId);
          this.setData({ messages });
          this.currentSwipedIndex = -1;

          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  /**
   * 标记所有消息为已读
   */
  async handleMarkAllRead() {
    const unreadMessages = this.data.messages.filter(m => !m.isRead);

    if (unreadMessages.length === 0) {
      wx.showToast({
        title: '没有未读消息',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    wx.showLoading({ title: '处理中...', mask: true });

    try {
      await this.delay(500);

      const messages = this.data.messages.map(m => ({
        ...m,
        isRead: true
      }));

      this.setData({ messages });

      wx.hideLoading();
      wx.showToast({
        title: '已全部标记为已读',
        icon: 'success',
        duration: 1500
      });

    } catch (error) {
      wx.hideLoading();
      console.error('[Message List] Mark all read error:', error);

      wx.showToast({
        title: '操作失败',
        icon: 'error',
        duration: 2000
      });
    }
  },

  /**
   * 点击消息
   */
  async handleMessageTap(e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.messages.find(m => m.id === messageId);

    if (!message) {
      console.error('[Message List] Message not found:', messageId);
      return;
    }

    // 如果当前消息是滑动状态，先收起
    if (message.swiped) {
      const messages = this.data.messages.map(m => ({
        ...m,
        swiped: false
      }));
      this.setData({ messages });
      return;
    }

    // 标记为已读
    if (!message.isRead) {
      const messages = this.data.messages.map(m => {
        if (m.id === messageId) {
          return { ...m, isRead: true };
        }
        return m;
      });
      this.setData({ messages });
    }

    // 根据模块类型跳转
    if (this.data.moduleId === 'workorder') {
      const match = message.content.match(/WO\d+/);
      if (match) {
        wx.navigateTo({
          url: `/pages/work-order-detail/index?id=${match[0]}`
        });
        return;
      }
    }

    // 显示消息详情弹窗
    wx.showModal({
      title: message.title,
      content: message.content,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 下拉刷新
   */
  onRefresh() {
    this.setData({ refreshing: true });
    this.loadMessages();
  }
});
