/**
 * 配件详情页
 */
const materialService = require('../../../services/materialService');
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
    material: {},
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
    // 从编辑页返回后刷新数据
    if (this._materialId) {
      this.loadDetail();
    }
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    this.setData({
      canManage: userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER].includes(userInfo.role_id)
    });

    if (options.id) {
      this._materialId = Number(options.id);
      this.loadDetail();
    }
  },

  async loadDetail() {
    wx.showLoading({ title: '加载中' });
    try {
      const result = await materialService.listMaterials('', 1, 100);
      const material = (result.materials || []).find(m => m.material_id === this._materialId);
      if (material) {
        let stockStatus = 'ok';
        let stockStatusText = '正常';
        if (material.min_stock > 0) {
          if (material.stock === 0) {
            stockStatus = 'danger';
            stockStatusText = '缺货';
          } else if (material.stock <= material.min_stock) {
            stockStatus = 'warning';
            stockStatusText = '预警';
          }
        }
        this.setData({ material, stockStatus, stockStatusText });
        // 并行加载累计统计 + 出入库记录
        materialService.getMaterialStats(this._materialId).then(res => {
          if (res && res.success) {
            this.setData({ totalIn: res.total_in, totalOut: res.total_out });
          }
        });
        materialService.getMaterialRecords(this._materialId).then(res => {
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
      console.error('[MaterialDetail] Load error:', e);
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
    wx.navigateTo({ url: `/pages/material/edit/index?id=${this._materialId}` });
  },

  async handleDelete() {
    this.setData({ showMoreActions: false });
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '删除后无法恢复，确定要删除该配件吗？',
        confirmText: '删除',
        confirmColor: '#EF4444',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;
    try {
      await materialService.deleteMaterial(this._materialId);
      wx.showToast({ title: '删除成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      console.error('[MaterialDetail] Delete error:', e);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.material.images || [url]
    });
  },


});
