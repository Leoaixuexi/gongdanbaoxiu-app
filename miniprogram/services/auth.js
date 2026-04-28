/**
 * Authentication Service
 * Handles WeChat login, logout, and user session management
 * Supports both cloud-based and password-based authentication
 */

const storage = require('./storage');
const { callCloud, callCloudSilent } = require('../utils/cloudCall');
const { STORAGE_KEYS } = require('../utils/constants');

// Token过期天数
const TOKEN_EXPIRY_DAYS = 7;

/**
 * Password Login (Username/Password Authentication)
 * Uses cloud function for password-based authentication
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<object>} User info
 */
const loginWithPassword = async (username, password) => {
  console.log('[Auth] Starting password login...');

  const result = await callCloud('userAuth', {
    action: 'passwordLogin',
    data: { username, password }
  }, { loadingText: '登录中...' });

  console.log('[Auth] Password login result:', result);

  const { user, permissions } = result;

  // Store user info and permissions
  // 确保 user_id 字段存在（兼容云函数返回的 id 字段）
  const normalizedUser = {
    ...user,
    user_id: user.user_id || user.id
  };
  await storage.set(STORAGE_KEYS.USER_INFO, normalizedUser);
  await storage.set(STORAGE_KEYS.USER_PERMISSIONS, permissions);
  await storage.set(STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
  await storage.set(STORAGE_KEYS.TOKEN, 'authenticated');

  wx.showToast({
    title: '登录成功',
    icon: 'success',
    duration: 1500
  });

  console.log('[Auth] Password login successful:', user);
  return user;
};

/**
 * WeChat Cloud Login (Pure Cloud Database Version)
 * Uses cloud function for authentication, no backend required
 * @returns {Promise<object>} User info
 */
const login = async () => {
  console.log('[Auth] Starting cloud login...');

  const result = await callCloud('userAuth', {
    action: 'login'
  }, { loadingText: '登录中...' });

  console.log('[Auth] Cloud login result:', result);

  const { user, permissions, isNewUser } = result;

  // Store user info and permissions
  // 确保 user_id 字段存在（兼容云函数返回的 id 字段）
  const normalizedUser = {
    ...user,
    user_id: user.user_id || user.id
  };
  await storage.set(STORAGE_KEYS.USER_INFO, normalizedUser);
  await storage.set(STORAGE_KEYS.USER_PERMISSIONS, permissions);
  await storage.set(STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
  await storage.set(STORAGE_KEYS.TOKEN, 'cloud_authenticated');

  wx.showToast({
    title: isNewUser ? '注册成功' : '登录成功',
    icon: 'success',
    duration: 1500
  });

  console.log('[Auth] Cloud login successful:', user);
  return user;
};

/**
 * Logout user
 * Clears token, user info, and permissions from storage
 * @returns {Promise<void>}
 */
const logout = async () => {
  try {
    console.log('[Auth] Logging out...');

    // Clear all auth-related data from storage
    await Promise.all([
      storage.remove(STORAGE_KEYS.TOKEN),
      storage.remove(STORAGE_KEYS.USER_INFO),
      storage.remove(STORAGE_KEYS.USER_PERMISSIONS),
      storage.remove(STORAGE_KEYS.LAST_LOGIN)
    ]);

    // 清除全局未读消息数缓存，确保账号切换后不会显示旧账号数据
    const app = getApp();
    if (app && app.clearUnreadCounts) {
      app.clearUnreadCounts();
    }

    wx.showToast({
      title: '已退出登录',
      icon: 'success',
      duration: 1500
    });

    // Redirect to login page
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/login/login'
      });
    }, 1500);

    console.log('[Auth] Logout successful');

  } catch (error) {
    console.error('[Auth] Logout error:', error);

    wx.showToast({
      title: '退出登录失败',
      icon: 'none',
      duration: 2000
    });

    throw error;
  }
};

/**
 * 清理所有认证相关的存储数据
 * @returns {Promise<void>}
 */
const clearAuthStorage = async () => {
  try {
    await Promise.all([
      storage.remove(STORAGE_KEYS.TOKEN),
      storage.remove(STORAGE_KEYS.USER_INFO),
      storage.remove(STORAGE_KEYS.USER_PERMISSIONS),
      storage.remove(STORAGE_KEYS.LAST_LOGIN)
    ]);
  } catch (e) {
    console.error('[Auth] Failed to clear auth storage:', e);
  }
};

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if user has valid token
 */
