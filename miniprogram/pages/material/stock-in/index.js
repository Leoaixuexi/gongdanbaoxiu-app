/**
 * 入库管理（独立页）
 * 子页签：入库记录 / 分类管理 + 右下角 FAB
 * 入口：首页 Tab2 耗品管理 → 宫格"入库管理"
 */

const materialService = require('../../../services/materialService');
const dictionaryAdmin = require('../../../services/dictionaryAdmin');
const dictionary = require('../../../services/dictionary');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

const DEFAULT_MATERIAL_CATEGORIES = [
  '电气', '水暖', '门窗', '消防', '清洁', '五金',
  '滤芯类', '轴承类', '密封类', '管路类', '油漆涂料', '通用',
];

const DEFAULT_MATERIAL_LOCATIONS = [
  '主仓库', '应急储备', '工程仓',
  '办公耗材区', '外采暂存', '其它',
];

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
    activeSubTab: 0,                       // 0 入库记录 / 1 商品管理 / 2 分类管理
    subTabs: ['入库记录', '商品管理', '分类管理'],
    canManage: false,

    // 入库记录
    inRecords: [],
    inLoading: true,
    inLoadingMore: false,
    inPage: 1,
    inTotal: 0,

    // 分类管理（material_category 字典）
    categoriesLoading: false,
    categoryItems: [],
    categoriesLoaded: false,

    // === Modal: 扫码后入库表单 ===
    showStockInModal: false,
    scannedMaterial: null,    // { material_id, name, material_number, stock, unit, spec, images, usage_area }
    modalQuantity: '',
    modalLocation: '',        // 选中的位置（用于提交）
    modalRemark: '',
    modalSubmitting: false,
    locationOptions: [],      // [{value, label}]
    locationIndex: 0,
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
    if (!this._loaded) {
      this._loaded = true;
      this.loadRecords();
      return;
    }
    if (this.data.activeSubTab === 0) {
      this.loadRecords();
    }
    if (this.data.activeSubTab === 1) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
    }
  },

  onPullDownRefresh() {
    if (this.data.activeSubTab === 0) {
      this.loadRecords().then(() => wx.stopPullDownRefresh());
    } else {
      this.loadCategories().then(() => wx.stopPullDownRefresh());
    }
  },

  // ===== Sub-tabs =====
  onSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    this.setData({ activeSubTab: sub });
    if (sub === 1) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
    }
    if (sub === 2) {
      this._ensureCategoriesLoaded();
    }
  },

  // ===== 直接扫码（替代旧 ActionSheet） =====
  async directScan() {
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
      console.error('[StockIn] scan lookup error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      return;
    }

    if (!result || !result.success) {
      wx.showToast({ title: (result && result.error) || '查询失败', icon: 'none' });
      return;
    }

    if (!result.material) {
      // 扫到不识别 → modal 双按钮引导添加
      wx.showModal({
        title: '未识别',
        content: `编号「${code}」未登记，是否去商品管理添加？`,
        cancelText: '取消',
        confirmText: '立即添加',
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.setData({ activeSubTab: 1 });
            wx.navigateTo({
              url: `/pages/material/add/index?material_number=${encodeURIComponent(code)}`,
            });
          }
        },
      });
      return;
    }

    // 命中 → 弹 Modal（loadLocationOptions + openStockInModal 下 Task 实现）
    await this.openStockInModal(result.material);
  },

  async openStockInModal(material) {
    // 首次扫码触发 loadLocationOptions（含 seed）
    await this.loadLocationOptions();

    // material.usage_area 在字典中找 idx；找不到 fallback 0
    const usage = material.usage_area || '';
    let idx = this.data.locationOptions.findIndex(o => o.value === usage);
    if (idx < 0) idx = 0;
    const initLocation = (this.data.locationOptions[idx] && this.data.locationOptions[idx].value) || '';

    this.setData({
      showStockInModal: true,
      scannedMaterial: material,
      modalQuantity: '',
      modalLocation: initLocation,
      modalRemark: '',
      modalSubmitting: false,
      locationIndex: idx,
    });
  },

  async loadLocationOptions() {
    if (this._locationLoaded && this.data.locationOptions.length > 0) return;
    try {
      const result = await dictionaryAdmin.getDictionary('material_location');
      if (result && result.success && result.data) {
        const items = (result.data.items || [])
          .filter(i => i.enabled !== false)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .map(i => ({ value: i.value, label: i.label || i.value }));
        this.setData({ locationOptions: items });
        this._locationLoaded = true;
        return;
      }
      if (result && !result.success && (result.error || '').includes('不存在')) {
        await this._seedLocations();
        return;
      }
      throw new Error('加载位置失败');
    } catch (e) {
      console.error('[StockIn] loadLocationOptions error:', e);
      wx.showToast({ title: '位置数据加载失败', icon: 'none' });
      throw e;
    }
  },

  async _seedLocations() {
    const items = DEFAULT_MATERIAL_LOCATIONS.map((label, idx) => ({
      value: label,
      label,
      sort: idx,
      enabled: true,
    }));
    const result = await dictionaryAdmin.createDictionary({
      dict_key: 'material_location',
      dict_name: '物料位置',
      description: '入库时的位置选项',
      items,
    });
    if (result && result.success) {
      wx.showToast({ title: '已创建默认位置', icon: 'success' });
      dictionary.refreshCache('material_location');
      this.setData({
        locationOptions: items.map(i => ({ value: i.value, label: i.label })),
      });
      this._locationLoaded = true;
    } else {
      wx.showToast({ title: (result && result.error) || '初始化位置失败', icon: 'none' });
      throw new Error('seed locations failed');
    }
  },

  closeStockInModal() {
    this.setData({
      showStockInModal: false,
      scannedMaterial: null,
      modalQuantity: '',
      modalLocation: '',
      modalRemark: '',
      modalSubmitting: false,
    });
  },

  onModalQuantityInput(e) {
    this.setData({ modalQuantity: e.detail.value });
  },

  onModalRemarkInput(e) {
    this.setData({ modalRemark: e.detail.value });
  },

  onModalLocationChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const opt = this.data.locationOptions[idx];
    if (!opt) return;
    this.setData({
      locationIndex: idx,
      modalLocation: opt.value,
    });
  },

  async submitStockIn() {
    const qty = parseInt(this.data.modalQuantity, 10);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    if (qty > 999999) {
      wx.showToast({ title: '数量不能超过 999999', icon: 'none' });
      return;
    }
    if (!this.data.modalLocation) {
      wx.showToast({ title: '请选择入库位置', icon: 'none' });
      return;
    }

    this.setData({ modalSubmitting: true });
    try {
      const result = await materialService.stockIn(
        this.data.scannedMaterial.material_id,
        qty,
        this.data.modalRemark || '',
        this.data.modalLocation
      );
      if (result && result.success) {
        wx.showToast({ title: '入库成功', icon: 'success' });
        this.closeStockInModal();
        this.loadRecords();
      } else {
        const err = (result && result.error) || '入库失败';
        wx.showToast({ title: err, icon: 'none' });
        this.setData({ modalSubmitting: false });
        if (err.includes('配件不存在')) {
          setTimeout(() => {
            this.closeStockInModal();
            this.loadRecords();
          }, 1200);
        }
      }
    } catch (e) {
      console.error('[StockIn] submitStockIn error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ modalSubmitting: false });
    }
  },

  // ===== 入库记录 =====
  async loadRecords(append = false) {
    if (!append) {
      this.setData({ inLoading: true, inPage: 1 });
    }
    try {
      const result = await materialService.listRecords('in', this.data.inPage);
      const records = (result.records || []).map(r => ({
        ...r,
        timeText: formatDateTime(r.created_at),
      }));
      this.setData({
        inRecords: append ? [...this.data.inRecords, ...records] : records,
        inTotal: result.total,
        inLoading: false,
        inLoadingMore: false,
      });
    } catch (e) {
      console.error('[StockIn] Load records error:', e);
      this.setData({ inLoading: false, inLoadingMore: false });
    }
  },

  onLoadMoreRecords() {
    if (this.data.activeSubTab !== 0) return;
    if (this.data.inLoadingMore || this.data.inRecords.length >= this.data.inTotal) return;
    this.setData({ inLoadingMore: true, inPage: this.data.inPage + 1 });
    this.loadRecords(true);
  },

  goToRecordDetail(e) {
    const record = e.currentTarget.dataset.record;
    wx.navigateTo({
      url: `/pages/material/record-detail/index?data=${encodeURIComponent(JSON.stringify(record))}`,
    });
  },

  // ===== 分类管理 =====
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
      console.error('[StockIn] loadCategories error:', e);
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
      console.error('[StockIn] seedCategories error:', e);
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
        if (label === item.label) return;
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
    this.setData({ categoryItems: items });
    try {
      const result = await dictionaryAdmin.updateDictionary('material_category', items);
      if (result && result.success) {
        dictionary.refreshCache('material_category');
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        this.setData({ categoryItems: prev });
        wx.showToast({ title: (result && result.error) || '保存失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[StockIn] saveCategoryItems error:', e);
      this.setData({ categoryItems: prev });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  onMaterialTap(e) {
    const material = e.detail.material;
    wx.navigateTo({ url: `/pages/material/detail/index?id=${material.material_id}` });
  },

  onAddMaterialTap() {
    wx.navigateTo({ url: '/pages/material/add/index' });
  },
});
