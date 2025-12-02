# 工单数据库字段完整列表

## 更新日期
2025-11-21 (最新更新)

---

## 一、数据库存储字段（微信云数据库）

### 基础字段

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `_id` | String | ✓ | MongoDB 自动生成的文档 ID | "60a1b2c3d4e5f6g7h8i9j0k1" |
| `_openid` | String | ✓ | 微信用户 OpenID（提交者） | "oXXXXXXXXXXXXXXXXXX" |
| `order_id` | Number | ✓ | 工单数字 ID（自增） | 1001 |
| `order_number` | String | ✓ | 工单编号（唯一） | "WO20251121001" |

### 位置信息

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `floor` | String | ✓ | 楼层 | "3F" / "1楼" / "B1" |
| `location` | String | ✓ | 具体位置 | "301室卫生间" |

### 工单分类

| 字段名 | 类型 | 必填 | 说明 | 可选值 |
|--------|------|------|------|--------|
| `order_category` | String | ✓ | 工单类别 | "电梯维修", "水电维修", "消防维修", "空调维修", "其他" |
| `responsible_party` | String | ✓ | 责任方 | "物业公司", "业主", "第三方" |
| `priority` | String | ✓ | 优先级 | "Low", "Normal", "High", "Emergency" |

### 描述信息

| 字段名 | 类型 | 必填 | 长度限制 | 说明 |
|--------|------|------|----------|------|
| `description` | String | ✓ | 10-80 字符 | 问题描述 |
| `remark` | String | - | 最多 30 字符 | 备注 |

### 附件信息

| 字段名 | 类型 | 必填 | 说明 | 限制 |
|--------|------|------|------|------|
| `photos` | Array | ✓ | 现场照片 URL 数组 | 最少 1 张，最多 3 张 |

### 状态管理

| 字段名 | 类型 | 必填 | 说明 | 可选值 |
|--------|------|------|------|--------|
| `status` | String | ✓ | 工单状态 | "已提报", "待维修", "维修中", "已修复", "需重修", "待复核", "已完成" |
| `is_overdue` | Boolean | ✓ | 是否超期 | true / false |
| `rework_count` | Number | ✓ | 返工次数 | 默认 0 |

### 用户关联

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `submitter` | Object | ✓ | 报修人信息 |
| `submitter.user_id` | Number | ✓ | 报修人用户 ID |
| `submitter.openid` | String | ✓ | 报修人 OpenID |
| `submitter.name` | String | ✓ | 报修人姓名 |
| `submitter.phone` | String | - | 报修人电话 |
| `assigned_technician` | Object | ✓ | 维修人信息 |
| `assigned_technician.user_id` | Number | ✓ | 维修人用户 ID |
| `assigned_technician.openid` | String | ✓ | 维修人 OpenID |
| `assigned_technician.name` | String | ✓ | 维修人姓名 |
| `assigned_technician.phone` | String | - | 维修人电话 |

### 时间字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `report_time` | Date | ✓ | 报修时间（故障发生时间） |
| `created_at` | Date | ✓ | 工单创建时间 |
| `assigned_at` | Date | - | 分配时间 |
| `started_at` | Date | - | 开始维修时间 |
| `repaired_at` | Date | - | 维修完成时间 |
| `reviewed_at` | Date | - | 审核时间 |
| `completed_at` | Date | - | 最终完成时间 |
| `updated_at` | Date | ✓ | 最后更新时间 |
| `sla_deadline` | Date | ✓ | SLA 截止时间 |

### SLA 与用时

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `sla_deadline` | Date | ✓ | SLA 截止时间（根据优先级计算） |
| `total_duration_seconds` | Number | - | 工单总用时（秒），**仅在完成时写入** |


### 状态历史

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `status_history` | Array | ✓ | 状态变更历史记录 |
| `status_history[].from_status` | String | - | 原状态 |
| `status_history[].to_status` | String | ✓ | 新状态 |
| `status_history[].changed_by` | Object | ✓ | 操作人信息 |
| `status_history[].changed_by.user_id` | Number | ✓ | 操作人 ID |
| `status_history[].changed_by.name` | String | ✓ | 操作人姓名 |
| `status_history[].changed_at` | Date | ✓ | 变更时间 |
| `status_history[].notes` | String | - | 备注说明 |

---

## 二、计算字段（云函数自动添加）

