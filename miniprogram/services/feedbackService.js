/**
 * 意见反馈服务
 * 封装 feedbackManager 云函数调用
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

/**
 * 获取反馈列表
 */
const listFeedbacks = async (filters = {}) => {
  const result = await callCloudSilent('feedbackManager', {
    action: 'list',
    data: filters
  });
  return result;
};

/**
 * 获取反馈详情
 */
const getFeedbackById = async (feedbackId) => {
  const result = await callCloudSilent('feedbackManager', {
    action: 'getById',
    data: { feedback_id: feedbackId }
  });
  return result;
};

/**
 * 创建反馈
 */
const createFeedback = async (data) => {
  const result = await callCloud('feedbackManager', {
    action: 'create',
    data
  }, { loadingText: '提交中...' });
  return result;
};

/**
 * 删除反馈
 */
const deleteFeedback = async (feedbackId) => {
  const result = await callCloud('feedbackManager', {
    action: 'delete',
    data: { feedback_id: feedbackId }
  }, { loadingText: '删除中...' });
  return result;
};

module.exports = {
  listFeedbacks,
  getFeedbackById,
  createFeedback,
  deleteFeedback
};
