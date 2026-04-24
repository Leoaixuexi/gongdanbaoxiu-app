/**
 * 用户与角色服务
 * 封装 userAuth 云函数中与用户管理、角色管理相关的操作
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');
const { STORAGE_KEYS } = require('../utils/constants');

/**
 * 获取当前用户ID（用于权限验证）
 */
function getCurrentUserId() {
  try {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    return userInfo?.user_id || null;
  } catch (e) {
    return null;
  }
}

// ========== 用户管理 ==========

/**
 * 通过ID获取用户
 */
const getUserById = async (userId) => {
  const result = await callCloudSilent('userAuth', {
    action: 'getUserById',
    data: { user_id: userId }
  });
  return result.user;
};

/**
 * 获取用户列表
 */
const listUsers = async (filters = {}) => {
  const result = await callCloudSilent('userAuth', {
    action: 'listUsers',
    data: filters
  });
  return result.users || [];
};

/**
 * 创建用户
 */
const createUser = async (userData) => {
  const result = await callCloud('userAuth', {
    action: 'createUser',
    data: userData,
    current_user_id: getCurrentUserId()
  }, { loadingText: '创建中...' });
  return result;
};

/**
 * 更新用户
 */
const updateUser = async (userData) => {
  const result = await callCloud('userAuth', {
    action: 'updateUser',
    data: userData,
    current_user_id: getCurrentUserId()
  }, { loadingText: '保存中...' });
  return result;
};

/**
 * 启用用户
 */
const enableUser = async (userId) => {
  const result = await callCloud('userAuth', {
    action: 'enableUser',
    data: { user_id: userId },
    current_user_id: getCurrentUserId()
  }, { loadingText: '处理中...' });
  return result;
};

/**
 * 停用用户
 */
const disableUser = async (userId) => {
  const result = await callCloud('userAuth', {
    action: 'disableUser',
    data: { user_id: userId },
    current_user_id: getCurrentUserId()
  }, { loadingText: '处理中...' });
  return result;
};

/**
 * 重置用户密码
 */
const resetPassword = async (userId) => {
  const result = await callCloud('userAuth', {
    action: 'resetUserPassword',
    data: { user_id: userId },
    current_user_id: getCurrentUserId()
  }, { loadingText: '重置中...' });
  return { newPassword: result.default_password };
};

/**
 * 获取办美员工列表（用于筛选器）
 */
const getPropertyStaffList = async () => {
  const result = await callCloudSilent('userAuth', {
    action: 'getPropertyStaffList'
  });
  return result;
};

// ========== 角色管理 ==========

/**
 * 获取所有角色
 */
const listRoles = async () => {
  const result = await callCloudSilent('userAuth', {
    action: 'listRoles'
  });
  return result.roles || [];
};

/**
 * 更新角色权限
 */
const updateRolePermissions = async (roleId, permissions) => {
  const result = await callCloud('userAuth', {
    action: 'updateRolePermissions',
    data: { role_id: roleId, permissions }
  }, { loadingText: '保存中...' });
  return result;
};

module.exports = {
  getCurrentUserId,
  // 用户
  getUserById,
  listUsers,
  createUser,
  updateUser,
  enableUser,
  disableUser,
  resetPassword,
  getPropertyStaffList,
  // 角色
  listRoles,
  updateRolePermissions
};
