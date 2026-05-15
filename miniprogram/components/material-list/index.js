/**
 * 配件列表组件
 * 用于 material/index Tab0 配件列表
 */

const materialService = require('../../services/materialService');
const dictionary = require('../../services/dictionary');

// 筛选 chip 分组 → data 字段映射
const FILTER_GROUP_KEY = {
  category: 'filterCategories',
  usage: 'filterUsageAreas',
  storage: 'filterStorageAreas',
};

Component({
  properties: {
    canManage: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    keyword: '',
    materialFilter: '全部',
    materials: [],
    filteredMaterials: [],
    warningCount: 0,
    shortageCount: 0,
    loading: true,
    loadingMore: false,
    materialPage: 1,
    materialTotal: 0,

    // 筛选弹层
    showFilter: false,
    filterCategories: [],
    filterUsageAreas: [],
    filterStorageAreas: [],
    optCategories: [],
    optUsageAreas: [],
    optStorageAreas: [],
    optsLoaded: false,
    hasActiveFilter: false,
  },

  lifetimes: {
    attached() {
      this.loadMaterials();
    },
  },

  methods: {
    async loadMaterials(append = false) {
      if (!append) {
        this.setData({ loading: true, materialPage: 1 });
      }
      try {
        const result = await materialService.listMaterials(
          this.data.keyword,
          this.data.materialPage,
          20,
          {
            categories: this.data.filterCategories,
            usage_areas: this.data.filterUsageAreas,
            storage_areas: this.data.filterStorageAreas,
          }
        );
        const all = append
          ? [...this.data.materials, ...result.materials]
          : result.materials;
        this.setData({
          materials: all,
          materialTotal: result.total,
          loading: false,
          loadingMore: false,
        });
        this._applyFilter();
      } catch (e) {
        console.error('[MaterialList] Load error:', e);
        this.setData({ loading: false, loadingMore: false });
      }
    },

    _applyFilter() {
      const { materials, materialFilter } = this.data;
      const warningCount = materials.filter(m => m.min_stock > 0 && m.stock > 0 && m.stock <= m.min_stock).length;
      const shortageCount = materials.filter(m => m.stock === 0).length;
      let filtered;
      if (materialFilter === '缺货') {
        filtered = materials.filter(m => m.stock === 0);
      } else if (materialFilter === '预警') {
        filtered = materials.filter(m => m.min_stock > 0 && m.stock > 0 && m.stock <= m.min_stock);
      } else {
        filtered = materials;
      }
      this.setData({ filteredMaterials: filtered, warningCount, shortageCount });
    },

    onLoadMore() {
      if (this.data.loadingMore) return;
      if (this.data.materials.length >= this.data.materialTotal) return;
      this.setData({
        loadingMore: true,
        materialPage: this.data.materialPage + 1,
      });
      this.loadMaterials(true);
    },

    onCardTap(e) {
      const material = e.currentTarget.dataset.material;
      this.triggerEvent('itemtap', { material });
    },

    onSearchInput(e) {
      this.setData({ keyword: e.detail.value });
    },

    onSearchConfirm() {
      this.loadMaterials();
    },

    onFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      if (filter === this.data.materialFilter) return;
      this.setData({ materialFilter: filter });
      this._applyFilter();
    },

    // ========== 筛选弹层 ==========
    async onOpenFilter() {
      this.setData({ showFilter: true });
      if (!this.data.optsLoaded) {
        try {
          const [categories, storageAreas, areasRes] = await Promise.all([
            dictionary.getOptions('material_category'),
            dictionary.getOptions('material_storage_area'),
            materialService.listMaterialAreas(),
          ]);
          this.setData({
            optCategories: categories || [],
            optStorageAreas: storageAreas || [],
            optUsageAreas: (areasRes && areasRes.usage_areas) || [],
            optsLoaded: true,
          });
        } catch (e) {
          console.error('[MaterialList] Load filter options error:', e);
        }
      }
    },

    onCloseFilter() {
      this.setData({ showFilter: false });
    },

    onToggleFilterChip(e) {
      const { group, value } = e.currentTarget.dataset;
      const key = FILTER_GROUP_KEY[group];
      if (!key) return;
      const arr = [...this.data[key]];
      const idx = arr.indexOf(value);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(value);
      this.setData({ [key]: arr });
    },

    onResetFilter() {
      this.setData({
        filterCategories: [],
        filterUsageAreas: [],
        filterStorageAreas: [],
        hasActiveFilter: false,
        showFilter: false,
      });
      this.loadMaterials();
    },

    onConfirmFilter() {
      const hasActiveFilter =
        this.data.filterCategories.length > 0 ||
        this.data.filterUsageAreas.length > 0 ||
        this.data.filterStorageAreas.length > 0;
      this.setData({ showFilter: false, hasActiveFilter });
      this.loadMaterials();
    },

    // 公开方法：父页 onShow 时主动刷新
    reload() {
      this.loadMaterials();
    },
  },
});
