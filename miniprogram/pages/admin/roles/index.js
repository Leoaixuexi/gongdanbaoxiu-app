/**
 * Roles Configuration Page (T151, T157-T158)
 * Manage roles and their permissions
 */

const api = require('../../../services/api');
const cloudDB = require('../../../services/cloudDatabase');
const config = require('../../../config/index');
const { ROLE_DISPLAY_NAMES, ROLES } = require('../../../utils/constants');

// Debug: 输出配置
console.log('========= ROLES PAGE CONFIG =========');
console.log('config.useCloudDatabase:', config.useCloudDatabase);
console.log('config object:', config);
console.log('====================================');

Page({
  data: {
    roles: [],
    originalRoles: [],
    loading: false,
    saving: false,
    hasChanges: false,
    isSystemAdmin: false,
    showConfirm: false
  },

  onLoad() {
    this.checkPermissions();
    this.loadRoles();
  },

  onPullDownRefresh() {
    this.loadRoles();
  },

  /**
   * Check if user is system admin
   */
  checkPermissions() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;

    console.log('[Roles] Checking permissions for user:', userInfo);
    console.log('[Roles] User permissions:', userInfo?.permissions);
    console.log('[Roles] User role_id:', userInfo?.role_id);

    // System admin (role_id = 1) has full access
    const isSystemAdmin = userInfo && userInfo.role_id === ROLES.ADMIN;

    if (!isSystemAdmin) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限访问角色配置页面',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }

    this.setData({ isSystemAdmin: true });
  },

  /**
   * Load all roles with permissions and user counts
   */
  async loadRoles() {
    this.setData({ loading: true });

    try {
      console.log('[Roles] useCloudDatabase:', config.useCloudDatabase);
      let roles = [];

      if (config.useCloudDatabase) {
        // 使用云数据库
        console.log('[Roles] Using cloud database mode');
        roles = await cloudDB.roles.list();

        // Get user counts for each role
        const rolesWithCounts = await Promise.all(
          roles.map(async (role) => {
            try {
              const users = await cloudDB.users.list({ role_id: role.role_id });

              // 转换permissions格式
              const permissions = role.permissions?.modules || {};

              return {
                ...role,
                id: role.role_id,
                name: ROLE_DISPLAY_NAMES[role.role_id] || role.display_name,
                user_count: users.length,
                permissions: {
                  submit_work_orders: permissions.submit_work_orders || false,
                  review_work_orders: permissions.review_work_orders || false,
                  view_analytics: permissions.view_analytics || false,
                  manage_users: permissions.manage_users || false,
                  configure_system: permissions.configure_system || false
                }
              };
            } catch (error) {
              console.error(`Failed to get user count for role ${role.role_id}:`, error);
              const permissions = role.permissions?.modules || {};
              return {
                ...role,
                id: role.role_id,
                name: ROLE_DISPLAY_NAMES[role.role_id] || role.display_name,
                user_count: 0,
                permissions: {
                  submit_work_orders: permissions.submit_work_orders || false,
                  review_work_orders: permissions.review_work_orders || false,
                  view_analytics: permissions.view_analytics || false,
                  manage_users: permissions.manage_users || false,
                  configure_system: permissions.configure_system || false
                }
              };
            }
          })
        );

        roles = rolesWithCounts;

      } else {
        // 使用后端API
        const response = await api.get('/roles');

        // Get user counts for each role
        const rolesWithCounts = await Promise.all(
          response.data.map(async (role) => {
            try {
              const users = await api.get('/users', { role_id: role.id });
              return {
                ...role,
                name: ROLE_DISPLAY_NAMES[role.id] || role.name,
                user_count: users.data.length,
                permissions: {
                  submit_work_orders: role.permissions.includes('submit_work_orders'),
                  review_work_orders: role.permissions.includes('review_work_orders'),
                  view_analytics: role.permissions.includes('view_analytics'),
                  manage_users: role.permissions.includes('manage_users'),
                  configure_system: role.permissions.includes('configure_system')
                }
              };
            } catch (error) {
              console.error(`Failed to get user count for role ${role.id}:`, error);
              return {
                ...role,
                name: ROLE_DISPLAY_NAMES[role.id] || role.name,
                user_count: 0,
                permissions: {
                  submit_work_orders: role.permissions.includes('submit_work_orders'),
                  review_work_orders: role.permissions.includes('review_work_orders'),
                  view_analytics: role.permissions.includes('view_analytics'),
                  manage_users: role.permissions.includes('manage_users'),
                  configure_system: role.permissions.includes('configure_system')
                }
              };
            }
          })
        );

        roles = rolesWithCounts;
      }

      this.setData({
        roles,
        originalRoles: JSON.parse(JSON.stringify(roles)),
        loading: false
      });

      wx.stopPullDownRefresh();

    } catch (error) {
      console.error('Failed to load roles:', error);
      this.setData({ loading: false });
      wx.stopPullDownRefresh();

      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * Handle permission change
   */
  onPermissionChange(e) {
    if (!this.data.isSystemAdmin) return;

    const { roleId, permission } = e.currentTarget.dataset;
    const value = e.detail.value;

    const roles = this.data.roles.map(role => {
      if (role.id === roleId) {
        return {
          ...role,
          permissions: {
            ...role.permissions,
            [permission]: value
          }
        };
      }
      return role;
    });

    // Check if there are changes
    const hasChanges = this.checkForChanges(roles);

    this.setData({
      roles,
      hasChanges
    });
  },

  /**
   * Check if there are any changes
   */
  checkForChanges(roles) {
    return roles.some((role, index) => {
      const original = this.data.originalRoles[index];
      return Object.keys(role.permissions).some(
        key => role.permissions[key] !== original.permissions[key]
      );
    });
  },

  /**
   * Show save confirmation
   */
  onSave() {
    this.setData({
      showConfirm: true
    });
  },

  /**
   * Cancel save
   */
  onCancelSave() {
    this.setData({
      showConfirm: false
    });
  },

  /**
   * Confirm and save changes
   */
  async onConfirmSave() {
    this.setData({
      showConfirm: false,
      saving: true
    });

    try {
      if (config.useCloudDatabase) {
        // 使用云数据库
        const updatePromises = this.data.roles.map(async (role, index) => {
          const original = this.data.originalRoles[index];
          const hasRoleChanges = Object.keys(role.permissions).some(
            key => role.permissions[key] !== original.permissions[key]
          );

          if (hasRoleChanges) {
            // 构建permissions对象
            const permissions = {};
            Object.keys(role.permissions).forEach(key => {
              permissions[key] = role.permissions[key];
            });

            await cloudDB.roles.updatePermissions(role.role_id, permissions);
          }
        });

        await Promise.all(updatePromises);

      } else {
        // 使用后端API
        const updatePromises = this.data.roles.map(async (role, index) => {
          const original = this.data.originalRoles[index];
          const hasRoleChanges = Object.keys(role.permissions).some(
            key => role.permissions[key] !== original.permissions[key]
          );

          if (hasRoleChanges) {
            // Convert permissions object to array
            const permissions = Object.keys(role.permissions)
              .filter(key => role.permissions[key]);

            await api.patch(`/roles/${role.id}`, { permissions });
          }
        });

        await Promise.all(updatePromises);
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });

      // Reload roles to get fresh data
      setTimeout(() => {
        this.loadRoles();
      }, 2000);

    } catch (error) {
      console.error('Failed to save roles:', error);
      this.setData({ saving: false });

      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * Stop modal propagation
   */
  onModalStopPropagation() {
    // Prevent tap event from bubbling to mask
  }
});
