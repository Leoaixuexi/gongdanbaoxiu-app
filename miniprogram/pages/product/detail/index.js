/**
 * 商品（耗品）详情页
 */
const productService = require('../../../services/productService');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

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

Page({
  data: {
    product: {},
    canManage: false,
    stockStatus: 'ok',
    stockStatusText: '正常',
    totalIn: 0,
    totalOut: 0,
    inRecords: [],
    outRecords: [],
    showMoreActions: false,
  },

  onShow() {
    if (this._productId) {
      this.loadDetail();
    }
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    this.setData({
      canManage: userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id)
    });

    if (options.id) {
      this._productId = Number(options.id);
      this.loadDetail();
    }
  },

  async loadDetail() {
    wx.showLoading({ title: '加载中' });
    try {
      const result = await productService.listProducts('', 1, 100);
      const product = (result.products || []).find(p => p.product_id === this._productId);
      if (product) {
        let stockStatus = 'ok';
        let stockStatusText = '正常';
        if (product.min_stock > 0) {
          if (product.stock === 0) {
            stockStatus = 'danger';
            stockStatusText = '缺货';
          } else if (product.stock <= product.min_stock) {
            stockStatus = 'warning';
            stockStatusText = '预警';
          }
        }
        this.setData({ product, stockStatus, stockStatusText });
        productService.getProductStats(this._productId).then(res => {
          if (res && res.success) {
            this.setData({ totalIn: res.total_in, totalOut: res.total_out });
          }
        });
        productService.getProductRecords(this._productId).then(res => {
          if (res && res.success) {
            const records = (res.records || []).map(r => ({
              ...r,
              timeText: formatTime(r.created_at)
            }));
            this.setData({
              inRecords: records.filter(r => r.type === 'in'),
              outRecords: records.filter(r => r.type === 'out'),
            });
          }
        });
      }
    } catch (e) {
      console.error('[ProductDetail] Load error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    wx.hideLoading();
  },

  handleMore() {
    this.setData({ showMoreActions: true });
  },

  closeMoreActions() {
    this.setData({ showMoreActions: false });
  },

  stopPropagation() {},

  handleEdit() {
    wx.navigateTo({ url: `/pages/product/edit/index?id=${this._productId}` });
  },

  async handleDelete() {
    this.setData({ showMoreActions: false });
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，确定要删除该商品吗？',
        confirmText: '删除',
        confirmColor: '#EF4444',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;
    try {
      await productService.deleteProduct(this._productId);
      wx.showToast({ title: '删除成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      console.error('[ProductDetail] Delete error:', e);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.product.images || [url]
    });
  },
});
