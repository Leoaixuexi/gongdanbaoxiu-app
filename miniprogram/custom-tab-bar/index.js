const notificationService = require('../services/notification');
const { STORAGE_KEYS } = require('../utils/constants');

Component({
  data: {
    selected: 0,
    color: "#7A7E83",
    selectedColor: "#0CA77D",
    hidden: false,
    unreadCount: 0,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "工作台",
        iconPath: "/images/tabbar/home.png",
        selectedIconPath: "/images/tabbar/home-active.png"
      },
      {
        pagePath: "/pages/data/index",
        text: "数据",
        iconPath: "/images/tabbar/baobiaohui.png",
        selectedIconPath: "/images/tabbar/baobiaolv.png"
      },
      {
        pagePath: "/pages/notifications/index",
        text: "消息",
        iconPath: "/images/tabbar/message.png",
        selectedIconPath: "/images/tabbar/message-active.png"
      },
      {
        pagePath: "/pages/property/submitted/index",
        text: "我的",
        iconPath: "/images/tabbar/profile.png",
        selectedIconPath: "/images/tabbar/profile-active.png"
      }
    ]
  },

  lifetimes: {
    attached() {
      // 组件加载时延迟获取，等待用户信息加载
      setTimeout(() => {
        this.updateUnreadCount();
      }, 500);
    }
  },

  pageLifetimes: {
    show() {
      // 每次页面显示时更新未读消息数
      this.updateUnreadCount();
    }
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    },

    /**
     * 更新未读消息数
     */
    async updateUnreadCount() {
      try {
        // 检查用户是否已登录
        const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
        if (!userInfo || !userInfo.user_id) {
          return;
        }

        const count = await notificationService.getUnreadCount();
        this.setData({ unreadCount: count || 0 });
      } catch (error) {
        console.error('[TabBar] Get unread count error:', error);
      }
    }
  }
});
