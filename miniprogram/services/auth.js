/**
 * Authentication Service
 * Handles WeChat login, logout, and user session management
 * Supports both cloud-based and password-based authentication
 */

const api = require('./api');
const storage = require('./storage');
const cloud = require('./cloud');
const { STORAGE_KEYS } = require('../utils/constants');

/**
 * Password Login (Username/Password Authentication)
 * Uses cloud function for password-based authentication
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<object>} User info
 */
const loginWithPassword = async (username, password) => {
  try {
    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    console.log('[Auth] Starting password login...');

    // Call userAuth cloud function with passwordLogin action
    const result = await wx.cloud.callFunction({
      name: 'userAuth',
      data: {
        action: 'passwordLogin',
        data: {
          username,
          password
        }
      }
    });

    console.log('[Auth] Password login result:', result);

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '登录失败');
    }

    const { user, permissions } = result.result;

    // Store user info and permissions
    await storage.set(STORAGE_KEYS.USER_INFO, user);
    await storage.set(STORAGE_KEYS.USER_PERMISSIONS, permissions);
    await storage.set(STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());

    // Store a flag for authentication
    await storage.set(STORAGE_KEYS.TOKEN, 'authenticated');

    wx.hideLoading();

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    console.log('[Auth] Password login successful:', user);
    return user;

  } catch (error) {
    wx.hideLoading();
    console.error('[Auth] Password login error:', error);

    const errorMessage = error.message || '登录失败，请稍后重试';
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    });

    throw error;
  }
};

/**
 * WeChat Cloud Login (Pure Cloud Database Version)
 * Uses cloud function for authentication, no backend required
 * @returns {Promise<object>} User info
 */
const login = async () => {
  try {
    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    console.log('[Auth] Starting cloud login...');

    // Call userAuth cloud function
    const result = await wx.cloud.callFunction({
      name: 'userAuth',
      data: {
        action: 'login'
      }
    });

    console.log('[Auth] Cloud login result:', result);

    if (!result.result || !result.result.success) {
      throw new Error(result.result?.error || '云登录失败');
    }

    const { user, permissions, isNewUser } = result.result;

    // Store user info and permissions
    await storage.set(STORAGE_KEYS.USER_INFO, user);
    await storage.set(STORAGE_KEYS.USER_PERMISSIONS, permissions);
    await storage.set(STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());

    // For cloud login, we don't need JWT token, but store a flag for compatibility
    await storage.set(STORAGE_KEYS.TOKEN, 'cloud_authenticated');

    wx.hideLoading();

    wx.showToast({
      title: isNewUser ? '注册成功' : '登录成功',
      icon: 'success',
      duration: 1500
    });

    console.log('[Auth] Cloud login successful:', user);
    return user;

  } catch (error) {
    wx.hideLoading();
    console.error('[Auth] Cloud login error:', error);

    const errorMessage = error.message || '登录失败，请稍后重试';
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    });

    throw error;
  }
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
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if user has valid token
 */
const isAuthenticated = async () => {
  try {
    const token = await storage.get(STORAGE_KEYS.TOKEN);
    const userInfo = await storage.get(STORAGE_KEYS.USER_INFO);

    const isAuth = !!(token && userInfo);
    console.log('[Auth] Is authenticated:', isAuth);

    return isAuth;
  } catch (error) {
    console.error('[Auth] Error checking authentication:', error);
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
  try {
    console.log('[Auth] Changing password...');

    const result = await wx.cloud.callFunction({
      name: 'userAuth',
      data: {
        action: 'changePassword',
        data: {
          old_password: oldPassword,
          new_password: newPassword
        }
      }
    });

    console.log('[Auth] Change password result:', result);

    if (!result.result) {
      throw new Error('修改密码失败');
    }

    return result.result;
  } catch (error) {
    console.error('[Auth] Error changing password:', error);
    throw error;
  }
};

/**
 * Refresh user info from backend
 * @returns {Promise<object>} Updated user info
 */
const refreshUserInfo = async () => {
  try {
    const response = await api.get('/auth/me');
    
    if (response.user) {
      await storage.set(STORAGE_KEYS.USER_INFO, response.user);
      
      if (response.permissions) {
        await storage.set(STORAGE_KEYS.USER_PERMISSIONS, response.permissions);
      }

      console.log('[Auth] User info refreshed:', response.user);
      return response.user;
    }

    throw new Error('Failed to refresh user info');

  } catch (error) {
    console.error('[Auth] Error refreshing user info:', error);
    throw error;
  }
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
  changePassword,
  refreshUserInfo
};