这些字段**不存储在数据库**中，由云函数 `enhanceWorkOrder()` 实时计算并添加到返回数据中。

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `duration` | String | 工单总用时（格式化字符串）<br>示例: "1天2小时30分钟" |
| `duration_details` | Object | 用时详细信息 |
| `duration_details.days` | Number | 天数 |
| `duration_details.hours` | Number | 小时数 |
| `duration_details.minutes` | Number | 分钟数 |
| `duration_details.seconds` | Number | 秒数 |
| `duration_details.totalSeconds` | Number | 总秒数 |
| `submitter_name` | String | 报修人姓名（快捷访问）<br>提取自 `submitter.name` |
| `technician_name` | String | 维修人姓名（快捷访问）<br>提取自 `assigned_technician.name` |
| `status_text` | String | 工单状态（即 status 字段本身）<br>"已提报", "待维修", "维修中", "已修复", "需重修", "待复核", "已完成" |
| `needs_live_timer` | Boolean | 是否需要前端读秒<br>`true`: 未完成，需读秒<br>`false`: 已完成，不读秒 |

---

## 三、字段统计

### 总计

| 类型 | 数量 |
|------|------|
| **数据库存储字段** | 36 个 |
| **计算字段** | 11 个 |
| **总计** | 47 个 |

### 按类别统计

| 类别 | 数量 | 字段 |
|------|------|------|
| **基础字段** | 4 | _id, _openid, order_id, order_number |
| **位置信息** | 2 | floor, location |
| **分类字段** | 3 | order_category, responsible_party, priority |
| **描述信息** | 2 | description, remark |
| **附件信息** | 1 | photos |
| **状态管理** | 3 | status, is_overdue, rework_count |
| **用户关联** | 8 | submitter.*, assigned_technician.* |
| **时间字段** | 9 | report_time, created_at, assigned_at, started_at, repaired_at, reviewed_at, completed_at, updated_at, sla_deadline |
| **用时字段** | 1 | total_duration_seconds |
| **状态历史** | 3 | status_history[] |
| **计算字段** | 11 | duration, duration_details, submitter_name, technician_name, status_text, needs_live_timer |

---

## 四、字段详细说明

### 1. 工单编号（order_number）

**格式**: `WO + YYYYMMDD + 随机3位数`

**示例**:
- `WO20251121001`
- `WO20251121002`

**生成方式**:
- 扫码自动生成
- 系统自动生成

**唯一性**: 全局唯一

---

### 2. 工单状态（status）流转

```
已提报
    ↓
待维修
    ↓
维修中
    ↓
已修复
    ↓ 审核
    ├─ 待复核 → 已完成 ✓
    └─ 需重修 → 回到维修中
```

**状态说明**:
- `已提报`: 工单刚创建
- `待维修`: 等待维修员接单
- `维修中`: 维修员已开始维修
- `已修复`: 维修员完成维修，等待物业审核
- `需重修`: 物业审核不通过，需要返工
- `待复核`: 等待最终复核
- `已完成`: 物业审核通过，工单最终完成

---

### 3. 优先级（priority）与 SLA

| 优先级 | 英文 | SLA 时长 | 说明 |
|--------|------|----------|------|
| 低 | Low | 168 小时（7 天） | 非紧急问题 |
| 普通 | Normal | 72 小时（3 天） | 常规维修 |
| 高 | High | 24 小时（1 天） | 重要问题 |
| 紧急 | Emergency | 2 小时 | 紧急故障 |

---

### 4. 工单类别（order_category）

| 类别 | 说明 | 示例 |
|------|------|------|
| 电梯维修 | 电梯相关故障 | 电梯门无法关闭 |
| 水电维修 | 水管、电路故障 | 水管漏水、电路跳闸 |
| 消防维修 | 消防设施故障 | 消防栓损坏 |
| 空调维修 | 空调系统故障 | 空调不制冷 |
| 其他 | 其他类型维修 | 门锁损坏 |

---

### 5. 责任方（responsible_party）

| 责任方 | 说明 |
|--------|------|
| 物业公司 | 物业公司负责维修和费用 |
| 业主 | 业主个人负责费用 |
| 第三方 | 第三方承包商负责 |

---

### 6. 总用时（total_duration_seconds）

**存储时机**:
- ✅ 工单状态变为 `Completed` 时自动计算并写入
- ❌ 未完成的工单此字段为 `null`

