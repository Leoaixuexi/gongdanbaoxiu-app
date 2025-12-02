# 小程序配置说明

## 配置文件：config/index.js

### 环境切换

在 `config/index.js` 文件中修改 `isDevelopment` 变量：

```javascript
// 开发环境
const isDevelopment = true;

// 生产环境
const isDevelopment = false;
```

### API地址配置

#### 开发环境
默认配置连接到本地后端服务：
```javascript
development: {
  baseURL: 'http://localhost:3000/api',
  timeout: 30000,
  enableLog: true
}
```

**注意**：
- 在微信开发者工具中，需要勾选"不校验合法域名"才能访问本地服务器
- 路径：详情 -> 本地设置 -> 不校验合法域名、web-view、TLS版本及HTTPS证书

#### 生产环境
需要修改为实际的生产服务器地址：
```javascript
production: {
  baseURL: 'https://your-production-domain.com/api',
  timeout: 10000,
  enableLog: false
}
```

**生产环境要求**：
1. 必须使用 HTTPS 协议
2. 域名需要在微信公众平台配置为合法域名
3. 配置路径：微信公众平台 -> 开发管理 -> 开发设置 -> 服务器域名

### 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `baseURL` | String | API基础地址，所有请求都会以此为前缀 |
| `timeout` | Number | 请求超时时间（毫秒） |
| `enableLog` | Boolean | 是否启用API日志输出（开发环境建议开启） |

### 微信小程序AppID

在 `config/index.js` 中配置：
```javascript
wechat: {
  appId: 'wx8553f910840a6bf1' // 替换为您的实际AppID
}
```

## 使用配置

在代码中引用配置：

```javascript
const config = require('../config/index');

console.log('当前环境:', config.isDevelopment ? '开发' : '生产');
console.log('API地址:', config.baseURL);
console.log('超时时间:', config.timeout);
```

## 常见问题

### 1. 请求失败：ERR_CERT_AUTHORITY_INVALID

**原因**：本地开发环境使用HTTP协议
**解决**：在微信开发者工具中勾选"不校验合法域名"

### 2. 请求失败：request:fail url not in domain list

**原因**：生产环境域名未在微信公众平台配置
**解决**：
1. 登录微信公众平台
2. 进入"开发管理" -> "开发设置"
3. 在"服务器域名"中添加API域名

### 3. 如何切换环境？

只需修改 `config/index.js` 中的 `isDevelopment` 变量即可：
- `true` = 开发环境（本地）
- `false` = 生产环境（线上）

### 4. 生产环境部署前检查清单

- [ ] 修改 `isDevelopment = false`
- [ ] 更新 `production.baseURL` 为实际服务器地址
- [ ] 确保使用 HTTPS 协议
- [ ] 在微信公众平台配置合法域名
- [ ] 关闭日志输出 `enableLog: false`
- [ ] 测试所有API接口

## 示例

### 开发环境配置
```javascript
const isDevelopment = true;

const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 30000,
    enableLog: true
  },
  production: {
    baseURL: 'https://api.example.com/api',
    timeout: 10000,
    enableLog: false
  }
};
```

### 生产环境配置
```javascript
const isDevelopment = false;

const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 30000,
    enableLog: true
  },
  production: {
    baseURL: 'https://api.yourdomain.com/api', // 您的实际域名
    timeout: 10000,
    enableLog: false
  }
};
```

## 相关文件

- `miniprogram/config/index.js` - 配置文件
- `miniprogram/services/api.js` - API服务（使用配置）
- `miniprogram/utils/constants.js` - 常量定义（使用配置）
