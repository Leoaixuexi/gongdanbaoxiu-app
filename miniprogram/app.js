/**
 * WeChat Mini-program App Entry
 * Handles app lifecycle and global state management
 */

const auth = require('./services/auth');
const storage = require('./services/storage');
const { API_BASE_URL, CLOUD_ENV_ID } = require('./utils/constants');

App({
  /**
   * Global data accessible throughout the mini-program
   */
  globalData: {
    userInfo: null,
    systemInfo: null,
    apiBaseUrl: API_BASE_URL,
    isLoggedIn: false,
    // 未读消息数缓存（全局统一状态源）
    unreadCounts: {
      notificationCount: 0,
      workorderCount: 0,
      reminderCount: 0,
      totalUnread: 0
    },
    // 上次刷新未读数的时间戳，用于节流
    _lastUnreadRefreshTime: 0,
    // 徽章版本号，用于确保 TabBar 能检测到数据更新
    _badgeVersion: 0
  },

  /**
   * App Launch Lifecycle
   * Called when the mini-program initialization is completed
   */
  onLaunch: function (options) {
    console.log('[App] Launch', options);

    // Initialize WeChat Cloud Development
    this.initCloudDevelopment();

    // Get system info
    this.getSystemInfo();

    // Check login status on launch
    this.checkLoginStatus();

    // Check for app updates
    this.checkForUpdates();

    console.log('[App] Launch completed');
  },

  /**
   * App Show Lifecycle
   * Called when the mini-program is shown (from background to foreground)
   */
  onShow: function (options) {
    console.log('[App] Show', options);

    // Refresh login status when app comes to foreground
    this.checkLoginStatus();
  },

  /**
   * App Hide Lifecycle
   * Called when the mini-program is hidden (from foreground to background)
   */
  onHide: function () {
    console.log('[App] Hide');
  },

  /**
   * App Error Handler
   * Called when a script error occurs
   */
  onError: function (error) {
    console.error('[App] Error:', error);

    // Show user-friendly error message
    wx.showToast({
      title: '程序出现错误',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * App Page Not Found Handler
   * Called when the page to open does not exist
   */
  onPageNotFound: function (res) {
    console.error('[App] Page not found:', res);

    // Redirect to home page
    wx.redirectTo({
      url: '/pages/index/index',
      fail: () => {
        // If redirect fails, try reLaunch
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }
    });
  },

  /**
   * Initialize WeChat Cloud Development
   */
  initCloudDevelopment: function () {
    if (!wx.cloud) {
      console.error('[App] Please use base library 2.2.3 or above to support cloud capabilities');
      return;
    }

    // Initialize cloud with environment ID
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true
    });

    console.log('[App] Cloud development initialized');
  },

  checkLoginStatus: async function () {
    try {
      console.log('[App] Checking login status...');
      const isAuth = await auth.isAuthenticated();
      this.globalData.isLoggedIn = isAuth;
      if (isAuth) {
        const userInfo = await auth.getCurrentUser();
        const permissions = await auth.getUserPermissions();

        // Convert permissions object to array format
        let permissionsArray = [];
        if (permissions && permissions.modules) {
          // If modules is an object, convert to array
          if (typeof permissions.modules === 'object' && !Array.isArray(permissions.modules)) {
            permissionsArray = Object.keys(permissions.modules).filter(
              key => permissions.modules[key] === true
            );
          } else if (Array.isArray(permissions.modules)) {
            // If already an array, use it directly
            permissionsArray = permissions.modules;
          }
        }

        // Merge user info with permissions array
        this.globalData.userInfo = {
          ...userInfo,
          permissions: permissionsArray
        };

        console.log('[App] User is logged in:', userInfo);
        console.log('[App] User permissions object:', permissions);
        console.log('[App] User permissions array:', permissionsArray);

        // 登录成功后刷新未读消息数（不需要 await，因为 TabBar 有数据过期检测兜底）
        this.refreshUnreadCounts();
      } else {
        console.log('[App] User is not logged in');
        this.globalData.userInfo = null;
      }
      return isAuth;
    } catch (error) {
      console.error('[App] Error checking login status:', error);
      this.globalData.isLoggedIn = false;
      this.globalData.userInfo = null;
      return false;
    }
  },

  getUserInfo: async function () {
    try {
      if (this.globalData.userInfo) {
        return this.globalData.userInfo;
      }
      const userInfo = await auth.getCurrentUser();
      this.globalData.userInfo = userInfo;
      return userInfo;
    } catch (error) {
      console.error('[App] Error getting user info:', error);
      return null;
    }
  },

  setUserInfo: function (userInfo) {
    this.globalData.userInfo = userInfo;
    console.log('[App] User info updated:', userInfo);
  },

  getSystemInfo: function () {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      console.log('[App] System info:', systemInfo);
    } catch (error) {
      console.error('[App] Error getting system info:', error);
    }
  },

  checkForUpdates: function () {
    if (!wx.canIUse('getUpdateManager')) {
      console.log('[App] Update manager not supported');
      return;
    }
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate((res) => {
      console.log('[App] Has update:', res.hasUpdate);
    });
    updateManager.onUpdateReady(() => {
      console.log('[App] Update ready');
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        }
      });
    });
    updateManager.onUpdateFailed(() => {
      console.error('[App] Update failed');
      wx.showToast({
        title: '更新失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    });
  },

  navigateToLogin: function () {
    wx.reLaunch({
      url: '/pages/login/login'
    });
  },

  requireAuth: async function () {
    const isAuth = await this.checkLoginStatus();
    if (!isAuth) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      setTimeout(() => {
        this.navigateToLogin();
      }, 2000);
      return false;
    }
    return true;
  },

  hasPermission: async function (permission) {
    try {
      return await auth.hasPermission(permission);
    } catch (error) {
      console.error('[App] Error checking permission:', error);
      return false;
    }
  },

  showError: function (message) {
    wx.showToast({
      title: message || '操作失败',
      icon: 'none',
      duration: 2000
    });
  },

  showSuccess: function (message) {
    wx.showToast({
      title: message || '操作成功',
      icon: 'success',
      duration: 1500
    });
  },

  showLoading: function (title = '加载中...') {
    wx.showLoading({
      title,
      mask: true
    });
  },

  hideLoading: function () {
    wx.hideLoading();
  },

  getRoleDisplayName: function (roleId) {
    const { ROLE_DISPLAY_NAMES } = require('./utils/constants');
    return ROLE_DISPLAY_NAMES[roleId] || '未知角色';
  },

  getStatusDisplayName: function (status) {
    const { STATUS_DISPLAY_NAMES } = require('./utils/constants');
    return STATUS_DISPLAY_NAMES[status] || status;
  },

  getPriorityDisplayName: function (priority) {
    const { PRIORITY_DISPLAY_NAMES } = require('./utils/constants');
    return PRIORITY_DISPLAY_NAMES[priority] || priority;
  },

  /**
   * 统一的徽章更新入口（Single Source of Truth）
   * 所有徽章更新必须通过此函数
   * @param {Object} counts - 未读数对象
   * @param {string} source - 调用来源（用于调试）
   */
  updateBadge: function (counts, source) {
    const timestamp = Date.now();

    // 1. 更新全局状态 + 版本号
    this.globalData.unreadCounts = {
      notificationCount: counts.notificationCount || 0,
      workorderCount: counts.workorderCount || 0,
      reminderCount: counts.reminderCount || 0,
      totalUnread: counts.totalUnread || 0
    };
    this.globalData._badgeVersion = timestamp;

    console.log('[Badge] ========== UPDATE START ==========');
    console.log('[Badge] Source:', source);
    console.log('[Badge] Counts:', JSON.stringify(this.globalData.unreadCounts));
    console.log('[Badge] Version:', timestamp);

    // 2. 同步到所有已加载的 TabBar
    const pages = getCurrentPages();
    console.log('[Badge] getCurrentPages() returned', pages.length, 'pages:', pages.map(p => p.route));

    let syncCount = 0;
    pages.forEach((page, index) => {
      console.log('[Badge] Checking page[' + index + ']:', page.route);
      if (typeof page.getTabBar === 'function') {
        const tabBar = page.getTabBar();
        console.log('[Badge] - getTabBar() returned:', tabBar ? 'TabBar instance' : 'null');
        if (tabBar) {
          console.log('[Badge] - applyBadge exists:', typeof tabBar.applyBadge === 'function');
          if (typeof tabBar.applyBadge === 'function') {
            tabBar.applyBadge(this.globalData.unreadCounts, timestamp, source);
            syncCount++;
          } else {
            // 降级：直接 setData
            console.log('[Badge] - Fallback: using setData directly');
            tabBar.setData({
              notificationCount: counts.notificationCount || 0,
              workorderCount: counts.workorderCount || 0,
              reminderCount: counts.reminderCount || 0,
              totalUnread: counts.totalUnread || 0
            });
            syncCount++;
          }
        }
      } else {
        console.log('[Badge] - No getTabBar function');
      }
    });

    console.log('[Badge] Synced to ' + syncCount + ' TabBar(s)');
    console.log('[Badge] ========== UPDATE END ==========');
  },

  /**
   * 刷新未读消息数并同步到所有 TabBar
   * 在登录成功后调用，确保首页也能显示正确的未读数徽章
   */
  refreshUnreadCounts: async function () {
    try {
      console.log('[App] refreshUnreadCounts: starting...');
      const notificationService = require('./services/notification');
      const counts = await notificationService.getCategorizedUnreadCount();
      console.log('[App] refreshUnreadCounts: got counts =', JSON.stringify(counts));

      // 调试：显示 toast（临时）
      // wx.showToast({ title: '未读:' + (counts.totalUnread || 0), icon: 'none', duration: 2000 });

      // 使用统一入口更新徽章
      this.updateBadge(counts, 'refreshUnreadCounts');
      console.log('[App] refreshUnreadCounts: completed, globalData.unreadCounts =', JSON.stringify(this.globalData.unreadCounts));
    } catch (error) {
      console.error('[App] Refresh unread counts error:', error);
      // 调试：显示错误（临时）
      // wx.showToast({ title: '加载未读数失败', icon: 'none' });
    }
  },

  /**
   * 清除未读消息数缓存
   * 在退出登录时调用，确保账号切换后不会显示旧账号的数据
   */
  clearUnreadCounts: function () {
    this.updateBadge({
      notificationCount: 0,
      workorderCount: 0,
      reminderCount: 0,
      totalUnread: 0
    }, 'logout');
  },

  /**
   * 同步 TabBar 徽章数据（供各页面 onShow 调用）
   * 解决 switchTab 时 TabBar 组件数据可能被重置的问题
   * @param {Object} tabBar - TabBar 组件实例
   * @param {string} source - 调用来源（用于日志）
   */
  syncTabBarBadge: function (tabBar, source) {
    if (!tabBar || !this.globalData.unreadCounts) return;

    const globalVersion = this.globalData._badgeVersion || 0;
    const globalCounts = this.globalData.unreadCounts;
    const appliedVersion = tabBar.data._appliedVersion || 0;
    const localTotal = tabBar.data.totalUnread || 0;
    const globalTotal = globalCounts.totalUnread || 0;

    if ((globalVersion > appliedVersion || localTotal !== globalTotal) && tabBar.applyBadge) {
      console.log('[App] syncTabBarBadge from ' + source + ': localTotal=' + localTotal + ', globalTotal=' + globalTotal);
      tabBar.applyBadge(globalCounts, globalVersion, source);
    }
  }
});
