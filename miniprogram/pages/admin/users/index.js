/**
 * User Management Page
 * 账号管理列表页面 - 增强版
 */

const cloudDB = require('../../../services/cloudDatabase');
const { ROLES, ROLE_DISPLAY_NAMES, STORAGE_KEYS } = require('../../../utils/constants');

Page({
  data: {
    users: [],
    loading: true,
    currentUserId: null,

    // 搜索和筛选
    searchKeyword: '',
    showFilter: false,
    filterRole: '',
    filterStatus: '',
    hasFilter: false,

    // 角色选项
    roleOptions: [
      { value: 1, label: '系统管理员' },
      { value: 2, label: '行政经理' },
      { value: 3, label: '维修员' },
      { value: 4, label: '办美员工' }
    ],

    // 防重复加载
    _isLoading: false,
    _lastLoadTime: 0
  },

  onLoad() {
    this.checkAdminPermission();
    this.getCurrentUser();
  },

  onShow() {
    // 防止2秒内重复加载
    const now = Date.now();
    if (this.data._isLoading || (now - this.data._lastLoadTime < 2000)) {
      console.log('[Users] Skip duplicate load');
      return;
    }
    this.loadUsers();
  },

  onPullDownRefresh() {
    this.loadUsers().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 检查管理员权限
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
    }
  },

  /**
   * 获取当前用户ID
   */
  getCurrentUser() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (userInfo) {
      this.setData({
        currentUserId: userInfo.user_id
      });
    }
  },

  /**
   * 加载用户列表
   */
  async loadUsers() {
    if (this.data._isLoading) return;

    this.setData({ loading: true, _isLoading: true });

    try {
      const filters = {};
      if (this.data.filterRole) {
        filters.role_id = this.data.filterRole;
      }
      if (this.data.filterStatus === 'active') {
        filters.is_active = 'true';
      } else if (this.data.filterStatus === 'inactive') {
        filters.is_active = 'false';
      }
      if (this.data.searchKeyword) {
        filters.search = this.data.searchKeyword;
      }

      const users = await cloudDB.users.list(filters);

      // 处理用户数据
      const processedUsers = users.map(user => ({
        ...user,
        roleName: ROLE_DISPLAY_NAMES[user.role_id] || '未知',
        isCurrentUser: user.user_id === this.data.currentUserId
      }));

      // 前端搜索过滤（如果云端搜索不够精确）
      let filteredUsers = processedUsers;
      if (this.data.searchKeyword) {
        const keyword = this.data.searchKeyword.toLowerCase();
        filteredUsers = processedUsers.filter(user =>
          (user.name && user.name.toLowerCase().includes(keyword)) ||
          (user.username && user.username.toLowerCase().includes(keyword))
        );
      }

      this.setData({
        users: filteredUsers,
        loading: false,
        _isLoading: false,
        _lastLoadTime: Date.now()
      });
    } catch (error) {
      console.error('[Users] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false, _isLoading: false });
    }
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  /**
   * 执行搜索
   */
  onSearch() {
    this.loadUsers();
  },

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({ searchKeyword: '' });
    this.loadUsers();
  },

  /**
   * 切换筛选面板
   */
  toggleFilter() {
    this.setData({
      showFilter: !this.data.showFilter
    });
  },

  /**
   * 按角色筛选
   */
  filterByRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({
      filterRole: role,
      hasFilter: role !== '' || this.data.filterStatus !== ''
    });
    this.loadUsers();
  },

  /**
   * 按状态筛选
   */
  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      filterStatus: status,
      hasFilter: this.data.filterRole !== '' || status !== ''
    });
    this.loadUsers();
  },

  /**
   * 重置筛选
   */
  resetFilter() {
    this.setData({
      filterRole: '',
      filterStatus: '',
      hasFilter: false,
      showFilter: false
    });
    this.loadUsers();
  },

  /**
   * 添加用户
   */
  addUser() {
    wx.navigateTo({
      url: '/pages/admin/users/add/index'
    });
  },

  /**
   * 编辑用户
   */
  editUser(e) {
    const userId = e.currentTarget.dataset.userId;
    wx.navigateTo({
      url: `/pages/admin/users/edit/index?user_id=${userId}`
    });
  },

  /**
   * 启用用户
   */
  async enableUser(e) {
    const { userId, name } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认启用',
      content: `确认启用用户"${name}"？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await cloudDB.users.enable(userId);
            wx.hideLoading();
            wx.showToast({
              title: '已启用',
              icon: 'success'
            });
            this.loadUsers();
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 停用用户
   */
  async disableUser(e) {
    const { userId, name } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认停用',
      content: `停用后用户"${name}"将无法登录系统，确认停用？`,
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await cloudDB.users.disable(userId);
            wx.hideLoading();
            wx.showToast({
              title: '已停用',
              icon: 'success'
            });
            this.loadUsers();
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: error.message || '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 重置密码
   */
  async resetPassword(e) {
    const { userId, name } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认重置密码',
      content: `确认重置用户"${name}"的密码？重置后密码将变为默认密码。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            const result = await cloudDB.users.resetPassword(userId);
            wx.hideLoading();

            // 显示新密码
            wx.showModal({
              title: '密码已重置',
              content: `新密码为：${result.newPassword || '123456'}\n请通知用户尽快修改密码。`,
              showCancel: false
            });
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: error.message || '重置失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
