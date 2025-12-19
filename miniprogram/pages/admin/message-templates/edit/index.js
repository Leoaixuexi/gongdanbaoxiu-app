/**
 * Message Template Edit Page
 * 消息模板编辑页面
 */

const cloudDB = require('../../../../services/cloudDatabase');
const { ROLES, MESSAGE_SCENES, MESSAGE_SCENE_NAMES, MESSAGE_TEMPLATE_VARIABLES, STORAGE_KEYS } = require('../../../../utils/constants');

Page({
  data: {
    isEdit: false,
    templateId: null,
    saving: false,
    selectedSceneIndex: 0,
    sceneOptions: [],
    availableVariables: [],
    formData: {
      scene: '',
      title: '',
      body: ''
    }
  },

  onLoad(options) {
    this.checkAdminPermission();
    this.initSceneOptions();

    if (options.id) {
      this.setData({
        isEdit: true,
        templateId: options.id
      });
      wx.setNavigationBarTitle({ title: '编辑模板' });
      this.loadTemplate(options.id);
    } else {
      wx.setNavigationBarTitle({ title: '新建模板' });
      // 设置默认场景
      this.updateAvailableVariables(this.data.sceneOptions[0].value);
      this.setData({
        'formData.scene': this.data.sceneOptions[0].value
      });
    }
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
   * 初始化场景选项
   */
  initSceneOptions() {
    const sceneOptions = Object.keys(MESSAGE_SCENES).map(key => ({
      value: MESSAGE_SCENES[key],
      label: MESSAGE_SCENE_NAMES[MESSAGE_SCENES[key]] || MESSAGE_SCENES[key]
    }));

    this.setData({ sceneOptions });
  },

  /**
   * 更新可用变量列表
   */
  updateAvailableVariables(scene) {
    const variables = MESSAGE_TEMPLATE_VARIABLES[scene] || [];
    this.setData({ availableVariables: variables });
  },

  /**
   * 加载模板详情
   */
  async loadTemplate(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const result = await cloudDB.messageTemplates.get(id);

      if (result) {
        // 找到场景对应的索引
        const selectedSceneIndex = this.data.sceneOptions.findIndex(
          opt => opt.value === result.scene
        );

        this.setData({
          formData: {
            scene: result.scene || '',
            title: result.title || '',
            body: result.body || ''
          },
          selectedSceneIndex: selectedSceneIndex >= 0 ? selectedSceneIndex : 0
        });

        this.updateAvailableVariables(result.scene);
      }

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('[TemplateEdit] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 场景选择变化
   */
  onSceneChange(e) {
    const index = parseInt(e.detail.value);
    const scene = this.data.sceneOptions[index].value;

    this.setData({
      selectedSceneIndex: index,
      'formData.scene': scene
    });

    this.updateAvailableVariables(scene);
  },

  /**
   * 标题输入
   */
  onTitleInput(e) {
    this.setData({
      'formData.title': e.detail.value
    });
  },

  /**
   * 正文输入
   */
  onBodyInput(e) {
    this.setData({
      'formData.body': e.detail.value
    });
  },

  /**
   * 插入变量
   */
  insertVariable(e) {
    const key = e.currentTarget.dataset.key;
    const variableText = `{{${key}}}`;
    const currentBody = this.data.formData.body || '';

    this.setData({
      'formData.body': currentBody + variableText
    });

    wx.showToast({
      title: '已插入变量',
      icon: 'none',
      duration: 1000
    });
  },

  /**
   * 保存模板
   */
  async saveTemplate() {
    const { formData, isEdit, templateId } = this.data;

    // 验证
    if (!formData.scene) {
      wx.showToast({
        title: '请选择场景类型',
        icon: 'none'
      });
      return;
    }

    if (!formData.title.trim()) {
      wx.showToast({
        title: '请输入模板标题',
        icon: 'none'
      });
      return;
    }

    if (!formData.body.trim()) {
      wx.showToast({
        title: '请输入模板正文',
        icon: 'none'
      });
      return;
    }

    this.setData({ saving: true });

    try {
      const data = {
        scene: formData.scene,
        title: formData.title.trim(),
        body: formData.body.trim()
      };

      if (isEdit) {
        await cloudDB.messageTemplates.update(templateId, data);
      } else {
        await cloudDB.messageTemplates.create(data);
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      console.error('[TemplateEdit] Save error:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    } finally {
      this.setData({ saving: false });
    }
  }
});
