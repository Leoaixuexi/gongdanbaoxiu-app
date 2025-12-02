# 微信云数据库架构设计

## 概述

将 PostgreSQL 表结构迁移到微信云开发数据库（MongoDB 风格的 NoSQL 数据库）

## 云数据库集合定义

### 1. roles（角色集合）

**集合名**: `roles`

```json
{
  "_id": "自动生成",
  "_openid": "创建者openid（云数据库自动）",
  "role_id": 1,
  "name": "admin",
  "display_name": "系统管理员",
  "permissions": {
    "work_orders": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true
    },
    "users": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true
    },
    "reports": {
      "view": true,
      "export": true
    },
    "admin": {
      "manage_roles": true,
      "manage_config": true,
      "view_audit_logs": true
    }
  },
  "created_at": "2025-11-13T10:00:00.000Z",
  "updated_at": "2025-11-13T10:00:00.000Z"
}
```

**权限设置**:
- 仅管理员可写
- 所有登录用户可读

### 2. users（用户集合）

**集合名**: `users`

```json
{
  "_id": "自动生成",
  "_openid": "用户的微信openid（云数据库自动）",
  "user_id": 1,
  "wechat_openid": "oXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "name": "张三",
  "role_id": 4,
  "role": {
    "name": "property_staff",
    "display_name": "物业员工"
  },
  "contact_phone": "13800138000",
  "department": "维修部",
  "supervisor_id": null,
  "active": true,
  "created_at": "2025-11-13T10:00:00.000Z",
  "updated_at": "2025-11-13T10:00:00.000Z",
  "last_login_at": "2025-11-13T15:30:00.000Z"
}
```

**权限设置**:
- 用户可读写自己的文档（_openid 匹配）
- 管理员可读写所有

### 3. fault_types（故障类型集合）

**集合名**: `fault_types`

```json
{
  "_id": "自动生成",
  "_openid": "创建者openid",
  "type_id": 1,
  "name": "水电维修",
  "parent_id": null,
  "children": [
    {
      "type_id": 11,
      "name": "水管漏水"
    },
    {
      "type_id": 12,
      "name": "电路故障"
    }
  ],
  "active": true,
  "created_at": "2025-11-13T10:00:00.000Z",
  "updated_at": "2025-11-13T10:00:00.000Z"
}
```

**权限设置**:
- 所有用户可读
- 仅管理员可写

### 4. work_orders（工单集合）

**集合名**: `work_orders`

```json
{
  "_id": "自动生成",
  "_openid": "提交者openid",
  "order_id": 1001,
  "order_number": "WO20251113001",
  "floor": "3F",
  "location": "301室卫生间",
  "order_category": "水电维修",
  "responsible_party": "物业公司",
  "priority": "High",
  "report_time": "2025-11-13T09:30:00.000Z",
  "description": "卫生间水管漏水严重，地面积水",
  "photos": [
    "cloud://cloud1-xxx.com/workorder/photo1.jpg",
    "cloud://cloud1-xxx.com/workorder/photo2.jpg"
  ],
  "remark": "需要尽快处理",
  "status": "Pending Repair",
  "submitter": {
    "user_id": 5,
    "openid": "oXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "name": "张三",
    "phone": "13800138000"
  },
  "assigned_technician": {
    "user_id": 3,
    "openid": "oYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    "name": "李四",
    "phone": "13900139000"
  },
  "created_at": "2025-11-13T10:00:00.000Z",
  "assigned_at": "2025-11-13T10:05:00.000Z",
  "started_at": null,
  "repaired_at": null,
  "reviewed_at": null,
  "completed_at": null,
  "sla_deadline": "2025-11-14T10:00:00.000Z",
  "is_overdue": false,
  "rework_count": 0,
  "completion_notes": null,
  "review_notes": null,
  "repair_photos": [],
  "updated_at": "2025-11-13T10:05:00.000Z",
  "status_history": [
    {
      "from_status": null,
      "to_status": "Pending Repair",
      "changed_by": {
        "user_id": 5,
        "name": "张三"
      },
      "changed_at": "2025-11-13T10:00:00.000Z",
      "notes": "工单创建"
    }
  ]
}
```

**字段说明**:
- `order_number`: 工单编号，通过扫码生成或自动生成
- `floor`: 楼层（如：1楼、2楼、B1等）
- `location`: 具体位置
- `order_category`: 工单类别（电梯维修、水电维修、消防维修、空调维修、其他）
- `responsible_party`: 责任方（物业公司、业主、第三方）
- `priority`: 优先级（Low、Normal、High、Emergency）
- `report_time`: 报修时间（用户填写的故障发生时间）
- `description`: 问题描述（最少10字符，最多80字符）
- `photos`: 现场照片数组（最少1张，最多3张）
- `remark`: 备注（可选，最多30字符）
- `repair_photos`: 维修后照片数组（维修员完成维修时上传）
- `status`: 工单状态（Pending Repair、In Progress、Repaired、Needs Rework、Completed）
- `submitter`: 报修人信息对象（包含 user_id、name、phone）
- `assigned_technician`: 维修人信息对象（包含 user_id、name、phone）

