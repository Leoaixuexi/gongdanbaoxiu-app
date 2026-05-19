/**
 * 物料管理页面
 * Tab：配件列表 / 出库记录
 * 注：入库管理已拆分到独立页 pages/material/stock-in
 */

const materialService = require('../../services/materialService');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');
const { getNavBarInfo } = require('../../utils/navigation');

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
    headerHeight: 0,
    activeTab: 0,
    tabs: ['配件列表', '入库记录', '出库记录'],
    canManage: false,

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
  },

  onLoad() {
    const { headerHeight } = getNavBarInfo();
    this.setData({ headerHeight: Math.ceil(headerHeight) });
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
      return;
    }
    if (this.data.activeTab === 0) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
      if (this._tabLoaded[1]) this.loadRecords('in');
      if (this._tabLoaded[2]) this.loadRecords('out');
    }
  },

  onPullDownRefresh() {
    if (this.data.activeTab === 0) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
      setTimeout(() => wx.stopPullDownRefresh(), 300);
    } else if (this.data.activeTab === 1) {
      this.loadRecords('in').then(() => wx.stopPullDownRefresh());
    } else if (this.data.activeTab === 2) {
      this.loadRecords('out').then(() => wx.stopPullDownRefresh());
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

    if (index === 1) this.loadRecords('in');
    if (index === 2) this.loadRecords('out');
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
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
      this.loadRecords('out');
    } catch (e) {
      // callCloud 已处理错误提示
    }
  },
});
