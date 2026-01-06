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
    // 已应用的徽章版本号（用于检测数据是否过期）
    _appliedVersion: 0,
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
      console.log('[TabBar] attached() called');
      const app = getApp();

      // 从全局状态恢复未读数
      if (app && app.globalData.unreadCounts) {
        const version = app.globalData._badgeVersion || 0;
        const counts = app.globalData.unreadCounts;
        console.log('[TabBar] attached: version =', version, ', totalUnread =', counts.totalUnread);

        if (version > 0) {
          // 已有数据，直接应用
          this.applyBadge(counts, version, 'attached');
        } else {
          // version === 0，数据未加载，主动触发加载
          console.log('[TabBar] attached: version=0, triggering refresh');
          if (app.refreshUnreadCounts) {
            await app.refreshUnreadCounts();
            // 刷新完成后，再次应用最新数据
            const newCounts = app.globalData.unreadCounts;
            const newVersion = app.globalData._badgeVersion || 0;
            console.log('[TabBar] attached: after refresh, version =', newVersion, ', totalUnread =', newCounts?.totalUnread);
            if (newCounts) {
              this.applyBadge(newCounts, newVersion, 'attached-after-refresh');
            }
          }
        }
      } else {
        console.log('[TabBar] attached: no app or unreadCounts, app exists:', !!app);
        // 即使没有 app，也尝试加载数据
        if (app && app.refreshUnreadCounts) {
          await app.refreshUnreadCounts();
          const newCounts = app.globalData?.unreadCounts;
          const newVersion = app.globalData?._badgeVersion || 0;
          if (newCounts) {
            this.applyBadge(newCounts, newVersion, 'attached-fallback');
          }
        }
      }

      // 缓存用户信息
      const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
      this.setData({ _cachedUserInfo: userInfo });
    }
  },

  pageLifetimes: {
    show() {
      const app = getApp();
      console.log('[TabBar] pageLifetimes.show() triggered');

      if (!app) {
        console.log('[TabBar] show: app is null, return');
        return;
      }

      const globalVersion = app.globalData._badgeVersion || 0;
      const appliedVersion = this.data._appliedVersion || 0;
      const globalCounts = app.globalData.unreadCounts || {};

      console.log('[TabBar] show: globalVersion=' + globalVersion + ', appliedVersion=' + appliedVersion);
      console.log('[TabBar] show: globalCounts=' + JSON.stringify(globalCounts));
      console.log('[TabBar] show: current data.totalUnread=' + this.data.totalUnread);

      // 关键修复：始终同步全局数据到 TabBar
      // 因为 TabBar 可能是新实例，或者数据被微信框架重置
      // 不再依赖版本号变化，而是直接比较实际值
      const localTotal = this.data.totalUnread || 0;
      const globalTotal = globalCounts.totalUnread || 0;

      if (globalVersion > appliedVersion || localTotal !== globalTotal) {
        console.log('[TabBar] show: syncing badge data');
        this.applyBadge(
          globalCounts,
          globalVersion,
          'pageShow-sync'
        );
      } else {
        console.log('[TabBar] show: data already in sync');
      }

      // 增强修复：如果全局版本为 0 或数据可能过期（超过30秒），主动拉取最新数据
      const now = Date.now();
      const dataAge = globalVersion > 0 ? now - globalVersion : Infinity;

      if (globalVersion === 0 || dataAge > 30000) {
        console.log('[TabBar] show: data stale or missing, triggering refresh (age=' + dataAge + 'ms)');
        if (app.refreshUnreadCounts) {
          app.refreshUnreadCounts();
        }
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
     * 应用徽章更新（被 app.updateBadge 调用或内部使用）
     * @param {Object} counts - 未读数对象
     * @param {number} version - 徽章版本号
     * @param {string} source - 调用来源（用于调试）
     */
    applyBadge(counts, version, source) {
      this.setData({
        notificationCount: counts.notificationCount || 0,
        workorderCount: counts.workorderCount || 0,
        reminderCount: counts.reminderCount || 0,
        totalUnread: counts.totalUnread || 0,
        _appliedVersion: version
      });
      console.log('[TabBar] Badge applied from ' + source + ', version: ' + version + ', total: ' + (counts.totalUnread || 0));
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
     * 更新未读消息数（获取分类未读数并通过 app.updateBadge 统一更新）
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

        // 使用 app 的统一入口更新徽章（会同步到所有 TabBar）
        const app = getApp();
        if (app && app.updateBadge) {
          app.updateBadge(counts, 'TabBar.updateUnreadCount');
        }
      } catch (error) {
        console.error('[TabBar] Get unread count error:', error);
      }
    }
  }
});
