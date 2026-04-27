/**
 * 物料管理页面
 * Tab：配件列表 / 出库记录
 * 注：入库管理已拆分到独立页 pages/material/stock-in
 */

const materialService = require('../../services/materialService');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');

function formatDateTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

Page({
  data: {
    activeTab: 0,
    tabs: ['配件列表', '出库记录'],
    canManage: false,

    // 配件列表
    keyword: '',
    materials: [],
    filteredMaterials: [],
    materialFilter: '全部',
    loading: true,
    loadingMore: false,
    materialPage: 1,
    materialTotal: 0,

    // 出库记录
    outRecords: [],
    outLoading: true,
    outLoadingMore: false,
    outPage: 1,
    outTotal: 0,

    // 出库弹窗
    showStockOut: false,
    stockOutForm: {
      material_id: 0,
      material_name: '',
      current_stock: 0,
      unit: '',
      quantity: '',
      remark: ''
    },

    // 回到顶部
    showBackToTop: false,
    materialScrollTopTarget: -1,
  },

  onLoad() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    // 维修员（MAINTENANCE_STAFF=3）已被移除耗品访问权
    const canAccess = userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id);
    if (!canAccess) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ canManage: true });
  },

  onShow() {
    if (!this._tabLoaded) {
      this._tabLoaded = { 0: true };
      this.loadMaterials();
      return;
    }
    // 从 add 页返回：刷配件列表 + 已加载过的出库记录
    if (this.data.activeTab === 0) {
      this.loadMaterials();
      if (this._tabLoaded && this._tabLoaded[1]) this.loadRecords('out');
    }
  },

  onPullDownRefresh() {
    const refreshMap = {
      0: () => this.loadMaterials(),
      1: () => this.loadRecords('out'),
    };
    const refreshFn = refreshMap[this.data.activeTab];
    if (refreshFn) {
      refreshFn().then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  },

  // ===== Tab 切换 =====
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
    this._ensureTabLoaded(index);
  },

  onSwiperChange(e) {
    const index = e.detail.current;
    this.setData({ activeTab: index });
    this._ensureTabLoaded(index);
  },

  _ensureTabLoaded(index) {
    if (this._tabLoaded && this._tabLoaded[index]) return;
    if (!this._tabLoaded) this._tabLoaded = {};
    this._tabLoaded[index] = true;

    const loaders = {
      0: () => this.loadMaterials(),
      1: () => this.loadRecords('out'),
    };
    if (loaders[index]) loaders[index]();
  },

  // ===== 配件列表 =====
  async loadMaterials(append = false) {
    if (!append) {
      this.setData({ loading: true, materialPage: 1 });
    }

    try {
      const result = await materialService.listMaterials(
        this.data.keyword,
        this.data.materialPage
      );
      const allMaterials = append
          ? [...this.data.materials, ...result.materials]
          : result.materials;
      this.setData({
        materials: allMaterials,
        materialTotal: result.total,
        loading: false,
        loadingMore: false,
      });
      this._applyMaterialFilter();
    } catch (e) {
      console.error('[Material] Load error:', e);
      this.setData({ loading: false, loadingMore: false });
    }
  },

  onSearchChange(e) {
    this.setData({ keyword: e.detail.value || e.detail });
  },

  onSearch() {
    this.loadMaterials();
  },

  onLoadMore() {
    if (this.data.loadingMore) return;
    if (this.data.materials.length >= this.data.materialTotal) return;
    this.setData({
      loadingMore: true,
      materialPage: this.data.materialPage + 1
    });
    this.loadMaterials(true);
  },

  // ===== 配件列表筛选 =====
  onMaterialFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ materialFilter: filter });
    this._applyMaterialFilter();
  },

  _applyMaterialFilter() {
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

  // ===== 出库记录 =====
  async loadRecords(type, append = false) {
    const prefix = type === 'in' ? 'in' : 'out';
    const loadingKey = `${prefix}Loading`;
    const loadingMoreKey = `${prefix}LoadingMore`;
    const pageKey = `${prefix}Page`;
    const recordsKey = `${prefix}Records`;
    const totalKey = `${prefix}Total`;

    if (!append) {
      this.setData({ [loadingKey]: true, [pageKey]: 1 });
    }

    try {
      const result = await materialService.listRecords(type, this.data[pageKey]);
      const records = (result.records || []).map(r => ({
        ...r,
        timeText: formatDateTime(r.created_at)
      }));
      this.setData({
        [recordsKey]: append ? [...this.data[recordsKey], ...records] : records,
        [totalKey]: result.total,
        [loadingKey]: false,
        [loadingMoreKey]: false,
      });
    } catch (e) {
      console.error(`[Material] Load ${type} records error:`, e);
      this.setData({ [loadingKey]: false, [loadingMoreKey]: false });
    }
  },

  onLoadMoreRecords() {
    const tab = this.data.activeTab;
    if (tab === 1) {
      if (this.data.outLoadingMore || this.data.outRecords.length >= this.data.outTotal) return;
      this.setData({ outLoadingMore: true, outPage: this.data.outPage + 1 });
      this.loadRecords('out', true);
    }
  },

  // ===== 筛选按钮 =====
  onFilterTap() {
    wx.showToast({ title: '筛选功能开发中', icon: 'none' });
  },

  // ===== 配件详情 =====
  goToDetail(e) {
    const material = e.currentTarget.dataset.material;
    wx.navigateTo({
      url: `/pages/material/detail/index?id=${material.material_id}`
    });
  },

  // ===== 记录详情 =====
  goToRecordDetail(e) {
    const record = e.currentTarget.dataset.record;
    wx.navigateTo({
      url: `/pages/material/record-detail/index?data=${encodeURIComponent(JSON.stringify(record))}`
    });
  },

  // ===== 出库弹窗 =====
  showStockOutModal(e) {
    const material = e.currentTarget.dataset.material;
    this.setData({
      showStockOut: true,
      stockOutForm: {
        material_id: material.material_id,
        material_name: material.name,
        current_stock: material.stock,
        unit: material.unit,
        quantity: '',
        remark: ''
      }
    });
  },

  closeStockOutModal() {
    this.setData({ showStockOut: false });
  },

  onStockOutQtyInput(e) {
    this.setData({ 'stockOutForm.quantity': e.detail.value });
  },

  onStockOutRemarkInput(e) {
    this.setData({ 'stockOutForm.remark': e.detail.value });
  },

  async doStockOut() {
    const { material_id, quantity, remark } = this.data.stockOutForm;
    if (!quantity || Number(quantity) <= 0) {
      wx.showToast({ title: '请输入正确的数量', icon: 'none' });
      return;
    }

    try {
      await materialService.stockOut(material_id, Number(quantity), remark);
      wx.showToast({ title: '出库成功', icon: 'success' });
      this.closeStockOutModal();
      this.loadMaterials();
      this.loadRecords('out');
    } catch (e) {
      // callCloud 已处理错误提示
    }
  },

  // ===== 新增配件 =====
  goToAddMaterial() {
    wx.navigateTo({ url: '/pages/material/add/index' });
  },

  // ===== 回到顶部 =====
  onMaterialScroll(e) {
    const showBackToTop = e.detail.scrollTop > 200;
    if (this.data.showBackToTop !== showBackToTop) {
      this.setData({ showBackToTop });
    }
  },

  scrollToTop() {
    this.setData({ materialScrollTopTarget: 0, showBackToTop: false });
    setTimeout(() => {
      this.setData({ materialScrollTopTarget: -1 });
    }, 300);
  },
});
