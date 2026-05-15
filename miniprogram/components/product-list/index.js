/**
 * 商品（耗品）列表组件
 * 用于 pages/product/index 商品管理列表页
 */

const productService = require('../../services/productService');

// 筛选维度声明：每个维度对应一组 options（可选值）和 selected（已选值）
// 改维度时只动这里，wxml/逻辑会自动跟随
const FILTER_GROUPS = [
  { group: 'category', title: '商品类别', icon: 'apps-o', field: 'category', optionsKey: 'optCategories', selectedKey: 'filterCategories' },
  { group: 'source', title: '采购渠道', icon: 'shop-o', field: 'source', optionsKey: 'optSources', selectedKey: 'filterSources' },
];

const SELECTED_KEY_BY_GROUP = FILTER_GROUPS.reduce((acc, g) => {
  acc[g.group] = g.selectedKey;
  return acc;
}, {});

Component({
  properties: {
    canManage: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    keyword: '',
    products: [],
    filteredProducts: [],
    loading: true,
    loadingMore: false,
    productPage: 1,
    productTotal: 0,

    // 筛选弹层
    showFilter: false,
    filterCategories: [],
    filterSources: [],
    optCategories: [],
    optSources: [],
    filterSections: [], // wxml 渲染用：FILTER_GROUPS + 当前 options/selected 的快照
    hasActiveFilter: false,
    matchCount: 0,
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
        this._refreshFilterOptions();
        this._applyFilter();
      } catch (e) {
        console.error('[ProductList] Load error:', e);
        this.setData({ loading: false, loadingMore: false });
      }
    },

    _refreshFilterOptions() {
      const update = {};
      FILTER_GROUPS.forEach((g) => {
        const set = new Set();
        this.data.products.forEach((p) => { if (p[g.field]) set.add(p[g.field]); });
        update[g.optionsKey] = [...set];
      });
      this.setData(update);
      this._refreshFilterSections();
    },

    // 把 FILTER_GROUPS + 当前 options/selected 打平成 wxml 一次循环可渲染的数组
    // options 预计算 active 字段，避免 wxml 表达式里调用 indexOf 导致 setData diff 失灵
    _buildFilterSections(overrideSelectedKey, overrideSelectedValue) {
      return FILTER_GROUPS.map((g) => {
        const selected = g.selectedKey === overrideSelectedKey
          ? overrideSelectedValue
          : this.data[g.selectedKey];
        return {
          group: g.group,
          title: g.title,
          icon: g.icon,
          options: this.data[g.optionsKey].map((opt) => ({
            value: opt,
            active: selected.indexOf(opt) >= 0,
          })),
        };
      });
    },

    _refreshFilterSections() {
      this.setData({ filterSections: this._buildFilterSections() });
    },

    _matchPredicate(p) {
      return FILTER_GROUPS.every((g) => {
        const sel = this.data[g.selectedKey];
        return sel.length === 0 || sel.indexOf(p[g.field]) >= 0;
      });
    },

    _applyFilter() {
      const filtered = this.data.products.filter((p) => this._matchPredicate(p));
      this.setData({ filteredProducts: filtered, matchCount: filtered.length });
    },

    _computeMatchCount() {
      const count = this.data.products.filter((p) => this._matchPredicate(p)).length;
      this.setData({ matchCount: count });
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

    onSearchInput(e) {
      this.setData({ keyword: e.detail.value });
    },

    onSearchConfirm() {
      this.loadProducts();
    },

    // ========== 筛选弹层 ==========
    onOpenFilter() {
      this.setData({ showFilter: true });
      this._computeMatchCount();
    },

    onCloseFilter() {
      this.setData({ showFilter: false });
    },

    onToggleFilterChip(e) {
      const { group, value } = e.currentTarget.dataset;
      const key = SELECTED_KEY_BY_GROUP[group];
      if (!key) return;
      const current = this.data[key];
      const next = current.indexOf(value) >= 0
        ? current.filter((v) => v !== value)
        : [...current, value];
      // 合并到一次 setData，filterSections 用 next 直接构造，避免读 this.data 时序歧义
      const filterSections = this._buildFilterSections(key, next);
      this.setData({ [key]: next, filterSections });
      this._computeMatchCount();
    },

    onResetFilter() {
      const reset = {};
      FILTER_GROUPS.forEach((g) => { reset[g.selectedKey] = []; });
      this.setData({ ...reset, hasActiveFilter: false, showFilter: false });
      this._refreshFilterSections();
      this._applyFilter();
    },

    onConfirmFilter() {
      if (this.data.matchCount === 0) return;
      const hasActiveFilter = FILTER_GROUPS.some((g) => this.data[g.selectedKey].length > 0);
      this.setData({ showFilter: false, hasActiveFilter });
      this._applyFilter();
    },

    // 公开方法：父页 onShow 时主动刷新
    reload() {
      this.loadProducts();
    },
  },
});
