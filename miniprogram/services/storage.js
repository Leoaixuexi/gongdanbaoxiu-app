/**
 * Storage Service
 * Wraps WeChat storage APIs with Promise-based interface
 * Provides type-safe storage operations with automatic JSON serialization
 */

/**
 * Set storage value asynchronously
 * @param {string} key - Storage key
 * @param {any} value - Value to store (will be JSON serialized)
 * @returns {Promise<void>}
 */
const set = (key, value) => {
  return new Promise((resolve, reject) => {
    try {
      wx.setStorage({
        key,
        data: value,
        success: () => {
          console.log(`[Storage] Set ${key}:`, value);
          resolve();
        },
        fail: (error) => {
          console.error(`[Storage] Failed to set ${key}:`, error);
          reject(error);
        }
      });
    } catch (error) {
      console.error(`[Storage] Exception while setting ${key}:`, error);
      reject(error);
    }
  });
};

/**
 * Get storage value asynchronously
 * @param {string} key - Storage key
 * @returns {Promise<any>} Stored value or null if not found
 */
const get = (key) => {
  return new Promise((resolve, reject) => {
    try {
      wx.getStorage({
        key,
        success: (res) => {
          console.log(`[Storage] Get ${key}:`, res.data);
          resolve(res.data);
        },
        fail: (error) => {
          // Return null for missing keys instead of error
          if (error.errMsg && error.errMsg.includes('data not found')) {
            console.log(`[Storage] Key ${key} not found, returning null`);
            resolve(null);
          } else {
            console.error(`[Storage] Failed to get ${key}:`, error);
            reject(error);
          }
        }
      });
    } catch (error) {
      console.error(`[Storage] Exception while getting ${key}:`, error);
      reject(error);
    }
  });
};

/**
 * Remove storage value asynchronously
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
const remove = (key) => {
  return new Promise((resolve, reject) => {
    try {
      wx.removeStorage({
        key,
        success: () => {
          console.log(`[Storage] Removed ${key}`);
          resolve();
        },
        fail: (error) => {
          console.error(`[Storage] Failed to remove ${key}:`, error);
          reject(error);
        }
      });
    } catch (error) {
      console.error(`[Storage] Exception while removing ${key}:`, error);
      reject(error);
    }
  });
};

/**
 * Clear all storage asynchronously
 * @returns {Promise<void>}
 */
const clear = () => {
  return new Promise((resolve, reject) => {
    try {
      wx.clearStorage({
        success: () => {
          console.log('[Storage] Cleared all storage');
          resolve();
        },
        fail: (error) => {
          console.error('[Storage] Failed to clear storage:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('[Storage] Exception while clearing storage:', error);
      reject(error);
    }
  });
};

/**
 * Set storage value synchronously
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
const setSync = (key, value) => {
  try {
    wx.setStorageSync(key, value);
    console.log(`[Storage] Set sync ${key}:`, value);
  } catch (error) {
    console.error(`[Storage] Failed to set sync ${key}:`, error);
    throw error;
  }
};

/**
 * Get storage value synchronously
 * @param {string} key - Storage key
 * @returns {any} Stored value or null if not found
 */
const getSync = (key) => {
  try {
    const value = wx.getStorageSync(key);
    console.log(`[Storage] Get sync ${key}:`, value);
    return value || null;
  } catch (error) {
    console.error(`[Storage] Failed to get sync ${key}:`, error);
    return null;
  }
};

/**
 * Remove storage value synchronously
 * @param {string} key - Storage key
 */
const removeSync = (key) => {
  try {
    wx.removeStorageSync(key);
    console.log(`[Storage] Removed sync ${key}`);
  } catch (error) {
    console.error(`[Storage] Failed to remove sync ${key}:`, error);
    throw error;
  }
};

/**
 * Clear all storage synchronously
 */
const clearSync = () => {
  try {
    wx.clearStorageSync();
    console.log('[Storage] Cleared all storage sync');
  } catch (error) {
    console.error('[Storage] Failed to clear storage sync:', error);
    throw error;
  }
};

/**
 * Get storage info
 * @returns {Promise<object>} Storage info with keys, currentSize, limitSize
 */
const getInfo = () => {
  return new Promise((resolve, reject) => {
    try {
      wx.getStorageInfo({
        success: (res) => {
          console.log('[Storage] Info:', res);
          resolve(res);
        },
        fail: (error) => {
          console.error('[Storage] Failed to get info:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('[Storage] Exception while getting info:', error);
      reject(error);
    }
  });
};

module.exports = {
  set,
  get,
  remove,
  clear,
  setSync,
  getSync,
  removeSync,
  clearSync,
  getInfo
};
