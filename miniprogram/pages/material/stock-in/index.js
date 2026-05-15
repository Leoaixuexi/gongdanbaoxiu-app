/**
 * 入库管理（独立页）
 * 子页签：入库记录 / 分类管理 + 右下角 FAB（直接扫码）
 * 入口：首页 Tab2 耗品管理 → 宫格"入库管理"
 *
 * 数据域：商品（耗品）— products 集合 + product_records + product_category/location 字典
 * 与维修域 materials 完全隔离
 */

const productService = require('../../../services/productService');
const dictionaryAdmin = require('../../../services/dictionaryAdmin');
const dictionary = require('../../../services/dictionary');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

const DEFAULT_PRODUCT_CATEGORIES = [
  '办公耗品', '清洁用品', '日用百货',
  '食品饮料', '五金杂货', '通用',
];

function formatDateTime(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatRecordNumber(recordId) {
  if (!recordId) return '-';
  return `RK${String(recordId).padStart(8, '0')}`;
}

Page({
  data: {
    activeSubTab: 0,                       // 0 入库记录 / 1 分类管理
    subTabs: ['入库记录', '分类管理'],
    canManage: false,

    // 入库记录
    inRecords: [],
    inLoading: true,
    inLoadingMore: false,
    inPage: 1,
    inTotal: 0,

    // 分类管理（product_category 字典）
    categoriesLoading: false,
    categoryItems: [],
    categoriesLoaded: false,
  },

  onLoad() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
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
      this._ensureCategoriesLoaded();
    }
  },

  // ===== FAB：进入自定义扫码页 =====
  directScan() {
    const self = this;
    wx.navigateTo({
      url: '/pages/material/stock-in/scan/index',
      events: {
        onScanResult: (code) => {
          self.handleCodeRecognized(code);
        },
      },
    });
  },

  // ===== 从扫码页拿到 code 后处理：查询商品 + 跳转到新增入库页 =====
  async handleCodeRecognized(rawCode) {
    const code = (rawCode || '').trim();
    if (!code) {
      wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      return;
    }

    let result;
    try {
      result = await productService.getProductByCode(code);
    } catch (e) {
      console.error('[StockIn] scan lookup error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      return;
    }

    if (!result || !result.success) {
      wx.showToast({ title: (result && result.error) || '查询失败', icon: 'none' });
      return;
    }

    if (!result.product) {
      wx.showModal({
        title: '未识别到该商品',
        content: `条码「${code}」尚未在商品管理中登记，是否前往新增？`,
        cancelText: '取消',
        confirmText: '去新增',
        confirmColor: '#2563EB',
        success: (modalRes) => {
          if (modalRes.confirm) {
            wx.navigateTo({
              url: `/pages/product/add/index?product_code=${encodeURIComponent(code)}`,
            });
          }
        },
      });
      return;
    }

    // 跳转到新增入库全屏页，通过 EventChannel 传递 product
    const product = result.product;
    wx.navigateTo({
      url: '/pages/material/stock-in/add/index',
      success: (res) => {
        if (res && res.eventChannel && typeof res.eventChannel.emit === 'function') {
          res.eventChannel.emit('acceptProduct', product);
        }
      },
    });
  },

  // ===== 入库记录 =====
  async loadRecords(append = false) {
    if (!append) {
      this.setData({ inLoading: true, inPage: 1 });
    }
    try {
      const result = await productService.listRecords('in', this.data.inPage);
      const records = (result.records || []).map(r => ({
        ...r,
        timeText: formatDateTime(r.created_at),
        recordNumber: formatRecordNumber(r.record_id),
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
    // record-detail 页仍用 material_* 字段名展示，桥接 product_* → material_* 复用旧页
    const bridged = {
      ...record,
      material_name: record.product_name || record.material_name || '',
      material_number: record.product_code || record.material_number || '',
      material_image: record.product_image || record.material_image || '',
    };
    wx.navigateTo({
      url: `/pages/material/record-detail/index?data=${encodeURIComponent(JSON.stringify(bridged))}`,
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
      const result = await dictionaryAdmin.getDictionary('product_category');
      if (result && result.success && result.data) {
        const items = (result.data.items || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this.setData({
          categoryItems: items,
          categoriesLoading: false,
          categoriesLoaded: true,
        });
        return;
      }
      if (result && !result.success && (result.error || '').includes('不存在')) {
        await this.seedCategories();
        return;
      }
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ categoriesLoading: false });
    } catch (e) {
      console.error('[StockIn] loadCategories error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ categoriesLoading: false });
    }
  },

  async seedCategories() {
    const items = DEFAULT_PRODUCT_CATEGORIES.map((label, idx) => ({
      value: label,
      label,
      sort: idx,
      enabled: true,
    }));
    try {
      const result = await dictionaryAdmin.createDictionary({
        dict_key: 'product_category',
        dict_name: '商品分类',
        description: '新品入库的商品分类',
        items,
      });
      if (result && result.success) {
        wx.showToast({ title: '已创建默认分类', icon: 'success' });
        dictionary.refreshCache('product_category');
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
    this._openCategoryEditor({ mode: 'create' });
  },

  onRenameCategoryTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.categoryItems[index];
    if (!item) return;
    this._openCategoryEditor({ mode: 'edit', value: item.value });
  },

  _openCategoryEditor({ mode, value }) {
    const self = this;
    const items = this.data.categoryItems;
    const params = ['mode=' + mode];
    if (value) params.push('value=' + encodeURIComponent(value));
    wx.navigateTo({
      url: '/pages/material/stock-in/category-edit/index?' + params.join('&'),
      events: {
        onSaved: ({ items: nextItems }) => {
          if (Array.isArray(nextItems)) {
            self.setData({ categoryItems: nextItems });
          } else {
            self.loadCategories();
          }
        },
      },
      success: (res) => {
        if (res && res.eventChannel && typeof res.eventChannel.emit === 'function') {
          res.eventChannel.emit('acceptItems', { items });
        }
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
      const result = await dictionaryAdmin.updateDictionary('product_category', items);
      if (result && result.success) {
        dictionary.refreshCache('product_category');
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
});
