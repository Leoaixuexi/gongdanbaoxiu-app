/**
 * 商品列表组件（共享）
 * 用于 stock-in 页 商品管理 sub-tab + material/index Tab0 配件列表
 */

const materialService = require('../../services/materialService');

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
          this.data.materialPage
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

    onCardMenuTap(e) {
      const material = e.currentTarget.dataset.material;
      wx.showActionSheet({
        itemList: ['编辑', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.navigateTo({ url: `/pages/material/edit/index?id=${material.material_id}` });
          } else if (res.tapIndex === 1) {
            this._confirmDelete(material);
          }
        },
      });
    },

    _confirmDelete(material) {
      wx.showModal({
        title: '确认删除',
        content: `删除「${material.name}」？此操作不可撤销。`,
        success: (res) => {
          if (res.confirm) this._optimisticDelete(material);
        },
      });
    },

    async _optimisticDelete(material) {
      const prev = this.data.materials;
      const next = prev.filter(m => m.material_id !== material.material_id);
      this.setData({ materials: next });
      this._applyFilter();
      try {
        const result = await materialService.deleteMaterial(material.material_id);
        if (!result || !result.success) {
          this.setData({ materials: prev });
          this._applyFilter();
          wx.showToast({ title: (result && result.error) || '删除失败', icon: 'none' });
        } else {
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      } catch (e) {
        console.error('[MaterialList] delete error:', e);
        this.setData({ materials: prev });
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
      this.loadMaterials();
    },

    onFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      if (filter === this.data.materialFilter) return;
      this.setData({ materialFilter: filter });
      this._applyFilter();
    },

    // 公开方法：父页 onShow 时主动刷新
    reload() {
      this.loadMaterials();
    },
  },
});
