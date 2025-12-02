# 云数据库配置完成说明

## 已完成的修改

### 1. 配置切换
- 修改了 `miniprogram/config/index.js`
- 添加了 `useCloudDatabase` 配置项,当前设置为 `true`
- 小程序现在使用微信云数据库,不依赖后端服务器

### 2. 云数据库服务
- 创建了 `miniprogram/services/cloudDatabase.js`
- 封装了所有云数据库操作:
  - 用户管理(users)
  - 角色管理(roles)
  - 故障类型(faultTypes)
  - 工单管理(workOrders)

### 3. 页面更新
已更新以下页面支持云数据库:
- `/pages/admin/users/index.js` - 用户列表页
- `/pages/admin/roles/index.js` - 角色配置页

### 4. 已初始化的数据
云数据库已成功初始化:
- ✅ 4个角色(系统管理员、物业经理、维修员、物业员工)
- ✅ 4个测试用户(admin、manager、technician、staff)
- ✅ 28个故障类型

## 使用步骤

### 步骤1: 关闭域名校验(必须!)

在**微信开发者工具**中:
1. 点击右上角 **"详情"** 按钮
2. 选择 **"本地设置"** 标签
3. 勾选 ✅ **"不校验合法域名、web-view(业务域名)、TLS版本以及HTTPS证书"**

### 步骤2: 确认云环境ID

在 `miniprogram/services/cloudDatabase.js` 第14行:
```javascript
wx.cloud.init({
  env: 'cloud1-7glfhm4r06e030bd', // 确认这是您的云环境ID
  traceUser: true
});
```

### 步骤3: 测试登录

使用测试账号登录:

| 角色 | 账号 | 密码 |
|------|------|------|
| 系统管理员 | admin | admin123 |
| 物业经理 | manager | manager123 |
| 维修员 | technician | tech123 |
| 物业员工 | staff | staff123 |

### 步骤4: 测试管理功能

使用 **admin** 账号登录后:
1. 进入 **"管理"** 模块
2. 测试 **"用户管理"** - 查看用户列表
3. 测试 **"角色配置"** - 查看和修改角色权限

## 云数据库集合结构

### roles (角色表)
```javascript
{
  role_id: Number,        // 角色ID: 1-4
  name: String,           // 角色名称(英文)
  display_name: String,   // 显示名称(中文)
  permissions: {          // 权限对象
    modules: {
      submit_work_orders: Boolean,
      review_work_orders: Boolean,
      view_analytics: Boolean,
      manage_users: Boolean,
      configure_system: Boolean
    }
  },
  created_at: Date,
  updated_at: Date
}
```

### users (用户表)
```javascript
{
  user_id: Number,           // 用户ID
  username: String,          // 用户名
  password: String,          // 密码(明文,仅测试用)
  wechat_openid: String,     // 微信OpenID
  name: String,              // 姓名
  role_id: Number,           // 角色ID
  role: Object,              // 角色信息
  contact_phone: String,     // 联系电话
  department: String,        // 部门
  supervisor_id: Number,     // 上级ID
  active: Boolean,           // 是否启用
  created_at: Date,
  updated_at: Date,
  last_login_at: Date
}
```

### fault_types (故障类型表)
```javascript
{
  type_id: Number,      // 类型ID
  name: String,         // 类型名称
  parent_id: Number,    // 父类型ID
  active: Boolean,      // 是否启用
  created_at: Date,
  updated_at: Date
}
```

## 常见问题

### Q1: 登录后提示"用户不存在"
**原因**: 云数据库没有正确初始化
**解决**:
1. 检查云函数 `initDatabase` 是否已上传
2. 运行云函数测试: `{"action": "stats"}` 查看数据统计
3. 如需重新初始化: `{"action": "reset_and_init"}`

### Q2: 管理员仍然显示"权限不足"
**原因**:
1. 云数据库中的用户role_id不正确
2. 角色permissions格式错误

**解决**:
1. 在云数据库控制台查看 `users` 集合
2. 确认 admin 用户的 `role_id` 为 1
3. 查看 `roles` 集合中 role_id=1 的权限配置

### Q3: 需要切换回后端API模式
修改 `miniprogram/config/index.js`:
```javascript
const USE_CLOUD_DATABASE = false; // 改为 false
```

## 后续开发建议

### 1. 密码加密
当前测试用户的密码是明文存储,生产环境应:
- 在云函数中使用加密算法(bcrypt/pbkdf2)
- 修改 `userAuth` 云函数验证逻辑

### 2. 微信登录
实现真正的微信授权登录:
- 使用 `wx.login()` 获取 code
- 云函数调用微信 API 获取 openid
- 根据 openid 创建或关联用户

### 3. 数据权限
添加更细粒度的数据权限:
- 用户只能查看自己创建的工单
- 维修员只能查看分配给自己的工单
- 物业经理可以查看部门所有工单

## 技术支持

如遇问题,请检查:
1. 微信开发者工具控制台的错误信息
2. 云函数日志(云开发控制台 -> 云函数 -> 日志)
3. 云数据库数据(云开发控制台 -> 数据库)
