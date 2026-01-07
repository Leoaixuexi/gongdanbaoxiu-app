/**
 * 管理员-用户反馈列表页面（只读）
 */

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

      const res = await wx.cloud.callFunction({
        name: 'feedbackManager',
        data: {
          action: 'list',
          data: {
            filters: {
              page: this.data.page,
              limit: this.data.limit
            }
          }
        }
      });

      if (res.result && res.result.success) {
        const newList = (res.result.list || []).map(item => this.formatItem(item));
        const hasMore = this.data.page < res.result.totalPages;

        this.setData({
          list: [...this.data.list, ...newList],
          hasMore,
          loading: false
        });
      } else {
        throw new Error(res.result?.error || '加载失败');
      }
    } catch (error) {
      console.error('[AdminFeedbacks] Load error:', error);
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

    const content_summary = item.content && item.content.length > 80
      ? item.content.substring(0, 80) + '...'
      : item.content || '';

    return {
      ...item,
      created_at_str,
      content_summary
    };
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

  goBack() {
    wx.navigateBack();
  }
});
