# 云数据库部署指南

## 完整部署步骤

### 第一步：创建云数据库集合

1. 登录微信云开发控制台
   - 访问：https://console.cloud.tencent.com/tcb
   - 选择环境：`cloud1-7glfhm4r06e030bd`

2. 进入"数据库"标签，创建以下集合：

| 集合名 | 说明 |
|--------|------|
| `roles` | 角色表 |
| `users` | 用户表 |
| `fault_types` | 故障类型表 |
| `work_orders` | 工单表 |
| `notifications` | 通知表 |
| `audit_logs` | 审计日志表 |

**创建方法**：
- 点击"添加集合"按钮
- 输入集合名称（如 `roles`）
- 点击"确定"

### 第二步：上传云函数

在微信开发者工具中：

1. **上传 initDatabase 云函数**
   - 右键点击 `cloudfunctions/initDatabase` 文件夹
   - 选择"上传并部署：云端安装依赖（不上传 node_modules）"
   - 等待上传完成

2. **上传 userAuth 云函数**
   - 右键点击 `cloudfunctions/userAuth` 文件夹
   - 选择"上传并部署：云端安装依赖（不上传 node_modules）"
   - 等待上传完成

3. **上传 workOrderManager 云函数**
   - 右键点击 `cloudfunctions/workOrderManager` 文件夹
   - 选择"上传并部署：云端安装依赖（不上传 node_modules）"
   - 等待上传完成

4. **确认已有云函数**
   - `login` - 已部署 ✓
   - `uploadImage` - 已部署 ✓
   - `sendNotification` - 已部署 ✓

### 第三步：初始化数据库

1. 在微信开发者工具，打开"云开发"控制台
2. 进入"云函数"标签
3. 找到 `initDatabase` 函数
4. 点击"测试"按钮
5. 输入测试参数：
   ```json
   {
     "action": "init"
   }
   ```
6. 点击"运行测试"
7. 查看返回结果，应该显示：
   ```json
   {
     "success": true,
     "action": "init",
     "results": {
       "roles": { "success": true, "count": 4 },
       "fault_types": { "success": true, "count": 30 },
       "test_users": { "success": true, "count": 3 }
     },
     "message": "数据库初始化完成"
   }
   ```

### 第四步：配置数据库权限（可选，推荐在测试通过后设置）

在云开发控制台 - 数据库 - 每个集合的"权限设置"：

#### roles 集合
```json
{
  "read": true,
  "write": "doc._openid == 'admin_openid'"
}
```

#### users 集合
```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

#### work_orders 集合
```json
{
  "read": true,
  "write": true
}
```
*注意：初期建议设置为 read: true, write: true 方便测试，正式上线前再收紧权限*

### 第五步：测试云数据库

1. 在微信开发者工具中，打开小程序
2. 进入"云开发测试"页面（pages/cloud-test）
3. 测试云函数调用

或者在云函数控制台测试：

#### 测试用户认证
```json
{
  "action": "login"
}
```

#### 测试获取故障类型
```json
{
  "action": "getFaultTypes"
}
```

### 第六步：更新前端代码（已准备好，暂未启用）

前端已经准备好云数据库集成代码，但目前仍连接 Node.js 后端。

如果要完全切换到云数据库：
1. 修改 `miniprogram/services/auth.js` 中的 `loginWithCloud()` 函数
2. 修改 `miniprogram/services/api.js` 中的工单相关 API 调用
3. 直接调用云函数而不是 HTTP API

## 云函数说明

### 1. initDatabase（初始化数据库）

**功能**：创建基础数据

**调用示例**：
```javascript
wx.cloud.callFunction({
  name: 'initDatabase',
  data: {
    action: 'init' // 或 'reset', 'stats', 'reset_and_init'
  }
})
```

**可用操作**：
- `init` - 初始化数据（如果已存在则跳过）
- `reset` - 清空所有数据（危险操作）
- `stats` - 获取数据库统计信息
- `reset_and_init` - 重置并重新初始化

### 2. userAuth（用户认证）

**功能**：用户登录、注册、信息更新

**调用示例**：
```javascript
// 登录/获取用户信息
wx.cloud.callFunction({
  name: 'userAuth',
  data: {
    action: 'login',
    data: {
      userInfo: {} // 可选：微信用户信息
    }
  }
})

// 更新个人信息
wx.cloud.callFunction({
  name: 'userAuth',
  data: {
    action: 'updateProfile',
    data: {
      name: '张三',
      contact_phone: '13800138000',
      department: '维修部'
    }
  }
})

