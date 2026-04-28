Page({
  data: {
    activeStatus: 'all',
    keyword: '',
    statusCounts: { all: 0, warning: 0, empty: 0, normal: 0 },
    materials: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: true,
    loadingMore: false,
  },

  onLoad() {},
  onShow() {},
  onPullDownRefresh() {},
  onReachBottom() {},
});
