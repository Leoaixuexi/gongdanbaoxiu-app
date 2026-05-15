/**
 * 新增入库（扫码后的入库登记页）— 全屏页，替代旧的 modal sheet
 *
 * 来源：stock-in 页扫码识别成功后 navigateTo 进入，
 * 通过 EventChannel 'acceptProduct' 接收 product 对象。
 *
 * 提交：复用 productService.stockIn(product_id, qty, remark, location)
 * 重新扫描：navigateBack 到 stock-in 页并触发其 directScan
 */
const productService = require('../../../../services/productService');
const dictionaryAdmin = require('../../../../services/dictionaryAdmin');
const dictionary = require('../../../../services/dictionary');
const { STORAGE_KEYS } = require('../../../../utils/constants');

const DEFAULT_PRODUCT_LOCATIONS = [
  '主仓库', '应急储备', '工程仓',
  '办公耗材区', '外采暂存', '其它',
];

function formatStockInTime(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

Page({
  data: {
    statusBarHeight: 20,
    product: {},
    quantity: 1,
    remark: '',
    submitting: false,

    locationOptions: [],
    locationIndex: -1,
    locationLabel: '',

    operatorName: '',
    stockInTimeText: '',
  },

  onLoad() {
    try {
      const sys = wx.getSystemInfoSync();
      this.setData({ statusBarHeight: sys.statusBarHeight || 20 });
    } catch (e) {
      // 忽略，用默认值
    }
    this.setData({
      stockInTimeText: formatStockInTime(new Date()),
    });
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    this.setData({ operatorName: userInfo.name || '当前用户' });

    const ec = this.getOpenerEventChannel();
    if (ec && typeof ec.on === 'function') {
      ec.on('acceptProduct', (product) => {
        this._applyProduct(product);
      });
    }

    this._loadLocationOptions();
  },

  onBack() {
    wx.navigateBack();
  },

  _applyProduct(product) {
    const safeProduct = product || {};
    this.setData({ product: safeProduct });
    // 商品的常用位置预选
    this._maybeSelectDefaultLocation(safeProduct.usage_area);
  },

  _maybeSelectDefaultLocation(value) {
    if (!value || !this.data.locationOptions.length) return;
    const idx = this.data.locationOptions.findIndex(o => o.value === value);
    if (idx >= 0) {
      this.setData({
        locationIndex: idx,
        locationLabel: this.data.locationOptions[idx].label,
      });
    }
  },

  async _loadLocationOptions() {
    try {
      const result = await dictionaryAdmin.getDictionary('product_location');
      if (result && result.success && result.data) {
        const items = (result.data.items || [])
          .filter(i => i.enabled !== false)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .map(i => ({ value: i.value, label: i.label || i.value }));
        this.setData({ locationOptions: items });
        // 应用商品默认位置
        this._maybeSelectDefaultLocation(this.data.product.usage_area);
        return;
      }
      if (result && !result.success && (result.error || '').includes('不存在')) {
        await this._seedLocations();
        return;
      }
      wx.showToast({ title: '位置数据加载失败', icon: 'none' });
    } catch (e) {
      console.error('[AddStockIn] loadLocationOptions error:', e);
      wx.showToast({ title: '位置数据加载失败', icon: 'none' });
    }
  },

  async _seedLocations() {
    const items = DEFAULT_PRODUCT_LOCATIONS.map((label, idx) => ({
      value: label,
      label,
      sort: idx,
      enabled: true,
    }));
    try {
      const result = await dictionaryAdmin.createDictionary({
        dict_key: 'product_location',
        dict_name: '商品位置',
        description: '入库时的位置选项',
        items,
      });
      if (result && result.success) {
        wx.showToast({ title: '已创建默认位置', icon: 'success' });
        dictionary.refreshCache('product_location');
        this.setData({
          locationOptions: items.map(i => ({ value: i.value, label: i.label })),
        });
        this._maybeSelectDefaultLocation(this.data.product.usage_area);
      } else {
        wx.showToast({ title: (result && result.error) || '初始化位置失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[AddStockIn] seedLocations error:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  // ===== 数量 stepper =====
  onQtyMinus() {
    const next = Math.max(1, this.data.quantity - 1);
    this.setData({ quantity: next });
  },

  onQtyPlus() {
    const next = Math.min(999999, this.data.quantity + 1);
    this.setData({ quantity: next });
  },

  onQtyTapEdit() {
    wx.showModal({
      title: '输入入库数量',
      editable: true,
      placeholderText: '1 ~ 999999',
      content: String(this.data.quantity || ''),
      success: (res) => {
        if (!res.confirm) return;
        const n = parseInt(res.content, 10);
        if (!n || n <= 0) {
          wx.showToast({ title: '请输入有效数量', icon: 'none' });
          return;
        }
        if (n > 999999) {
          wx.showToast({ title: '数量不能超过 999999', icon: 'none' });
          return;
        }
        this.setData({ quantity: n });
      },
    });
  },

  // ===== 入库位置 =====
  onLocationChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const opt = this.data.locationOptions[idx];
    if (!opt) return;
    this.setData({
      locationIndex: idx,
      locationLabel: opt.label,
    });
  },

  // ===== 备注 =====
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  // ===== 重新扫描 =====
  onRescan() {
    const pages = getCurrentPages();
    const prev = pages.length >= 2 ? pages[pages.length - 2] : null;
    wx.navigateBack({
      success: () => {
        if (prev && typeof prev.directScan === 'function') {
          prev.directScan();
        }
      },
    });
  },

  // ===== 提交 =====
  async onSubmit() {
    if (this.data.submitting) return;

    const qty = parseInt(this.data.quantity, 10);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    if (qty > 999999) {
      wx.showToast({ title: '数量不能超过 999999', icon: 'none' });
      return;
    }
    if (this.data.locationIndex < 0 || !this.data.locationOptions[this.data.locationIndex]) {
      wx.showToast({ title: '请选择入库位置', icon: 'none' });
      return;
    }
    if (!this.data.product || !this.data.product.product_id) {
      wx.showToast({ title: '商品数据缺失', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const location = this.data.locationOptions[this.data.locationIndex].value;
      const result = await productService.stockIn(
        this.data.product.product_id,
        qty,
        this.data.remark || '',
        location
      );
      if (result && result.success) {
        wx.showToast({ title: '入库成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      } else {
        const err = (result && result.error) || '入库失败';
        wx.showToast({ title: err, icon: 'none' });
        this.setData({ submitting: false });
        if (err.includes('商品不存在')) {
          setTimeout(() => wx.navigateBack(), 1200);
        }
      }
    } catch (e) {
      console.error('[AddStockIn] submit error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
