/**
 * 商品（耗品）修改页面
 * 可编辑字段：图片、商品名称、编号、类别、规格、型号、单位、采购渠道、采购单价、预警值
 */

const productService = require('../../../services/productService');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');
const { smartCompress, COMPRESS_PRESETS } = require('../../../utils/imageUtils');
const { uploadFiles } = require('../../../services/cloudStorage');

const CATEGORIES = ['办公耗品', '清洁用品', '日用百货', '食品饮料', '通用'];
const UNITS = ['个', '包', '箱', '套', '瓶', '盒'];

Page({
  data: {
    submitting: false,

    form: {
      name: '',
      product_code: '',
      category: '',
      unit: '',
      spec: '',
      model: '',
      source: '',
      purchase_price: '',
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
    if (!userInfo || ![ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id)) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    if (options.id) {
      this._productId = Number(options.id);
      this._loadProduct();
    }
  },

  async _loadProduct() {
    wx.showLoading({ title: '加载中' });
    try {
      const result = await productService.listProducts('', 1, 100);
      const product = (result.products || []).find(p => p.product_id === this._productId);
      if (!product) {
        wx.showToast({ title: '商品不存在', icon: 'none' });
        wx.navigateBack();
        return;
      }

      const existingPhotos = (product.images || []).slice(0, 3);
      const photos = ['', '', ''];
      existingPhotos.forEach((url, i) => { photos[i] = url; });

      const categoryIndex = CATEGORIES.indexOf(product.category);
      const unitIndex = UNITS.indexOf(product.unit);

      this.setData({
        form: {
          name: product.name || '',
          product_code: product.product_code || '',
          category: product.category || '',
          unit: product.unit || '',
          spec: product.spec || '',
          model: product.model || '',
          source: product.source || '',
          purchase_price: product.purchase_price != null ? String(product.purchase_price) : '',
          min_stock: product.min_stock != null ? String(product.min_stock) : '',
        },
        photos,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
        unitIndex: unitIndex >= 0 ? unitIndex : 0,
      });
    } catch (e) {
      console.error('[ProductEdit] Load error:', e);
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
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
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
      const imageUrls = [];
      for (const p of this.data.photos.filter(p => p)) {
        if (p.startsWith('cloud://') || p.startsWith('https://')) {
          imageUrls.push(p);
        } else {
          wx.showLoading({ title: '上传图片中...', mask: true });
          const [res] = await uploadFiles([p], 'product');
          wx.hideLoading();
          imageUrls.push(res.fileID);
        }
      }

      const { form } = this.data;
      await productService.updateProduct({
        product_id: this._productId,
        name: form.name,
        product_code: form.product_code,
        category: form.category,
        unit: form.unit,
        spec: form.spec,
        model: form.model,
        source: form.source,
        purchase_price: Number(form.purchase_price) || 0,
        min_stock: Number(form.min_stock) || 0,
        images: imageUrls,
      });

      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1500);

    } catch (e) {
      wx.hideLoading();
      console.error('[ProductEdit] Submit error:', e);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
