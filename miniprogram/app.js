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
  }
});
