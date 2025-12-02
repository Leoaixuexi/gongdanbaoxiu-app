/**
 * System Configuration Page (T152)
 * Configure SLA rules, fault types, and system settings
 */

const api = require('../../../services/api');
const { PRIORITIES, PRIORITY_DISPLAY_NAMES } = require('../../../utils/constants');

Page({
  data: {
    slaRules: [],
    faultTypes: [],
    systemSettings: {
      max_concurrent_orders: 5,
      max_photo_size_mb: 5,
      notifications_enabled: true
    },
    saving: false,
    showFaultTypeModal: false,
    editingFaultType: {
      id: null,
      name: ''
    }
  },

  onLoad() {
    this.checkPermissions();
    this.loadConfig();
  },

  /**
   * Check permissions
   */
  checkPermissions() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    console.log('[Config] Checking permissions for user:', userInfo);

    // Only system admin (role_id = 1) can access system configuration
    if (!userInfo || userInfo.role_id !== 1) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限访问系统配置页面',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  /**
   * Load all configuration
   */
  async loadConfig() {
    wx.showLoading({ title: '加载中...' });

    try {
      await Promise.all([
        this.loadSlaRules(),
        this.loadFaultTypes(),
        this.loadSystemSettings()
      ]);

      wx.hideLoading();
    } catch (error) {
      console.error('Failed to load config:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * Load SLA rules
   */
  async loadSlaRules() {
    try {
      const response = await api.get('/sla-rules', { hideLoading: true });
      const slaRules = PRIORITIES.map(priority => {
        const rule = response.data.find(r => r.priority === priority) || {};
        return {
          priority,
          priority_name: PRIORITY_DISPLAY_NAMES[priority],
          target_hours: rule.target_hours || 24,
          escalation_threshold_hours: rule.escalation_threshold_hours || 48
        };
      });

      this.setData({ slaRules });
    } catch (error) {
      console.error('Failed to load SLA rules:', error);
    }
  },

  /**
   * Load fault types
   */
  async loadFaultTypes() {
    try {
      const response = await api.get('/fault-types', { hideLoading: true });
      this.setData({
        faultTypes: response.data
      });
    } catch (error) {
      console.error('Failed to load fault types:', error);
    }
  },

  /**
   * Load system settings
   */
  async loadSystemSettings() {
    try {
      const response = await api.get('/system-settings', { hideLoading: true });
      this.setData({
        systemSettings: response.data || this.data.systemSettings
      });
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  },

  /**
   * Handle SLA target hours change
   */
  onSlaTargetChange(e) {
    const priority = e.currentTarget.dataset.priority;
    const value = parseInt(e.detail.value) || 0;

    const slaRules = this.data.slaRules.map(rule => {
      if (rule.priority === priority) {
        return { ...rule, target_hours: value };
      }
      return rule;
    });

    this.setData({ slaRules });
  },

  /**
   * Handle SLA escalation hours change
   */
  onSlaEscalationChange(e) {
    const priority = e.currentTarget.dataset.priority;
    const value = parseInt(e.detail.value) || 0;

    const slaRules = this.data.slaRules.map(rule => {
      if (rule.priority === priority) {
        return { ...rule, escalation_threshold_hours: value };
      }
      return rule;
    });

    this.setData({ slaRules });
  },

  /**
   * Handle max concurrent orders change
   */
  onMaxOrdersChange(e) {
    this.setData({
      'systemSettings.max_concurrent_orders': parseInt(e.detail.value) || 5
    });
  },

  /**
   * Handle photo size change
   */
  onPhotoSizeChange(e) {
    this.setData({
      'systemSettings.max_photo_size_mb': parseInt(e.detail.value) || 5
    });
  },

  /**
   * Handle notifications toggle
   */
  onNotificationsChange(e) {
    this.setData({
      'systemSettings.notifications_enabled': e.detail.value
    });
  },

  /**
   * Add fault type
   */
  onAddFaultType() {
    this.setData({
      showFaultTypeModal: true,
      editingFaultType: {
        id: null,
        name: ''
      }
    });
  },

  /**
   * Edit fault type
   */
  onEditFaultType(e) {
    const id = e.currentTarget.dataset.id;
    const faultType = this.data.faultTypes.find(ft => ft.id === id);

    this.setData({
      showFaultTypeModal: true,
      editingFaultType: {
        id: faultType.id,
        name: faultType.name
      }
    });
  },

  /**
   * Toggle fault type active status
   */
  async onToggleFaultType(e) {
    const id = e.currentTarget.dataset.id;
    const isActive = e.currentTarget.dataset.active;

    try {
      await api.patch(`/fault-types/${id}`, {
        is_active: !isActive
      });

      wx.showToast({
        title: isActive ? '已停用' : '已启用',
        icon: 'success'
      });

      this.loadFaultTypes();

    } catch (error) {
      console.error('Failed to toggle fault type:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * Fault type name input
   */
  onFaultTypeNameInput(e) {
    this.setData({
      'editingFaultType.name': e.detail.value
    });
  },

  /**
   * Save fault type
   */
  async onSaveFaultType() {
    if (!this.data.editingFaultType.name.trim()) {
      wx.showToast({
        title: '请输入类型名称',
        icon: 'none'
      });
      return;
    }

    try {
      if (this.data.editingFaultType.id) {
        // Update
        await api.patch(`/fault-types/${this.data.editingFaultType.id}`, {
          name: this.data.editingFaultType.name.trim()
        });
      } else {
        // Create
        await api.post('/fault-types', {
          name: this.data.editingFaultType.name.trim(),
          is_active: true
        });
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      this.setData({ showFaultTypeModal: false });
      this.loadFaultTypes();

    } catch (error) {
      console.error('Failed to save fault type:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * Close fault type modal
   */
  onCloseFaultTypeModal() {
    this.setData({
      showFaultTypeModal: false
    });
  },

  /**
   * Stop modal propagation
   */
  onModalStopPropagation() {
    // Prevent tap event from bubbling to mask
  },

  /**
   * Save all configuration
   */
  async onSave() {
    this.setData({ saving: true });

    try {
      // Update SLA rules
      await Promise.all(
        this.data.slaRules.map(rule => {
          return api.post('/sla-rules', {
            priority: rule.priority,
            target_hours: rule.target_hours,
            escalation_threshold_hours: rule.escalation_threshold_hours
          });
        })
      );

      // Update system settings
      await api.post('/system-settings', this.data.systemSettings);

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });

      this.setData({ saving: false });

    } catch (error) {
      console.error('Failed to save config:', error);
      this.setData({ saving: false });

      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
        duration: 2000
      });
    }
  }
});
