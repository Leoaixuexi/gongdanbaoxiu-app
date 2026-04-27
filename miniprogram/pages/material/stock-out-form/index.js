const dictionary = require('../../../services/dictionary');
const dictionaryAdmin = require('../../../services/dictionaryAdmin');

const DEFAULT_REGIONS = [
  '办公区', '会议室', '接待区', '茶水间', '卫生间',
  '餐厅', '前台', '电梯间', '楼梯间', '储物间',
  '室外公共区', '通用',
];
const DEFAULT_SCENES = [
  '日常办公', '会议接待', '客户接待', '卫生清洁',
  '设备维护', '活动布置', '突发事件', '其他',
];

Page({
  data: {
    form: {
      material_id: 0,
      material_name: '',
      material_number: '',
      spec: '',
      unit: '',
      current_stock: 0,
      requested_quantity: '',
      region: '',
      scene: '',
      remark: '',
    },
    regionOptions: [],
    sceneOptions: [],
    submitting: false,
    canSubmit: false,
  },

  onLoad() {
    this._ensureDicts();
  },

  async _ensureDicts() {
    try {
      const [regionOpts, sceneOpts] = await Promise.all([
        dictionary.getOptionsWithLabel('stock_out_region'),
        dictionary.getOptionsWithLabel('stock_out_scene'),
      ]);
      let regionOptions = regionOpts || [];
      let sceneOptions = sceneOpts || [];

      if (!regionOptions.length) {
        await this._seedDict('stock_out_region', '使用区域', DEFAULT_REGIONS);
        regionOptions = DEFAULT_REGIONS.map((label) => ({ value: label, label }));
      }
      if (!sceneOptions.length) {
        await this._seedDict('stock_out_scene', '使用场景', DEFAULT_SCENES);
        sceneOptions = DEFAULT_SCENES.map((label) => ({ value: label, label }));
      }

      this.setData({ regionOptions, sceneOptions });
    } catch (err) {
      console.error('[stock-out-form] dict load fail', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  async _seedDict(dict_key, dict_name, labels) {
    const items = labels.map((label, i) => ({ value: label, label, sort: i, enabled: true }));
    const res = await dictionaryAdmin.createDictionary({ dict_key, dict_name, items });
    if (!res || !res.success) throw new Error((res && res.error) || 'seed dict fail');
    dictionary.refreshCache(dict_key);
    wx.showToast({ title: '已创建默认选项', icon: 'success' });
  },

  onPickMaterial() {
    // Task 14 实现
    wx.showToast({ title: '物资选择待实现', icon: 'none' });
  },

  onQuantityInput(e) {
    this.setData({ 'form.requested_quantity': e.detail.value }, this._refreshSubmit);
  },

  onRegionChange(e) {
    const opt = this.data.regionOptions[e.detail.value];
    if (opt) this.setData({ 'form.region': opt.label }, this._refreshSubmit);
  },

  onSceneChange(e) {
    const opt = this.data.sceneOptions[e.detail.value];
    if (opt) this.setData({ 'form.scene': opt.label }, this._refreshSubmit);
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value });
  },

  _refreshSubmit() {
    const { form } = this.data;
    const qty = Number(form.requested_quantity);
    const ok = !!form.material_id
      && Number.isInteger(qty) && qty >= 1 && qty <= 999999
      && qty <= form.current_stock
      && !!form.region && !!form.scene;
    this.setData({ canSubmit: ok });
  },

  onSubmit() {
    // Task 14 实现
    wx.showToast({ title: '提交逻辑待实现', icon: 'none' });
  },
});
