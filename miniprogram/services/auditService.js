/**
 * 审计日志服务
 * 封装 userAuth 云函数中与审计日志相关的操作
 */

const { callCloudSilent } = require('../utils/cloudCall');
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
 * 获取审计日志列表
 */
const listAuditLogs = async (filters = {}) => {
  const result = await callCloudSilent('userAuth', {
    action: 'listAuditLogs',
    data: filters,
    current_user_id: getCurrentUserId()
  });
  return result;
};

/**
 * 获取审计动作类型列表
 */
const getAuditActions = async () => {
  const result = await callCloudSilent('userAuth', {
    action: 'getAuditLogActions',
    current_user_id: getCurrentUserId()
  });
  return result.actions;
};

module.exports = {
  listAuditLogs,
  getAuditActions
};
