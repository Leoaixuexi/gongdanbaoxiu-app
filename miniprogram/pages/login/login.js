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
    passwordFocus: false,
    quickAccounts: [
      { label: '信泰物业', username: 'xintaiwuye', password: '123456' },
      { label: '工程总包', username: 'tonghezongbao', password: '123456' },
      { label: '老崔', username: 'laocui', password: '123456' },
      { label: '杨乾坤', username: 'yangqiankun', password: '123456' },
      { label: '黄贺楠', username: 'huanghenan', password: '123456' },
      { label: '张语芮', username: 'zhangyurui', password: '123456' },
      { label: '管理员', username: 'admin', password: 'l19890522' }
    ]
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

  // 快捷登录
  onQuickLogin(e) {
    const index = e.currentTarget.dataset.index;
    const account = this.data.quickAccounts[index];

    // 填充账号密码
    this.setData({
      username: account.username,
      password: account.password
    });

    // 自动登录
    setTimeout(() => {
      this.onLogin();
    }, 100);
  },

  async onLogin() {
    const { username, password, isLoading } = this.data;

    if (isLoading) return;

    if (!username) {
      return wx.showToast({ title: '请输入用户名', icon: 'none' });
    }
    if (!password) {
      return wx.showToast({ title: '请输入密码', icon: 'none' });
    }

    this.setData({ isLoading: true });

    try {
      const user = await auth.loginWithPassword(username, password);

      console.log('[Login] Login successful:', user);

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
      }, 1500);

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
