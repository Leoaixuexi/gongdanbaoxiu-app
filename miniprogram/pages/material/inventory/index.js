const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, ROLES } = require('../../../utils/constants');
const { getNavBarInfo } = require('../../../utils/navigation');

const STATUS_TEXT = { warning: '预警', empty: '缺货', normal: '正常' };

function statusOf(m) {
  const stock = Number(m.stock) || 0;
  const min = Number(m.min_stock) || 0;
  if (stock === 0) return 'empty';
  if (stock <= min) return 'warning';
  return 'normal';
}

function fmtMD(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
}

function latestLabel(m) {
  const inDate = m.last_in_date ? new Date(m.last_in_date).getTime() : 0;
  const outDate = m.last_out_date ? new Date(m.last_out_date).getTime() : 0;
  if (!inDate && !outDate) return '';
  if (outDate > inDate) return `出库 ${fmtMD(m.last_out_date)}`;
  return `入库 ${fmtMD(m.last_in_date)}`;
}

function decorate(materials) {
  return materials.map(m => {
    const s = statusOf(m);
    return {
      ...m,
      _status: s,
      _statusText: STATUS_TEXT[s] || '',
      _latestLabel: latestLabel(m),
    };
  });
}

Page({
  data: {
    headerHeight: 0,
    activeStatus: 'all',
    keyword: '',
    statusCounts: { all: 0, warning: 0, empty: 0, normal: 0 },
    materials: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: true,
    loadingMore: false,
  },

  onLoad() {
    const { headerHeight } = getNavBarInfo();
    this.setData({ headerHeight: Math.ceil(headerHeight) });
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    const canAccess = userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF, ROLES.WAREHOUSE_KEEPER].includes(userInfo.role_id);
    if (!canAccess) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadList(true);
  },

  onShow() {
    if (this._needsReload) {
      this._needsReload = false;
      this.loadList(true);
    }
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.materials.length < this.data.total && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  async loadList(reset = false) {
    if (reset) {
      this.setData({ loading: true, page: 1, materials: [] });
    }
    const res = await materialService.getInventoryList({
      status: this.data.activeStatus,
      keyword: this.data.keyword,
      page: this.data.page,
      pageSize: this.data.pageSize,
    });
    if (res && res.success) {
      this.setData({
        materials: decorate(res.materials || []),
        statusCounts: res.statusCounts || { all: 0, warning: 0, empty: 0, normal: 0 },
        total: res.total || 0,
        loading: false,
      });
    } else {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    this.setData({ loadingMore: true, page: this.data.page + 1 });
    const res = await materialService.getInventoryList({
      status: this.data.activeStatus,
      keyword: this.data.keyword,
      page: this.data.page,
      pageSize: this.data.pageSize,
    });
    if (res && res.success) {
      this.setData({
        materials: this.data.materials.concat(decorate(res.materials || [])),
        loadingMore: false,
      });
    } else {
      this.setData({ loadingMore: false });
    }
  },

  onStatusTap(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.activeStatus) return;
    this.setData({ activeStatus: status });
    this.loadList(true);
  },

  onKeywordChange(e) {
    this.setData({ keyword: e.detail || '' });
  },
  onKeywordConfirm() {
    this.loadList(true);
  },
  onKeywordClear() {
    this.setData({ keyword: '' });
    this.loadList(true);
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    this._needsReload = true;
    wx.navigateTo({ url: `/pages/material/inventory-detail/index?id=${id}` });
  },
});
