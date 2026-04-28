/**
 * 商品（耗品）管理页面
 * 单一列表 + 搜索/筛选/CRUD（由 product-list 组件承载）
 */

const { ROLES, STORAGE_KEYS } = require('../../utils/constants');

Page({
  data: {
    canManage: false,
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
      return;
    }
    const list = this.selectComponent('#productList');
    if (list) list.reload();
  },

  onPullDownRefresh() {
    const list = this.selectComponent('#productList');
    if (list) list.reload();
    setTimeout(() => wx.stopPullDownRefresh(), 300);
  },

  onProductTap(e) {
    const product = e.detail.product;
    wx.navigateTo({ url: `/pages/product/detail/index?id=${product.product_id}` });
  },

  onAddProductTap() {
    wx.navigateTo({ url: '/pages/product/add/index' });
  },
});
