# 数据看板问题诊断与修复

## 🔍 问题分析

**症状**: 数据看板模块显示"正在开发中"

**根本原因**: 小程序配置为使用**云数据库模式**而非**后端 API 模式**

### 当前配置

**文件**: `miniprogram/config/index.js`

```javascript
const USE_CLOUD_DATABASE = true;  // ← 这是问题所在
```

当 `USE_CLOUD_DATABASE = true` 时：
- 前端直接连接微信云数据库
- **不会调用后端 Analytics API**
- 数据看板的 `/analytics/overview` 等接口无法访问

---

## ✅ 解决方案

### 方案 1：切换到后端 API 模式（推荐）

#### 步骤 1: 修改配置文件

编辑 `miniprogram/config/index.js`：

```javascript
// 修改这一行
const USE_CLOUD_DATABASE = false; // 改为 false，使用后端API
```

#### 步骤 2: 确保后端服务运行

```bash
# 进入后端目录
cd backend

# 启动后端服务
npm run dev

# 应该看到:
# Server running on port 3000
```

#### 步骤 3: 重新编译小程序

在微信开发者工具中：
1. 点击"编译"按钮
2. 或按 `Ctrl + B` (Windows) / `Cmd + B` (Mac)

#### 步骤 4: 验证修复

1. 登录小程序
2. 进入"数据看板"
3. 应该能看到：
   - ✅ 活跃工单数量
   - ✅ 平均响应时间
   - ✅ 平均完成时间
   - ✅ 超期率
   - ✅ 一次修复率
   - ✅ 完成率

---

### 方案 2：保持云数据库模式（需要额外开发）

如果你想继续使用云数据库，需要：

#### 要做的工作：
1. **实现云函数版本的 Analytics**
   - 创建云函数 `getAnalyticsOverview`
   - 创建云函数 `getAnalyticsTrends`
   - 创建云函数 `getWorkOrdersByCategory`

2. **修改前端代码**
   - 更新 `dashboard/index.js` 中的 `loadOverview()` 方法
   - 调用云函数而非 API

#### 示例代码（云函数方式）:

```javascript
// miniprogram/pages/admin-manager/dashboard/index.js
async loadOverview() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getAnalyticsOverview',
      data: {}
    });

    if (res.result && res.result.success) {
      this.setData({
        overview: res.result.data
      });
    }
  } catch (error) {
    console.error('Error loading overview:', error);
  }
}
```

**评估**:
- ⏰ **预计工作量**: 8-12 小时
- 📝 **需要创建**: 6+ 个云函数
- 🔧 **需要修改**: 多个前端页面

---

## 💡 推荐方案对比

| 特性 | 方案 1: 后端 API | 方案 2: 云数据库 |
|------|------------------|------------------|
| **修复时间** | ✅ 5 分钟 | ⏳ 8-12 小时 |
| **代码改动** | ✅ 1 行配置 | ❌ 大量新代码 |
| **功能完整性** | ✅ 100% 可用 | ⏳ 需要开发 |
| **性能** | ✅ 优秀 | ✅ 优秀 |
| **维护成本** | ✅ 低 | ❌ 高 |
| **适用场景** | 企业内部系统 | 公网小程序 |

**推荐**: **方案 1 - 后端 API 模式**

理由：
1. ✅ 后端 Analytics 功能已完整实现
2. ✅ 无需额外开发
3. ✅ 维护成本低
4. ✅ 适合企业内部使用场景

---

## 🚀 详细修复步骤（方案 1）

### 第 1 步: 修改配置

```bash
# 1. 打开配置文件
notepad miniprogram/config/index.js

# 或使用你喜欢的编辑器
code miniprogram/config/index.js
```

**修改内容**:
```javascript
// 第 10 行，改为:
const USE_CLOUD_DATABASE = false; // 使用后端API

// 第 16 行，确保后端地址正确:
baseURL: 'http://localhost:3000/api',  // 本地开发
// 或
baseURL: 'http://your-server-ip:3000/api',  // 局域网访问
```

### 第 2 步: 启动后端服务

```bash
cd backend
npm run dev
```

