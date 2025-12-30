/**
 * Cloud Function: Login
 * Purpose: Get user's openid and session information
 *
 * This function automatically retrieves the user's WeChat openid
 * without requiring any input parameters.
 */

const cloud = require('wx-server-sdk');

// Initialize cloud SDK
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();

    // 只记录操作状态，不输出敏感信息
    console.log('[Cloud Function - Login] User login success');

    return {
      success: true,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Cloud Function - Login] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
