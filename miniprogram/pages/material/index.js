/**
 * 物料管理页面
 * Tab：配件列表 / 出库管理
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
    tabs: ['配件列表', '出库管理'],
    canManage: false,
    canFab: false,

    // sub[1] 出库记录（原 outRecords 字段保留）
    outRecords: [],
    outLoading: true,
    outLoadingMore: false,
    outPage: 1,
    outTotal: 0,

    // Tab2 出库管理 sub-tabs
    outActiveSubTab: 0,           // 0 出库申请 / 1 出库记录
    outSubTabs: ['出库申请', '出库记录'],

    // sub[0] 出库申请列表
    requests: [],
    requestsLoading: true,
    requestsLoadingMore: false,
    requestsPage: 1,
    requestsTotal: 0,

    // sub[1] 出库记录筛选
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
    this._refreshFab();
  },

  onShow() {
    if (!this._tabLoaded) {
      this._tabLoaded = { 0: true };
      return;
    }
    if (this.data.activeTab === 0) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
    } else if (this.data.activeTab === 1) {
      if (this.data.outActiveSubTab === 0) this._loadRequests(true);
      else if (this.data.outActiveSubTab === 1) this._loadOutRecords(true);
    }
  },

  onPullDownRefresh() {
    if (this.data.activeTab === 0) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
      setTimeout(() => wx.stopPullDownRefresh(), 300);
    } else if (this.data.activeTab === 1) {
      if (this.data.outActiveSubTab === 0) {
        this._loadRequests(true).then(() => wx.stopPullDownRefresh());
      } else {
        this._loadOutRecords(true).then(() => wx.stopPullDownRefresh());
      }
    } else {
      wx.stopPullDownRefresh();
    }
  },

  // ===== Tab 切换 =====
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeTab: index });
    this._ensureTabLoaded(index);
    this._refreshFab();
  },

  onSwiperChange(e) {
    const index = e.detail.current;
    this.setData({ activeTab: index });
    this._ensureTabLoaded(index);
    this._refreshFab();
  },

  _ensureTabLoaded(index) {
    if (this._tabLoaded && this._tabLoaded[index]) return;
    if (!this._tabLoaded) this._tabLoaded = {};
    this._tabLoaded[index] = true;

    if (index === 1) {
      // 进入出库管理 Tab，按当前 sub 加载
      if (this.data.outActiveSubTab === 0) this._loadRequests(true);
      else this._loadOutRecords(true);
    }
    // index 0 配件列表由组件自加载，无需 page 处理
  },

  // ===== material-list 组件事件 =====
  onMaterialTap(e) {
    const material = e.detail.material;
    wx.navigateTo({ url: `/pages/material/detail/index?id=${material.material_id}` });
  },

  onAddMaterialTap() {
    wx.navigateTo({ url: '/pages/material/add/index' });
  },

  // ===== sub-tabs 切换 =====
  onOutSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    this.setData({ outActiveSubTab: sub }, () => {
      this._refreshFab();
      if (sub === 0) this._loadRequests(true);
      else if (sub === 1) this._loadOutRecords(true);
    });
  },

  // ===== FAB 显隐 =====
  _refreshFab() {
    const { activeTab, outActiveSubTab, canManage } = this.data;
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const canRequest = userInfo && [1, 2, 4, 5].includes(userInfo.role_id);

    let canFab = false;
    if (activeTab === 0) {
      canFab = canManage;                              // 配件列表 → 新增配件
    } else if (activeTab === 1 && outActiveSubTab === 0) {
      canFab = canRequest;                             // 出库管理 sub[0] → 跳 stock-out-form
    }
    this.setData({ canFab });
  },

  onFabTap() {
    if (this.data.activeTab === 0) {
      wx.navigateTo({ url: '/pages/material/add/index' });
    } else if (this.data.activeTab === 1 && this.data.outActiveSubTab === 0) {
      wx.navigateTo({ url: '/pages/material/stock-out-form/index' });
    }
  },

  // ===== sub[0] 出库申请 =====
  _decorateRequest(req) {
    const { STOCK_OUT_STATUS_DISPLAY_NAMES } = require('../../utils/constants');
    return {
      ...req,
      timeText: formatDateTime(req.created_at),
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

    // sub[0] 默认筛选：办美看自己全状态；其他角色看 Pending
    if (userInfo.role_id !== 4) {
      params.status = 'Pending';
    }

    const res = await materialService.listStockOutRequests(params);
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

  goToRequestDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/material/stock-out-detail/index?request_id=${id}` });
  },

  // ===== sub[1] 出库记录（用 listStockOutRequests 拉历史完结单）=====
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

    const res = await materialService.listStockOutRequests(params);
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
    // sub[1] 出库记录上拉加载
    if (this.data.outLoadingMore) return;
    if (this.data.outRecords.length >= this.data.outTotal) return;
    this.setData({ outLoadingMore: true, outPage: this.data.outPage + 1 });
    this._loadOutRecords(false);
  },

  // ===== 筛选抽屉 =====
  onOutKeywordInput(e) {
    this.setData({ 'outFilter.keyword': e.detail.value });
  },

  onOutKeywordSearch() {
    this._refreshFilterChips();
    this._loadOutRecords(true);
  },

  onOutFilterTap() {
    this.setData({ showOutFilterDrawer: true });
  },

  onCloseOutFilterDrawer() {
    this.setData({ showOutFilterDrawer: false });
  },

  onFilterStatusToggle(e) {
    const s = e.currentTarget.dataset.s;
    const cur = this.data.outFilter.status || [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : cur.concat(s);
    this.setData({ 'outFilter.status': next });
  },

  onFilterRegionInput(e) {
    this.setData({ 'outFilter.region': e.detail.value });
  },

  onFilterSceneInput(e) {
    this.setData({ 'outFilter.scene': e.detail.value });
  },

  onFilterDateFromChange(e) {
    this.setData({ 'outFilter.date_from': e.detail.value });
  },

  onFilterDateToChange(e) {
    this.setData({ 'outFilter.date_to': e.detail.value });
  },

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
    const { STOCK_OUT_STATUS_DISPLAY_NAMES } = require('../../utils/constants');
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
