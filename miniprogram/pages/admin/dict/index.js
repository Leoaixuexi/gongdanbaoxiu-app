/**
 * Dictionary Management Page
 * 字典管理列表页面
 */

const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

Page({
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
    this.checkAdminPermission();
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
   * 检查管理员权限
   */
  checkAdminPermission() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || userInfo.role_id !== ROLES.ADMIN) {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 加载字典列表
   */
  async loadDictionaries() {
    this.setData({ loading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'dictionaryManager',
        data: { action: 'list' }
      });

      if (result.result && result.result.success) {
        this.setData({
          dictionaries: result.result.data,
          loading: false
        });
      } else {
        throw new Error(result.result?.error || '加载失败');
      }
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
      wx.showLoading({ title: '创建中...' });

      const result = await wx.cloud.callFunction({
        name: 'dictionaryManager',
        data: {
          action: 'create',
          data: this.data.newDict
        }
      });

      wx.hideLoading();

      if (result.result && result.result.success) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });
        this.closeModal();
        this.loadDictionaries();
      } else {
        throw new Error(result.result?.error || '创建失败');
      }
    } catch (error) {
      wx.hideLoading();
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
            wx.showLoading({ title: '删除中...' });

            const result = await wx.cloud.callFunction({
              name: 'dictionaryManager',
              data: {
                action: 'delete',
                data: { dict_key: dictKey }
              }
            });

            wx.hideLoading();

            if (result.result && result.result.success) {
              wx.showToast({
                title: '已删除',
                icon: 'success'
              });
              this.loadDictionaries();
            } else {
              throw new Error(result.result?.error || '删除失败');
            }
          } catch (error) {
            wx.hideLoading();
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
