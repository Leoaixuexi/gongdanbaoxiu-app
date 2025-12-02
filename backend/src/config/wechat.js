const axios = require('axios');
const logger = require('../utils/logger');

/**
 * WeChat Mini Program API Configuration
 * Provides configuration and helper functions for WeChat API integration
 *
 * Features:
 * - Access token management with Redis caching
 * - Template message sending
 * - User authentication (code2Session)
 * - Retry logic for failed requests
 */

// WeChat API Endpoints
const WECHAT_API = {
  // Get access token
  ACCESS_TOKEN_URL: 'https://api.weixin.qq.com/cgi-bin/token',
  // Login (code2Session)
  LOGIN_URL: 'https://api.weixin.qq.com/sns/jscode2session',
  // Send template message
  TEMPLATE_MESSAGE_URL: 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send',
  // Get phone number
  PHONE_NUMBER_URL: 'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
};

// WeChat configuration
const wechatConfig = {
  appId: process.env.WECHAT_APPID,
  appSecret: process.env.WECHAT_SECRET,
  apiEndpoints: WECHAT_API,
};

// Validate configuration on module load
if (!wechatConfig.appId || !wechatConfig.appSecret) {
  logger.error('WeChat configuration is incomplete', {
    hasAppId: !!wechatConfig.appId,
    hasAppSecret: !!wechatConfig.appSecret,
  });
}

/**
 * Get Redis client instance
 * Lazy loading to avoid circular dependency
 */
let redisClient = null;
const getRedisClient = () => {
  if (!redisClient) {
    redisClient = require('./redis');
  }
  return redisClient;
};

/**
 * Get WeChat access token
 * Caches token in Redis for 2 hours (WeChat tokens expire after 2 hours)
 *
 * @returns {Promise<string>} Access token
 * @throws {Error} If token retrieval fails
 */
