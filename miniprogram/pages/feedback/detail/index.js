/**
 * 反馈详情页面
 */

const { STORAGE_KEYS } = require('../../../utils/constants');

Page({
  data: {
    feedback: null,
    loading: true,
    statusBarHeight: 0,
    navBarHeight: 0,
    isAdmin: false
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = statusBarHeight + 44;
    this.setData({
      statusBarHeight,
      navBarHeight
    });

    // 检查是否为管理员
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (userInfo && userInfo.role_id === 1) {
      this.setData({ isAdmin: true });
    }

    const feedbackId = options.id;
    if (feedbackId) {
      this.loadDetail(feedbackId);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  async loadDetail(feedbackId) {
    try {
      this.setData({ loading: true });

      const res = await wx.cloud.callFunction({
        name: 'feedbackManager',
        data: {
          action: 'getById',
          data: { feedback_id: feedbackId }
        }
      });

      if (res.result && res.result.success) {
        const feedback = this.formatFeedback(res.result.feedback);
        this.setData({
          feedback,
          loading: false
        });
      } else {
        throw new Error(res.result?.error || '加载失败');
      }
    } catch (error) {
      console.error('[FeedbackDetail] Load error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  formatFeedback(feedback) {
    let created_at_str = '';
    if (feedback.created_at) {
      const date = new Date(feedback.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      created_at_str = `${year}-${month}-${day} ${hour}:${minute}`;
    }

    return {
      ...feedback,
      created_at_str
    };
  },

  previewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.feedback.photos || [];

    if (photos.length > 0) {
      wx.previewImage({
        current: photos[index],
        urls: photos
      });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
