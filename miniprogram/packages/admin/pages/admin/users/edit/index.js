/**
 * Edit User Page (T155-T156)
 * Edit existing user with restrictions
 */

const { ROLE_DISPLAY_NAMES } = require('../../../../utils/constants');

Page({
  data: {
    userId: null,
    originalData: null,
    formData: {
      openid: '',
      name: '',
      role_id: null,
      contact_phone: '',
      department: '',
      supervisor_id: null,
      is_active: true
    },
    errors: {},
    loading: false,
    submitting: false,
    isSelf: false,

    // Picker data
    roles: [],
    departments: ['行政部', '物业部', '维修部'],
    supervisors: [],

    // Selected values
    selectedRoleName: '',
    selectedSupervisorName: '',

    // Picker visibility
    showRolePicker: false,
    showDeptPicker: false,
    showSupervisorPicker: false,
    showDeactivateConfirm: false,
    pendingDeactivation: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ userId: options.id });
      this.loadRoles();
      this.loadUser();
    } else {
      wx.showToast({
        title: '用户ID缺失',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  /**
   * Load user data
   */
  async loadUser() {
    this.setData({ loading: true });

    try {
      console.log('========= EDIT USER PAGE =========');
      console.log('userId from data:', this.data.userId);
      console.log('userId type:', typeof this.data.userId);
      console.log('parseInt result:', parseInt(this.data.userId));
      console.log('====================================');

      if (!this.data.userId) {
        throw new Error('用户ID缺失');
      }

      // 调用云函数获取用户信息
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'getUserById',
          data: {
            user_id: parseInt(this.data.userId)
          }
        }
      });

      if (!result.result.success) {
        throw new Error(result.result.error || '获取用户信息失败');
      }

      const user = result.result.user;
      const app = getApp();
      const currentUserId = app.globalData.userInfo?.user_id;

      this.setData({
        originalData: { ...user },
        formData: {
          openid: user.wechat_openid,
          name: user.name,
          role_id: user.role_id,
          contact_phone: user.contact_phone || '',
          department: user.department || '',
          supervisor_id: user.supervisor_id,
          is_active: user.active
        },
        selectedRoleName: ROLE_DISPLAY_NAMES[user.role_id] || '未知',
        selectedSupervisorName: user.supervisor_name || '',
        isSelf: user.user_id === currentUserId,
        loading: false
      });

      // Load supervisors if role is set
      if (user.role_id) {
        this.loadSupervisors();
      }

    } catch (error) {
      console.error('Failed to load user:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  /**
   * Load all roles
   */
  async loadRoles() {
    try {
      // 调用云函数获取角色列表
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'listRoles'
        }
      });

      if (result.result.success) {
        this.setData({
          roles: result.result.roles.map(role => ({
            id: role.role_id,
            name: ROLE_DISPLAY_NAMES[role.role_id] || role.role_name
          }))
        });
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  },

  /**
   * Load supervisors filtered by role
   */
  async loadSupervisors() {
    if (!this.data.formData.role_id) return;

    try {
      // 调用云函数获取上级列表
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'getSupervisors'
        }
      });

      if (result.result.success) {
        // Exclude current user from supervisor list
        const supervisors = result.result.supervisors
          .filter(user => user.user_id !== parseInt(this.data.userId))
          .map(user => ({
            id: user.user_id,
            name: user.name,
            role_name: ROLE_DISPLAY_NAMES[user.role_id] || '未知',
            department: user.department
          }));

        this.setData({ supervisors });
      }
    } catch (error) {
      console.error('Failed to load supervisors:', error);
    }
  },

  /**
   * Name input handler
   */
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value,
      'errors.name': ''
    });
  },

  /**
   * Validate name on blur
   */
  onNameBlur() {
    const name = this.data.formData.name.trim();
    if (!name) {
      this.setData({
        'errors.name': '请输入姓名'
      });
    } else if (name.length < 2) {
      this.setData({
        'errors.name': '姓名至少2个字符'
      });
    }
  },

  /**
   * Phone input handler
   */
  onPhoneInput(e) {
    this.setData({
      'formData.contact_phone': e.detail.value,
      'errors.contact_phone': ''
    });
  },

  /**
   * Validate phone on blur
   */
  onPhoneBlur() {
    const phone = this.data.formData.contact_phone;
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      this.setData({
        'errors.contact_phone': '请输入正确的手机号码'
      });
    }
  },

  /**
   * Active status change handler
   */
  onActiveChange(e) {
    const newValue = e.detail.value;

    // If deactivating, show confirmation
    if (!newValue && this.data.originalData.is_active) {
      this.setData({
        showDeactivateConfirm: true,
        pendingDeactivation: true
      });
    } else {
      this.setData({
        'formData.is_active': newValue
      });
    }
  },

  /**
   * Confirm deactivation
   */
  onConfirmDeactivate() {
    this.setData({
      'formData.is_active': false,
      showDeactivateConfirm: false,
      pendingDeactivation: false
    });
  },

  /**
   * Cancel deactivation
   */
  onCancelDeactivate() {
    this.setData({
      showDeactivateConfirm: false,
      pendingDeactivation: false
    });
  },

  /**
   * Show role picker
   */
  onShowRolePicker() {
    if (this.data.isSelf) return;
    this.setData({ showRolePicker: true });
  },

  /**
   * Close role picker
   */
  onCloseRolePicker() {
    this.setData({ showRolePicker: false });
  },

  /**
   * Select role
   */
  onSelectRole(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    this.setData({
      'formData.role_id': id,
      selectedRoleName: name,
      showRolePicker: false,
      'errors.role_id': '',
      'formData.supervisor_id': null,
      selectedSupervisorName: ''
    });

    this.loadSupervisors();
  },

  /**
   * Show department picker
   */
  onShowDeptPicker() {
    this.setData({ showDeptPicker: true });
  },

  /**
   * Close department picker
   */
  onCloseDeptPicker() {
    this.setData({ showDeptPicker: false });
  },

  /**
   * Select department
   */
  onSelectDept(e) {
    const dept = e.currentTarget.dataset.dept;
    this.setData({
      'formData.department': dept,
      showDeptPicker: false
    });
  },

  /**
   * Show supervisor picker
   */
  onShowSupervisorPicker() {
    if (this.data.supervisors.length === 0) {
      this.loadSupervisors();
    }
    this.setData({ showSupervisorPicker: true });
  },

  /**
   * Close supervisor picker
   */
  onCloseSupervisorPicker() {
    this.setData({ showSupervisorPicker: false });
  },

  /**
   * Select supervisor
   */
  onSelectSupervisor(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    this.setData({
      'formData.supervisor_id': id,
      selectedSupervisorName: name,
      showSupervisorPicker: false
    });
  },

  /**
   * Stop modal propagation
   */
  onModalStopPropagation() {
    // Prevent tap event from bubbling to mask
  },

  /**
   * Validate form
   */
  validateForm() {
    const errors = {};
    const { name, role_id, contact_phone } = this.data.formData;

    if (!name || !name.trim()) {
      errors.name = '请输入姓名';
    } else if (name.trim().length < 2) {
      errors.name = '姓名至少2个字符';
    }

    if (!role_id) {
      errors.role_id = '请选择角色';
    }

    if (contact_phone && !/^1[3-9]\d{9}$/.test(contact_phone)) {
      errors.contact_phone = '请输入正确的手机号码';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  /**
   * Submit form
   */
  async onSubmit() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      const data = {
        user_id: parseInt(this.data.userId),
        name: this.data.formData.name.trim(),
        role_id: this.data.formData.role_id,
        is_active: this.data.formData.is_active
      };

      if (this.data.formData.contact_phone) {
        data.contact_phone = this.data.formData.contact_phone;
      }
      if (this.data.formData.department) {
        data.department = this.data.formData.department;
      }
      if (this.data.formData.supervisor_id) {
        data.supervisor_id = this.data.formData.supervisor_id;
      }

      // 调用云函数更新用户
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'updateUser',
          data: data
        }
      });

      if (!result.result.success) {
        throw new Error(result.result.error || '更新失败');
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 2000);

    } catch (error) {
      console.error('Failed to update user:', error);
      this.setData({ submitting: false });

      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * Cancel and go back
   */
  onCancel() {
    wx.navigateBack();
  }
});
