# 工单数据库字段重构总结

## 重构日期
2025-11-21

## 重构原因
根据小程序提交工单页面的实际表单字段，对数据库字段进行优化和重构，移除冗余的 `fault_type` 外键关联，使用更简洁的枚举字段 `order_category`。

---

## 字段变更详情

### 新增字段

| 字段名 | 类型 | 必填 | 说明 | 默认值 |
|--------|------|------|------|--------|
| `order_category` | ENUM | ✓ | 工单类别（电梯维修、水电维修、消防维修、空调维修、其他） | - |
| `responsible_party` | ENUM | ✓ | 责任方（物业公司、业主、第三方） | - |
| `report_time` | DATE | ✓ | 报修时间（用户填写的故障发生时间） | - |
| `remark` | STRING(30) | - | 备注（可选） | null |
| `repair_photos_json` | JSON | - | 维修后照片数组 | [] |

### 移除字段

| 字段名 | 原类型 | 说明 | 替代方案 |
|--------|--------|------|----------|
| `fault_type_id` | INTEGER (外键) | 故障类型ID | 使用 `order_category` 枚举字段替代 |

### 修改字段

| 字段名 | 原限制 | 新限制 | 说明 |
|--------|--------|--------|------|
| `photos_json` | 最多9张 | 最少1张，最多3张 | 现场照片数组 |
| `description` | 不限 | 最少10字符，最多80字符 | 问题描述 |

---

## 数据库架构对比

### 重构前

```javascript
{
  order_id: 1001,
  order_number: "WO20251113001",
  floor: "3F",
  location: "301室卫生间",
  fault_type_id: 11,              // 外键关联到 fault_types 表
  priority: "High",
  description: "卫生间水管漏水严重",
  photos: [...]                   // 最多9张
}
```

### 重构后

```javascript
{
  order_id: 1001,
  order_number: "WO20251113001",
  floor: "3F",
  location: "301室卫生间",
  order_category: "水电维修",      // ✨ 枚举字段，无需关联
  responsible_party: "物业公司",    // ✨ 新增
  priority: "High",
  report_time: "2025-11-13T09:30:00.000Z",  // ✨ 新增
  description: "卫生间水管漏水严重",  // 10-80字符
  photos: [...],                   // 1-3张
  remark: "需要尽快处理",          // ✨ 新增
  repair_photos: []                // ✨ 新增
}
```

---

## 文件变更清单

### 1. 云函数 ✅

**文件**: `cloudfunctions/workOrderManager/index.js`

**变更**:
- 移除 `getFaultType()` 函数
- 新增 `ORDER_CATEGORIES` 常量（工单类别枚举）
- 新增 `RESPONSIBLE_PARTIES` 常量（责任方枚举）
- 更新 `createWorkOrder()` 函数：
  - 验证 `order_category` 和 `responsible_party`
  - 支持 `order_number` 传入（扫码生成）
  - 处理 `report_date` + `report_time` 转换为 `report_time`
  - 添加 `remark` 字段
  - 初始化 `repair_photos` 为空数组

### 2. 小程序提交页面 ✅

**文件**: `miniprogram/pages/property/submit/index.js`

**变更**:
- 移除 `loadFaultTypes()` 函数
- 移除 `onFaultTypeChange()`、`onSafetyChange()`、`onDateChange()`、`onTimeChange()` 事件处理器
- 更新 `validateForm()` 验证逻辑：
  - 验证 `orderNumber`（工单编号）
  - 验证 `orderCategoryIndex`（工单类别）
  - 验证 `responsiblePartyIndex`（责任方）
  - 验证至少上传1张照片
- 更新 `handleSubmit()` 提交数据结构：
  - `order_number`
  - `order_category`
  - `responsible_party`
  - `report_date` + `report_time`
  - `remark`

### 3. 数据库 Schema 文档 ✅

**文件**: `database/CLOUD_DATABASE_SCHEMA.md`

**变更**:
- 更新 `work_orders` 集合定义
- 新增字段说明：
  - `order_category`
  - `responsible_party`
  - `report_time`
  - `remark`
  - `repair_photos`
- 移除 `fault_type` 对象定义

### 4. 后端 Sequelize 模型 ✅

**文件**: `backend/src/models/WorkOrder.js`

**变更**:
- 移除 `fault_type_id` 字段及外键引用
- 新增字段：
  - `order_category` - ENUM('电梯维修', '水电维修', '消防维修', '空调维修', '其他')
  - `responsible_party` - ENUM('物业公司', '业主', '第三方')
  - `report_time` - DATE
  - `remark` - STRING(30)
  - `repair_photos_json` - JSON
- 更新字段验证：
  - `photos_json`: 最少1张，最多3张
  - `description`: 长度限制 10-80 字符

### 5. 数据库迁移文件 ✅

**文件**: `database/migrations/20251121000001-refactor-work-orders-fields.js`