**计算字段（云函数自动添加）**:
- `duration`: 工单总用时（格式化字符串，如 "1天2小时30分钟"）
- `duration_details`: 用时详细信息对象（包含 days、hours、minutes、seconds、totalSeconds）
- `submitter_name`: 报修人姓名（提取自 submitter.name）
- `technician_name`: 维修人姓名（提取自 assigned_technician.name）
- `status_text`: 工单状态中文描述（待维修、维修中、已维修、需返工、已完成）

**权限设置**:
- 提交者可读自己的工单
- 维修员可读分配给自己的工单
- 物业管理员可读写所有工单

### 5. notifications（通知集合）

**集合名**: `notifications`

```json
{
  "_id": "自动生成",
  "_openid": "接收者openid",
  "notification_id": 1,
  "user_id": 3,
  "type": "order_assigned",
  "title": "新工单分配",
  "message": "您有一个新的维修工单：WO20251113001",
  "data": {
    "order_id": 1001,
    "order_number": "WO20251113001",
    "priority": "High",
    "location": "3F-301室卫生间"
  },
  "read": false,
  "sent_at": "2025-11-13T10:05:00.000Z",
  "read_at": null,
  "created_at": "2025-11-13T10:05:00.000Z"
}
```

**权限设置**:
- 用户只能读写自己的通知（_openid 匹配）

### 6. audit_logs（审计日志集合）

**集合名**: `audit_logs`

```json
{
  "_id": "自动生成",
  "_openid": "操作者openid",
  "log_id": 1,
  "user_id": 1,
  "user_name": "管理员",
  "action": "update_order_status",
  "resource_type": "work_order",
  "resource_id": 1001,
  "old_value": {
    "status": "Pending Repair"
  },
  "new_value": {
    "status": "In Progress"
  },
  "ip_address": "183.14.132.117",
  "user_agent": "MicroMessenger/8.0.5",
  "created_at": "2025-11-13T10:10:00.000Z"
}
```

**权限设置**:
- 仅管理员可读
- 由云函数自动创建，用户不可写

## 索引策略

### users 集合
```javascript
db.collection('users').createIndex({
  wechat_openid: 1
}, {
  unique: true
});

db.collection('users').createIndex({
  role_id: 1,
  active: 1
});
```

### work_orders 集合
```javascript
db.collection('work_orders').createIndex({
  status: 1,
  created_at: -1
});

db.collection('work_orders').createIndex({
  'assigned_technician.user_id': 1,
  status: 1
});

db.collection('work_orders').createIndex({
  'submitter.openid': 1,
  created_at: -1
});

db.collection('work_orders').createIndex({
  sla_deadline: 1,
  is_overdue: 1
});
```

### notifications 集合
```javascript
db.collection('notifications').createIndex({
  _openid: 1,
  read: 1,
  created_at: -1
});
```

## 数据迁移策略

### 方案 A：完全云端（推荐）

**优点**:
- 无需 Node.js 后端
- 无连接问题
- 降低运维成本
- 微信生态集成更好

**实施步骤**:
1. 在云控制台创建集合
2. 编写初始化云函数导入基础数据（角色、故障类型）
3. 修改前端直接调用云函数
4. 移除 Node.js 后端依赖

### 方案 B：混合架构

**优点**:
- 保留复杂业务逻辑在 Node.js
- 云数据库用于认证和简单 CRUD
- 灵活性更高

**实施步骤**:
1. 云数据库存储用户、工单
2. Node.js 后端处理统计、报表、复杂查询
3. 云函数作为中间层

## 权限配置示例

在云开发控制台 - 数据库 - 集合权限中设置：

### users 集合
```json
{
  "read": "doc._openid == auth.openid || get('database.users.${auth.openid}').role_id == 1",
  "write": "doc._openid == auth.openid || get('database.users.${auth.openid}').role_id == 1"
}
```

### work_orders 集合
```json
{
  "read": "doc._openid == auth.openid || doc.assigned_technician.openid == auth.openid || get('database.users.${auth.openid}').role_id in [1,2,3]",
  "write": "get('database.users.${auth.openid}').role_id in [1,2,3]"
}
```

## 下一步操作

1. 登录云开发控制台：https://console.cloud.tencent.com/tcb
2. 选择环境：cloud1-7glfhm4r06e030bd
3. 进入"数据库"标签
4. 创建集合（按上述定义）
5. 配置权限
6. 运行初始化云函数导入数据
