/**
 * 列表页 Behavior
 * 提供列表加载、下拉刷新、分页、loading 状态管理
 */

module.exports = Behavior({
  data: {
    listData: [],
    listLoading: true,
    listLoadingMore: false,
    listHasMore: true,
    listPage: 1,
    listPageSize: 20,
    listTotal: 0
  },

  methods: {
    /**
     * 重置并加载列表
     * 子页面需实现 loadListData() 方法
     */
    async resetAndLoadList() {
      this.setData({
        listData: [],
        listPage: 1,
        listHasMore: true,
        listLoading: true
      });
      await this.loadListData();
    },

    /**
     * 加载更多
     */
    async loadMoreList() {
      if (this.data.listLoadingMore || !this.data.listHasMore) return;

      this.setData({
        listLoadingMore: true,
        listPage: this.data.listPage + 1
      });

      await this.loadListData();
    },

    /**
     * 更新列表数据（子页面在 loadListData 中调用）
     */
    updateListData(items, total) {
      const { listPage } = this.data;

      this.setData({
        listData: listPage === 1 ? items : [...this.data.listData, ...items],
        listTotal: total,
        listHasMore: this.data.listData.length + items.length < total,
        listLoading: false,
        listLoadingMore: false
      });
    },

    /**
     * 列表加载失败时调用
     */
    onListLoadError(error) {
      console.error('[ListPage] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({
        listLoading: false,
        listLoadingMore: false
      });
    }
  }
});
