# 快速启动指南

本指南将帮助您快速设置并运行小物业报修管理系统。

## 前提条件

请确保已安装以下软件：

- Node.js 18.x 或更高版本
- MySQL 8.0
- Redis 6.x
- 微信开发者工具
- Git

## 一、后端设置

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置以下关键配置：

```env
# 服务器配置
NODE_ENV=development
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=work_order_system
DB_USER=root
DB_PASSWORD=your_mysql_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 微信配置
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret

# 腾讯云COS配置（用于图片上传）
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_BUCKET=your_bucket_name
COS_REGION=ap-guangzhou
```

### 3. 创建数据库

```bash
# 登录MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE work_order_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. 运行数据库迁移

```bash
cd backend
npx sequelize-cli db:migrate
```

### 5. 填充测试数据

```bash
npx sequelize-cli db:seed:all
```

这将创建5个测试账号：
- 超级管理员：test_openid_super_admin
- 系统管理员：test_openid_sys_admin
- 行政经理：test_openid_admin_manager
- 物业人员：test_openid_property_staff
- 维修人员：test_openid_maintenance_worker

### 6. 启动Redis

```bash
# Windows (需要先安装Redis)
redis-server

# Linux/Mac
sudo service redis-server start
```

### 7. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务将在 http://localhost:3000 启动

## 二、前端设置

### 1. 配置微信开发者工具

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择项目目录（gongdanbaoxiu）
4. AppID：使用您的微信小程序 AppID（或选择"测试号"）

### 2. 配置后端API地址

编辑 `miniprogram/services/api.js`，确保 `BASE_URL` 指向您的后端服务：

```javascript
const BASE_URL = 'http://localhost:3000/api';
```

### 3. 下载ECharts库（用于图表）

1. 访问 https://github.com/ecomfe/echarts-for-weixin
2. 下载 `echarts.js` 文件
3. 重命名为 `echarts.min.js`
4. 放置到 `miniprogram/components/ec-canvas/` 目录

或者使用npm安装：

```bash
cd miniprogram
npm install echarts-for-weixin --save
# 在微信开发者工具中：工具 -> 构建npm
```

### 4. 编译项目

在微信开发者工具中：
- 点击"编译"按钮
- 项目应该成功加载，显示登录页面

## 三、测试登录

由于是本地开发环境，微信登录需要特殊处理：

### 方式1：模拟登录（推荐用于开发）

在后端添加测试登录接口，跳过微信OAuth：

```javascript
// backend/src/routes/auth.js
router.post('/test-login', async (req, res) => {
  const { openid } = req.body;
  const user = await User.findOne({
    where: { wechat_openid: openid },
    include: [{ model: Role }]
  });

  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  res.json({ token, user });
});
```

前端使用：

```javascript
// 临时测试登录
const response = await api.post('/auth/test-login', {
  openid: 'test_openid_property_staff'
});
```

### 方式2：使用真实微信登录

1. 在微信公众平台配置服务器域名
2. 部署后端到公网服务器
3. 配置微信小程序的合法域名

## 四、验证功能

### 1. 检查后端API

访问 http://localhost:3000/health 应该返回：

```json
{
  "status": "ok",
  "timestamp": "2025-11-13T..."
}
```

### 2. 检查数据库

```bash
mysql -u root -p work_order_system

# 查看角色
SELECT * FROM roles;

# 查看测试用户
SELECT * FROM users;
```

### 3. 测试工单流程

1. 使用物业人员账号登录
2. 提交工单 -> 自动分配给维修人员
3. 切换维修人员账号 -> 开始维修 -> 完成维修
4. 切换物业人员账号 -> 审核工单 -> 通过/驳回

## 五、常见问题

### 1. 数据库连接失败

- 检查MySQL是否启动
- 验证 `.env` 中的数据库配置
- 确认数据库已创建

### 2. Redis连接失败

```bash
# 检查Redis状态
redis-cli ping
# 应返回：PONG
```

### 3. 微信开发者工具报错

- 检查 `project.config.json` 中的 `miniprogramRoot` 是否为 `"miniprogram/"`
- 确认所有页面文件完整（.js, .json, .wxml, .wxss）
- 在"详情"中勾选"不校验合法域名"（开发环境）

### 4. ECharts图表不显示

- 确认已下载 `echarts.min.js` 到正确位置
- 检查组件引用路径是否正确
- 查看控制台是否有错误信息

### 5. 图片上传失败

- 确认腾讯云COS配置正确
- 检查bucket权限设置
- 验证SecretId和SecretKey

## 六、开发调试

### 启用调试模式

在 `miniprogram/app.json` 中设置：

```json
{
  "debug": true
}
```

### 查看后端日志

后端日志保存在 `backend/logs/` 目录：
- `error.log` - 错误日志
- `combined.log` - 所有日志

### API测试

使用提供的Postman集合：

```bash
# 导入 POSTMAN_COLLECTION.json 到Postman
# 包含所有API的测试用例
```

## 七、生产部署

生产环境部署请参考：
- `DEPLOYMENT_CHECKLIST.md` - 完整部署清单
- `TESTING_GUIDE.md` - 测试指南

## 八、获取帮助

如遇到问题：

1. 查看 `TROUBLESHOOTING.md` 故障排除指南
2. 检查 `backend/logs/` 日志文件
3. 查看微信开发者工具控制台
4. 参考 `PROJECT_SUMMARY.md` 项目概览

## 下一步

现在您可以：

1. 探索各个功能模块
2. 根据需求修改业务逻辑
3. 自定义UI样式
4. 添加新功能

祝开发顺利！
