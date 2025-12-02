# 项目结构说明

## 📁 完整目录结构

```
gongdanbaoxiu/                          # 项目根目录
│
├── 📱 miniprogram/                     # 小程序前端目录
│   ├── pages/                          # 页面文件
│   │   ├── index/                      # 首页（根据角色显示不同内容）
│   │   ├── login/                      # 登录页（密码登录）
│   │   ├── property/                   # 物业人员页面
│   │   │   ├── submit/                 # 提交工单
│   │   │   ├── submitted/              # 我提交的工单
│   │   │   └── review/                 # 审核工单
│   │   ├── maintenance/                # 维修人员页面
│   │   │   ├── pending/                # 待维修工单
│   │   │   ├── inprogress/             # 进行中工单
│   │   │   └── history/                # 历史工单
│   │   ├── work-order-detail/          # 工单详情
│   │   └── admin-manager/              # 管理员页面（未来实现）
│   │
│   ├── components/                     # 可复用组件
│   │   ├── image-uploader/             # 图片上传组件
│   │   └── status-badge/               # 状态标签组件
│   │
│   ├── services/                       # 业务服务层
│   │   ├── api.js                      # HTTP请求封装
│   │   ├── auth.js                     # 认证服务（登录、登出）
│   │   ├── storage.js                  # 本地存储封装
│   │   ├── cloud.js                    # 🆕 云函数调用封装
│   │   └── cloudStorage.js             # 🆕 云存储服务（图片上传）
│   │
│   ├── utils/                          # 工具函数
│   │   ├── constants.js                # 常量定义
│   │   └── validators.js               # 表单验证
│   │
│   ├── config/                         # 配置文件
│   │   └── index.js                    # 环境配置
│   │
│   ├── app.js                          # 小程序入口（初始化云开发）
│   ├── app.json                        # 小程序配置
│   ├── app.wxss                        # 全局样式
│   └── sitemap.json                    # 搜索配置
│
├── ☁️ cloudfunctions/                  # 🆕 云函数目录
│   ├── login/                          # 获取用户openid
│   │   ├── index.js                    # 云函数代码
│   │   └── package.json                # 依赖配置
│   ├── uploadImage/                    # 上传图片到云存储
│   │   ├── index.js
│   │   └── package.json
│   └── sendNotification/               # 发送订阅消息
│       ├── index.js
│       └── package.json
│
├── 🖥️ backend/                         # Node.js后端目录
│   ├── src/
│   │   ├── controllers/                # 控制器层
│   │   │   ├── authController.js       # 认证（登录、注册）
│   │   │   ├── workOrderController.js  # 工单管理
│   │   │   ├── userController.js       # 用户管理
│   │   │   ├── analyticsController.js  # 数据统计
│   │   │   └── notificationController.js # 通知管理
│   │   │
│   │   ├── routes/                     # 路由定义
│   │   │   ├── auth.js                 # 认证路由
│   │   │   ├── workOrders.js           # 工单路由
│   │   │   ├── users.js                # 用户路由
│   │   │   ├── analytics.js            # 统计路由
│   │   │   └── notifications.js        # 通知路由
│   │   │
│   │   ├── models/                     # 数据模型（Sequelize）
│   │   │   ├── User.js                 # 用户模型
│   │   │   ├── Role.js                 # 角色模型
│   │   │   ├── WorkOrder.js            # 工单模型
│   │   │   ├── StatusHistory.js        # 状态历史模型
│   │   │   ├── FaultType.js            # 故障类型模型
│   │   │   ├── SLARule.js              # SLA规则模型
│   │   │   ├── Notification.js         # 通知模型
│   │   │   └── AuditLog.js             # 审计日志模型
│   │   │
│   │   ├── middleware/                 # 中间件
│   │   │   ├── auth.js                 # 认证中间件（JWT验证）
│   │   │   ├── errorHandler.js         # 错误处理
│   │   │   └── requestLogger.js        # 请求日志
│   │   │
│   │   ├── services/                   # 业务服务
│   │   │   ├── wechatService.js        # 微信API服务
│   │   │   ├── notificationService.js  # 通知服务
│   │   │   ├── analyticsService.js     # 统计服务
│   │   │   ├── assignmentService.js    # 工单分配服务
│   │   │   └── slaMonitorService.js    # SLA监控服务
│   │   │
│   │   ├── utils/                      # 工具函数
│   │   │   ├── constants.js            # 常量定义
│   │   │   ├── logger.js               # 日志工具
│   │   │   ├── jwt.js                  # JWT工具
│   │   │   ├── password.js             # 密码加密
│   │   │   └── validators.js           # 验证工具
│   │   │
│   │   ├── config/                     # 配置文件
│   │   │   ├── database.js             # 数据库配置
│   │   │   └── wechat.js               # 微信配置
│   │   │
│   │   └── server.js                   # 服务器入口
│   │
│   ├── package.json                    # 后端依赖
│   └── .env                            # 环境变量（需要创建）
│
├── 🗄️ database/                        # 数据库相关
│   ├── migrations/                     # 数据库迁移文件
│   │   ├── 20251112000001-create-roles.js
│   │   ├── 20251112000002-create-users.js
│   │   ├── 20251112000003-create-fault-types.js
│   │   ├── 20251112000004-create-sla-rules.js
│   │   ├── 20251112000005-create-work-orders.js
│   │   ├── 20251112000006-create-status-history.js
│   │   ├── 20251112000007-create-notifications.js
│   │   ├── 20251112000008-create-audit-logs.js
│   │   └── 20251113000001-update-users-openid-nullable.js  # 🆕
│   │
│   ├── seeders/                        # 测试数据
│   │   ├── 20251112000001-seed-roles.js
│   │   ├── 20251112000002-seed-fault-types.js
│   │   ├── 20251112000003-seed-sla-rules.js
│   │   └── 20251112000004-seed-test-users.js
│   │
│   └── config.json                     # Sequelize配置
│
├── 📚 specs/                           # 需求规格文档
│   └── 001-work-order-system/
│       ├── spec.md                     # 功能规格
│       ├── plan.md                     # 实施计划
│       └── tasks.md                    # 任务列表
│
├── 📄 文档文件                         # 项目文档
│   ├── README.md                       # 项目说明
│   ├── DOCUMENTATION_INDEX.md          # 文档索引
│   ├── PROJECT_SUMMARY.md              # 项目总览
│   ├── QUICK_START.md                  # 快速开始
│   │
│   ├── 🆕 云开发相关文档
│   ├── EXPLAIN_FOR_BEGINNER.md         # 小白级别说明（用比喻）
│   ├── HYBRID_ARCHITECTURE_PLAN.md     # 混合架构详细文档
│   ├── CLOUD_MIGRATION_PLAN.md         # 迁移方案对比
│   ├── CLOUD_SETUP_GUIDE.md            # 30分钟设置指南
│   ├── QUICK_CLOUD_REFERENCE.md        # 5分钟快速参考
│   └── HYBRID_IMPLEMENTATION_SUMMARY.md # 实施完成总结
│   │
│   ├── 测试相关
│   ├── TESTING_GUIDE.md                # 测试指南
│   ├── TEST_ACCOUNTS.md                # 测试账号
│   └── START_HERE.md                   # 启动指南
│   │
│   └── 部署相关
│       ├── DEPLOYMENT_CHECKLIST.md      # 部署检查清单
│       └── TROUBLESHOOTING.md           # 故障排除
│
├── 🔧 配置文件
│   ├── project.config.json             # 微信开发者工具配置
│   ├── project.private.config.json     # 私有配置
│   ├── .gitignore                      # Git忽略文件
│   └── .env.example                    # 环境变量示例
│
└── 📋 其他
    ├── POSTMAN_COLLECTION.json         # API测试集合
    └── PROJECT_STATUS.md               # 项目状态
```

