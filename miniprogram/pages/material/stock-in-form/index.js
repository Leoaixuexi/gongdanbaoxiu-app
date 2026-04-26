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
    const qty = parseInt(this.data.quantity, 10);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    if (qty > 999999) {
      wx.showToast({ title: '数量不能超过 999999', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const result = await materialService.stockIn(
        this.data.material_id,
        qty,
        this.data.remark || ''
      );
      if (result && result.success) {
        wx.showToast({ title: '入库成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      } else {
        const err = (result && result.error) || '入库失败';
        wx.showToast({ title: err, icon: 'none' });
        // 商品不存在 → 该商品在扫码后被删，回退列表刷新
        if (err.includes('配件不存在')) {
          setTimeout(() => wx.navigateBack(), 1200);
        }
        this.setData({ submitting: false });
      }
    } catch (e) {
      console.error('[StockInForm] submit error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
