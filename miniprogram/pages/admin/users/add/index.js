/**
 * Add User Page (T153-T154)
 * Create new user with form validation
 */

const { ROLE_DISPLAY_NAMES } = require('../../../../utils/constants');
const dictionary = require('../../../../services/dictionary');

Page({
  data: {
    formData: {
      username: '',
      password: '',
      name: '',
      gender: null,  // 1=男, 2=女
      role_id: null,
      contact_phone: '',
      department: '',
      is_active: true
    },
    errors: {},
    submitting: false,

    // Picker data
    roles: [],
    departments: ['行政部', '信泰物业', '工程总包', '供应商'],

    // Selected values
    selectedRoleName: '',

    // Picker visibility
    showRolePicker: false,
    showDeptPicker: false
  },

  onLoad() {
    this.loadRoles();
    this.loadDepartments();
  },

  async loadDepartments() {
    try {
      const departments = await dictionary.getOptions('department');
      if (departments.length > 0) {
        this.setData({ departments });
      }
    } catch (error) {
      console.error('[AddUser] Load departments error:', error);
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
   * Username input handler
   */
  onUsernameInput(e) {
    this.setData({
      'formData.username': e.detail.value,
      'errors.username': ''
    });
  },

  /**
   * Validate username on blur
   */
  onUsernameBlur() {
    const username = this.data.formData.username.trim();
    if (!username) {
      this.setData({
        'errors.username': '请输入用户名'
      });
    } else if (username.length < 3) {
      this.setData({
        'errors.username': '用户名至少3个字符'
      });
    }
  },

  /**
   * Password input handler
   */
  onPasswordInput(e) {
    this.setData({
      'formData.password': e.detail.value,
      'errors.password': ''
    });
  },

  /**
   * Validate password on blur
   */
  onPasswordBlur() {
    const password = this.data.formData.password;
    if (!password) {
      this.setData({
        'errors.password': '请输入密码'
      });
    } else if (password.length < 6) {
      this.setData({
        'errors.password': '密码至少6个字符'
      });
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
   * Gender select handler
   */
  onSelectGender(e) {
    const gender = parseInt(e.currentTarget.dataset.gender);
    this.setData({
      'formData.gender': gender,
      'errors.gender': ''
    });
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
    this.setData({
      'formData.is_active': e.detail.value
    });
  },

  /**
   * Show role picker
   */
  onShowRolePicker() {
    this.setData({
      showRolePicker: true
    });
  },

  /**
   * Close role picker
   */
  onCloseRolePicker() {
    this.setData({
      showRolePicker: false
    });
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
      'errors.role_id': ''
    });
  },

  /**
   * Show department picker
   */
  onShowDeptPicker() {
    this.setData({
      showDeptPicker: true
    });
  },

  /**
   * Close department picker
   */
  onCloseDeptPicker() {
    this.setData({
      showDeptPicker: false
    });
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
    const { username, password, name, gender, role_id, contact_phone } = this.data.formData;

    // Validate username
    if (!username || !username.trim()) {
      errors.username = '请输入用户名';
    } else if (username.trim().length < 3) {
      errors.username = '用户名至少3个字符';
    }

    // Validate password
    if (!password) {
      errors.password = '请输入密码';
    } else if (password.length < 6) {
      errors.password = '密码至少6个字符';
    }

    // Validate name
    if (!name || !name.trim()) {
      errors.name = '请输入姓名';
    } else if (name.trim().length < 2) {
      errors.name = '姓名至少2个字符';
    }

    // Validate gender
    if (!gender) {
      errors.gender = '请选择性别';
    }

    // Validate role
    if (!role_id) {
      errors.role_id = '请选择角色';
    }

    // Validate phone (optional but must be valid if provided)
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
      // Prepare data
      const data = {
        username: this.data.formData.username.trim(),
        password: this.data.formData.password,
        name: this.data.formData.name.trim(),
        gender: this.data.formData.gender,
        role_id: this.data.formData.role_id
      };

      // Add optional fields
      if (this.data.formData.contact_phone) {
        data.contact_phone = this.data.formData.contact_phone;
      }
      if (this.data.formData.department) {
        data.department = this.data.formData.department;
      }

      // 调用云函数创建用户
      const result = await wx.cloud.callFunction({
        name: 'userAuth',
        data: {
          action: 'createUser',
          data: data
        }
      });

      if (!result.result.success) {
        throw new Error(result.result.error || '创建失败');
      }

      wx.showToast({
        title: '创建成功',
        icon: 'success',
        duration: 2000
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 2000);

    } catch (error) {
      console.error('Failed to create user:', error);
      this.setData({ submitting: false });

      wx.showToast({
        title: error.message || '创建失败',
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