**计算公式**:
```javascript
total_duration_seconds = Math.floor((completed_at - created_at) / 1000)
```

**前端显示**:
- 已完成工单：直接读取此字段，静态显示
- 未完成工单：实时计算，动态读秒

**示例**:
- `9015` → 显示为 "2小时30分15秒"
- `null` → 启动读秒组件，实时计算

---

### 7. 照片字段

#### 现场照片（photos）

- **拍摄时机**: 工单提交时
- **拍摄者**: 物业员工（报修人）
- **用途**: 记录故障现场
- **限制**: 最少 1 张，最多 3 张
- **格式**: 云存储 URL 数组

#### 维修后照片（repair_photos）

- **拍摄时机**: 维修完成时
- **拍摄者**: 维修员
- **用途**: 记录维修结果
- **限制**: 无限制
- **格式**: 云存储 URL 数组

---

### 8. 状态历史（status_history）

**示例数据**:
```json
[
  {
    "from_status": null,
    "to_status": "Pending Repair",
    "changed_by": { "user_id": 5, "name": "张三" },
    "changed_at": "2025-11-21T10:00:00.000Z",
    "notes": "工单创建"
  },
  {
    "from_status": "Pending Repair",
    "to_status": "In Progress",
    "changed_by": { "user_id": 3, "name": "李四" },
    "changed_at": "2025-11-21T10:30:00.000Z",
    "notes": "开始维修"
  },
  {
    "from_status": "In Progress",
    "to_status": "Repaired",
    "changed_by": { "user_id": 3, "name": "李四" },
    "changed_at": "2025-11-21T12:00:00.000Z",
    "notes": "维修完成"
  },
  {
    "from_status": "Repaired",
    "to_status": "Completed",
    "changed_by": { "user_id": 5, "name": "张三" },
    "changed_at": "2025-11-21T12:30:00.000Z",
    "notes": "审核通过"
  }
]
```

---

## 五、完整数据示例

### 未完成工单

```json
{
  "_id": "60a1b2c3d4e5f6g7h8i9j0k1",
  "_openid": "oXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "order_id": 1001,
  "order_number": "WO20251121001",
  "floor": "3F",
  "location": "301室卫生间",
  "order_category": "水电维修",
  "responsible_party": "物业公司",
  "priority": "High",
  "report_time": "2025-11-21T09:30:00.000Z",
  "description": "卫生间水管漏水严重，地面积水",
  "remark": "需要尽快处理",
  "photos": [
    "cloud://xxx/photo1.jpg",
    "cloud://xxx/photo2.jpg"
  ],
  "repair_photos": [],
  "status": "In Progress",
  "is_overdue": false,
  "rework_count": 0,
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
  "created_at": "2025-11-21T10:00:00.000Z",
  "assigned_at": "2025-11-21T10:05:00.000Z",
  "started_at": "2025-11-21T10:30:00.000Z",
  "repaired_at": null,
  "reviewed_at": null,
  "completed_at": null,
  "updated_at": "2025-11-21T10:30:00.000Z",
  "sla_deadline": "2025-11-22T10:00:00.000Z",
  "total_duration_seconds": null,
  "completion_notes": null,
  "review_notes": null,
  "status_history": [
    {
      "from_status": null,
      "to_status": "Pending Repair",
      "changed_by": { "user_id": 5, "name": "张三" },
      "changed_at": "2025-11-21T10:00:00.000Z",
      "notes": "工单创建"
    },
    {
      "from_status": "Pending Repair",
      "to_status": "In Progress",
      "changed_by": { "user_id": 3, "name": "李四" },
      "changed_at": "2025-11-21T10:30:00.000Z",
      "notes": "开始维修"
    }
  ],

  // ========== 以下为云函数自动添加的计算字段 ==========
  "duration": "1小时23分钟",
  "duration_details": {
    "days": 0,
    "hours": 1,
    "minutes": 23,
    "seconds": 0,
    "totalSeconds": 4980
  },
  "submitter_name": "张三",
  "technician_name": "李四",
  "status_text": "维修中",
  "needs_live_timer": true
}
```

### 已完成工单

