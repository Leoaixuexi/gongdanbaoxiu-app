/**
 * API Client Service
 * Handles all HTTP requests to the backend API
 * Includes request/response interceptors and error handling
 */

const { API_BASE_URL, STORAGE_KEYS, HTTP_STATUS, REQUEST_TIMEOUT } = require('../utils/constants');
const config = require('../config/index');
const storage = require('./storage');

/**
 * Make HTTP request with interceptors
 * @param {string} url - API endpoint
 * @param {object} options - Request options
 * @returns {Promise} Response data
 */
const request = async (url, options = {}) => {
  try {
    // Show loading indicator
    if (!options.hideLoading) {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
    }

    // Request interceptor - add auth token and headers
    const token = await storage.get(STORAGE_KEYS.TOKEN);
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    };

    // Add authorization token if available
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    // Log request in development
    if (config.enableLog) {
      console.log('[API Request]', {
        url: `${API_BASE_URL}${url}`,
        method: options.method || 'GET',
        header,
        data: options.data
      });
    }

    // Make the request
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE_URL}${url}`,
        method: options.method || 'GET',
        data: options.data,
        header,
        timeout: options.timeout || REQUEST_TIMEOUT,
        success: (res) => resolve(res),
        fail: (error) => reject(error)
      });
    });

    // Hide loading indicator
    if (!options.hideLoading) {
      wx.hideLoading();
    }

    // Log response in development
    if (config.enableLog) {
      console.log('[API Response]', response);
    }

    // Response interceptor - handle different status codes
    const { statusCode, data } = response;

    // Success responses (200-299)
    if (statusCode >= 200 && statusCode < 300) {
      return data;
    }

    // Handle 401 Unauthorized - redirect to login
    if (statusCode === HTTP_STATUS.UNAUTHORIZED) {
      console.warn('[API] Unauthorized access, redirecting to login');
      await storage.remove(STORAGE_KEYS.TOKEN);
      await storage.remove(STORAGE_KEYS.USER_INFO);
      
      wx.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none',
        duration: 2000
      });

      // Redirect to login page after a short delay
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 2000);

      throw new Error('Unauthorized');
    }

    // Handle other error status codes
    const errorMessage = data?.message || '请求失败';
    
    wx.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 2000
    });

    throw new Error(errorMessage);

  } catch (error) {
    // Hide loading indicator on error
    if (!options.hideLoading) {
      wx.hideLoading();
    }

    console.error('[API Error]', error);

    // Handle network errors
    if (error.errMsg) {
      let errorMessage = '网络错误，请检查网络连接';
      
      if (error.errMsg.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试';
      } else if (error.errMsg.includes('fail')) {
        errorMessage = '网络连接失败';
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      });

      throw new Error(errorMessage);
    }

    throw error;
  }
};

/**
 * HTTP GET request
 * @param {string} url - API endpoint
 * @param {object} params - Query parameters
 * @param {object} options - Additional options
 * @returns {Promise} Response data
 */
const get = (url, params = {}, options = {}) => {
  // Convert params object to query string
  const queryString = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const fullUrl = queryString ? `${url}?${queryString}` : url;

  return request(fullUrl, {
    method: 'GET',
    ...options
  });
};

/**
 * HTTP POST request
 * @param {string} url - API endpoint
 * @param {object} data - Request body
 * @param {object} options - Additional options
 * @returns {Promise} Response data
 */
const post = (url, data = {}, options = {}) => {
  return request(url, {
    method: 'POST',
    data,
    ...options
  });
};

/**
 * HTTP PUT request
 * @param {string} url - API endpoint
 * @param {object} data - Request body
 * @param {object} options - Additional options
 * @returns {Promise} Response data
 */
const put = (url, data = {}, options = {}) => {
  return request(url, {
    method: 'PUT',
    data,
    ...options
  });
};

/**
 * HTTP PATCH request
 * @param {string} url - API endpoint
 * @param {object} data - Request body
 * @param {object} options - Additional options
 * @returns {Promise} Response data
 */
const patch = (url, data = {}, options = {}) => {
  return request(url, {
    method: 'PATCH',
    data,
    ...options
  });
};

/**
 * HTTP DELETE request
 * @param {string} url - API endpoint
 * @param {object} options - Additional options
 * @returns {Promise} Response data
 */
const deleteRequest = (url, options = {}) => {
  return request(url, {
    method: 'DELETE',
    ...options
  });
};

/**
 * Upload file to server
 * @param {string} url - API endpoint
 * @param {string} filePath - Local file path
 * @param {object} formData - Additional form data
 * @returns {Promise} Response data
 */
const upload = async (url, filePath, formData = {}) => {
  try {
    wx.showLoading({
      title: '上传中...',
      mask: true
    });

    const token = await storage.get(STORAGE_KEYS.TOKEN);
    const header = {};

    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }

    const response = await new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${API_BASE_URL}${url}`,
        filePath,
        name: 'file',
        formData,
        header,
        success: (res) => resolve(res),
        fail: (error) => reject(error)
      });
    });

    wx.hideLoading();

    const { statusCode, data } = response;
    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

    if (statusCode >= 200 && statusCode < 300) {
      return parsedData;
    }

    throw new Error(parsedData.message || '上传失败');

  } catch (error) {
    wx.hideLoading();
    console.error('[Upload Error]', error);
    
    wx.showToast({
      title: error.message || '上传失败',
      icon: 'none',
      duration: 2000
    });

    throw error;
  }
};

module.exports = {
  request,
  get,
  post,
  put,
  patch,
  delete: deleteRequest,
  upload
};
