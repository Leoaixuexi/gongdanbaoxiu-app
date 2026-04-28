/**
 * Dictionary Items Management Page
 * 字典项管理页面
 */

const dictionaryAdmin = require('../../../services/dictionaryAdmin');

Page({
  behaviors: [require('../../../behaviors/adminPage')],

  data: {
    dictKey: '',
    dictName: '',
    dictionary: null,
    items: [],
    loading: true,
    showEditModal: false,
    editingItem: null,
    editForm: {
      value: '',
      label: '',
      sort: 0,
      enabled: true
    }
  },

  onLoad(options) {
    if (!this.checkAdminPermission()) return;
    if (options.dict_key) {
      this.setData({
        dictKey: options.dict_key,
        dictName: decodeURIComponent(options.dict_name || '')
      });
      wx.setNavigationBarTitle({
        title: this.data.dictName || '字典项管理'
      });
    }
  },

  onShow() {
    if (this.data.dictKey) {
      this.loadDictionary();
    }
  },

  onPullDownRefresh() {
    this.loadDictionary().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载字典数据
   */
  async loadDictionary() {
    this.setData({ loading: true });

    try {
      const result = await dictionaryAdmin.getDictionary(this.data.dictKey);

      const dict = result.data;
      this.setData({
        dictionary: dict,
        items: dict.items || [],
        loading: false
      });
    } catch (error) {
      console.error('[DictItems] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 显示新增弹窗
   */
  showAddDialog() {
    const maxSort = this.data.items.reduce((max, item) =>
      Math.max(max, item.sort || 0), 0);

    this.setData({
      showEditModal: true,
      editingItem: null,
      editForm: {
        value: '',
        label: '',
        sort: maxSort + 10,
        enabled: true
      }
    });
  },

  /**
   * 显示编辑弹窗
   */
  editItem(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.items[index];

    this.setData({
      showEditModal: true,
      editingItem: item,
      editForm: {
        value: item.value,
        label: item.label || '',
        sort: item.sort || 0,
        enabled: item.enabled !== false
      }
    });
  },

  /**
   * 关闭弹窗
   */
  closeModal() {
    this.setData({ showEditModal: false });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  /**
   * 输入值
   */
  onValueInput(e) {
    this.setData({
      'editForm.value': e.detail.value
    });
  },

  /**
   * 输入标签
   */
  onLabelInput(e) {
    this.setData({
      'editForm.label': e.detail.value
    });
  },

  /**
   * 输入排序
   */
  onSortInput(e) {
    this.setData({
      'editForm.sort': parseInt(e.detail.value) || 0
    });
  },

  /**
   * 切换启用状态
   */
  toggleEnabled() {
    this.setData({
      'editForm.enabled': !this.data.editForm.enabled
    });
  },

  /**
   * 保存字典项
   */
  async saveItem() {
    const { value } = this.data.editForm;

    if (!value) {
      wx.showToast({
        title: '请输入值',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      // 构建新的items数组
      let newItems = [...this.data.items];
      const newItem = {
        value: this.data.editForm.value,
        label: this.data.editForm.label || this.data.editForm.value,
        sort: this.data.editForm.sort,
        enabled: this.data.editForm.enabled
      };

      if (this.data.editingItem) {
        // 编辑现有项
        const index = newItems.findIndex(item => item.value === this.data.editingItem.value);
        if (index !== -1) {
          newItems[index] = newItem;
        }
      } else {
        // 检查是否已存在
        if (newItems.some(item => item.value === value)) {
          wx.hideLoading();
          wx.showToast({
            title: '该值已存在',
            icon: 'none'
          });
          return;
        }
        newItems.push(newItem);
      }

      // 按sort排序
      newItems.sort((a, b) => (a.sort || 0) - (b.sort || 0));

      await dictionaryAdmin.updateDictionary(this.data.dictKey, newItems);

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      this.closeModal();
      this.loadDictionary();
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 删除字典项
   */
  deleteItem(e) {
    const { index, value } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: `确认删除字典项"${value}"？`,
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            const newItems = this.data.items.filter((_, i) => i !== index);

            await dictionaryAdmin.updateDictionary(this.data.dictKey, newItems);

            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
            this.loadDictionary();
          } catch (error) {
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 快速切换启用状态
   */
  async toggleItemEnabled(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.items[index];
    const newEnabled = item.enabled === false ? true : false;

    try {
      const newItems = [...this.data.items];
      newItems[index] = {
        ...newItems[index],
        enabled: newEnabled
      };

      await dictionaryAdmin.updateDictionary(this.data.dictKey, newItems);

      wx.showToast({
        title: newEnabled ? '已启用' : '已停用',
        icon: 'success'
      });
      this.loadDictionary();
    } catch (error) {
      wx.showToast({
        title: error.message || '更新失败',
        icon: 'none'
      });
    }
  }
});