**功能**:
- 新增字段：`order_category`, `responsible_party`, `report_time`, `remark`, `repair_photos_json`
- 数据迁移：将现有 `fault_type_id` 映射到 `order_category`
- 移除字段：`fault_type_id`
- 支持回滚（down 函数）

---

## 数据迁移策略

### 方案 A：云数据库（推荐）⭐

由于项目主要使用**微信云数据库**，数据库中可能没有或仅有少量测试数据。

**建议操作**:
1. 直接在云开发控制台手动删除现有测试工单数据
2. 使用新结构创建工单
3. 无需运行迁移脚本

### 方案 B：后端 Node.js + PostgreSQL/SQLite

如果使用传统后端数据库且有生产数据：

**迁移步骤**:
```bash
# 1. 进入后端目录
cd backend

# 2. 运行迁移
npx sequelize-cli db:migrate

# 3. 验证迁移
npx sequelize-cli db:migrate:status

# 4. 如需回滚
npx sequelize-cli db:migrate:undo
```

**迁移逻辑**:
- `fault_type_id` → `order_category` 映射规则：
  - 包含"电梯" → "电梯维修"
  - 包含"水"或"电" → "水电维修"
  - 包含"消防" → "消防维修"
  - 包含"空调" → "空调维修"
  - 其他 → "其他"
- `responsible_party` 默认值：`'物业公司'`
- `report_time` 默认值：`created_at`（工单创建时间）

---

## 向后兼容性

### ⚠️ 破坏性变更

此重构包含破坏性变更，需要注意：

1. **API 接口变更**
   - 创建工单时必须传入 `order_category` 和 `responsible_party`
   - 不再接受 `fault_type_id` 参数

2. **前端代码变更**
   - 所有调用工单创建 API 的页面需要更新
   - 工单详情页显示逻辑需要更新（不再显示 fault_type，改为 order_category）

3. **数据库结构变更**
   - 移除了 `fault_types` 表的外键依赖
   - `fault_types` 表可以选择性保留或删除

---

## 测试清单

### 功能测试

- [ ] 工单提交：验证所有必填字段
- [ ] 工单提交：验证照片数量限制（1-3张）
- [ ] 工单提交：验证问题描述长度（10-80字符）
- [ ] 工单提交：验证工单编号扫码生成
- [ ] 工单提交：验证备注字段（可选）
- [ ] 工单列表：验证新字段正确显示
- [ ] 工单详情：验证 `order_category` 和 `responsible_party` 显示
- [ ] 维修完成：验证 `repair_photos` 上传

### 数据验证

- [ ] 云数据库：验证新字段存在
- [ ] 云数据库：验证枚举值限制
- [ ] 后端数据库（如有）：验证迁移成功
- [ ] 后端数据库（如有）：验证旧数据迁移正确

### 回归测试

- [ ] 维修员接单流程
- [ ] 工单状态流转
- [ ] 通知推送
- [ ] 工单统计和报表
- [ ] SLA 监控

---

## 优势总结

### ✨ 重构带来的改进

1. **简化数据结构**
   - 移除 `fault_types` 表的外键依赖
   - 减少数据库查询次数（无需 JOIN）
   - 降低数据一致性维护成本

2. **提升性能**
   - 工单创建无需额外查询 `fault_types` 表
   - 工单列表查询无需关联查询
   - 减少数据库索引数量

3. **增强可维护性**
   - 枚举字段更直观，易于理解
   - 前端表单和数据库字段一一对应
   - 减少代码复杂度

4. **匹配业务需求**
   - 字段直接对应用户填写的表单项
   - 新增 `report_time` 准确记录故障发生时间
   - 新增 `remark` 支持额外说明
   - 新增 `responsible_party` 明确责任归属

---

## 后续建议

### 短期（1周内）

1. ✅ 更新所有工单相关页面的显示逻辑
2. ✅ 更新工单筛选和搜索功能（使用 `order_category` 替代 `fault_type`）
3. ✅ 更新导出报表的字段映射

### 中期（1月内）

1. 评估 `fault_types` 表的保留必要性
2. 如不再使用，可以删除 `fault_types` 相关表和代码
3. 清理 `getFaultTypes` API 端点

### 长期（3月内）

1. 考虑添加更多枚举类型（如新的工单类别）
2. 建立工单类别的统计分析
3. 优化基于 `order_category` 的自动分配逻辑

---

## 文档更新

需要更新以下文档：

- [x] `database/CLOUD_DATABASE_SCHEMA.md` - 云数据库架构
- [x] `backend/src/models/WorkOrder.js` - Sequelize 模型
- [ ] API 文档（Swagger，如有）
- [ ] 用户操作手册
- [ ] 开发者指南

---

## 联系信息

如有问题或疑问，请联系：
- 开发者：Claude Code
- 重构日期：2025-11-21
