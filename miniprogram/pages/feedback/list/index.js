/**
 * 我的反馈列表页面
 */

const feedbackService = require('../../../services/feedbackService');

Page({
  data: {
    list: [],
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    limit: 20,
    statusBarHeight: 0,
    navBarHeight: 0
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    const navBarHeight = statusBarHeight + 44;
    this.setData({
      statusBarHeight,
      navBarHeight
    });
  },

  onShow() {
    this.setData({
      list: [],
      page: 1,
      hasMore: true
    });
    this.loadList();
  },

  onPullDownRefresh() {
    this.setData({
      list: [],
      page: 1,
      hasMore: true
    });
    this.loadList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadList() {
    try {
      this.setData({ loading: this.data.list.length === 0 });

      const result = await feedbackService.listFeedbacks({
        filters: {
          page: this.data.page,
          limit: this.data.limit
        }
      });

      const newList = (result.list || []).map(item => this.formatItem(item));
      const hasMore = this.data.page < result.totalPages;

      this.setData({
        list: [...this.data.list, ...newList],
        hasMore,
        loading: false
      });
    } catch (error) {
      console.error('[FeedbackList] Load error:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  formatItem(item) {
    let created_at_str = '';
    if (item.created_at) {
      const date = new Date(item.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      created_at_str = `${year}-${month}-${day} ${hour}:${minute}`;
    }

    const content_summary = item.content && item.content.length > 100
      ? item.content.substring(0, 100) + '...'
      : item.content || '';

    // 类型到样式类的映射
    const typeClass = this.getTypeClass(item.type);

    return {
      ...item,
      created_at_str,
      content_summary,
      typeClass
    };
  },

  // 根据类型返回对应的样式类
  getTypeClass(type) {
    const typeMap = {
      '系统BUG': 'type-bug',
      '新增功能建议': 'type-feature',
      '现有模块优化': 'type-optimize',
      '个人想法': 'type-idea'
    };
    return typeMap[type] || 'type-default';
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;

    this.setData({
      loadingMore: true,
      page: this.data.page + 1
    });

    this.loadList().then(() => {
      this.setData({ loadingMore: false });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/feedback/detail/index?id=${id}`
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条反馈吗？删除后无法恢复。',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          this.deleteFeedback(id);
        }
      }
    });
  },

  async deleteFeedback(feedbackId) {
    try {
      await feedbackService.deleteFeedback(feedbackId);

      // 从列表中移除已删除的项
      const newList = this.data.list.filter(item => item.feedback_id !== feedbackId);
      this.setData({ list: newList });
      wx.showToast({ title: '删除成功', icon: 'success' });
    } catch (error) {
      console.error('[FeedbackList] Delete error:', error);
    }
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      // 没有上一页时，跳转到反馈入口页
      wx.redirectTo({
        url: '/pages/feedback/index/index'
      });
    }
  }
});
