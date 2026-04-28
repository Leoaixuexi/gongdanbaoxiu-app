/**
 * 商品（耗品）列表组件
 * 用于 pages/product/index 商品管理列表页
 */

const productService = require('../../services/productService');

Component({
  properties: {
    canManage: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    keyword: '',
    productFilter: '全部',
    products: [],
    filteredProducts: [],
    warningCount: 0,
    shortageCount: 0,
    loading: true,
    loadingMore: false,
    productPage: 1,
    productTotal: 0,
  },

  lifetimes: {
    attached() {
      this.loadProducts();
    },
  },

  methods: {
    async loadProducts(append = false) {
      if (!append) {
        this.setData({ loading: true, productPage: 1 });
      }
      try {
        const result = await productService.listProducts(
          this.data.keyword,
          this.data.productPage
        );
        const all = append
          ? [...this.data.products, ...result.products]
          : result.products;
        this.setData({
          products: all,
          productTotal: result.total,
          loading: false,
          loadingMore: false,
        });
        this._applyFilter();
      } catch (e) {
        console.error('[ProductList] Load error:', e);
        this.setData({ loading: false, loadingMore: false });
      }
    },

    _applyFilter() {
      const { products, productFilter } = this.data;
      const warningCount = products.filter(m => m.min_stock > 0 && m.stock > 0 && m.stock <= m.min_stock).length;
      const shortageCount = products.filter(m => m.stock === 0).length;
      let filtered;
      if (productFilter === '缺货') {
        filtered = products.filter(m => m.stock === 0);
      } else if (productFilter === '预警') {
        filtered = products.filter(m => m.min_stock > 0 && m.stock > 0 && m.stock <= m.min_stock);
      } else {
        filtered = products;
      }
      this.setData({ filteredProducts: filtered, warningCount, shortageCount });
    },

    onLoadMore() {
      if (this.data.loadingMore) return;
      if (this.data.products.length >= this.data.productTotal) return;
      this.setData({
        loadingMore: true,
        productPage: this.data.productPage + 1,
      });
      this.loadProducts(true);
    },

    onCardTap(e) {
      const product = e.currentTarget.dataset.product;
      this.triggerEvent('itemtap', { product });
    },

    onCardMenuTap(e) {
      const product = e.currentTarget.dataset.product;
      wx.showActionSheet({
        itemList: ['编辑', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.navigateTo({ url: `/pages/product/edit/index?id=${product.product_id}` });
          } else if (res.tapIndex === 1) {
            this._confirmDelete(product);
          }
        },
      });
    },

    _confirmDelete(product) {
      wx.showModal({
        title: '确认删除',
        content: `删除「${product.name}」？此操作不可撤销。`,
        success: (res) => {
          if (res.confirm) this._optimisticDelete(product);
        },
      });
    },

    async _optimisticDelete(product) {
      const prev = this.data.products;
      const next = prev.filter(m => m.product_id !== product.product_id);
      this.setData({ products: next });
      this._applyFilter();
      try {
        const result = await productService.deleteProduct(product.product_id);
        if (!result || !result.success) {
          this.setData({ products: prev });
          this._applyFilter();
          wx.showToast({ title: (result && result.error) || '删除失败', icon: 'none' });
        } else {
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      } catch (e) {
        console.error('[ProductList] delete error:', e);
        this.setData({ products: prev });
        this._applyFilter();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    },

    onAddTap() {
      this.triggerEvent('additem', {});
    },

    onSearchInput(e) {
      this.setData({ keyword: e.detail.value });
    },

    onSearchConfirm() {
      this.loadProducts();
    },

    onFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      if (filter === this.data.productFilter) return;
      this.setData({ productFilter: filter });
      this._applyFilter();
    },

    // 公开方法：父页 onShow 时主动刷新
    reload() {
      this.loadProducts();
    },
  },
});
