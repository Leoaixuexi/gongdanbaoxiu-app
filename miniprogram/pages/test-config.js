// 测试配置加载
const config = require('../config/index');

console.log('========= CONFIG TEST =========');
console.log('useCloudDatabase:', config.useCloudDatabase);
console.log('isDevelopment:', config.isDevelopment);
console.log('baseURL:', config.baseURL);
console.log('===============================');

module.exports = {};
