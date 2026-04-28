/**
 * 公告管理服务
 * 封装 userAuth 云函数中与公告相关的操作
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
 * 获取公告列表（管理端）
 */
const listAnnouncements = async (filters = {}) => {
  const result = await callCloudSilent('userAuth', {
    action: 'listAnnouncements',
    data: filters,
    current_user_id: getCurrentUserId()
  });
  return { list: result.announcements || [] };
};

/**
 * 获取公告详情
 */
const getAnnouncement = async (announcementId) => {
  const result = await callCloudSilent('userAuth', {
    action: 'getAnnouncement',
    data: { announcement_id: announcementId },
    current_user_id: getCurrentUserId()
  });
  return result.announcement;
};

/**
 * 创建公告
 */
const createAnnouncement = async (data) => {
  const result = await callCloud('userAuth', {
    action: 'createAnnouncement',
    data,
    current_user_id: getCurrentUserId()
  }, { loadingText: '创建中...' });
  return result;
};

/**
 * 更新公告
 */
const updateAnnouncement = async (announcementId, updateData) => {
  const result = await callCloud('userAuth', {
    action: 'updateAnnouncement',
    data: { announcement_id: announcementId, ...updateData },
    current_user_id: getCurrentUserId()
  }, { loadingText: '保存中...' });
  return result;
};

/**
 * 发布公告
 */
const publishAnnouncement = async (announcementId) => {
  const result = await callCloud('userAuth', {
    action: 'publishAnnouncement',
    data: { announcement_id: announcementId },
    current_user_id: getCurrentUserId()
  }, { loadingText: '发布中...' });
  return result;
};

/**
 * 下线公告
 */
const offlineAnnouncement = async (announcementId) => {
  const result = await callCloud('userAuth', {
    action: 'offlineAnnouncement',
    data: { announcement_id: announcementId },
    current_user_id: getCurrentUserId()
  }, { loadingText: '处理中...' });
  return result;
};

/**
 * 删除公告
 */
const deleteAnnouncement = async (announcementId) => {
  const result = await callCloud('userAuth', {
    action: 'deleteAnnouncement',
    data: { announcement_id: announcementId },
    current_user_id: getCurrentUserId()
  }, { loadingText: '删除中...' });
  return result;
};

/**
 * 隐藏公告（用户级别）
 */
const hideAnnouncement = async (announcementId) => {
  const result = await callCloudSilent('sendNotification', {
    action: 'hideAnnouncement',
    data: { announcement_id: announcementId }
  });
  return result;
};

/**
 * 获取用户可见的公告列表
 */
const listAnnouncementsForUser = async (roleId) => {
  try {
    const result = await callCloudSilent('userAuth', {
      action: 'listAnnouncements',
      data: { forUser: true, roleId },
      current_user_id: getCurrentUserId()
    });
    return { list: result.announcements || [] };
  } catch (error) {
    if (error.message && error.message.includes('collection not exists')) {
      console.warn('[Announcement] 集合不存在，返回空列表');
      return { list: [] };
    }
    throw error;
  }
};

module.exports = {
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  offlineAnnouncement,
  deleteAnnouncement,
  hideAnnouncement,
  listAnnouncementsForUser
};