---

## 🎯 关键目录说明

### 1. miniprogram/ - 小程序前端

**作用：** 用户看到的界面和交互

**技术栈：**
- JavaScript（逻辑）
- WXML（结构，类似HTML）
- WXSS（样式，类似CSS）

**重要文件：**
- `app.js` - 初始化云开发，全局状态
- `services/auth.js` - 登录、登出
- `services/cloud.js` - 🆕 调用云函数
- `services/cloudStorage.js` - 🆕 上传图片到云存储

### 2. cloudfunctions/ - 云函数

**作用：** 在微信服务器运行的后端代码

**特点：**
- 不需要自己的服务器
- 微信官方维护
- 按调用次数计费（有免费额度）

**三个云函数：**
1. `login` - 获取用户openid
2. `uploadImage` - 上传图片到云存储
3. `sendNotification` - 发送订阅消息

### 3. backend/ - Node.js后端

**作用：** 处理复杂业务逻辑

**技术栈：**
- Node.js 18
- Express.js（Web框架）
- Sequelize（ORM，操作数据库）
- MySQL（数据库）

**重要文件：**
- `server.js` - 服务器启动入口
- `controllers/` - 处理请求逻辑
- `routes/` - 定义API路径
- `models/` - 数据库表定义
- `services/` - 复杂业务逻辑

