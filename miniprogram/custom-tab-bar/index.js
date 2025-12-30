const notificationService = require('../services/notification');
const storage = require('../services/storage');
const { STORAGE_KEYS } = require('../utils/constants');

Component({
  data: {
    selected: 0,
    color: "#A0A5AB",
    selectedColor: "#0CA77D",
    hidden: false,
    // 分类未读数
    notificationCount: 0,  // 通知公告
    workorderCount: 0,     // 待办工单
    reminderCount: 0,      // 提醒我的
    totalUnread: 0,        // 总未读数（派生值）
    // 缓存的用户信息
    _cachedUserInfo: null,
    list: [
      {
        pagePath: "/pages/index/index",
        text: "工作台",
        iconPath: "/images/tabbar/gzt-gray.svg",
        selectedIconPath: "/images/tabbar/gzt.svg"
      },
      {
        pagePath: "/pages/data/index",
        text: "数据",
        iconPath: "/images/tabbar/sj-gray.svg",
        selectedIconPath: "/images/tabbar/sj.svg"
      },
      {
        pagePath: "/pages/notifications/index",
        text: "消息",
        iconPath: "/images/tabbar/xx-gray.svg",
        selectedIconPath: "/images/tabbar/xx.svg"
      },
      {
        pagePath: "/pages/property/submitted/index",
        text: "我的",
        iconPath: "/images/tabbar/wd-gray.svg",
        selectedIconPath: "/images/tabbar/wd.svg"
      }
    ]
  },

  lifetimes: {
    async attached() {
      // 组件加载时异步获取用户信息并缓存
      const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
      this.setData({ _cachedUserInfo: userInfo });
      // 尝试更新未读数，带重试机制
      this.tryUpdateUnreadCount(0);
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
     * 带重试的更新未读数方法
     * 如果用户未登录，每隔1秒重试，最多5次
     */
    tryUpdateUnreadCount(retryCount) {
      const maxRetries = 5;
      const retryDelay = 1000;

      // 使用缓存的用户信息，避免同步调用
      const userInfo = this.data._cachedUserInfo;
      if (!userInfo || (!userInfo.user_id && !userInfo.id)) {
        if (retryCount < maxRetries) {
          console.log('[TabBar] User not logged in, retry', retryCount + 1);
          setTimeout(async () => {
            // 重试时异步刷新缓存
            const freshUserInfo = await storage.get(STORAGE_KEYS.USER_INFO);
            this.setData({ _cachedUserInfo: freshUserInfo });
            this.tryUpdateUnreadCount(retryCount + 1);
          }, retryDelay);
        }
        return;
      }

      // 用户已登录，更新未读数
      this.updateUnreadCount();
    },

    /**
     * 更新未读消息数（获取分类未读数并聚合）
     */
    async updateUnreadCount() {
      try {
        // 使用缓存的用户信息，避免同步调用
        let userInfo = this.data._cachedUserInfo;

        // 如果缓存为空，异步获取一次
        if (!userInfo) {
          userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
          this.setData({ _cachedUserInfo: userInfo });
        }

        if (!userInfo || (!userInfo.user_id && !userInfo.id)) {
          console.log('[TabBar] User not logged in, skip update');
          return;
        }

        // 获取分类未读数
        console.log('[TabBar] Fetching unread counts...');
        const counts = await notificationService.getCategorizedUnreadCount();
        console.log('[TabBar] Got counts:', counts);
        this.setData({
          notificationCount: counts.notificationCount || 0,
          workorderCount: counts.workorderCount || 0,
          reminderCount: counts.reminderCount || 0,
          totalUnread: counts.totalUnread || 0
        });
      } catch (error) {
        console.error('[TabBar] Get unread count error:', error);
      }
    }
  }
});
