/**
 * Message Template Management Page
 * 消息模板管理列表页面
 */

const cloudDB = require('../../../services/cloudDatabase');
const { ROLES, MESSAGE_SCENE_NAMES, MESSAGE_TEMPLATE_VARIABLES, STORAGE_KEYS } = require('../../../utils/constants');

// 示例数据用于预览
const SAMPLE_DATA = {
  'order_created': {
    order_id: 'WO20231201001',
    description: '空调不制冷',
    location: 'A栋101室',
    submitter_name: '张三',
    created_at: '2023-12-01 10:30'
  },
  'order_status_changed': {
    order_id: 'WO20231201001',
    old_status: '待维修',
    new_status: '维修中',
    operator_name: '李四',
    changed_at: '2023-12-01 14:00'
  },
  'order_reminder': {
    order_id: 'WO20231201001',
    description: '空调不制冷',
    status: '待维修',
    created_at: '2023-12-01 10:30',
    days_pending: '3'
  },
  'announcement': {
    title: '系统维护通知',
    publish_time: '2023-12-01 09:00'
  }
};

Page({
  data: {
    templates: [],
    groupedTemplates: [],
    loading: true,
    showPreview: false,
    previewData: {
      title: '',
      body: ''
    }
  },

  onLoad() {
    this.checkAdminPermission();
  },

  onShow() {
    this.loadTemplates();
  },

  onPullDownRefresh() {
    this.loadTemplates().then(() => {
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
   * 加载模板列表
   */
  async loadTemplates() {
    this.setData({ loading: true });

    try {
      const result = await cloudDB.messageTemplates.list();
      const templates = (result.list || []).map(item => ({
        ...item,
        updated_at_text: this.formatDate(item.updated_at),
        body_preview: this.truncateText(item.body, 50)
      }));

      // 按场景分组
      const groupedTemplates = this.groupByScene(templates);

      this.setData({
        templates,
        groupedTemplates,
        loading: false
      });
    } catch (error) {
      console.error('[MessageTemplates] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 按场景分组
   */
  groupByScene(templates) {
    const groups = {};

    templates.forEach(template => {
      const scene = template.scene || 'other';
      if (!groups[scene]) {
        groups[scene] = {
          scene,
          sceneName: MESSAGE_SCENE_NAMES[scene] || scene,
          templates: []
        };
      }
      groups[scene].templates.push(template);
    });

    return Object.values(groups);
  },

  /**
   * 格式化日期
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 截断文本
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  /**
   * 创建新模板
   */
  createTemplate() {
    wx.navigateTo({
      url: '/pages/admin/message-templates/edit/index'
    });
  },

  /**
   * 编辑模板
   */
  editTemplate(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/message-templates/edit/index?id=${id}`
    });
  },

  /**
   * 切换模板启用状态
   */
  async toggleTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const currentEnabled = e.currentTarget.dataset.enabled;
    const newEnabled = !currentEnabled;

    try {
      await cloudDB.messageTemplates.toggle(id, newEnabled);
      wx.showToast({
        title: newEnabled ? '已启用' : '已停用',
        icon: 'success'
      });
      this.loadTemplates();
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 预览模板
   */
  previewTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const template = this.data.templates.find(t => t._id === id);

    if (template) {
      const sampleData = SAMPLE_DATA[template.scene] || {};
      const previewTitle = this.replaceVariables(template.title, sampleData);
      const previewBody = this.replaceVariables(template.body, sampleData);

      this.setData({
        showPreview: true,
        previewData: {
          title: previewTitle,
          body: previewBody
        }
      });
    }
  },

  /**
   * 替换变量
   */
  replaceVariables(text, data) {
    if (!text) return '';
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  },

  /**
   * 关闭预览
   */
  closePreview() {
    this.setData({ showPreview: false });
  },

  /**
   * 删除模板
   */
  async deleteTemplate(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确认删除？',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await cloudDB.messageTemplates.delete(id);
            wx.hideLoading();
            wx.showToast({
              title: '已删除',
              icon: 'success'
            });
            this.loadTemplates();
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
