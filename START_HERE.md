# 🚀 快速启动指南

## 当前问题：网络连接失败

这说明**后端服务器未启动**或**小程序无法连接到后端**。

---

## ✅ 解决方案（按顺序执行）

### 步骤1：启动MySQL数据库

```bash
# Windows系统
net start MySQL80

# 或者在服务管理器中启动MySQL服务
# Win+R -> services.msc -> 找到MySQL -> 右键启动
```

### 步骤2：创建数据库并添加测试数据

```bash
# 1. 连接到MySQL
mysql -u root -p

# 2. 创建数据库
CREATE DATABASE IF NOT EXISTS work_order_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. 使用数据库
USE work_order_system;

# 4. 退出MySQL命令行
EXIT;
```

### 步骤3：配置后端环境

```bash
# 1. 进入后端目录
cd backend

# 2. 复制环境配置文件
copy .env.example .env

# 3. 编辑.env文件（使用记事本或其他编辑器）
notepad .env

# 修改以下配置：
# DB_PASSWORD=你的MySQL密码
# JWT_SECRET=随机字符串（例如：abc123xyz789）
```

### 步骤4：安装依赖并运行迁移

```bash
# 确保还在backend目录
cd backend

# 安装依赖
npm install

# 运行数据库迁移（创建表结构）
npx sequelize-cli db:migrate

# 运行种子数据（创建测试账号）
npx sequelize-cli db:seed:all
```

### 步骤5：为测试账号添加密码

```bash
# 连接数据库
mysql -u root -p work_order_system

# 执行以下SQL（复制整段）
UPDATE users
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    contact_phone = CASE
        WHEN role_id = 1 THEN 'superadmin'
        WHEN role_id = 2 THEN 'admin'
        WHEN role_id = 3 THEN 'manager'
        WHEN role_id = 4 THEN 'property'
        WHEN role_id = 5 THEN 'maintenance'
        ELSE contact_phone
    END
WHERE wechat_openid LIKE 'test_openid_%';

# 验证（应该看到5个用户）
SELECT id, name, contact_phone, role_id, active FROM users;

# 退出
EXIT;
```

### 步骤6：启动Redis（可选，用于缓存）

```bash
# Windows - 如果已安装Redis
redis-server

# 如果没有Redis，可以先跳过，后端会继续运行
```

### 步骤7：启动后端服务器 ⭐

```bash
# 确保在backend目录
cd backend

# 启动开发服务器
npm run dev

# ✅ 成功的标志：
# [INFO] Server is running on http://localhost:3000
# [INFO] Database connected successfully
```

**保持这个命令行窗口打开！不要关闭！**

### 步骤8：配置微信开发者工具

1. 打开微信开发者工具
2. 点击右上角 **"详情"**
3. 选择 **"本地设置"** 标签
4. ✅ 勾选：**不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书**
5. ✅ 勾选：**不校验Secure域名（TLS必须）**
6. 点击 **"编译"** 重新编译小程序

### 步骤9：测试登录

在小程序登录页面输入：

| 字段 | 值 |
|------|-----|
| 账号 | property |
| 密码 | 123456 |

点击"登录"按钮。

---

## ✅ 成功标志

### 后端控制台应该显示：
```
[INFO] Server is running on http://localhost:3000
[INFO] Database connected successfully
[INFO] Processing login request username=property
[INFO] Login successful userId=...
```

### 小程序应该：
1. 显示"登录成功"提示
2. 自动跳转到首页
3. 首页显示用户信息

---

## 🔍 验证后端是否运行

### 方法1：浏览器测试
打开浏览器，访问：
```
http://localhost:3000/health
```

应该看到：
```json
{
  "status": "ok",
  "timestamp": "2025-11-13T..."
}
```

### 方法2：命令行测试
```bash
curl http://localhost:3000/health
```

---

## 📝 所有测试账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 超级管理员 | superadmin | 123456 | 所有权限 |
| 系统管理员 | admin | 123456 | 用户管理、系统配置 |
| 行政经理 | manager | 123456 | 数据分析 |
| 物业人员 | property | 123456 | 提交工单、审核工单 |
| 维修人员 | maintenance | 123456 | 处理工单 |

---

## ❌ 常见错误及解决

### 错误1：`ECONNREFUSED 127.0.0.1:3000`
**原因**：后端服务器未启动

**解决**：
```bash
cd backend
npm run dev
```

### 错误2：`ER_ACCESS_DENIED_ERROR`
**原因**：数据库密码错误

**解决**：检查 `backend/.env` 中的 `DB_PASSWORD`

### 错误3：`ER_BAD_DB_ERROR`
**原因**：数据库不存在

**解决**：
```sql
CREATE DATABASE work_order_system;
```

### 错误4：`用户名或密码错误`
**原因**：测试账号未添加密码

**解决**：执行步骤5的SQL语句

### 错误5：`Port 3000 is already in use`
**原因**：端口被占用

**解决方案A**：找到并结束占用进程
```bash
# 查找占用3000端口的进程
netstat -ano | findstr :3000

# 结束进程（PID是上一步的最后一列数字）
taskkill /PID <进程ID> /F
```

**解决方案B**：更改端口
```bash
# 在 backend/.env 中添加
PORT=3001

# 在 miniprogram/config/index.js 中修改
baseURL: 'http://localhost:3001/api'
```

---

## 📞 需要帮助？

如果按照以上步骤仍然无法解决，请提供：

1. **后端控制台的日志**（从 `npm run dev` 开始的所有输出）
2. **小程序控制台的错误**（微信开发者工具 -> 控制台）
3. **浏览器访问 http://localhost:3000/health 的结果**

---

## 🎯 下一步

登录成功后，您可以：

1. 📝 提交工单（物业人员账号）
2. 🔧 处理工单（维修人员账号）
3. ✅ 审核工单（物业人员账号）
4. 📊 查看数据分析（行政经理账号）
5. 👥 管理用户（管理员账号）

祝使用顺利！🎉
