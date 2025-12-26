/**
 * 登录页面
 * 使用zip提供的UI,集成原有的auth服务
 */

const auth = require('../../services/auth');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');

Page({
  data: {
    username: '',
    password: '',
    showPassword: false,
    loading: false,
    rememberUsername: false,
    showTestAccounts: false
  },

  onLoad() {
    // Hide test accounts in release builds
    try {
      const accountInfo = wx.getAccountInfoSync?.();
      const envVersion = accountInfo?.miniProgram?.envVersion || 'develop'; // develop | trial | release
      this.setData({ showTestAccounts: envVersion !== 'release' });
    } catch (e) {
      // If API not available, default to hiding in unknown environments
      this.setData({ showTestAccounts: false });
    }

    // 加载记住的账号
    this.loadRememberedUsername();
    // 自动尝试登录
    this.autoLogin();
  },

  /**
   * 加载记住的账号
   */
  loadRememberedUsername() {
    try {
      const rememberUsername = wx.getStorageSync('rememberUsername');
      const savedUsername = wx.getStorageSync('savedUsername');

      if (rememberUsername && savedUsername) {
        this.setData({
          username: savedUsername,
          rememberUsername: true
        });
        console.log('[Login] Loaded remembered username:', savedUsername);
      }
    } catch (error) {
      console.error('[Login] Error loading remembered username:', error);
    }
  },

  /**
   * 自动登录检查
   */
  async autoLogin() {
    try {
      // 检查是否已登录
      const isAuth = await auth.isAuthenticated();
      if (isAuth) {
        // 已登录,根据角色跳转
        const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
        if (userInfo && userInfo.role_id == ROLES.ADMIN) {
          wx.reLaunch({
            url: '/pages/admin/dashboard/index'
          });
        } else {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
        return;
      }
    } catch (error) {
      console.error('[Login] Error checking auth:', error);
    }
  },

  /**
   * 用户名输入
   */
  onUsernameInput(e) {
    this.setData({
      username: e.detail.value
    });
  },

  /**
   * 密码输入
   */
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  /**
   * 切换密码可见性
   */
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  /**
   * 处理登录（集成真实的auth服务）
   */
  async handleLogin(e) {
    const username = (this.data.username || '').trim();
    const password = (this.data.password || '').trim();

    console.log('[Login] Attempting login with username:', username);

    // 验证输入
    if (!username || username.length === 0) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!password || password.length === 0) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({ loading: true });

    try {
      // 使用真实的auth服务登录
      const user = await auth.loginWithPassword(username, password);

      console.log('[Login] Login successful:', user);

      // 保存记住的账号
      if (this.data.rememberUsername) {
        try {
          wx.setStorageSync('rememberUsername', true);
          wx.setStorageSync('savedUsername', username);
          console.log('[Login] Username saved for next login');
        } catch (error) {
          console.error('[Login] Error saving username:', error);
        }
      } else {
        // 如果取消记住，清除保存的账号
        try {
          wx.removeStorageSync('rememberUsername');
          wx.removeStorageSync('savedUsername');
          console.log('[Login] Saved username cleared');
        } catch (error) {
          console.error('[Login] Error clearing username:', error);
        }
      }

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      // 登录成功，根据角色跳转
      setTimeout(() => {
        // 使用 == 宽松比较，兼容字符串和数字类型
        if (user.role_id == ROLES.ADMIN) {
          // 管理员跳转到管理台首页
          wx.reLaunch({
            url: '/pages/admin/dashboard/index'
          });
        } else {
          // 其他角色跳转到工作台
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }, 1500);

    } catch (error) {
      console.error('[Login] Login error:', error);

      let errorMessage = '登录失败，请稍后重试';

      if (error.message) {
        errorMessage = error.message;
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 忘记密码
   */
  handleForgotPassword() {
    wx.showToast({
      title: '请联系管理员重置密码',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 快速填充测试账号
   */
  fillTestAccount(e) {
    if (!this.data.showTestAccounts) {
      return;
    }

    const { username, password } = e.currentTarget.dataset;

    if (!username || !password) {
      console.error('[Login] Missing username or password in dataset');
      return;
    }

    this.setData({
      username,
      password
    });

    console.log('[Login] Test account filled:', username);

    wx.showToast({
      title: '已填充测试账号',
      icon: 'success',
      duration: 1500
    });
  },

  /**
   * 快捷登录 - 自动填充并登录
   */
  async quickLogin(e) {
    const { username, password } = e.currentTarget.dataset;

    if (!username || !password) {
      console.error('[Login] Missing username or password in dataset');
      return;
    }

    // 填充账号密码
    this.setData({
      username,
      password
    });

    console.log('[Login] Quick login with:', username);

    // 自动执行登录
    await this.handleLogin();
  }
});
