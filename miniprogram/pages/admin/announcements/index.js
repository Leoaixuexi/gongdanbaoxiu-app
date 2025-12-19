/**
 * Announcement Management Page
 * 公告管理列表页面
 */

const cloudDB = require('../../../services/cloudDatabase');
const { ROLES, ANNOUNCEMENT_STATUS_NAMES, ROLE_DISPLAY_NAMES, STORAGE_KEYS } = require('../../../utils/constants');

Page({
  data: {
    announcements: [],
    loading: true,
    currentStatus: '',
    statusNames: ANNOUNCEMENT_STATUS_NAMES
  },

  onLoad() {
    this.checkAdminPermission();
  },

  onShow() {
    this.loadAnnouncements();
  },

  onPullDownRefresh() {
    this.loadAnnouncements().then(() => {
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
   * 加载公告列表
   */
  async loadAnnouncements() {
    this.setData({ loading: true });

    try {
      const filters = {};
      if (this.data.currentStatus) {
        filters.status = this.data.currentStatus;
      }

      const result = await cloudDB.announcements.list(filters);
      const announcements = (result.list || []).map(item => ({
        ...item,
        created_at_text: this.formatDate(item.created_at),
        visibleRolesText: this.formatVisibleRoles(item.visible_roles)
      }));

      this.setData({
        announcements,
        loading: false
      });
    } catch (error) {
      console.error('[Announcements] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 格式化可见角色
   */
  formatVisibleRoles(roles) {
    if (!roles || roles.length === 0 || roles.length === 4) {
      return '全部';
    }
    return roles.map(r => ROLE_DISPLAY_NAMES[r] || r).join('、');
  },

  /**
   * 按状态筛选
   */
  filterByStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ currentStatus: status });
    this.loadAnnouncements();
  },

  /**
   * 创建新公告
   */
  createAnnouncement() {
    wx.navigateTo({
      url: '/pages/admin/announcements/edit/index'
    });
  },

  /**
   * 编辑公告
   */
  editAnnouncement(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/announcements/edit/index?id=${id}`
    });
  },

  /**
   * 查看公告详情（跳转到编辑页面）
   */
  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/announcements/edit/index?id=${id}`
    });
  },

  /**
   * 发布公告
   */
  async publishAnnouncement(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认发布',
      content: '发布后公告将对目标用户可见，确认发布？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '发布中...' });
            await cloudDB.announcements.publish(id);
            wx.hideLoading();
            wx.showToast({
              title: '发布成功',
              icon: 'success'
            });
            this.loadAnnouncements();
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: error.message || '发布失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 下线公告
   */
  async offlineAnnouncement(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认下线',
      content: '下线后公告将不再对用户可见，确认下线？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            await cloudDB.announcements.offline(id);
            wx.hideLoading();
            wx.showToast({
              title: '已下线',
              icon: 'success'
            });
            this.loadAnnouncements();
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
   * 删除公告
   */
  async deleteAnnouncement(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确认删除？',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await cloudDB.announcements.delete(id);
            wx.hideLoading();
            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
            this.loadAnnouncements();
          } catch (error) {
            wx.hideLoading();
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
