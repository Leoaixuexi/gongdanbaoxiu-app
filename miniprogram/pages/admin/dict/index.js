/**
 * Dictionary Management Page
 * 字典管理列表页面
 */

const dictionaryAdmin = require('../../../services/dictionaryAdmin');

Page({
  behaviors: [require('../../../behaviors/adminPage')],

  data: {
    dictionaries: [],
    loading: true,
    showAddModal: false,
    newDict: {
      dict_key: '',
      dict_name: '',
      description: ''
    }
  },

  onLoad() {
    if (!this.checkAdminPermission()) return;
  },

  onShow() {
    this.loadDictionaries();
  },

  onPullDownRefresh() {
    this.loadDictionaries().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载字典列表
   */
  async loadDictionaries() {
    this.setData({ loading: true });

    try {
      const result = await dictionaryAdmin.listDictionaries();

      this.setData({
        dictionaries: result.data,
        loading: false
      });
    } catch (error) {
      console.error('[Dict] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 进入字典项管理
   */
  goToItems(e) {
    const { dictKey, dictName } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/admin/dict/items?dict_key=${dictKey}&dict_name=${encodeURIComponent(dictName)}`
    });
  },

  /**
   * 显示新增弹窗
   */
  showAddDialog() {
    this.setData({
      showAddModal: true,
      newDict: {
        dict_key: '',
        dict_name: '',
        description: ''
      }
    });
  },

  /**
   * 关闭弹窗
   */
  closeModal() {
    this.setData({ showAddModal: false });
  },

  /**
   * 输入字典键
   */
  onKeyInput(e) {
    this.setData({
      'newDict.dict_key': e.detail.value
    });
  },

  /**
   * 输入字典名称
   */
  onNameInput(e) {
    this.setData({
      'newDict.dict_name': e.detail.value
    });
  },

  /**
   * 输入描述
   */
  onDescInput(e) {
    this.setData({
      'newDict.description': e.detail.value
    });
  },

  /**
   * 创建字典
   */
  async createDictionary() {
    const { dict_key, dict_name } = this.data.newDict;

    if (!dict_key || !dict_name) {
      wx.showToast({
        title: '请填写必填项',
        icon: 'none'
      });
      return;
    }

    // 验证键名格式（只允许英文、数字、下划线）
    if (!/^[a-z][a-z0-9_]*$/.test(dict_key)) {
      wx.showToast({
        title: '键名格式不正确',
        icon: 'none'
      });
      return;
    }

    try {
      await dictionaryAdmin.createDictionary(this.data.newDict);

      wx.showToast({
        title: '创建成功',
        icon: 'success'
      });
      this.closeModal();
      this.loadDictionaries();
    } catch (error) {
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      });
    }
  },

  /**
   * 删除字典
   */
  deleteDictionary(e) {
    const { dictKey, dictName, isSystem } = e.currentTarget.dataset;

    if (isSystem) {
      wx.showToast({
        title: '系统字典不可删除',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确认删除字典"${dictName}"？删除后无法恢复。`,
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await dictionaryAdmin.deleteDictionary(dictKey);

            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
            this.loadDictionaries();
          } catch (error) {
            wx.showToast({
              title: error.message || '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