// 获取用户列表（需管理员权限）
wx.cloud.callFunction({
  name: 'userAuth',
  data: {
    action: 'listUsers'
  }
})
```

**可用操作**：
- `login` - 登录/注册（自动创建新用户）
- `getUserInfo` - 获取当前用户信息
- `updateProfile` - 更新个人信息
- `getUserById` - 通过 user_id 获取用户
- `listUsers` - 获取用户列表（管理员）
- `listRoles` - 获取所有角色

### 3. workOrderManager（工单管理）

**功能**：工单的增删改查、状态流转

**调用示例**：
```javascript
// 创建工单
wx.cloud.callFunction({
  name: 'workOrderManager',
  data: {
    action: 'create',
    data: {
      floor: '3F',
      location: '301室卫生间',
      fault_type_id: 11,
      priority: 'High',
      description: '水管漏水严重',
      photos: ['cloud://xxx.jpg', 'cloud://yyy.jpg']
    }
  }
})

// 更新工单状态
wx.cloud.callFunction({
  name: 'workOrderManager',
  data: {
    action: 'updateStatus',
    data: {
      order_id: 1,
      status: 'In Progress',
      notes: '开始维修'
    }
  }
})

// 获取工单列表
wx.cloud.callFunction({
  name: 'workOrderManager',
  data: {
    action: 'list',
    data: {
      filters: {
        status: 'Pending Repair', // 可选
        priority: 'High', // 可选
        limit: 50 // 可选，默认100
      }
    }
  }
})

// 获取单个工单详情
wx.cloud.callFunction({
  name: 'workOrderManager',
  data: {
    action: 'getById',
    data: {
      order_id: 1
    }
  }
})

// 获取故障类型列表
wx.cloud.callFunction({
  name: 'workOrderManager',
  data: {
    action: 'getFaultTypes'
  }
})
```

**可用操作**：
- `create` - 创建工单（自动分配维修员）
- `updateStatus` - 更新工单状态
- `list` - 获取工单列表（根据角色自动过滤）
- `getById` - 获取工单详情
- `getFaultTypes` - 获取故障类型列表

## 工单状态流转

```
创建工单 → Pending Repair（待维修）
         ↓
    In Progress（维修中）
         ↓
    Repaired（已维修）→ 业主验收
         ↓                ↓
    Completed        Needs Rework（需返工）
    （已完成）             ↓
                    In Progress（重新维修）
```

## 角色权限说明

| 角色 ID | 角色名称 | 权限 |
|---------|----------|------|
| 1 | 系统管理员 | 全部权限 |
| 2 | 物业经理 | 查看/分配/审核工单，查看报表 |
| 3 | 维修员 | 查看/更新分配给自己的工单 |
| 4 | 物业员工 | 创建工单，查看自己提交的工单 |

## 测试账号

初始化数据库后会创建 3 个测试账号：

| 姓名 | 角色 | OpenID（测试用） |
|------|------|------------------|
| 测试管理员 | 系统管理员 | test_admin_openid |
| 测试经理 | 物业经理 | test_manager_openid |
| 测试维修员 | 维修员 | test_technician_openid |

*注意：这些是测试账号，正式环境请删除*

## 数据库索引优化（推荐）

在云开发控制台 - 数据库 - 索引管理中添加：

### users 集合
```json
{
  "wechat_openid": 1
}
```

### work_orders 集合
```json
{
  "status": 1,
  "created_at": -1
}
```

```json
{
  "assigned_technician.user_id": 1,
  "status": 1
}
```

## 监控和调试

1. **云函数日志**：云开发控制台 - 云函数 - 日志
2. **数据库操作日志**：云开发控制台 - 数据库 - 操作日志
3. **错误监控**：云开发控制台 - 监控告警

## 常见问题

### Q: 云函数调用失败，提示权限不足？
A: 检查数据库集合权限设置，初期建议设置为 `read: true, write: true`

### Q: 找不到用户/工单数据？
A: 确认已运行 `initDatabase` 云函数初始化数据

### Q: 云函数超时？
A: 检查数据库连接，或增加云函数超时时间（控制台设置）

### Q: 如何查看云函数日志？
A: 云开发控制台 - 云函数 - 选择函数 - 日志

### Q: 如何重置数据库？
A: 调用 `initDatabase` 云函数，传入 `{"action": "reset_and_init"}`

## 下一步

1. ✅ 创建数据库集合
2. ✅ 上传云函数
3. ✅ 初始化数据
4. ⏸️ 配置权限（可选）
5. ⏸️ 更新前端代码切换到云数据库
6. ⏸️ 完整功能测试

当前已完成云数据库基础设施搭建，可以开始测试！
