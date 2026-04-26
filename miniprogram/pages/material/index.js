/**
 * 物料管理页面
 * Tab切换：配件列表、入库记录、出库记录、库存警告
 */

const materialService = require('../../services/materialService');
const dictionaryAdmin = require('../../services/dictionaryAdmin');
const dictionary = require('../../services/dictionary');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');

const DEFAULT_MATERIAL_CATEGORIES = [
  '电气', '水暖', '门窗', '消防', '清洁', '五金',
  '滤芯类', '轴承类', '密封类', '管路类', '油漆涂料', '通用',
];

function formatTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

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
    tabs: ['配件列表', '入库管理', '出库记录'],
    // Tab2 入库管理 - 子页签
    activeSubTab: 0,                       // 0 入库记录 / 1 分类管理
    subTabs: ['入库记录', '分类管理'],
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

    // 入库记录
    inRecords: [],
    inLoading: true,
    inLoadingMore: false,
    inPage: 1,
    inTotal: 0,

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

    // 分类管理（material_category 字典）
    categoriesLoading: false,
    categoryItems: [],
    categoriesLoaded: false,
  },

  onLoad(query = {}) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    // 维修员（MAINTENANCE_STAFF=3）已被移除耗品访问权
    const canAccess = userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id);
    if (!canAccess) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // canManage = 与 canAccess 同集合（ADMIN/PROPERTY_MANAGER/PROPERTY_STAFF）
    const subTabsForRole = ['入库记录', '分类管理'];
    this.setData({
      canManage: true,
      subTabs: subTabsForRole,
    });

    // 支持 ?tab= & ?sub= deeplink
    const tab = parseInt(query.tab, 10);
    const sub = parseInt(query.sub, 10);
    if (!isNaN(tab) && tab >= 0 && tab <= 2) {
      this.setData({ activeTab: tab });
      if (tab === 1 && !isNaN(sub) && sub >= 0 && sub <= 1) {
        this.setData({ activeSubTab: sub });
        if (sub === 1) {
          this._ensureCategoriesLoaded();
        }
      }
    }
  },

  onShow() {
    // 首次：只加载 Tab1
    if (!this._tabLoaded) {
      this._tabLoaded = { 0: true };
      this.loadMaterials();
      return;
    }
    // 从 stock-in-form 返回：当前在 Tab2 入库记录子页，强制刷新前 1 页
    if (this.data.activeTab === 1 && this.data.activeSubTab === 0) {
      this.loadRecords('in');
    }
    // 从 add 页返回：刷 Tab1 配件列表 + Tab2 入库记录
    if (this.data.activeTab === 0) {
      this.loadMaterials();
      // Tab2 入库记录数据若已加载过，也刷
      if (this._tabLoaded && this._tabLoaded[1]) this.loadRecords('in');
    }
  },

  onPullDownRefresh() {
    const refreshMap = {
      0: () => this.loadMaterials(),
      1: () => this.loadRecords('in'),
      2: () => this.loadRecords('out'),
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

  // ===== Tab2 sub-tabs =====
  onSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    this.setData({ activeSubTab: sub });
    if (sub === 1) {
      this._ensureCategoriesLoaded();
    }
  },

  // ===== FAB =====
  onFabTap() {
    const tab = this.data.activeTab;

    // Tab1：保持原"新增配件"行为
    if (tab === 0) {
      this.goToAddMaterial();
      return;
    }

    // Tab2 入库记录子页：弹 ActionSheet
    wx.showActionSheet({
      itemList: ['扫码入库', '新品入库'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.scanAndStockIn();
        } else if (res.tapIndex === 1) {
          this.goToAddMaterial();
        }
      },
    });
  },

  // 注：goToAddMaterial 已在文件 ~L374 定义，无需重定义

  // ===== 扫码入库 =====
  async scanAndStockIn() {
    let scanResult;
    try {
      scanResult = await wx.scanCode({ scanType: ['qrCode', 'barCode'] });
    } catch (e) {
      // 用户取消，静默
      return;
    }
    const code = (scanResult.result || '').trim();
    if (!code) {
      wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      return;
    }

    let result;
    try {
      result = await materialService.getMaterialByNumber(code);
    } catch (e) {
      console.error('[Material] scan lookup error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      return;
    }

    if (!result || !result.success) {
      wx.showToast({ title: (result && result.error) || '查询失败', icon: 'none' });
      return;
    }

    if (!result.material) {
      wx.showModal({
        title: '未找到',
        content: `编号「${code}」未登记，请先去新品入库`,
        showCancel: false,
      });
      return;
    }

    const m = result.material;
    const url = '/pages/material/stock-in-form/index'
      + `?material_id=${m.material_id}`
      + `&name=${encodeURIComponent(m.name || '')}`
      + `&number=${encodeURIComponent(m.material_number || '')}`
      + `&stock=${m.stock || 0}`
      + `&unit=${encodeURIComponent(m.unit || '')}`
      + `&spec=${encodeURIComponent(m.spec || '')}`;
    wx.navigateTo({ url });
  },

  async _ensureCategoriesLoaded() {
    if (this.data.categoriesLoaded) return;
    await this.loadCategories();
  },

  async loadCategories() {
    this.setData({ categoriesLoading: true });
    try {
      const result = await dictionaryAdmin.getDictionary('material_category');
      if (result && result.success && result.data) {
        const items = (result.data.items || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this.setData({
          categoryItems: items,
          categoriesLoading: false,
          categoriesLoaded: true,
        });
        return;
      }
      // 不存在 → 自动 seed
      if (result && !result.success && (result.error || '').includes('不存在')) {
        await this.seedCategories();
        return;
      }
      // 其他错误
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ categoriesLoading: false });
    } catch (e) {
      console.error('[Material] loadCategories error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ categoriesLoading: false });
    }
  },

  async seedCategories() {
    const items = DEFAULT_MATERIAL_CATEGORIES.map((label, idx) => ({
      value: label,
      label,
      sort: idx,
      enabled: true,
    }));
    try {
      const result = await dictionaryAdmin.createDictionary({
        dict_key: 'material_category',
        dict_name: '物料分类',
        description: '新品入库的商品分类',
        items,
      });
      if (result && result.success) {
        wx.showToast({ title: '已创建默认分类', icon: 'success' });
        dictionary.refreshCache('material_category');
        this.setData({
          categoryItems: items,
          categoriesLoading: false,
          categoriesLoaded: true,
        });
      } else {
        wx.showToast({ title: (result && result.error) || '初始化失败', icon: 'none' });
        this.setData({ categoriesLoading: false });
      }
    } catch (e) {
      console.error('[Material] seedCategories error:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.setData({ categoriesLoading: false });
    }
  },

  onAddCategoryTap() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '输入分类名称',
      success: (res) => {
        if (!res.confirm) return;
        const label = (res.content || '').trim();
        if (!label) {
          wx.showToast({ title: '名称不能为空', icon: 'none' });
          return;
        }
        // 重名校验（只看 enabled 项）
        const exists = this.data.categoryItems.some(
          i => i.enabled !== false && i.label === label
        );
        if (exists) {
          wx.showToast({ title: '该分类已存在', icon: 'none' });
          return;
        }
        const next = [
          ...this.data.categoryItems,
          {
            value: label,
            label,
            sort: this.data.categoryItems.length,
            enabled: true,
          },
        ];
        this._saveCategoryItems(next);
      },
    });
  },

  onRenameCategoryTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.categoryItems[index];
    if (!item) return;
    wx.showModal({
      title: '重命名分类',
      editable: true,
      content: item.label,
      placeholderText: '输入新的分类名称',
      success: (res) => {
        if (!res.confirm) return;
        const label = (res.content || '').trim();
        if (!label) {
          wx.showToast({ title: '名称不能为空', icon: 'none' });
          return;
        }
        if (label === item.label) return; // 没变
        const dup = this.data.categoryItems.some(
          (i, idx) => idx !== index && i.enabled !== false && i.label === label
        );
        if (dup) {
          wx.showToast({ title: '该分类已存在', icon: 'none' });
          return;
        }
        const next = this.data.categoryItems.map((i, idx) =>
          idx === index ? { ...i, label, value: label } : i
        );
        this._saveCategoryItems(next);
      },
    });
  },

  onDeleteCategoryTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.categoryItems[index];
    if (!item) return;
    wx.showModal({
      title: '确认删除',
      content: `删除分类「${item.label}」？已使用该分类的商品保留旧值。`,
      success: (res) => {
        if (!res.confirm) return;
        const next = this.data.categoryItems.map((i, idx) =>
          idx === index ? { ...i, enabled: false } : i
        );
        const remaining = next.filter(i => i.enabled !== false).length;
        this._saveCategoryItems(next, () => {
          if (remaining === 0) {
            wx.showToast({ title: '已删除最后一个分类，新品入库无可选项', icon: 'none', duration: 2500 });
          }
        });
      },
    });
  },

  async _saveCategoryItems(items, onSuccess) {
    const prev = this.data.categoryItems;
    this.setData({ categoryItems: items });   // 乐观 UI
    try {
      const result = await dictionaryAdmin.updateDictionary('material_category', items);
      if (result && result.success) {
        dictionary.refreshCache('material_category');
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        // 失败回滚
        this.setData({ categoryItems: prev });
        wx.showToast({ title: (result && result.error) || '保存失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[Material] saveCategoryItems error:', e);
      this.setData({ categoryItems: prev });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  _ensureTabLoaded(index) {
    if (this._tabLoaded && this._tabLoaded[index]) return;
    if (!this._tabLoaded) this._tabLoaded = {};
    this._tabLoaded[index] = true;

    const loaders = {
      0: () => this.loadMaterials(),
      1: () => this.loadRecords('in'),
      2: () => this.loadRecords('out'),
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

  // ===== 出入库记录（合并入库/出库逻辑） =====
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
      if (this.data.inLoadingMore || this.data.inRecords.length >= this.data.inTotal) return;
      this.setData({ inLoadingMore: true, inPage: this.data.inPage + 1 });
      this.loadRecords('in', true);
    } else if (tab === 2) {
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
