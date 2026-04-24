/**
 * 配件修改页面
 * 可编辑字段：图片、物品名称、编号、类别、规格、型号、单位、配件来源、使用区域、预警值
 */

const materialService = require('../../../services/materialService');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');
const { smartCompress, COMPRESS_PRESETS } = require('../../../utils/imageUtils');
const { uploadFiles } = require('../../../services/cloudStorage');

const CATEGORIES = ['电气', '水暖', '门窗', '消防', '通用'];
const UNITS = ['个', '根', '箱', '套', '米', '卷'];

Page({
  data: {
    submitting: false,

    form: {
      name: '',
      material_number: '',
      category: '',
      unit: '',
      spec: '',
      model: '',
      source: '',
      usage_area: '',
      min_stock: '',
    },

    photos: ['', '', ''],
    categoryIndex: -1,
    unitIndex: -1,
    categories: CATEGORIES,
    units: UNITS,
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || ![ROLES.ADMIN, ROLES.PROPERTY_MANAGER].includes(userInfo.role_id)) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    if (options.id) {
      this._materialId = Number(options.id);
      this._loadMaterial();
    }
  },

  async _loadMaterial() {
    wx.showLoading({ title: '加载中' });
    try {
      const result = await materialService.listMaterials('', 1, 100);
      const material = (result.materials || []).find(m => m.material_id === this._materialId);
      if (!material) {
        wx.showToast({ title: '配件不存在', icon: 'none' });
        wx.navigateBack();
        return;
      }

      // 回填图片：已有云图放入 photos 数组，空位补 ''
      const existingPhotos = (material.images || []).slice(0, 3);
      const photos = ['', '', ''];
      existingPhotos.forEach((url, i) => { photos[i] = url; });

      // 回填 picker 的选中索引
      const categoryIndex = CATEGORIES.indexOf(material.category);
      const unitIndex = UNITS.indexOf(material.unit);

      this.setData({
        form: {
          name: material.name || '',
          material_number: material.material_number || '',
          category: material.category || '',
          unit: material.unit || '',
          spec: material.spec || '',
          model: material.model || '',
          source: material.source || '',
          usage_area: material.usage_area || '',
          min_stock: material.min_stock != null ? String(material.min_stock) : '',
        },
        photos,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
        unitIndex: unitIndex >= 0 ? unitIndex : 0,
      });
    } catch (e) {
      console.error('[MaterialEdit] Load error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    wx.hideLoading();
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onCategoryChange(e) {
    const index = Number(e.detail.value);
    this.setData({ 'form.category': CATEGORIES[index], categoryIndex: index });
  },

  onUnitChange(e) {
    const index = Number(e.detail.value);
    this.setData({ 'form.unit': UNITS[index], unitIndex: index });
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

    const { name, category, unit } = this.data.form;
    if (!name) {
      wx.showToast({ title: '请输入物品名称', icon: 'none' });
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
      // 处理图片：本地路径上传，云 URL 直接保留
      const imageUrls = [];
      for (const p of this.data.photos.filter(p => p)) {
        if (p.startsWith('cloud://') || p.startsWith('https://')) {
          imageUrls.push(p);
        } else {
          wx.showLoading({ title: '上传图片中...', mask: true });
          const [res] = await uploadFiles([p], 'material');
          wx.hideLoading();
          imageUrls.push(res.fileID);
        }
      }

      const { form } = this.data;
      await materialService.updateMaterial({
        material_id: this._materialId,
        name: form.name,
        material_number: form.material_number,
        category: form.category,
        unit: form.unit,
        spec: form.spec,
        model: form.model,
        source: form.source,
        usage_area: form.usage_area,
        min_stock: Number(form.min_stock) || 0,
        images: imageUrls,
      });

      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1500);

    } catch (e) {
      wx.hideLoading();
      console.error('[MaterialEdit] Submit error:', e);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
