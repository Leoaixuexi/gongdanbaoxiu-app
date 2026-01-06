/**
 * 登录页面
 * 按原图设计重构
 */

const auth = require('../../services/auth');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');

Page({
  data: {
    username: '',
    password: '',
    agreed: false,
    showPassword: false,
    isLoading: false,
    usernameFocus: false,
    passwordFocus: false
  },

  onLoad() {
    // 自动尝试登录
    this.autoLogin();
  },

  /**
   * 自动登录检查
   */
  async autoLogin() {
    try {
      const isAuth = await auth.isAuthenticated();
      if (isAuth) {
        // 关键修复：自动登录时也需要等待未读数加载完成
        const app = getApp();
        if (app && typeof app.refreshUnreadCounts === 'function') {
          console.log('[Login] AutoLogin: Awaiting refreshUnreadCounts');
          await app.refreshUnreadCounts();
          console.log('[Login] AutoLogin: refreshUnreadCounts completed');
        }

        const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
        if (userInfo && userInfo.role_id == ROLES.ADMIN) {
          wx.reLaunch({ url: '/pages/admin/dashboard/index' });
        } else {
          wx.switchTab({ url: '/pages/index/index' });
        }
      }
    } catch (error) {
      console.error('[Login] Error checking auth:', error);
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onUsernameFocus() {
    this.setData({ usernameFocus: true });
  },

  onUsernameBlur() {
    this.setData({ usernameFocus: false });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onPasswordFocus() {
    this.setData({ passwordFocus: true });
  },

  onPasswordBlur() {
    this.setData({ passwordFocus: false });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onForget() {
    wx.showToast({ title: '请联系管理员阿哲（Leo）重置密码', icon: 'none', duration: 2500 });
  },

  openUserAgreement() {
    wx.showToast({ title: '《用户协议》', icon: 'none' });
  },

  openPrivacyAgreement() {
    wx.showToast({ title: '《隐私协议》', icon: 'none' });
  },

  async onLogin() {
    const { username, password, isLoading } = this.data;

    if (isLoading) return;

    if (!username) {
      return wx.showToast({ title: '请输入用户名或手机号', icon: 'none' });
    }
    if (!password) {
      return wx.showToast({ title: '请输入密码', icon: 'none' });
    }

    this.setData({ isLoading: true });

    try {
      const user = await auth.loginWithPassword(username, password);

      console.log('[Login] Login successful:', user);

      // 登录成功后，等待未读数获取完成再跳转（关键修复）
      const app = getApp();
      if (app && typeof app.refreshUnreadCounts === 'function') {
        console.log('[Login] Awaiting refreshUnreadCounts');
        await app.refreshUnreadCounts();
        console.log('[Login] refreshUnreadCounts completed');
      }

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });

      setTimeout(() => {
        if (user.role_id == ROLES.ADMIN) {
          wx.reLaunch({ url: '/pages/admin/dashboard/index' });
        } else {
          wx.switchTab({ url: '/pages/index/index' });
        }
      }, 1000);  // 缩短到1秒，因为数据已加载完成

    } catch (error) {
      console.error('[Login] Login error:', error);

      wx.showToast({
        title: error.message || '登录失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ isLoading: false });
    }
  }
});
