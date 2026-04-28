/**
 * Role Management Page
 * 角色与权限管理页面
 */

const userService = require('../../../services/userService');

// 系统模块定义（与云数据库 roles.permissions.modules 保持一致）
const SYSTEM_MODULES = [
  { key: 'submit_work_orders', name: '提交工单', desc: '创建/提交报修工单' },
  { key: 'review_work_orders', name: '审核工单', desc: '验收通过/返工处理' },
  { key: 'view_analytics', name: '数据分析', desc: '查看统计报表与导出' },
  { key: 'manage_users', name: '账号管理', desc: '管理系统用户与重置密码' },
  { key: 'configure_system', name: '系统配置', desc: '管理系统配置项与模板' }
];

Page({
  behaviors: [require('../../../behaviors/adminPage')],

  data: {
    roles: [],
    loading: true,
    modules: SYSTEM_MODULES,

    // 编辑权限弹窗
    showPermissionModal: false,
    editingRole: null,
    editingPermissions: {}
  },

  onLoad() {
    if (!this.checkAdminPermission()) return;
  },

  onShow() {
    this.loadRoles();
  },

  onPullDownRefresh() {
    this.loadRoles().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载角色列表
   */
  async loadRoles() {
    this.setData({ loading: true });

    try {
      const roles = await userService.listRoles();

      // 处理角色数据
      const processedRoles = roles.map(role => ({
        ...role,
        permissionCount: this.countPermissions(role.permissions),
        permissionList: this.getPermissionList(role.permissions)
      }));

      this.setData({
        roles: processedRoles,
        loading: false
      });
    } catch (error) {
      console.error('[Roles] Load error:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 统计权限数量
   */
  countPermissions(permissions) {
    if (!permissions || !permissions.modules) return 0;
    return Object.values(permissions.modules).filter(v => v).length;
  },

  /**
   * 获取权限列表文本
   */
  getPermissionList(permissions) {
    if (!permissions || !permissions.modules) return '无权限';

    const enabledModules = SYSTEM_MODULES
      .filter(m => permissions.modules[m.key])
      .map(m => m.name);

    if (enabledModules.length === 0) return '无权限';
    if (enabledModules.length === SYSTEM_MODULES.length) return '全部权限';
    if (enabledModules.length > 3) {
      return enabledModules.slice(0, 3).join('、') + '等';
    }
    return enabledModules.join('、');
  },

  /**
   * 打开权限编辑弹窗
   */
  editPermissions(e) {
    const roleId = e.currentTarget.dataset.roleId;
    const role = this.data.roles.find(r => r.role_id === roleId);

    if (!role) return;

    // 初始化编辑中的权限
    const editingPermissions = {};
    SYSTEM_MODULES.forEach(m => {
      editingPermissions[m.key] = role.permissions?.modules?.[m.key] || false;
    });

    this.setData({
      showPermissionModal: true,
      editingRole: role,
      editingPermissions
    });
  },

  /**
   * 切换权限
   */
  togglePermission(e) {
    const key = e.currentTarget.dataset.key;
    const currentValue = this.data.editingPermissions[key];

    this.setData({
      [`editingPermissions.${key}`]: !currentValue
    });
  },

  /**
   * 全选/取消全选
   */
  toggleAllPermissions() {
    const allEnabled = Object.values(this.data.editingPermissions).every(v => v);
    const newPermissions = {};

    SYSTEM_MODULES.forEach(m => {
      newPermissions[m.key] = !allEnabled;
    });

    this.setData({ editingPermissions: newPermissions });
  },

  /**
   * 关闭权限编辑弹窗
   */
  closePermissionModal() {
    this.setData({
      showPermissionModal: false,
      editingRole: null,
      editingPermissions: {}
    });
  },

  /**
   * 保存权限设置
   */
  async savePermissions() {
    const { editingRole, editingPermissions } = this.data;

    if (!editingRole) return;

    try {
      wx.showLoading({ title: '保存中...' });

      await userService.updateRolePermissions(editingRole.role_id, editingPermissions);

      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      this.closePermissionModal();
      this.loadRoles();
    } catch (error) {
      wx.hideLoading();
      console.error('[Roles] Save permissions error:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 空函数，用于阻止点击事件冒泡
  }
});
