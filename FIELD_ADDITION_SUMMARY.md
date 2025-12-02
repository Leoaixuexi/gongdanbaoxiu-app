# 工单字段添加总结

## 更新日期
2025-11-21

## 需求概述

用户要求添加以下字段：
1. ✅ 工单状态 - **已存在** (`status` 字段)
2. ✅ 工单总用时（天/时/分/秒）- **已添加** (计算字段 `duration`)
3. ✅ 报修人 - **已存在** (`submitter` 对象)
4. ✅ 维修人 - **已存在** (`assigned_technician` 对象)

---

## 实现方案

### 1. 工单状态 ✅

**字段**: `status`

**已有状态值**:
- `Pending Repair` - 待维修
- `In Progress` - 维修中
- `Repaired` - 已维修
- `Needs Rework` - 需返工
- `Completed` - 已完成

**显示优化**:
- 新增计算字段 `status_text`，提供中文描述
- 在云函数 `enhanceWorkOrder()` 中自动添加

```javascript
status_text: '待维修'  // 根据 status 自动转换
```

---

### 2. 工单总用时 ✨ 新增

**字段**: `duration` (计算字段，不存储在数据库)

**实现方式**: 实时计算
- 已完成工单：`completed_at - created_at`
- 进行中工单：`当前时间 - created_at`

**数据结构**:
```javascript
{
  duration: "1天2小时30分钟",  // 格式化字符串
  duration_details: {          // 详细数据
    days: 1,
    hours: 2,
    minutes: 30,
    seconds: 0,
    totalSeconds: 95400
  }
}
```

**计算逻辑**:
- 云函数 `workOrderManager/index.js` 中的 `calculateWorkOrderDuration()` 函数
- 小程序工具函数 `miniprogram/utils/timeUtils.js`

**显示位置**:
- 工单卡片组件 (可选显示)
- 工单详情页顶部状态信息区域
- 工单详情页信息卡片中

---

### 3. 报修人 ✅

**字段**: `submitter` (对象)

**数据结构**:
```javascript
submitter: {
  user_id: 5,
  openid: "oXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  name: "张三",
  phone: "13800138000"
}
```

**显示优化**:
- 新增计算字段 `submitter_name`，方便直接访问
- 在云函数 `enhanceWorkOrder()` 中自动添加

```javascript
submitter_name: "张三"  // 提取自 submitter.name
```

**显示位置**:
- 工单详情页 - 工单信息 Tab
- 工单卡片组件 (showDetails=true 时显示)

---

### 4. 维修人 ✅

**字段**: `assigned_technician` (对象)

**数据结构**:
```javascript
assigned_technician: {
  user_id: 3,
  openid: "oYYYYYYYYYYYYYYYYYYYYYYYYYYY",
  name: "李四",
  phone: "13900139000"
}
```

**显示优化**:
- 新增计算字段 `technician_name`，方便直接访问
- 在云函数 `enhanceWorkOrder()` 中自动添加

```javascript
technician_name: "李四"  // 提取自 assigned_technician.name
```

**显示位置**:
- 工单详情页 - 工单信息 Tab
- 工单卡片组件 (showDetails=true 时显示)

---

## 文件变更清单

### 云函数 ✅

**文件**: `cloudfunctions/workOrderManager/index.js`

**新增函数**:
```javascript
// 计算工单总用时
function calculateWorkOrderDuration(workOrder)

// 增强工单数据（添加计算字段）
function enhanceWorkOrder(workOrder)

// 获取工单状态中文描述
function getStatusText(status)
```

**修改函数**:
- `getWorkOrders()` - 返回增强后的工单数组
- `getById()` - 返回增强后的工单对象

### 小程序工具函数 ✨ 新增

**文件**: `miniprogram/utils/timeUtils.js`

**功能**:
- `calculateDuration()` - 计算两个时间之间的时长
- `formatDuration()` - 格式化时长为易读字符串
- `calculateWorkOrderDuration()` - 计算工单总用时
- `calculateWorkOrderPhases()` - 计算工单各阶段用时
- `formatDateTime()` - 格式化日期时间
- `getRelativeTime()` - 获取相对时间描述

### 工单卡片组件 ✅

**文件**: `miniprogram/components/work-order-card/index.wxml`

**新增显示字段**:
- 工单类别 (`order_category`)
- 责任方 (`responsible_party`)
- 总用时 (`duration`)
- 报修人 (`submitter_name`)
- 维修人 (`technician_name`)

### 工单详情页 ✅

**文件**:
- `miniprogram/pages/work-order-detail/index.wxml`
- `miniprogram/pages/work-order-detail/index.js`

**新增显示字段**:
- 报修时间 (`report_time`)
- 工单状态 (`status_text`)
- 工单类别 (`order_category`)
- 责任方 (`responsible_party`)

**新增数据字段**:
- `reportTime` - 格式化的报修时间

### 数据库 Schema 文档 ✅

**文件**: `database/CLOUD_DATABASE_SCHEMA.md`

**新增说明**:
- 计算字段章节，说明云函数自动添加的字段
- 各字段的详细说明

---

## 使用示例

### 1. 在小程序中显示工单信息

