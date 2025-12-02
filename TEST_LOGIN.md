# 登录测试指南

## 问题：网络连接失败

### 可能的原因

1. **后端服务未启动**
2. **微信开发者工具未开启"不校验合法域名"**
3. **端口被占用**
4. **数据库未连接**

---

## 解决步骤

### 第一步：启动后端服务

```bash
# 1. 进入后端目录
cd backend

# 2. 确保依赖已安装
npm install

# 3. 检查环境变量配置
# 确保 .env 文件存在并配置正确
cp .env.example .env

# 编辑 .env 文件，设置数据库等配置：
# DB_HOST=localhost
# DB_PORT=3306
# DB_NAME=work_order_system
# DB_USER=root
# DB_PASSWORD=your_password
# JWT_SECRET=your-secret-key

# 4. 启动MySQL数据库
# Windows: 启动MySQL服务
# net start MySQL80

# 5. 创建数据库（如果还没创建）
mysql -u root -p
# 输入密码后执行：
CREATE DATABASE work_order_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

# 6. 运行数据库迁移
npx sequelize-cli db:migrate

# 7. 运行种子数据（创建测试账号）
npx sequelize-cli db:seed:all

# 8. 启动后端服务
npm run dev

# 应该看到：
# [INFO] Server is running on http://localhost:3000
# [INFO] Database connected successfully
```

### 第二步：配置微信开发者工具

1. 打开微信开发者工具
2. 点击右上角 **详情**
3. 在 **本地设置** 标签页中
4. ✅ 勾选 **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**
5. ✅ 勾选 **不校验 Secure 域名**

### 第三步：测试后端连接

在浏览器或Postman中测试：

```bash
# 测试1: 健康检查
GET http://localhost:3000/health

# 应该返回：
{
  "status": "ok",
  "timestamp": "2025-11-13T..."
}

# 测试2: 测试登录接口
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "property",
  "password": "123456"
}

# 如果成功，应该返回：
{
  "user": {...},
  "token": "eyJhbGc...",
  "permissions": {...}
}
```

### 第四步：为测试账号添加密码

测试账号需要密码才能登录。运行以下SQL：

```sql
-- 连接数据库
mysql -u root -p work_order_system

-- 为测试用户添加密码（密码：123456）
-- bcrypt hash for "123456": $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi

UPDATE users SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE wechat_openid LIKE 'test_openid_%';

-- 为了方便登录，我们将contact_phone设置为简单的用户名
UPDATE users SET contact_phone = 'property' WHERE role_id = 4 AND contact_phone = '13800000004';
UPDATE users SET contact_phone = 'maintenance' WHERE role_id = 5 AND contact_phone = '13800000005';
UPDATE users SET contact_phone = 'manager' WHERE role_id = 3 AND contact_phone = '13800000003';
UPDATE users SET contact_phone = 'admin' WHERE role_id = 2 AND contact_phone = '13800000002';
UPDATE users SET contact_phone = 'superadmin' WHERE role_id = 1 AND contact_phone = '13800000001';

-- 验证更新
SELECT id, name, contact_phone, role_id, active FROM users;
```

---

## 测试账号信息

更新后的测试账号：

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 物业人员 | property | 123456 | 可以提交和审核工单 |
| 维修人员 | maintenance | 123456 | 可以接收和处理工单 |
| 行政经理 | manager | 123456 | 可以查看分析数据 |
| 系统管理员 | admin | 123456 | 系统管理权限 |
| 超级管理员 | superadmin | 123456 | 完整权限 |

---

## 验证流程

### 1. 验证后端是否运行

```bash
# 在命令行中执行
curl http://localhost:3000/health

# 或在浏览器打开
http://localhost:3000/health
```

### 2. 验证数据库连接

查看后端控制台日志，应该看到：
```
[INFO] Database connected successfully
[INFO] Server is running on http://localhost:3000
```

### 3. 在小程序中测试登录

1. 在微信开发者工具中编译小程序
2. 进入登录页面
3. 输入用户名：`property`
4. 输入密码：`123456`
5. 点击登录

---

## 常见错误排查

### 错误1: 网络连接失败

**原因**: 后端未启动或端口不对

**解决**:
```bash
# 检查3000端口是否被占用
netstat -ano | findstr :3000

# 如果被占用，杀死进程或更改端口
# 在 backend/.env 中修改 PORT=3001
```

### 错误2: 用户名或密码错误

**原因**: 数据库中没有密码或用户名不对

**解决**: 执行上面的SQL语句添加密码

### 错误3: Database connection failed

**原因**: MySQL未启动或配置错误

**解决**:
```bash
# 启动MySQL
net start MySQL80

# 或检查MySQL服务状态
services.msc
```

### 错误4: Sequelize Migration Error

**原因**: 数据库表未创建

**解决**:
```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

---

## 调试技巧

### 1. 查看后端日志

后端控制台会显示所有API请求：
```
[API Request] POST /api/auth/login
[Login] Processing login request username=property
[Login] Login successful userId=4
```

### 2. 查看小程序控制台

微信开发者工具 -> 控制台：
```javascript
[API Request] {url: "http://localhost:3000/api/auth/login", ...}
[API Response] {token: "...", user: {...}}
```

### 3. 使用Postman测试

先用Postman测试后端接口是否正常，排除前端问题。

---

## 成功标志

登录成功后应该看到：

1. ✅ 控制台显示：`[Login] Login successful`
2. ✅ Toast提示："登录成功"
3. ✅ 自动跳转到首页
4. ✅ 首页显示用户名和角色

---

## 需要帮助？

如果按照以上步骤仍然无法解决，请提供：

1. 后端控制台的完整日志
2. 小程序控制台的错误信息
3. 浏览器访问 http://localhost:3000/health 的结果
4. 数据库查询 `SELECT * FROM users LIMIT 1;` 的结果
