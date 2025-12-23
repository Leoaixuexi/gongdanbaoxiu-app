/**
 * System Config Page
 * 系统配置页面
 */

const cloudDB = require('../../../services/cloudDatabase');
const { ROLES, STORAGE_KEYS } = require('../../../utils/constants');

// 配置项定义
const CONFIG_ITEMS = [
  {
    key: 'system_name',
    name: '系统名称',
    desc: '显示在小程序首页的系统名称',
    type: 'text',
    default: '物业报修系统'
  },
  {
    key: 'contact_phone',
    name: '客服电话',
    desc: '用户联系客服的电话号码',
    type: 'text',
    default: ''
  },
  {
    key: 'work_order_auto_close_days',
    name: '工单自动关闭天数',
    desc: '完成后超过多少天自动关闭',
    type: 'number',
    default: 7
  },
  {
    key: 'max_upload_images',
    name: '最大上传图片数',
    desc: '每个工单最多上传的图片数量',
    type: 'number',
    default: 9
  },
  {
    key: 'enable_notification',
    name: '启用通知提醒',
    desc: '是否启用工单状态变更通知',
    type: 'switch',
    default: true
  },
  {
    key: 'enable_auto_assign',
    name: '启用自动派单',
    desc: '新工单是否自动分配给维修人员',
    type: 'switch',
    default: false
  },
  {
    key: 'maintenance_mode',
    name: '维护模式',
    desc: '开启后普通用户无法提交工单',
    type: 'switch',
    default: false
  },
  {
    key: 'announcement_display_days',
    name: '公告显示天数',
    desc: '公告在首页显示的天数',
    type: 'number',
    default: 30
  }
];

Page({
  data: {
    configItems: [],
    loading: true,
    saving: false,
    hasChanges: false,

    // 编辑中的配置值
    editingConfig: {}
  },

  onLoad() {
    this.checkAdminPermission();
  },

  onShow() {
    this.loadConfig();
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
   * 加载配置
   */
  async loadConfig() {
    this.setData({ loading: true });

    try {
      const result = await cloudDB.systemConfig.get();
      const serverConfig = result.config || {};

      // 合并服务器配置和默认配置
      const configItems = CONFIG_ITEMS.map(item => {
        const serverValue = serverConfig[item.key];
        return {
          ...item,
          value: serverValue !== undefined ? serverValue : item.default
        };
      });

      // 构建编辑配置对象
      const editingConfig = {};
      configItems.forEach(item => {
        editingConfig[item.key] = item.value;
      });

      this.setData({
        configItems,
        editingConfig,
        loading: false,
        hasChanges: false
      });
    } catch (error) {
      console.error('[Config] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 文本输入变化
   */
  onInputChange(e) {
    const { key } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.setData({
      [`editingConfig.${key}`]: value,
      hasChanges: true
    });
  },

  /**
   * 数字输入变化
   */
  onNumberChange(e) {
    const { key } = e.currentTarget.dataset;
    const value = parseInt(e.detail.value) || 0;

    this.setData({
      [`editingConfig.${key}`]: value,
      hasChanges: true
    });
  },

  /**
   * 开关切换
   */
  onSwitchChange(e) {
    const { key } = e.currentTarget.dataset;
    const currentValue = this.data.editingConfig[key];

    this.setData({
      [`editingConfig.${key}`]: !currentValue,
      hasChanges: true
    });
  },

  /**
   * 保存配置
   */
  async saveConfig() {
    if (!this.data.hasChanges) {
      wx.showToast({
        title: '没有修改',
        icon: 'none'
      });
      return;
    }

    this.setData({ saving: true });

    try {
      const { editingConfig, configItems } = this.data;

      // 构建配置列表
      const configs = configItems.map(item => ({
        key: item.key,
        value: editingConfig[item.key],
        description: item.desc
      }));

      await cloudDB.systemConfig.batchUpdate(configs);

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      this.setData({
        saving: false,
        hasChanges: false
      });

      // 重新加载
      this.loadConfig();
    } catch (error) {
      console.error('[Config] Save error:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
      this.setData({ saving: false });
    }
  },

  /**
   * 重置配置
   */
  resetConfig() {
    wx.showModal({
      title: '确认重置',
      content: '确定要将所有配置恢复到默认值吗？',
      success: (res) => {
        if (res.confirm) {
          const editingConfig = {};
          CONFIG_ITEMS.forEach(item => {
            editingConfig[item.key] = item.default;
          });

          this.setData({
            editingConfig,
            hasChanges: true
          });

          wx.showToast({
            title: '已重置为默认值',
            icon: 'none'
          });
        }
      }
    });
  }
});
