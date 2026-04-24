/**
 * 管理员-用户反馈列表页面
 */

const feedbackService = require('../../../services/feedbackService');

Page({
  data: {
    allList: [],      // 全部反馈数据
    list: [],         // 当前显示的列表（筛选后）
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    limit: 20,
    statusBarHeight: 0,
    navBarHeight: 0,
    // 分类筛选
    filterTabs: [
      { label: '全部', value: 'all' },
      { label: '系统BUG', value: '系统BUG' },
      { label: '新增功能建议', value: '新增功能建议' },
      { label: '现有模块优化', value: '现有模块优化' },
      { label: '个人想法', value: '个人想法' }
    ],
    currentFilter: 'all'
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

  onShow() {
    // 每次显示时刷新列表
    this.setData({
      allList: [],
      list: [],
      page: 1,
      hasMore: true
    });
    this.loadList();
  },

  onPullDownRefresh() {
    this.setData({
      allList: [],
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
      this.setData({ loading: this.data.allList.length === 0 });

      const result = await feedbackService.listFeedbacks({
        filters: {
          page: this.data.page,
          limit: this.data.limit,
          admin: true  // 管理员模式，获取所有用户反馈
        }
      });

      const newList = (result.list || []).map(item => this.formatItem(item));
      const hasMore = this.data.page < result.totalPages;
      const allList = [...this.data.allList, ...newList];

      this.setData({
        allList,
        hasMore,
        loading: false
      });

      // 应用当前筛选
      this.applyFilter();
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

  // 分类筛选切换
  onFilterChange(e) {
    const value = e.currentTarget.dataset.value;
    if (value === this.data.currentFilter) return;

    this.setData({ currentFilter: value });
    this.applyFilter();
  },

  // 应用筛选
  applyFilter() {
    const { allList, currentFilter } = this.data;

    if (currentFilter === 'all') {
      this.setData({ list: allList });
    } else {
      const filteredList = allList.filter(item => item.type === currentFilter);
      this.setData({ list: filteredList });
    }
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
