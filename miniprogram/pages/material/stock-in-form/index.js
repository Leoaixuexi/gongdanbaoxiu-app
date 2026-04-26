/**
 * 扫码入库 - 轻量补单页
 * Query 入参：material_id, material_name, material_number, current_stock, unit, spec
 */

const materialService = require('../../../services/materialService');

Page({
  data: {
    material_id: 0,
    material_name: '',
    material_number: '',
    current_stock: 0,
    unit: '',
    spec: '',
    quantity: '',
    remark: '',
    submitting: false,
  },

  onLoad(query) {
    const material_id = parseInt(query.material_id, 10);
    if (!material_id) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({
      material_id,
      material_name: decodeURIComponent(query.name || ''),
      material_number: decodeURIComponent(query.number || ''),
      current_stock: parseInt(query.stock || '0', 10),
      unit: decodeURIComponent(query.unit || ''),
      spec: decodeURIComponent(query.spec || ''),
    });
  },

  onQuantityInput(e) {
    this.setData({ quantity: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async onSubmit() {
    // 下一 Task 实现
  },
});
