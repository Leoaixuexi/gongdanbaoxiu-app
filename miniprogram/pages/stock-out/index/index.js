const stockOutService = require('../../../services/stockOutService');
const { ROLES, STORAGE_KEYS, STOCK_OUT_STATUS_DISPLAY_NAMES } = require('../../../utils/constants');

function formatTime(d) {
  if (!d) return '';
  const x = new Date(d);
  const now = new Date();
  const hm = `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (x.toDateString() === now.toDateString()) return `今天 ${hm}`;
  if (x.toDateString() === yesterday.toDateString()) return `昨天 ${hm}`;
  return `${x.getMonth() + 1}/${x.getDate()} ${hm}`;
}

Page({
  data: {
    activeSubTab: 0,
    subTabs: ['出库申请', '出库记录'],
    canFab: false,

    // sub[0] 出库申请
    requests: [],
    requestsLoading: true,
    requestsLoadingMore: false,
    requestsPage: 1,
    requestsTotal: 0,

    // sub[1] 出库记录
    outRecords: [],
    outLoading: true,
    outLoadingMore: false,
    outPage: 1,
    outTotal: 0,
    outFilter: {
      status: [],
      region: '',
      scene: '',
      keyword: '',
      date_from: '',
      date_to: '',
    },
    outFilterChips: [],
    showOutFilterDrawer: false,
  },

  onLoad(query) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    // 维修员排除
    const canAccess = userInfo && [1, 2, 4, 5].includes(userInfo.role_id);
    if (!canAccess) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 支持 ?sub= deeplink
    const sub = parseInt(query.sub, 10);
    if (!isNaN(sub) && (sub === 0 || sub === 1)) {
      this.setData({ activeSubTab: sub });
    }

    this._refreshFab();
    this._loadCurrent(true);
  },

  onShow() {
    if (this._tabLoaded) {
      this._loadCurrent(true);
    } else {
      this._tabLoaded = true;
    }
  },

  _loadCurrent(reset = false) {
    if (this.data.activeSubTab === 0) this._loadRequests(reset);
    else this._loadOutRecords(reset);
  },

  _refreshFab() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const canRequest = userInfo && [1, 2, 4, 5].includes(userInfo.role_id);
    this.setData({ canFab: canRequest });
  },

  // ===== sub-tabs 切换 =====
  onSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    if (sub === this.data.activeSubTab) return;
    this.setData({ activeSubTab: sub }, () => {
      this._loadCurrent(true);
    });
  },

  onSwiperChange(e) {
    const sub = e.detail.current;
    if (sub === this.data.activeSubTab) return;
    this.setData({ activeSubTab: sub }, () => {
      this._loadCurrent(true);
    });
  },

  // ===== Tab1 出库申请 =====
  _decorateRequest(req) {
    return {
      ...req,
      timeText: formatTime(req.created_at),
      statusText: STOCK_OUT_STATUS_DISPLAY_NAMES[req.status] || req.status,
    };
  },

  async _loadRequests(reset = false) {
    if (reset) {
      this.setData({ requestsPage: 1, requests: [], requestsLoading: true });
    } else {
      this.setData({ requestsLoadingMore: true });
    }

    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const params = { page: this.data.requestsPage, pageSize: 20 };

    // 默认筛选：办美自己全状态；其他角色看 Pending
    if (userInfo.role_id !== 4) {
      params.status = 'Pending';
    }

    const res = await stockOutService.listStockOutRequests(params);
    if (!res || !res.success) {
      this.setData({ requestsLoading: false, requestsLoadingMore: false });
      return;
    }
    const decorated = (res.requests || []).map(r => this._decorateRequest(r));
    this.setData({
      requests: reset ? decorated : this.data.requests.concat(decorated),
      requestsTotal: res.total,
      requestsLoading: false,
      requestsLoadingMore: false,
    });
  },

  onLoadMoreRequests() {
    if (this.data.requestsLoadingMore) return;
    if (this.data.requests.length >= this.data.requestsTotal) return;
    this.setData({ requestsPage: this.data.requestsPage + 1 });
    this._loadRequests(false);
  },

  // ===== FAB & 跳转 =====
  onFabTap() {
    wx.navigateTo({ url: '/pages/stock-out/form/index' });
  },

  goToRequestDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/stock-out/detail/index?request_id=${id}` });
  },

  // ===== Tab2 出库记录 =====
  async _loadOutRecords(reset = false) {
    if (reset) {
      this.setData({ outPage: 1, outRecords: [], outLoading: true });
    } else {
      this.setData({ outLoadingMore: true });
    }
    const f = this.data.outFilter;
    const params = { page: this.data.outPage, pageSize: 20 };
    const status = f.status && f.status.length ? f.status : ['Approved', 'Rejected', 'Cancelled'];
    params.status = status;
    if (f.region) params.region = f.region;
    if (f.scene) params.scene = f.scene;
    if (f.keyword) params.keyword = f.keyword;
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;

    const res = await stockOutService.listStockOutRequests(params);
    if (!res || !res.success) {
      this.setData({ outLoading: false, outLoadingMore: false });
      return;
    }
    const decorated = (res.requests || []).map(r => this._decorateRequest(r));
    this.setData({
      outRecords: reset ? decorated : this.data.outRecords.concat(decorated),
      outTotal: res.total,
      outLoading: false,
      outLoadingMore: false,
    });
  },

  onLoadMoreRecords() {
    if (this.data.outLoadingMore) return;
    if (this.data.outRecords.length >= this.data.outTotal) return;
    this.setData({ outLoadingMore: true, outPage: this.data.outPage + 1 });
    this._loadOutRecords(false);
  },

  // ===== 筛选抽屉 =====
  onOutKeywordInput(e) { this.setData({ 'outFilter.keyword': e.detail.value }); },
  onOutKeywordSearch() { this._refreshFilterChips(); this._loadOutRecords(true); },
  onOutFilterTap() { this.setData({ showOutFilterDrawer: true }); },
  onCloseOutFilterDrawer() { this.setData({ showOutFilterDrawer: false }); },

  onFilterStatusToggle(e) {
    const s = e.currentTarget.dataset.s;
    const cur = this.data.outFilter.status || [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : cur.concat(s);
    this.setData({ 'outFilter.status': next });
  },
  onFilterRegionInput(e) { this.setData({ 'outFilter.region': e.detail.value }); },
  onFilterSceneInput(e) { this.setData({ 'outFilter.scene': e.detail.value }); },
  onFilterDateFromChange(e) { this.setData({ 'outFilter.date_from': e.detail.value }); },
  onFilterDateToChange(e) { this.setData({ 'outFilter.date_to': e.detail.value }); },

  onApplyOutFilter() {
    this.setData({ showOutFilterDrawer: false });
    this._refreshFilterChips();
    this._loadOutRecords(true);
  },

  onResetOutFilter() {
    this.setData({
      outFilter: { status: [], region: '', scene: '', keyword: '', date_from: '', date_to: '' },
      outFilterChips: [],
    });
    this._loadOutRecords(true);
  },

  _refreshFilterChips() {
    const f = this.data.outFilter;
    const chips = [];
    if (f.keyword) chips.push({ key: 'keyword', label: `关键词:${f.keyword}` });
    if (f.region) chips.push({ key: 'region', label: `区域:${f.region}` });
    if (f.scene) chips.push({ key: 'scene', label: `场景:${f.scene}` });
    if (f.status && f.status.length) {
      chips.push({ key: 'status', label: `状态:${f.status.map(s => STOCK_OUT_STATUS_DISPLAY_NAMES[s]).join(',')}` });
    }
    if (f.date_from) chips.push({ key: 'date_from', label: `从 ${f.date_from}` });
    if (f.date_to) chips.push({ key: 'date_to', label: `到 ${f.date_to}` });
    this.setData({ outFilterChips: chips });
  },

  onRemoveFilterChip(e) {
    const key = e.currentTarget.dataset.key;
    const f = { ...this.data.outFilter };
    if (key === 'status') f.status = [];
    else f[key] = '';
    this.setData({ outFilter: f });
    this._refreshFilterChips();
    this._loadOutRecords(true);
  },
});
