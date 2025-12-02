/**
 * 小程序环境配置
 * Configuration for WeChat Mini Program
 */

// 判断是否为开发环境
const isDevelopment = true; // 开发环境设置为true，生产环境设置为false

// 数据存储模式配置
const USE_CLOUD_DATABASE = false; // true: 使用云数据库, false: 使用后端API

// API基础地址配置 (仅在USE_CLOUD_DATABASE=false时使用)
const API_CONFIG = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 30000,
    enableLog: true
  },
  // 生产环境
  production: {
    baseURL: 'https://your-production-domain.com/api',
    timeout: 10000,
    enableLog: false
  }
};

// 获取当前环境配置
const getConfig = () => {
  return isDevelopment ? API_CONFIG.development : API_CONFIG.production;
};

// 导出配置
module.exports = {
  isDevelopment,
  useCloudDatabase: USE_CLOUD_DATABASE,
  ...getConfig(),
  // 微信小程序配置
  wechat: {
    appId: 'wx8553f910840a6bf1' // 从project.config.json获取
  }
};
