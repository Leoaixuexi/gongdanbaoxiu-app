# 密码登录系统设置指南

## ✅ 已完成的修改

1. **云函数 userAuth**
   - ✅ 添加了 `getUserByUsername()` 函数
   - ✅ 添加了 `verifyPassword()` 函数
   - ✅ 添加了 `passwordLogin` action
   - ⚠️ **需要重新上传云函数**

2. **云函数 initDatabase**
   - ✅ 更新了测试用户数据，添加 username 和 password 字段
   - ⚠️ **需要重新上传云函数**

3. **登录页面 UI (login.wxml)**
   - ✅ 添加了用户名输入框
   - ✅ 添加了密码输入框
   - ✅ 更新了按钮文字为"登录"
   - ✅ 显示所有角色的测试账号（系统管理员、物业经理、维修员、物业员工）

4. **登录页面样式 (login.wxss)**
   - ✅ 美化了测试账号显示区域
   - ✅ 为每个角色账号添加了独立卡片样式
   - ✅ 用户名和密码使用不同颜色区分

5. **登录页面逻辑 (login.js)**
   - ✅ 添加了用户名和密码的 data 字段
   - ✅ 添加了 `onUsernameInput` 和 `onPasswordInput` 方法
   - ✅ 更新了 `handleLogin` 方法调用 `auth.loginWithPassword()`

6. **认证服务 (auth.js)**
   - ✅ 添加了 `loginWithPassword()` 函数
   - ✅ 导出了 `loginWithPassword` 方法

---

## 📋 接下来需要做的操作

### 步骤 1: 重新上传云函数

#### 1.1 上传 userAuth 云函数
1. 在微信开发者工具中，找到 `cloudfunctions/userAuth` 文件夹
2. 右键点击文件夹
3. 选择 **"上传并部署：云端安装依赖"**
4. 等待上传完成

#### 1.2 上传 initDatabase 云函数
1. 找到 `cloudfunctions/initDatabase` 文件夹
2. 右键点击文件夹
3. 选择 **"上传并部署：云端安装依赖"**
4. 等待上传完成

### 步骤 2: 更新数据库中的用户数据

由于之前已经创建了测试用户，但没有 username 和 password 字段，需要更新现有用户。

**选项 A：手动更新（推荐，保留现有工单数据）**

在云开发控制台 - 数据库 - users 集合中，手动编辑每个用户，添加：

| 用户 | username | password |
|------|----------|----------|
| 测试管理员 | admin | admin123 |
| 测试经理 | manager | manager123 |
| 测试维修员 | technician | tech123 |
| 测试员工 | staff | staff123 |

如果数据库中还没有第4个用户（物业员工），需要手动添加一个新用户记录。

**选项 B：重置数据库（会删除所有数据，包括工单）**

在云开发控制台 - 云函数 - initDatabase 中测试运行：
```json
{
  "action": "reset_and_init"
}
```

⚠️ **警告**: 这会删除所有现有数据（包括你之前创建的工单）！

---

## 🧪 步骤 3: 测试登录功能

1. **清除本地存储**
   - 在微信开发者工具中，点击 "清除缓存" → "清除数据缓存"

2. **重新编译小程序**
   - 点击 "编译" 按钮

3. **测试登录**
   - 应该看到新的登录界面（有用户名和密码输入框）
   - 输入测试账号：
     - 用户名: `admin`
     - 密码: `admin123`
   - 点击"登录"按钮
   - 应该显示"登录成功"并跳转到首页

---

## 📝 测试账号列表

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 系统管理员 | admin | admin123 | 完整权限 |
| 物业经理 | manager | manager123 | 管理工单、分配维修员 |
| 维修员 | technician | tech123 | 接收和处理工单 |
| 物业员工 | staff | staff123 | 提报工单 |

---

## ⚠️ 重要说明

1. **密码是明文存储**：当前密码验证使用简单的字符串比对（`inputPassword === storedPassword`）。在生产环境中，应该使用 bcrypt 或其他加密算法对密码进行哈希处理。

2. **保留了微信快捷登录**：`auth.js` 中保留了 `login()` 函数，支持微信快捷登录。如果将来需要，可以在登录页添加"微信快捷登录"选项。

3. **OpenID 字段保留**：用户数据中保留了 `wechat_openid` 字段，以便将来支持微信快捷登录或绑定微信账号。

---

## 🔄 如果需要切换回微信快捷登录

只需修改 `pages/login/login.js` 中的 `handleLogin` 方法：

```javascript
// 改回调用
const user = await auth.login();  // 微信快捷登录

// 而不是
const user = await auth.loginWithPassword(username, password);  // 账号密码登录
```

---

准备好后，请按照上述步骤操作，然后告诉我测试结果！