### 4. database/ - 数据库

**作用：** 存储所有业务数据

**migrations（迁移文件）：**
- 定义数据库表结构
- 版本控制，可回滚

**seeders（测试数据）：**
- 初始化角色、类型等基础数据
- 创建测试账号

---

## 🔄 数据流向

### 用户提交工单的完整流程：

```
1. 用户在小程序填写工单
   ↓
2. 点击"上传图片"
   ↓
3. 小程序调用 cloudStorage.chooseAndUploadImages()
   ↓
4. 调用云函数 uploadImage
   ↓
5. 云函数将图片上传到云存储
   ↓
6. 返回图片URL给小程序
   ↓
7. 用户点击"提交工单"
   ↓
8. 小程序调用 api.post('/workorders', data)
   ↓
9. 请求到达 backend/src/routes/workOrders.js
   ↓
10. 路由调用 workOrderController.createWorkOrder()
   ↓
11. 控制器调用 WorkOrder.create() 保存到MySQL
   ↓
12. 调用 assignmentService 自动分配维修员
   ↓
13. 调用 notificationService 发送通知
   ↓
14. 返回成功响应给小程序
   ↓
15. 小程序显示"提交成功"
```

---

## 📱 页面结构

### 物业人员看到的页面：

```
首页（index）
├── 提交工单按钮 → 跳转到 property/submit
├── 我的工单列表 → 跳转到 property/submitted
└── 待审核工单 → 跳转到 property/review
```

### 维修人员看到的页面：

```
首页（index）
├── 待维修工单 → 跳转到 maintenance/pending
├── 进行中工单 → 跳转到 maintenance/inprogress
└── 历史工单 → 跳转到 maintenance/history
```

### 管理员看到的页面：

```
首页（index）
├── 数据统计 → 跳转到 admin-manager/dashboard
├── 用户管理 → 跳转到 admin/users
├── 角色配置 → 跳转到 admin/roles
└── 系统设置 → 跳转到 admin/config
```

---

## 🔑 核心服务说明

### 前端服务（miniprogram/services/）

| 文件 | 作用 | 主要方法 |
|------|------|----------|
| api.js | HTTP请求封装 | get(), post(), put(), delete() |
| auth.js | 认证管理 | login(), loginWithCloud(), logout() |
| storage.js | 本地存储 | get(), set(), remove() |
| cloud.js | 云函数调用 | callFunction(), getOpenId() |
| cloudStorage.js | 云存储管理 | chooseAndUploadImages(), deleteImage() |

### 后端服务（backend/src/services/）

| 文件 | 作用 | 主要方法 |
|------|------|----------|
| wechatService.js | 微信API | wechatLogin(), sendTemplateMessage() |
| notificationService.js | 通知管理 | sendNotification(), scheduleReminder() |
| assignmentService.js | 工单分配 | assignWorkOrder(), findAvailableTechnician() |
| slaMonitorService.js | SLA监控 | checkOverdue(), sendReminders() |
| analyticsService.js | 数据统计 | getWorkOrderStats(), getTechnicianPerformance() |

---

## 🗄️ 数据库表结构

### 核心表：

