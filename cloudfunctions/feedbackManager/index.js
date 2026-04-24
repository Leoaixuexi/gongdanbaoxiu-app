/**
 * 意见反馈管理云函数
 * 处理用户反馈的创建、查询
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取用户信息
 */
async function getUserByOpenId(openid) {
  const { data } = await db.collection('users').where({ wechat_openid: openid }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 角色ID到名称映射
 */
const ROLE_NAMES = {
  1: '管理员',
  2: '行政经理',
  3: '维修员',
  4: '办美员工'
};

/**
 * 创建反馈
 */
async function createFeedback(openid, feedbackData) {
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  // 验证必填字段 - type替代原来的title
  const type = (feedbackData.type || '').trim();
  const content = (feedbackData.content || '').trim();

  if (!type) {
    throw new Error('请选择反馈类型');
  }
  if (!content) {
    throw new Error('请填写内容');
  }

  // 处理照片（选填，最多9张）
  const photos = Array.isArray(feedbackData.photos)
    ? feedbackData.photos.filter(p => typeof p === 'string' && p.trim()).slice(0, 9)
    : [];

  const now = new Date();
  const feedbackId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  const newFeedback = {
    feedback_id: feedbackId,
    type,
    content,
    photos,
    // 用户信息
    user_id: user.user_id,
    user_name: user.name || user.username || '用户',
    user_role_id: user.role_id,
    user_role_name: ROLE_NAMES[user.role_id] || '用户',
    _openid: openid,
    // 上下文信息（可选）
    context_info: {
      page_path: feedbackData.page_path || '',
      user_agent: feedbackData.user_agent || '',
      app_version: feedbackData.app_version || '',
      system_info: feedbackData.system_info || ''
    },
    created_at: now
  };

  const result = await db.collection('feedbacks').add({
    data: newFeedback
  });

  return {
    ...newFeedback,
    _id: result._id
  };
}

/**
 * 获取反馈列表
 */
async function getFeedbackList(openid, filters = {}) {
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const page = Math.max(parseInt(filters.page || 1, 10), 1);
  const limit = Math.min(Math.max(parseInt(filters.limit || 20, 10), 1), 100);
  const offset = (page - 1) * limit;

  const conditions = {};

  // 权限控制：管理员看全部，其他用户只看自己的
  if (user.role_id !== 1) {
    conditions.user_id = user.user_id;  // 基于 user_id 过滤，支持账号切换场景
  }

  const [{ total }, { data }] = await Promise.all([
    db.collection('feedbacks').where(conditions).count(),
    db.collection('feedbacks')
      .where(conditions)
      .orderBy('created_at', 'desc')
      .skip(offset)
      .limit(limit)
      .get()
  ]);

  return {
    list: data,
    total,
    page,
    limit,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0
  };
}

/**
 * 删除反馈
 */
async function deleteFeedback(openid, feedbackId) {
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const numericId = parseInt(feedbackId, 10);
  if (Number.isNaN(numericId)) {
    throw new Error('反馈ID不正确');
  }

  const { data } = await db.collection('feedbacks').where({ feedback_id: numericId }).get();
  if (data.length === 0) {
    throw new Error('反馈不存在');
  }

  const feedback = data[0];

  // 权限控制：只能删除自己的反馈（管理员可删除任意反馈）
  if (user.role_id !== 1 && feedback.user_id !== user.user_id) {
    throw new Error('无权限删除此反馈');
  }

  await db.collection('feedbacks').where({ feedback_id: numericId }).remove();

  return { feedback_id: numericId };
}

/**
 * 获取反馈详情
 */
async function getFeedbackById(openid, feedbackId) {
  const user = await getUserByOpenId(openid);
  if (!user) {
    throw new Error('用户不存在');
  }
  if (user.active === false) {
    throw new Error('账号已被停用');
  }

  const numericId = parseInt(feedbackId, 10);
  if (Number.isNaN(numericId)) {
    throw new Error('反馈ID不正确');
  }

  const { data } = await db.collection('feedbacks').where({ feedback_id: numericId }).get();
  if (data.length === 0) {
    throw new Error('反馈不存在');
  }

  const feedback = data[0];

  // 权限控制：管理员可查看全部，其他用户只能查看自己的
  if (user.role_id !== 1 && feedback.user_id !== user.user_id) {
    throw new Error('无权限查看此反馈');
  }

  return feedback;
}

/**
 * 主函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      error: '无法获取微信身份'
    };
  }

  console.log(`[FeedbackManager] Action: ${action}, OpenID: ${openid}`);

  try {
    switch (action) {
      case 'create':
        const newFeedback = await createFeedback(openid, data);
        return {
          success: true,
          feedback: newFeedback,
          message: '提交成功'
        };

      case 'list':
        const listResult = await getFeedbackList(openid, data.filters || {});
        return {
          success: true,
          ...listResult
        };

      case 'getById':
        const feedback = await getFeedbackById(openid, data.feedback_id);
        return {
          success: true,
          feedback
        };

      case 'delete':
        const deleteResult = await deleteFeedback(openid, data.feedback_id);
        return {
          success: true,
          ...deleteResult,
          message: '删除成功'
        };

      default:
        return {
          success: false,
          error: `未知操作: ${action}`
        };
    }
  } catch (error) {
    console.error('[FeedbackManager] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
