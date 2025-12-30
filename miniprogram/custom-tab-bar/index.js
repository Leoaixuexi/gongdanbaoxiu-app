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
      const app = getApp();

      // 从全局状态恢复未读数
      if (app && app.globalData.unreadCounts) {
        const counts = app.globalData.unreadCounts;
        this.setData({
          notificationCount: counts.notificationCount || 0,
          workorderCount: counts.workorderCount || 0,
          reminderCount: counts.reminderCount || 0,
          totalUnread: counts.totalUnread || 0
        });
      }

      // 缓存用户信息
      const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
      this.setData({ _cachedUserInfo: userInfo });

      // 只在首次加载（globalData._unreadInitialized 为 false）时发起请求
      // 避免多个 TabBar 实例同时发起请求导致数据不一致
      if (app && !app.globalData._unreadInitialized) {
        app.globalData._unreadInitialized = true;
        this.tryUpdateUnreadCount(0);
      }
    }
  },

  pageLifetimes: {
    show() {
      // 只从 globalData 同步恢复数据，不发起新的异步请求
      // 避免多个 TabBar 组件同时请求导致数据不一致
      const app = getApp();
      if (app && app.globalData.unreadCounts) {
        const counts = app.globalData.unreadCounts;
        this.setData({
          notificationCount: counts.notificationCount || 0,
          workorderCount: counts.workorderCount || 0,
          reminderCount: counts.reminderCount || 0,
          totalUnread: counts.totalUnread || 0
        });
      }
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

        const newCounts = {
          notificationCount: counts.notificationCount || 0,
          workorderCount: counts.workorderCount || 0,
          reminderCount: counts.reminderCount || 0,
          totalUnread: counts.totalUnread || 0
        };

        // 同步更新全局状态，避免切换 Tab 时回退
        const app = getApp();
        if (app) {
          app.globalData.unreadCounts = newCounts;
        }

        this.setData(newCounts);
      } catch (error) {
        console.error('[TabBar] Get unread count error:', error);
      }
    }
  }
});