```
users                   # 用户表
├── id
├── wechat_openid      # 🆕 可选（支持云登录）
├── password_hash      # 🆕 密码（支持密码登录）
├── name
├── role_id
├── contact_phone
└── department

work_orders            # 工单表
├── id
├── title
├── description
├── status
├── priority
├── submitted_by       # 提交人（外键 → users.id）
├── assigned_to        # 维修员（外键 → users.id）
├── photos             # 图片URL数组
└── sla_deadline

status_history         # 状态历史表
├── id
├── work_order_id
├── from_status
├── to_status
├── changed_by
└── changed_at

notifications          # 通知表
├── id
├── user_id
├── type
├── title
├── content
└── delivery_status
```

---

## 🔧 配置文件说明

### project.config.json（微信开发者工具配置）

```json
{
  "miniprogramRoot": "miniprogram/",     // 小程序根目录
  "cloudfunctionRoot": "cloudfunctions/", // 云函数根目录
  "projectname": "gongdanbaoxiu",
  "appid": "wx8553f910840a6bf1",         // 小程序AppID
  "libVersion": "2.32.0"                  // 基础库版本
}
```

### backend/.env（后端环境变量）

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=workorder_db
DB_USER=root
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 微信配置
WECHAT_APP_ID=wx8553f910840a6bf1
WECHAT_APP_SECRET=your_app_secret

# 服务器配置
PORT=3000
NODE_ENV=development
```

### miniprogram/config/index.js（前端配置）

```javascript
const isDevelopment = true;

const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:3000/api',  // 本地开发
    timeout: 30000
  },
  production: {
    baseURL: 'https://your-domain.com/api', // 生产环境
    timeout: 10000
  }
};
```

---

## 📚 文档阅读顺序

### 如果您是编程新手：

1. **EXPLAIN_FOR_BEGINNER.md** - 从零开始理解架构
2. **PROJECT_STRUCTURE.md** - 了解文件结构（本文档）
3. **CLOUD_SETUP_GUIDE.md** - 30分钟设置云开发
4. **QUICK_START.md** - 启动项目

### 如果您有编程经验：

1. **HYBRID_IMPLEMENTATION_SUMMARY.md** - 快速了解实施内容
2. **HYBRID_ARCHITECTURE_PLAN.md** - 详细技术文档
3. **QUICK_CLOUD_REFERENCE.md** - API参考
4. **PROJECT_STRUCTURE.md** - 文件结构（本文档）

### 如果您要部署到生产：

1. **DEPLOYMENT_CHECKLIST.md** - 部署检查清单
2. **TESTING_GUIDE.md** - 测试指南
3. **TROUBLESHOOTING.md** - 故障排除

---

## 🎯 快速定位文件

### 我想修改登录逻辑：

- 前端：`miniprogram/pages/login/login.js`
- 前端服务：`miniprogram/services/auth.js`
- 后端控制器：`backend/src/controllers/authController.js`
- 后端路由：`backend/src/routes/auth.js`

### 我想修改工单提交：

- 前端页面：`miniprogram/pages/property/submit/index.js`
- 图片上传：`miniprogram/services/cloudStorage.js`
- 后端控制器：`backend/src/controllers/workOrderController.js`
- 数据模型：`backend/src/models/WorkOrder.js`

### 我想修改首页显示：

- 前端页面：`miniprogram/pages/index/index.js`
- 页面布局：`miniprogram/pages/index/index.wxml`
- 页面样式：`miniprogram/pages/index/index.wxss`

### 我想添加新的云函数：

1. 创建目录：`cloudfunctions/新函数名/`
2. 创建代码：`cloudfunctions/新函数名/index.js`
3. 创建配置：`cloudfunctions/新函数名/package.json`
4. 右键上传：选择"上传并部署：云端安装依赖"

---

## 💡 小贴士

### 文件命名规范：

- **页面文件：** 小写+连字符（kebab-case）
  - 例如：`work-order-detail`

- **组件文件：** 小写+连字符
  - 例如：`image-uploader`

- **服务文件：** 驼峰命名（camelCase）
  - 例如：`cloudStorage.js`

- **模型文件：** 大驼峰（PascalCase）
  - 例如：`WorkOrder.js`

### 代码注释：

每个重要函数都有详细注释，格式：

```javascript
/**
 * 函数说明
 * @param {类型} 参数名 - 参数说明
 * @returns {类型} 返回值说明
 */
```

---

**希望这份文档能帮助您快速了解项目结构！** 📚

如有任何疑问，随时告诉我！