**预期输出**:
```
> workorder-backend@1.0.0 dev
> nodemon src/app.js

[nodemon] 3.0.2
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node src/app.js`
Server running on port 3000
Database connected successfully
```

### 第 3 步: 验证后端 API

```bash
# 在浏览器或 Postman 中访问:
http://localhost:3000/health

# 应该返回:
{
  "status": "ok",
  "timestamp": "2025-11-18T..."
}
```

### 第 4 步: 重新编译小程序

1. 打开**微信开发者工具**
2. 点击顶部的**编译**按钮
3. 等待编译完成

### 第 5 步: 测试数据看板

1. 在模拟器中登录小程序
2. 导航到"数据看板"页面
3. 观察控制台日志：

**成功的日志**:
```
[API Request] {url: "http://localhost:3000/api/analytics/overview", method: "GET"}
[API Response] {statusCode: 200, data: {...}}
[Dashboard] Overview loaded: {totalActiveOrders: 10, avgResponseTime: 2.5, ...}
```

**失败的日志**（需要排查）:
```
[API Request] {url: "http://localhost:3000/api/analytics/overview"}
request:fail ...
```

---

## 🔧 常见问题排查

### 问题 1: "request:fail url not in domain list"

**原因**: 微信小程序域名白名单限制

**解决**:
1. 打开微信开发者工具
2. 右上角 → 详情 → 本地设置
3. 勾选 ✅ "不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"

### 问题 2: "Cannot GET /api/analytics/overview"

**原因**: 后端服务未启动或路由未注册

**解决**:
```bash
# 检查后端是否运行
curl http://localhost:3000/health

# 检查 analytics 路由
curl http://localhost:3000/api/analytics/overview \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 问题 3: "401 Unauthorized"

**原因**: 未登录或 Token 过期

**解决**:
1. 退出小程序
2. 重新登录
3. Token 会自动刷新

### 问题 4: 数据显示为 0

**原因**: 数据库中没有数据

**解决**:
```bash
# 运行种子数据
cd backend
npm run db:seed

# 创建测试工单
# 使用小程序提交几个工单进行测试
```

---

## 📊 预期效果

修复后，数据看板应显示：

### KPI 指标卡片
- **活跃工单**: 实时数量
- **平均响应时间**: X.X 小时
- **平均完成时间**: X.X 小时
- **超期率**: X.X%
- **一次修复率**: X.X%
- **完成率**: X.X%

### 工单列表
- 显示所有工单卡片
- 支持筛选（状态、优先级、楼层等）
- 支持分页
- 点击可查看详情

### 自动刷新
- 每 5 分钟自动刷新数据
- 手动刷新按钮可用
- 显示最后更新时间

---

## ✅ 验收清单

修复完成后，请检查以下项目：

- [ ] 后端服务正常运行 (端口 3000)
- [ ] 配置文件已修改 (`USE_CLOUD_DATABASE = false`)
- [ ] 小程序已重新编译
- [ ] 数据看板页面加载无报错
- [ ] KPI 指标显示正确数值（非 0.0）
- [ ] 工单列表可以正常显示
- [ ] 筛选功能正常工作
- [ ] 分页功能正常工作
- [ ] 点击工单可跳转详情页
- [ ] 手动刷新按钮可用
- [ ] 控制台无错误日志

---

## 📞 需要帮助？

如果按照以上步骤仍然无法解决问题：

1. **检查控制台日志** - 查看详细错误信息
2. **检查网络请求** - 使用开发者工具的 Network 标签
3. **验证后端 API** - 使用 Postman 测试接口
4. **查看后端日志** - 检查 `backend/logs/` 目录

**常用调试命令**:
```bash
# 查看后端日志
tail -f backend/logs/combined.log

# 测试 Analytics API
curl http://localhost:3000/api/analytics/overview

# 检查数据库连接
cd backend && npm run db:migrate
```

---

## 📝 总结

**问题**: 云数据库模式导致无法访问后端 Analytics API

**解决**: 修改 1 行配置 `USE_CLOUD_DATABASE = false`

**时间**: 5 分钟

**状态**: ✅ 可立即修复

立即执行修复，数据看板功能即可正常使用！🎉