const isAuthenticated = async () => {
  try {
    const token = await storage.get(STORAGE_KEYS.TOKEN);
    const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
    const lastLogin = await storage.get(STORAGE_KEYS.LAST_LOGIN);

    // 检查基本认证数据
    if (!token || !userInfo) {
      console.log('[Auth] No token or userInfo');
      return false;
    }

    // 检查 userInfo 数据完整性（防止存储损坏）
    if (typeof userInfo !== 'object' || !userInfo.user_id) {
      console.warn('[Auth] userInfo 数据损坏，清理存储');
      await clearAuthStorage();
      return false;
    }

    // 检查Token是否过期
    if (lastLogin) {
      const loginTime = new Date(lastLogin).getTime();
      // 检查 lastLogin 是否为有效日期
      if (isNaN(loginTime)) {
        console.warn('[Auth] lastLogin 数据损坏，清理存储');
        await clearAuthStorage();
        return false;
      }

      const daysSinceLogin = (Date.now() - loginTime) / (1000 * 60 * 60 * 24);

      if (daysSinceLogin > TOKEN_EXPIRY_DAYS) {
        console.log('[Auth] Token已过期，天数:', daysSinceLogin.toFixed(1));
        await clearAuthStorage();
        return false;
      }
    }

    console.log('[Auth] Is authenticated: true');
    return true;
  } catch (error) {
    console.error('[Auth] Error checking authentication:', error);
    // 发生异常时清理可能损坏的存储数据
    await clearAuthStorage();
    return false;
  }
};

/**
 * Get current user info from storage
 * @returns {Promise<object|null>} User info or null if not logged in
 */
const getCurrentUser = async () => {
  try {
    const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);
    console.log('[Auth] Current user:', userInfo);
    return userInfo;
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
};

/**
 * Update user info in storage
 * @param {object} userInfo - Updated user info
 * @returns {Promise<void>}
 */
const updateUserInfo = async (userInfo) => {
  try {
    if (!userInfo) {
      throw new Error('User info is required');
    }

    await storage.set(STORAGE_KEYS.USER_INFO, userInfo);
    console.log('[Auth] User info updated:', userInfo);

    wx.showToast({
      title: '信息更新成功',
      icon: 'success',
      duration: 1500
    });

  } catch (error) {
    console.error('[Auth] Error updating user info:', error);

    wx.showToast({
      title: '更新失败',
      icon: 'none',
      duration: 2000
    });

    throw error;
  }
};

/**
 * Get user permissions from storage
 * @returns {Promise<object|null>} User permissions or null
 */
const getUserPermissions = async () => {
  try {
    const permissions = await storage.get(STORAGE_KEYS.USER_PERMISSIONS);
    console.log('[Auth] User permissions:', permissions);
    return permissions;
  } catch (error) {
    console.error('[Auth] Error getting user permissions:', error);
    return null;
  }
};

/**
 * Check if user has specific permission
 * @param {string} permission - Permission to check
 * @returns {Promise<boolean>} True if user has permission
 */
const hasPermission = async (permission) => {
  try {
    const permissions = await getUserPermissions();

    if (!permissions) {
      return false;
    }

    // Support both formats:
    // - modules as array: ['manage_users', ...]
    // - modules as object map: { manage_users: true, ... }
    if (permissions.modules) {
      if (Array.isArray(permissions.modules)) {
        return permissions.modules.includes(permission);
      }
      if (typeof permissions.modules === 'object') {
        return permissions.modules[permission] === true;
      }
    }

    return false;
  } catch (error) {
    console.error('[Auth] Error checking permission:', error);
    return false;
  }
};

/**
 * Change password
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<object>} Result
 */
const changePassword = async (oldPassword, newPassword) => {
  console.log('[Auth] Changing password...');
  const result = await callCloudSilent('userAuth', {
    action: 'changePassword',
    data: { old_password: oldPassword, new_password: newPassword }
  });
  console.log('[Auth] Change password result:', result);
  return result;
};

module.exports = {
  login,
  loginWithPassword,
  logout,
  isAuthenticated,
  getCurrentUser,
  updateUserInfo,
  getUserPermissions,
  hasPermission,
  changePassword
};