const getAccessToken = async () => {
  try {
    const redis = getRedisClient();
    const cacheKey = 'wechat:access_token';

    // Try to get from cache first
    const cachedToken = await redis.get(cacheKey);
    if (cachedToken) {
      logger.debug('Using cached WeChat access token');
      return cachedToken;
    }

    // Fetch new token from WeChat API
    logger.info('Fetching new WeChat access token');
    const response = await axios.get(WECHAT_API.ACCESS_TOKEN_URL, {
      params: {
        grant_type: 'client_credential',
        appid: wechatConfig.appId,
        secret: wechatConfig.appSecret,
      },
      timeout: 10000, // 10 second timeout
    });

    // Check for errors in response
    if (response.data.errcode) {
      throw new Error(
        `WeChat API error: ${response.data.errcode} - ${response.data.errmsg}`
      );
    }

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('No access token received from WeChat API');
    }

    // Cache token for slightly less than expiry time (7200s = 2 hours)
    // We cache for 7000s to ensure we refresh before actual expiry
    const cacheTTL = Math.min(expires_in - 200, 7000);
    await redis.set(cacheKey, access_token, cacheTTL);

    logger.info('WeChat access token obtained and cached', {
      expiresIn: expires_in,
      cacheTTL,
    });

    return access_token;
  } catch (error) {
    logger.error('Failed to get WeChat access token', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to get WeChat access token: ${error.message}`);
  }
};

/**
 * Login via WeChat (code2Session)
 * Exchanges temporary code for openid and session_key
 *
 * @param {string} code - Temporary login code from WeChat client
 * @returns {Promise<Object>} Object containing openid, session_key, unionid
 * @throws {Error} If login fails
 */
const login = async (code) => {
  try {
    if (!code) {
      throw new Error('WeChat login code is required');
    }

    logger.info('WeChat login request', { codeLength: code.length });

    const response = await axios.get(WECHAT_API.LOGIN_URL, {
      params: {
        appid: wechatConfig.appId,
        secret: wechatConfig.appSecret,
        js_code: code,
        grant_type: 'authorization_code',
      },
      timeout: 10000,
    });

    // Check for errors
    if (response.data.errcode) {
      throw new Error(
        `WeChat login error: ${response.data.errcode} - ${response.data.errmsg}`
      );
    }

    const { openid, session_key, unionid } = response.data;

    if (!openid || !session_key) {
      throw new Error('Invalid response from WeChat login API');
    }

    logger.info('WeChat login successful', {
      hasOpenid: !!openid,
      hasSessionKey: !!session_key,
      hasUnionid: !!unionid,
    });

    return {
      openid,
      session_key,
      unionid: unionid || null,
    };
  } catch (error) {
    logger.error('WeChat login failed', {
      error: error.message,
      code: code ? code.substring(0, 10) + '...' : null,
    });
    throw new Error(`WeChat login failed: ${error.message}`);
  }
};

/**
 * Send WeChat template message
 * Sends a subscribe message to a user via WeChat
 *
 * @param {string} openid - User's WeChat openid
 * @param {string} templateId - Template message ID
 * @param {Object} data - Template data (key-value pairs)
 * @param {string} page - Optional page path to navigate to on click
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<Object>} Send result
 * @throws {Error} If sending fails after retries
 */
const sendTemplateMessage = async (
  openid,
  templateId,
  data,
  page = '',
  retryCount = 0
) => {
  const maxRetries = 3;

  try {
    if (!openid || !templateId || !data) {
      throw new Error('Missing required parameters for template message');
    }

    // Get access token
    const accessToken = await getAccessToken();

    // Format data according to WeChat API requirements
    const formattedData = {};
    Object.keys(data).forEach((key) => {
      formattedData[key] = {
        value: String(data[key]),
      };
    });

    const payload = {
      touser: openid,
      template_id: templateId,
      page,
      data: formattedData,
      miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'trial',
    };

    logger.info('Sending WeChat template message', {
      openid: openid.substring(0, 10) + '...',
      templateId,
      page,
    });

    const response = await axios.post(
      `${WECHAT_API.TEMPLATE_MESSAGE_URL}?access_token=${accessToken}`,
      payload,
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      // If access token is invalid, clear cache and retry
      if (response.data.errcode === 40001 || response.data.errcode === 42001) {
        if (retryCount < maxRetries) {
          logger.warn('Access token invalid, refreshing and retrying', {
            errcode: response.data.errcode,
            retryCount: retryCount + 1,
          });
          const redis = getRedisClient();
          await redis.del('wechat:access_token');
          // Retry with incremented count
          return sendTemplateMessage(openid, templateId, data, page, retryCount + 1);
        }
      }

      throw new Error(
        `WeChat template message error: ${response.data.errcode} - ${response.data.errmsg}`
      );
    }

    logger.info('WeChat template message sent successfully', {
      msgid: response.data.msgid,
    });

    return {
      success: true,
      msgid: response.data.msgid,
    };
  } catch (error) {
    // Retry logic for network errors
    if (retryCount < maxRetries && error.code === 'ECONNRESET') {
      logger.warn('Network error, retrying template message', {
        retryCount: retryCount + 1,
        error: error.message,
      });
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      return sendTemplateMessage(openid, templateId, data, page, retryCount + 1);
    }

    logger.error('Failed to send WeChat template message', {
      error: error.message,
      openid: openid ? openid.substring(0, 10) + '...' : null,
      templateId,
      retryCount,
    });

    throw new Error(`Failed to send WeChat template message: ${error.message}`);
  }
};

/**
 * Get user phone number
 * Decrypts and retrieves user's phone number from WeChat
 *
 * @param {string} code - Code from WeChat client for phone number
 * @returns {Promise<Object>} Phone number information
 * @throws {Error} If retrieval fails
 */
const getPhoneNumber = async (code) => {
  try {
    if (!code) {
      throw new Error('Phone number code is required');
    }

    const accessToken = await getAccessToken();

    const response = await axios.post(
      `${WECHAT_API.PHONE_NUMBER_URL}?access_token=${accessToken}`,
      { code },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      throw new Error(
        `WeChat phone number error: ${response.data.errcode} - ${response.data.errmsg}`
      );
    }

    const phoneInfo = response.data.phone_info;

    logger.info('WeChat phone number retrieved successfully', {
      hasPhoneNumber: !!phoneInfo.phoneNumber,
    });

    return {
      phoneNumber: phoneInfo.phoneNumber,
      purePhoneNumber: phoneInfo.purePhoneNumber,
      countryCode: phoneInfo.countryCode,
    };
  } catch (error) {
    logger.error('Failed to get WeChat phone number', {
      error: error.message,
    });
    throw new Error(`Failed to get WeChat phone number: ${error.message}`);
  }
};

// Export configuration and helper functions
module.exports = {
  config: wechatConfig,
  getAccessToken,
  login,
  sendTemplateMessage,
  getPhoneNumber,
};
