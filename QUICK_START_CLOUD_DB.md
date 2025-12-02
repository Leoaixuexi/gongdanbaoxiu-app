# 云数据库快速开始 - 3步搞定

## 你需要提供的信息

### ✅ 已有的信息
- 云开发环境ID: `cloud1-7glfhm4r06e030bd`
- 小程序 AppID: `wx8553f910840a6bf1`

### ❌ 不需要额外提供
- ✓ 无需数据库账号密码
- ✓ 无需服务器配置
- ✓ 无需安装数据库软件
- ✓ 无需网络配置

## 3步部署

### 步骤 1: 创建集合（2分钟）

登录 https://console.cloud.tencent.com/tcb → 选择环境 `cloud1-7glfhm4r06e030bd` → 数据库

点击"添加集合"，创建 6 个集合：
1. `roles`
2. `users`
3. `fault_types`
4. `work_orders`
5. `notifications`
6. `audit_logs`

### 步骤 2: 上传云函数（3分钟）

在微信开发者工具中，右键每个文件夹 → "上传并部署：云端安装依赖"：
1. `cloudfunctions/initDatabase`
2. `cloudfunctions/userAuth`
3. `cloudfunctions/workOrderManager`

### 步骤 3: 初始化数据（1分钟）

在云开发控制台 → 云函数 → `initDatabase` → 测试

输入：
```json
{"action": "init"}
```

点击"运行测试"，看到成功提示即完成！

## 验证是否成功

在云开发控制台 → 数据库 → 检查：
- `roles` 集合应该有 4 条数据
- `fault_types` 集合应该有 30 条数据
- `users` 集合应该有 3 条测试数据

## 接下来做什么？

### 选项 A：立即测试（推荐）
在小程序中测试云登录和云存储功能（已经可用）

### 选项 B：切换到纯云数据库
完全移除 Node.js 后端，所有功能都用云开发

### 选项 C：保持混合架构
继续使用 Node.js 后端处理复杂业务逻辑

## 云数据库 vs PostgreSQL

| 对比项 | 云数据库 | PostgreSQL |
|--------|----------|------------|
| 配置 | ✅ 无需配置 | ❌ 需要配置连接 |
| 成本 | ✅ 免费额度充足 | ⚠️ 需付费 |
| 连接 | ✅ 无连接问题 | ❌ ECONNRESET错误 |
| 扩展性 | ✅ 自动扩容 | ⚠️ 需手动扩容 |
| 查询能力 | ⚠️ NoSQL限制 | ✅ 强大SQL |
| 微信集成 | ✅ 完美集成 | ⚠️ 需额外开发 |

## 免费额度

- 存储：2GB
- 读操作：5万次/天
- 写操作：3万次/天
- 云函数调用：10万次/月

对于小型物业（< 500户），完全够用！

## 需要帮助？

查看完整文档：`CLOUD_DATABASE_DEPLOYMENT.md`

数据结构设计：`database/CLOUD_DATABASE_SCHEMA.md`
