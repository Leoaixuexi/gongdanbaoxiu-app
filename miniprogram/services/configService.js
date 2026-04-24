/**
 * 系统配置服务
 * 封装 userAuth 云函数中与系统配置相关的操作
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');
const { STORAGE_KEYS } = require('../utils/constants');

function getCurrentUserId() {
  try {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    return userInfo?.user_id || null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取系统配置
 */
const getSystemConfig = async () => {
  const result = await callCloudSilent('userAuth', {
    action: 'getSystemConfig',
    current_user_id: getCurrentUserId()
  });
  return result;
};

/**
 * 更新单个配置
 */
const updateSystemConfig = async (key, value, description) => {
  const result = await callCloud('userAuth', {
    action: 'updateSystemConfig',
    data: { key, value, description },
    current_user_id: getCurrentUserId()
  }, { loadingText: '保存中...' });
  return result;
};

/**
 * 批量更新配置
 */
const batchUpdateSystemConfig = async (configs) => {
  const result = await callCloud('userAuth', {
    action: 'batchUpdateSystemConfig',
    data: { configs },
    current_user_id: getCurrentUserId()
  }, { loadingText: '保存中...' });
  return result;
};

module.exports = {
  getSystemConfig,
  updateSystemConfig,
  batchUpdateSystemConfig
};
