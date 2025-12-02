# 角色映射修复说明

## 🐛 问题描述

用户登录维修员账号 (`technician` / `tech123`) 时，首页显示的角色是"行政经理"而不是"维修员"。

## 🔍 问题原因

前端代码中的 `constants.js` 文件中的角色定义与云数据库中的角色定义不匹配。

### 修复前的错误配置

**constants.js (旧的，错误的)**:
```javascript
// System Roles
const ROLES = {
  SUPER_ADMIN: 1,           // 超级管理员
  SYSTEM_ADMIN: 2,          // 系统管理员
  ADMINISTRATIVE_MANAGER: 3, // 行政经理 ❌ 错误
  PROPERTY_STAFF: 4,        // 物业员工
  MAINTENANCE_WORKER: 5,    // 维修工人 ❌ 错误 (实际不存在)
}

// Role Display Names
const ROLE_DISPLAY_NAMES = {
  1: '超级管理员',
  2: '系统管理员',
  3: '行政经理',      // ❌ 应该是"维修员"
  4: '物业员工',
  5: '维修工人',      // ❌ 不存在这个角色
}
```

**云数据库 (正确的)**:
```javascript
role_id: 1 → name: 'admin'            → display_name: '系统管理员'
role_id: 2 → name: 'property_manager' → display_name: '物业经理'
role_id: 3 → name: 'maintenance_staff'→ display_name: '维修员'
role_id: 4 → name: 'property_staff'   → display_name: '物业员工'
```

### 导致的问题

当用户使用 `technician` 账号登录时：
1. 云数据库返回 `role_id: 3`
2. 前端根据 `ROLE_DISPLAY_NAMES[3]` 查找显示名称
3. 得到错误的结果："行政经理"（应该是"维修员"）

## ✅ 修复内容

### 1. 修复 `miniprogram/utils/constants.js`

#### 修复角色常量定义
```javascript
// 修复前
const ROLES = {
  SUPER_ADMIN: 1,
  SYSTEM_ADMIN: 2,
  ADMINISTRATIVE_MANAGER: 3,
  PROPERTY_STAFF: 4,
  MAINTENANCE_WORKER: 5,
};

// 修复后
const ROLES = {
  ADMIN: 1,                  // 系统管理员
  PROPERTY_MANAGER: 2,       // 物业经理
  MAINTENANCE_STAFF: 3,      // 维修员
  PROPERTY_STAFF: 4,         // 物业员工
};
```

#### 修复角色显示名称
```javascript
// 修复前
const ROLE_DISPLAY_NAMES = {
  1: '超级管理员',
  2: '系统管理员',
  3: '行政经理',
  4: '物业员工',
  5: '维修工人',
};

// 修复后
const ROLE_DISPLAY_NAMES = {
  1: '系统管理员',
  2: '物业经理',
  3: '维修员',
  4: '物业员工',
};
```

### 2. 修复 `miniprogram/pages/index/index.js`

更新角色判断逻辑：

```javascript
// 修复前
const isPropertyStaff = userInfo.role_id === ROLES.PROPERTY_STAFF;
const isMaintenanceWorker = userInfo.role_id === ROLES.MAINTENANCE_WORKER; // ❌ 错误常量
const isManager = [
  ROLES.SUPER_ADMIN,          // ❌ 不存在
  ROLES.SYSTEM_ADMIN,         // ❌ 不存在
  ROLES.ADMINISTRATIVE_MANAGER // ❌ 不存在
].includes(userInfo.role_id);

// 修复后
const isPropertyStaff = userInfo.role_id === ROLES.PROPERTY_STAFF;
const isMaintenanceWorker = userInfo.role_id === ROLES.MAINTENANCE_STAFF; // ✅ 正确
const isManager = [
  ROLES.ADMIN,                // ✅ 系统管理员
  ROLES.PROPERTY_MANAGER      // ✅ 物业经理
].includes(userInfo.role_id);
```

## 📋 角色映射表（正确版本）

| role_id | name | display_name | 测试账号 | 密码 |
|---------|------|--------------|----------|------|
| 1 | admin | 系统管理员 | admin | admin123 |
| 2 | property_manager | 物业经理 | manager | manager123 |
| 3 | maintenance_staff | 维修员 | technician | tech123 |
| 4 | property_staff | 物业员工 | staff | staff123 |

## 🎯 角色权限说明

### 1. 系统管理员 (role_id: 1)
- 完整的系统权限
- 用户管理
- 系统配置
- 审计日志查看

### 2. 物业经理 (role_id: 2)
- 查看所有工单
- 分配维修员
- 查看数据报表
- 审计日志查看

### 3. 维修员 (role_id: 3)
- 查看分配给自己的工单
- 更新工单状态
- 上传维修照片
- 完成维修

### 4. 物业员工 (role_id: 4)
- 提交报修工单
- 查看自己提交的工单
- 验收已维修的工单

## 🧪 测试验证

修复后，请按以下步骤测试：

### 测试 1: 维修员登录
1. 使用 `technician` / `tech123` 登录
2. 进入首页
3. **预期结果**: 显示"维修员"（不是"行政经理"）
4. 应该看到维修员相关的导航卡片：
   - 待维修
   - 维修中
   - 维修历史

### 测试 2: 物业经理登录
1. 使用 `manager` / `manager123` 登录
2. 进入首页
3. **预期结果**: 显示"物业经理"
4. 应该看到管理员相关的导航卡片：
   - 数据看板
   - 数据分析
   - 用户管理
   - 等

### 测试 3: 系统管理员登录
1. 使用 `admin` / `admin123` 登录
2. 进入首页
3. **预期结果**: 显示"系统管理员"
4. 应该看到所有管理相关的导航卡片

### 测试 4: 物业员工登录
1. 使用 `staff` / `staff123` 登录
2. 进入首页
3. **预期结果**: 显示"物业员工"
4. 应该看到：
   - 提交工单
   - 我的工单

## 📝 修复的文件列表

1. ✅ `miniprogram/utils/constants.js`
   - 修复 `ROLES` 常量定义
   - 修复 `ROLE_DISPLAY_NAMES` 映射

2. ✅ `miniprogram/pages/index/index.js`
   - 修复 `isMaintenanceWorker` 判断
   - 修复 `isManager` 判断

## ⚠️ 注意事项

1. **重新编译**: 修改后需要在微信开发者工具中点击"编译"
2. **清除缓存**: 建议清除缓存后重新登录测试
3. **数据一致性**: 确保云数据库中的角色数据与这里的定义一致

## 🔄 如果问题仍然存在

如果修复后问题仍然存在，请检查：

1. **云数据库数据**:
   - 打开云开发控制台
   - 进入数据库 → users 集合
   - 检查 technician 用户的 `role_id` 是否为 3
   - 检查 `role` 字段是否为 `{ name: 'maintenance_staff', display_name: '维修员' }`

2. **缓存问题**:
   - 在开发者工具中点击"清除缓存" → "清除数据缓存"
   - 重新编译并登录

3. **代码同步**:
   - 确认修改的文件已保存
   - 确认开发者工具已重新编译

---

**修复状态**: ✅ 已完成
**测试状态**: ⏸️ 待用户测试验证