```json
{
  "_id": "60a1b2c3d4e5f6g7h8i9j0k2",
  "_openid": "oXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "order_id": 1002,
  "order_number": "WO20251121002",
  "floor": "2F",
  "location": "205室客厅",
  "order_category": "电梯维修",
  "responsible_party": "物业公司",
  "priority": "Normal",
  "report_time": "2025-11-21T08:00:00.000Z",
  "description": "电梯按钮失灵，无法选择楼层",
  "remark": null,
  "photos": [
    "cloud://xxx/photo3.jpg"
  ],
  "repair_photos": [
    "cloud://xxx/repair1.jpg",
    "cloud://xxx/repair2.jpg"
  ],
  "status": "Completed",
  "is_overdue": false,
  "rework_count": 0,
  "submitter": {
    "user_id": 6,
    "openid": "oZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
    "name": "王五",
    "phone": "13900139000"
  },
  "assigned_technician": {
    "user_id": 3,
    "openid": "oYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    "name": "李四",
    "phone": "13900139000"
  },
  "created_at": "2025-11-21T09:00:00.000Z",
  "assigned_at": "2025-11-21T09:05:00.000Z",
  "started_at": "2025-11-21T09:15:00.000Z",
  "repaired_at": "2025-11-21T11:00:00.000Z",
  "reviewed_at": "2025-11-21T11:30:15.000Z",
  "completed_at": "2025-11-21T11:30:15.000Z",
  "updated_at": "2025-11-21T11:30:15.000Z",
  "sla_deadline": "2025-11-24T09:00:00.000Z",
  "total_duration_seconds": 9015,
  "completion_notes": "已更换电梯控制面板",
  "review_notes": "验收通过，运行正常",
  "status_history": [
    {
      "from_status": null,
      "to_status": "Pending Repair",
      "changed_by": { "user_id": 6, "name": "王五" },
      "changed_at": "2025-11-21T09:00:00.000Z",
      "notes": "工单创建"
    },
    {
      "from_status": "Pending Repair",
      "to_status": "In Progress",
      "changed_by": { "user_id": 3, "name": "李四" },
      "changed_at": "2025-11-21T09:15:00.000Z",
      "notes": "开始维修"
    },
    {
      "from_status": "In Progress",
      "to_status": "Repaired",
      "changed_by": { "user_id": 3, "name": "李四" },
      "changed_at": "2025-11-21T11:00:00.000Z",
      "notes": "已更换电梯控制面板"
    },
    {
      "from_status": "Repaired",
      "to_status": "Completed",
      "changed_by": { "user_id": 6, "name": "王五" },
      "changed_at": "2025-11-21T11:30:15.000Z",
      "notes": "验收通过，运行正常"
    }
  ],

  // ========== 以下为云函数自动添加的计算字段 ==========
  "duration": "2小时30分15秒",
  "duration_details": {
    "days": 0,
    "hours": 2,
    "minutes": 30,
    "seconds": 15,
    "totalSeconds": 9015
  },
  "submitter_name": "王五",
  "technician_name": "李四",
  "status_text": "已完成",
  "needs_live_timer": false
}
```

---

## 六、数据库索引

为提高查询性能，建议创建以下索引：

| 索引名 | 字段 | 说明 |
|--------|------|------|
| `idx_order_number` | order_number | 工单编号（唯一） |
| `idx_status` | status | 按状态查询 |
| `idx_priority` | priority | 按优先级查询 |
| `idx_created_at` | created_at (DESC) | 按创建时间倒序 |
| `idx_assigned_technician` | assigned_technician.user_id | 按维修人查询 |
| `idx_submitter` | submitter.user_id | 按报修人查询 |
| `idx_sla` | sla_deadline, is_overdue | SLA 监控 |
| `idx_floor` | floor | 按楼层查询 |

---

## 七、字段验证规则

| 字段 | 验证规则 |
|------|----------|
| `order_number` | 必填，唯一，长度 ≤ 20 |
| `floor` | 必填，长度 ≤ 20 |
| `location` | 必填，长度 ≤ 255 |
| `description` | 必填，长度 10-80 |
| `remark` | 可选，长度 ≤ 30 |
| `photos` | 必填，数组，1-3 张 |
| `repair_photos` | 可选，数组 |
| `priority` | 必填，枚举值 |
| `status` | 必填，枚举值 |
| `order_category` | 必填，枚举值 |
| `responsible_party` | 必填，枚举值 |
| `total_duration_seconds` | 可选，≥ 0 |
| `rework_count` | 必填，≥ 0，默认 0 |

---

这就是工单数据库的完整字段列表！📋
