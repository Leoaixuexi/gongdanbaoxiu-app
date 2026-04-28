const stockOutService = require('../../../services/stockOutService');
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

    showPicker: false,
    pickerKeyword: '',
    pickerList: [],
    pickerLoading: false,
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
        regionOptions = DEFAULT_REGIONS.map(label => ({ value: label, label }));
      }
      if (!sceneOptions.length) {
        await this._seedDict('stock_out_scene', '使用场景', DEFAULT_SCENES);
        sceneOptions = DEFAULT_SCENES.map(label => ({ value: label, label }));
      }

      this.setData({ regionOptions, sceneOptions });
    } catch (err) {
      console.error('[stock-out/form] dict load fail', err);
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

  // ===== 物资选择 =====
  onPickMaterial() {
    this.setData({ showPicker: true, pickerKeyword: '' });
    this._loadPickerList('');
  },

  onClosePicker() {
    this.setData({ showPicker: false });
  },

  onPickerSearchInput(e) {
    this.setData({ pickerKeyword: e.detail.value });
  },

  async onPickerSearch() {
    await this._loadPickerList(this.data.pickerKeyword);
  },

  async _loadPickerList(keyword) {
    this.setData({ pickerLoading: true });
    const res = await stockOutService.listMaterials(keyword || '', 1, 50);
    this.setData({
      pickerList: (res && res.success) ? res.materials : [],
      pickerLoading: false,
    });
  },

  onSelectMaterial(e) {
    const m = e.currentTarget.dataset.mat;
    if (!m || m.stock <= 0) {
      wx.showToast({ title: '库存为 0，无法申请', icon: 'none' });
      return;
    }
    this.setData({
      'form.material_id': m.material_id,
      'form.material_name': m.name,
      'form.material_number': m.material_number || '',
      'form.spec': m.spec || '',
      'form.unit': m.unit || '',
      'form.current_stock': m.stock,
      showPicker: false,
    }, this._refreshSubmit);
  },

  // ===== 表单字段 =====
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

  // ===== 提交 =====
  async onSubmit() {
    if (!this.data.canSubmit || this.data.submitting) return;

    const { form } = this.data;
    const qty = Number(form.requested_quantity);

    if (qty > form.current_stock) {
      wx.showToast({ title: `库存仅 ${form.current_stock}，请减少申请量`, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const res = await stockOutService.createStockOutRequest({
      material_id: form.material_id,
      requested_quantity: qty,
      region: form.region,
      scene: form.scene,
      remark: form.remark || '',
    });
    this.setData({ submitting: false });

    if (res && res.success) {
      wx.showToast({ title: '已提交', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    }
  },
});
