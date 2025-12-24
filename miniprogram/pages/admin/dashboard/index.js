/**
 * Admin Dashboard Page
 * 管理台首页
 */

const app = getApp();
const auth = require('../../../services/auth');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

Page({
  data: {
    userName: '',
    statusBarHeight: 20,
    navBarHeight: 64
  },

  onLoad() {
    this.initNavBar();
    this.checkAdminPermission();
    this.loadUserInfo();
  },

  /**
   * 初始化导航栏高度
   */
  initNavBar() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navBarHeight = statusBarHeight + 44;
    this.setData({
      statusBarHeight,
      navBarHeight
    });
  },

  onShow() {
    this.checkAdminPermission();
  },

  /**
   * 检查管理员权限
   */
  checkAdminPermission() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    console.log('[Dashboard] userInfo:', userInfo);

    if (!userInfo || userInfo.role_id != ROLES.ADMIN) {
      console.log('[Dashboard] Permission denied');
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 1500);
    } else {
      console.log('[Dashboard] Permission granted');
    }
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (userInfo) {
      this.setData({
        userName: `欢迎，${userInfo.name || userInfo.username}`
      });
    }
  },

  /**
   * 导航到指定页面
   */
  navigateTo(e) {
    const path = e.currentTarget.dataset.path;
    if (path) {
      wx.navigateTo({
        url: path,
        fail: () => {
          wx.showToast({
            title: '页面暂未开放',
            icon: 'none'
          });
        }
      });
    }
  },

  /**
   * 退出登录
   */
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: async (res) => {
        if (res.confirm) {
          await auth.logout();
        }
      }
    });
  }
});
