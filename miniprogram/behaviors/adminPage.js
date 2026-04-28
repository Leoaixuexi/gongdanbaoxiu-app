/**
 * 管理员页面 Behavior
 * 提供管理员权限校验，适用于所有管理后台页面
 */

const { ROLES, STORAGE_KEYS } = require('../utils/constants');

module.exports = Behavior({
  methods: {
    /**
     * 检查管理员权限
     * 非管理员自动返回上一页
     */
    checkAdminPermission() {
      const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
      if (!userInfo || userInfo.role_id !== ROLES.ADMIN) {
        wx.showToast({
          title: '无权限访问',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return false;
      }
      return true;
    }
  }
});
