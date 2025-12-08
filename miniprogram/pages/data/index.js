/**
 * 数据统计页面
 */

Page({
  data: {
    // 工单统计 - 卡片背景色和数字颜色参考工作台状态标签
    stats: [
      {
        label: "今日提报",
        value: 5,
        bgClass: "#dbeafe",    // 浅蓝色背景（已提报）
        color: "#2563eb"       // 深蓝色字体（已提报）
      },
      {
        label: "维修中",
        value: 3,
        bgClass: "#cffafe",    // 浅青色背景（维修中）
        color: "#0891b2"       // 深青色字体（维修中）
      },
      {
        label: "待复核",
        value: 28,
        bgClass: "#fee2e2",    // 浅红色背景（待复核）
        color: "#dc2626"       // 深红色字体（待复核）
      },
      {
        label: "已完成",
        value: 1,
        bgClass: "#d1fae5",    // 浅绿色背景（已完成）
        color: "#059669"       // 深绿色字体（已完成）
      }
    ],

    // 月度排名
    rankings: [
      {
        rank: 1,
        name: "李明",
        avatar: "/images/avatar/user1.png",
        completedOrders: 45,
        trend: "up",
        isCurrentUser: false
      },
      {
        rank: 2,
        name: "王芳",
        avatar: "/images/avatar/user2.png",
        completedOrders: 42,
        trend: "up",
        isCurrentUser: false
      },
      {
        rank: 3,
        name: "张伟",
        avatar: "/images/avatar/default.png",
        completedOrders: 38,
        trend: "same",
        isCurrentUser: true
      }
    ],
    // 自定义导航栏高度
    headerHeight: 0
  },

  onLoad() {
    // 计算自定义导航栏高度
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = 88 * systemInfo.windowWidth / 750;
    this.setData({
      headerHeight: statusBarHeight + navBarHeight
    });
  },

  onShow() {
    // 设置自定义 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
  },

  /**
   * 查看全部排名
   */
  viewAllRankings() {
    wx.showToast({
      title: '查看全部排名',
      icon: 'none'
    });
    // TODO: 跳转到完整排名页面
    // wx.navigateTo({
    //   url: '/pages/rankings/index'
    // });
  }
});