```javascript
// 获取工单列表（云函数已自动添加计算字段）
const orders = await workOrderService.getWorkOrders();

orders.forEach(order => {
  console.log('工单编号:', order.order_number);
  console.log('工单状态:', order.status_text);        // "待维修"
  console.log('报修人:', order.submitter_name);        // "张三"
  console.log('维修人:', order.technician_name);       // "李四"
  console.log('总用时:', order.duration);              // "1天2小时30分钟"
  console.log('用时详情:', order.duration_details);    // { days: 1, hours: 2, ... }
});
```

### 2. 在页面中使用 timeUtils 工具

```javascript
const { calculateWorkOrderDuration, formatDateTime } = require('../../utils/timeUtils');

// 计算工单用时
const duration = calculateWorkOrderDuration(workOrder);
console.log(duration.formatted);  // "1天2小时30分钟"

// 格式化时间
const dateTime = formatDateTime(workOrder.report_time);
console.log(dateTime);  // "2025-11-21 10:30"
```

### 3. 工单卡片组件使用

```xml
<!-- 显示基本信息 -->
<work-order-card
  workOrder="{{item}}"
  showDetails="{{false}}"
/>

<!-- 显示详细信息（包含报修人、维修人） -->
<work-order-card
  workOrder="{{item}}"
  showDetails="{{true}}"
/>
```

---

## 数据示例

### 云函数返回的增强工单数据

```json
{
  "_id": "xxx",
  "order_id": 1001,
  "order_number": "WO20251121001",
  "floor": "3F",
  "location": "301室卫生间",
  "order_category": "水电维修",
  "responsible_party": "物业公司",
  "priority": "High",
  "status": "In Progress",
  "report_time": "2025-11-21T09:30:00.000Z",
  "description": "卫生间水管漏水严重",
  "photos": ["..."],
  "submitter": {
    "user_id": 5,
    "name": "张三",
    "phone": "13800138000"
  },
  "assigned_technician": {
    "user_id": 3,
    "name": "李四",
    "phone": "13900139000"
  },
  "created_at": "2025-11-21T10:00:00.000Z",
  "completed_at": null,

  // ========== 以下为云函数自动添加的计算字段 ==========
  "duration": "2小时30分钟",
  "duration_details": {
    "days": 0,
    "hours": 2,
    "minutes": 30,
    "seconds": 0,
    "totalSeconds": 9000
  },
  "submitter_name": "张三",
  "technician_name": "李四",
  "status_text": "维修中"
}
```

---

## 性能考虑

### 计算字段的优势

1. **实时准确**: 每次查询都计算最新的用时数据
2. **节省存储**: 不占用数据库存储空间
3. **自动更新**: 无需维护数据一致性

### 性能优化建议

1. **缓存策略**: 对于已完成的工单，可以缓存 duration 值
2. **分页查询**: 工单列表使用分页，避免一次性计算大量数据
3. **按需计算**: 列表页可以不显示详细的用时，详情页再计算

---

## 兼容性说明

### 向后兼容

- 所有计算字段都是在云函数层面添加，不影响数据库结构
- 旧的工单数据无需迁移，云函数会自动处理
- 如果某些字段不存在（如 `report_time`），会优雅地处理

### 故障类型字段

- 旧的 `fault_type` 字段已被 `order_category` 替代
- 工单卡片组件已更新，移除对 `fault_type` 的依赖
- 如需兼容旧数据，可添加回退逻辑：
  ```javascript
  const category = order.order_category || order.fault_type?.name || '未知';
  ```

---

## 测试清单

### 功能测试

- [x] 工单列表：验证 `duration`、`status_text` 正确显示
- [x] 工单详情：验证报修人、维修人正确显示
- [x] 工单详情：验证工单状态、报修时间正确显示
- [x] 工单详情：验证工单总用时实时更新
- [x] 工单卡片：验证新字段在 showDetails=true 时正确显示

### 数据验证

- [ ] 已完成工单：验证 duration 计算准确（使用 completed_at）
- [ ] 进行中工单：验证 duration 实时更新（使用当前时间）
- [ ] 无 report_time 工单：验证优雅降级（使用 created_at）
- [ ] 旧数据兼容：验证没有新字段的工单正常显示

### 性能测试

- [ ] 100 条工单列表：验证加载时间 < 2 秒
- [ ] 工单详情页：验证首次加载时间 < 1 秒
- [ ] 实时用时更新：验证不影响页面性能

---

## 后续优化建议

### 短期（1周内）

1. 添加工单各阶段用时统计
   - 等待维修时长：`started_at - created_at`
   - 维修时长：`repaired_at - started_at`
   - 审核时长：`completed_at - repaired_at`

2. 添加用时预警
   - 超过平均用时的工单标记
   - SLA 用时百分比显示

### 中期（1月内）

1. 用时统计分析
   - 按工单类别统计平均用时
   - 按维修人员统计平均用时
   - 用时趋势分析图表

2. 性能优化
   - 对已完成工单的 duration 进行缓存
   - 优化计算逻辑，减少重复计算

### 长期（3月内）

1. 智能预测
   - 基于历史数据预测工单完成时间
   - 维修员工作负载预测

2. 用时排行榜
   - 最快完成的维修员
   - 平均用时最短的工单类别

---

## 总结

本次更新成功添加/优化了以下功能：

✅ **工单状态** - 已存在，新增中文描述
✅ **工单总用时** - 实时计算，格式化显示
✅ **报修人** - 已存在，新增快捷字段
✅ **维修人** - 已存在，新增快捷字段

所有字段均通过云函数计算添加，无需修改数据库结构，保证了系统的灵活性和可维护性。
