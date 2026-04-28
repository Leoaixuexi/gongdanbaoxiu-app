/**
 * 新增配件页面
 */

const materialService = require('../../../services/materialService');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');
const { smartCompress, COMPRESS_PRESETS } = require('../../../utils/imageUtils');
const { uploadFiles } = require('../../../services/cloudStorage');
const { getNavBarInfo } = require('../../../utils/navigation');
const dictionary = require('../../../services/dictionary');

Page({
  data: {
    headerHeight: 0,
    submitting: false,

    form: {
      material_number: '',
      name: '',
      category: '',
      unit: '',
      spec: '',
      model: '',
      source: '',
      stock_in_time: '',
      quantity: '',
      usage_area: '',
      min_stock: '',
      remark: ''
    },

    photos: ['', '', ''],
    categories: [],
    units: ['个', '根', '箱', '套', '米', '卷']
  },

  async onLoad(query = {}) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || ![ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id)) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight),
      'form.stock_in_time': new Date().toISOString().split('T')[0],
    });

    // 来自扫码失败引导 → prefill 编号
    if (query.material_number) {
      this.setData({
        'form.material_number': decodeURIComponent(query.material_number),
      });
    }

    await this.loadCategories();
  },

  async onShow() {
    dictionary.refreshCache('material_category');
    await this.loadCategories();
  },

  async loadCategories() {
    const options = await dictionary.getOptions('material_category');
    this.setData({
      categories: options || [],
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({ 'form.category': this.data.categories[e.detail.value] });
  },

  onUnitChange(e) {
    this.setData({ 'form.unit': this.data.units[e.detail.value] });
  },

  onDateChange(e) {
    this.setData({ 'form.stock_in_time': e.detail.value });
  },

  onChoosePhoto(e) {
    const index = e.currentTarget.dataset.index;
    wx.chooseImage({
      count: 1,
      sizeType: ['original'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const result = await smartCompress(res.tempFilePaths[0], COMPRESS_PRESETS.WORKORDER);
        const newPhotos = [...this.data.photos];
        newPhotos[index] = result.path;
        this.setData({ photos: newPhotos });
      }
    });
  },

  onPreviewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.photos.filter(p => p);
    if (this.data.photos[index]) {
      wx.previewImage({ current: this.data.photos[index], urls });
    }
  },

  onRemovePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const newPhotos = [...this.data.photos];
    newPhotos[index] = '';
    this.setData({ photos: newPhotos });
  },

  async handleSubmit() {
    if (this.data.submitting) return;

    const { material_number, name, category, unit } = this.data.form;

    if (!name) {
      wx.showToast({ title: '请输入配件名称', icon: 'none' });
      return;
    }
    if (!category) {
      wx.showToast({ title: '请选择类别', icon: 'none' });
      return;
    }
    if (!unit) {
      wx.showToast({ title: '请选择单位', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      let imageUrls = [];
      const localPhotos = this.data.photos.filter(p => p);
      if (localPhotos.length > 0) {
        wx.showLoading({ title: '上传图片中...', mask: true });
        const results = await uploadFiles(localPhotos, 'material');
        imageUrls = results.map(r => r.fileID);
        wx.hideLoading();
      }

      const { form } = this.data;
      await materialService.addMaterial({
        material_number: form.material_number,
        name: form.name,
        category: form.category,
        unit: form.unit,
        spec: form.spec,
        model: form.model,
        source: form.source,
        stock_in_time: form.stock_in_time,
        quantity: Number(form.quantity) || 0,
        usage_area: form.usage_area,
        min_stock: Number(form.min_stock) || 0,
        images: imageUrls,
        remark: form.remark
      });

      wx.showToast({ title: '添加成功', icon: 'success', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1500);

    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '添加失败，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
