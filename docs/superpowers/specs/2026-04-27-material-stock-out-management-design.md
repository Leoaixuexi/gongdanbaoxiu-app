# 耗品出库管理设计 v2

**日期**：2026-04-27
**版本**：v2（替换 v1，原 v1 见 git history `7d5f3d9`）
**模块**：耗品管理 / 出库（独立子模块）
**状态**：Spec 草案，待用户最终审阅

---

## 0. v2 与 v1 的差异（关键）

v1 把出库管理改造塞进既有的 `pages/material/` 和 `cloudfunctions/materialManager/`，但因为首页**工单维修 Tab 也有"物料管理"快捷入口共享同一个 `pages/material/index` 页面**，导致从工单维修 Tab 进入也会看到出库管理改动，模块边界混乱。

v2 把出库管理**完全独立**：

| 维度 | v1（旧） | v2（新） |
|---|---|---|
| 前端落点 | 改造 `pages/material/index` Tab2/3 | **新建 `pages/stock-out/`**（4 个页面），不动 `pages/material/` |
| 后端落点 | `cloudfunctions/materialManager` 内拆 handlers + 加 6 个 action | **新建 `cloudfunctions/stockOutManager`** 独立云函数，不动 `materialManager` |
| 权限函数 | 在 `materialManager/helpers.js` 加 `canApproveStockOut/canRequestStockOut` | **stockOutManager 自带 helpers.js**，独立维护 |
| 入库扣库存 | 共用 `materialManager` 内逻辑 | stockOutManager 直接读写 `materials` 集合（保持彻底解耦） |
| 入口位置 | 耗品管理 Tab 宫格 + 工单维修 Tab "物料管理"间接入口共享 | **仅**耗品管理 Tab 的"出库管理"宫格 → 跳 `/pages/stock-out/index` |
| 共享基建 | 共享 helpers.js（争议点） | 共享 dictionaryManager / sendNotification / roles 集合（必要的项目级基建，无争议） |

---

## 1. 背景与需求

入库管理已完成（独立成 `pages/material/stock-in`）。当前 `pages/material/index` 是 2-Tab `['配件列表', '出库记录']`，出库记录仅是只读历史，无审批流程。

新需求（与 v1 一致）：

- 引入"申请 → 审核 → 出库"三段式审批流（全部物资强制走审批）
- 新增"仓管员"角色（role_id=5），作为审核+出库执行的专职岗位
- 出库带"使用区域 / 使用场景 / 实际出库数量"业务维度，可被多条件筛选
- 通知贯穿全节点（提交 / 审核通过 / 驳回）

**v2 新增需求**：模块完全独立，不动 `pages/material/` 和 `cloudfunctions/materialManager/`，避免与工单维修 Tab 的"物料管理"快捷入口冲突。

## 2. 设计决策

| 决策点 | 选择 | 备选 | 选择原因 |
|---|---|---|---|
| **模块边界** | **独立 `pages/stock-out/` + `stockOutManager` 云函数** | 改造既有 material 模块（v1 方案，已废弃） | 避免与工单维修 Tab 的"物料管理"入口共享页面产生混淆 |
| 审批粒度 | 完整三段式（pending → approved/rejected/cancelled） | 物资打"需审批"标签 / 完全无审核 | 用户拍板：全部物资走审批 |
| 审核+出库 | **合并为一个动作**（仓管员点"审核通过"时直接扣库存） | 拆为两步 | 简化流程；用户拍板 |
| 申请人角色 | 1/2/4/5 都可申请 | 仅办美员工 | 经理/管理员代提常见 |
| 审核+出库角色 | 仅 1（管理员）+ 5（仓管员） | 1/2/5 / 仅 5 | 经理只看不操作；管理员超级兜底 |
| 数据集合 | 单表 `material_requests`（含状态机），出库执行时同步写 `material_records.type=out` | 多表分层 | 出库申请有独立生命周期，单表最干净 |
| `material_records` 字段扩展 | 新增 `request_id` / `region` / `scene` 3 个字段 | 不扩展 | 保留库存流水完整性，区分申请单出库 vs 工单扣库 |
| 库存读写 | stockOutManager 直接读写 `materials` 集合（不依赖 materialManager） | 调用 `materialManager.stockOut` action | 保持云函数间彻底解耦 |
| 申请人 vs 领用人 | 默认相同 | 独立字段 | 小团队 99% 自提自领 |
| 区域/场景 | 字典（`stock_out_region` / `stock_out_scene`） | 自由文本 | 多条件筛选必须数据干净 |
| 字典配置权限 | **仅管理员**（不放给经理/仓管员） | canManageMaterial 例外 | 用户拍板 |
| 申请数量 vs 实际数量 | 出库时仓管员可改实际数量（≤ 申请且 ≤ 库存） | 锁定 / 完全自由 | 应对库存不足/部分出库 |
| 驳回处理 | 不可编辑重提，只能新建 | 可编辑重提 | 审计追溯更干净 |
| 撤回 | 仅 Pending 可撤；状态变 Cancelled | 不可撤 | 基础体验 |
| 物资选择方式 | 搜索 + 分类筛选 | 仅搜索 / +扫码 | 出库场景扫码使用率低 |
| 通知 | 全节点（提交→通知 1+5；审核结果→通知申请人） | 仅审核结果 | 复用 createBatchNotifications 直写 notifications 集合 |
| Excel 导出 | **本期不做** | 本期做 | 聚焦闭环 |
| 入口 | 首页耗品管理 Tab "出库管理"宫格 → 跳 `/pages/stock-out/index` | 首页新增独立 Tab / admin 后台 | 与"出库管理 = 耗品管理子功能"的认知一致 |
| 入库管理 / 分类管理权限 | **不动 `materialManager`**（pages/material 模块仍是 [1,2,4]） | 同步收紧到 [1,2,5] | v2 明确不修改 materialManager；办美员工保留入库/分类权限（与 v1 不同） |

## 3. 架构

```
首页 Tab2 耗品管理 → 宫格"出库管理"（新增/已存在）
       ▼
/pages/stock-out/index   ← 独立页面，与 pages/material 完全分家
├── Tab1 出库申请          ← 活动单据（按角色视角变形）
│     · 办美员工(4)：我的申请（自己提的全状态）
│     · 仓管员(5) / 管理员(1)：待审核工作台 (status=Pending)
│     · 经理(2)：全部进行中（只读）
│     · FAB ➕ → /pages/stock-out/form 创建申请
│
└── Tab2 出库记录          ← 历史完结单据
      · 多条件筛选（时间/物资/区域/场景/状态/申请人/审核人）
      · 按权限过滤（办美只看自己的，其他角色看全部）
```

### 3.1 新增页面（4 个）

| 路径 | 用途 |
|---|---|
| `/pages/stock-out/index` | 主页（Tab1 出库申请 + Tab2 出库记录） |
| `/pages/stock-out/form` | 申请人填申请单（搜索物资 + 数量 + 区域 + 场景 + 备注） |
| `/pages/stock-out/detail` | 申请单详情页（状态时间线 + 操作按钮） |

注：subpages 文件夹结构 `/pages/stock-out/{index,form,detail}/index.{js,wxml,wxss,json}`。

### 3.2 与既有模块的关系

| 关系点 | 说明 |
|---|---|
| `pages/material/` | **完全不动** |
| `cloudfunctions/materialManager/` | **完全不动** |
| `materials` 集合 | stockOutManager 直接读写（取库存 / 扣库存） |
| `material_records` 集合 | stockOutManager 写 `type=out` 记录（含 request_id/region/scene 新字段） |
| 工单完成扣库存路径 | `workOrderManager → materialManager.stockOut` 不受影响 |
| 既有 Tab2 出库记录（pages/material/index）| 仍是只读历史展示，对历史 material_records type=out 数据继续显示；本期新增 request_id/region/scene 字段是后向兼容（旧数据为空） |

## 4. 角色与权限

### 4.1 新增角色

```js
// miniprogram/utils/constants.js（v2 仍需要修改）
const ROLES = {
  ADMIN: 1, PROPERTY_MANAGER: 2, MAINTENANCE_STAFF: 3, PROPERTY_STAFF: 4,
  WAREHOUSE_KEEPER: 5,           // 仓管员（新增）
};
const ROLE_DISPLAY_NAMES = { ..., 5: '仓管员' };
```

云数据库 `roles` 集合新增一条 `{ role_id:5, name:'仓管员', module_permissions:[...], active:true }`（手动配置）。

### 4.2 出库流程权限矩阵

| 操作 | 管理员(1) | 经理(2) | 维修员(3) | 办美(4) | 仓管员(5) |
|------|:--:|:--:|:--:|:--:|:--:|
| 进入 stock-out 模块 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 提交出库申请 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 审核出库（=出库） | ✓ | ✗ | ✗ | ✗ | ✓ |
| 驳回 | ✓ | ✗ | ✗ | ✗ | ✓ |
| 撤回自己的申请 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 查看出库申请单 | 全部 | 全部 | ✗ | 仅自己 | 全部 |
| 查看出库记录（历史） | 全部 | 全部 | ✗ | 仅自己提的 | 全部 |

### 4.3 既有模块权限**不变**（v2 与 v1 的关键差异）

| 既有功能 | v1 调整 | v2 处理 |
|---|---|---|
| materialManager.canAccessMaterial | [1,2,4] → [1,2,4,5] | **不动**，保持 [1,2,4] |
| materialManager.canManageMaterial | [1,2,4] → [1,2,5] | **不动**，保持 [1,2,4] |
| dictionaryManager material_category 写权限 | [1,2,4] → [1,2,5] | **不动**，保持 [1,2,4] |
| 进入 pages/material/ | 加入 5 | **不动**（仓管员通过 stock-out 独立模块工作，不需要进 pages/material） |

如果未来仓管员（role_id=5）需要管理配件/分类，再单独评估。本期不做。

### 4.4 stockOutManager 自有权限函数

```js
// cloudfunctions/stockOutManager/helpers.js（独立维护，不依赖 materialManager）
function canAccessStockOut(user) {
  // 进 stock-out 模块：管理员 / 经理 / 办美 / 仓管员（维修员排除）
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}
function canRequestStockOut(user) {
  // 提交申请：1/2/4/5 都可
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}
function canApproveStockOut(user) {
  // 审核+出库：仅管理员 + 仓管员
  return user && [1, 5].includes(user.role_id) && user.active !== false;
}
```

### 4.5 字典权限

新字典 `stock_out_region` / `stock_out_scene` 在 `dictionaryManager` 严格仅放给 `role_id=1`（管理员）写。这是 v1 已有的决策，沿用。**注意：v2 不动 material_category / material_location 字典的权限**——它们仍然是 canManageMaterial（[1,2,4]）。

### 4.6 入口可见性

| 入口 | 看得见？ |
|---|---|
| 首页耗品管理 Tab "出库管理"宫格 | 1/2/4/5（除维修员） |
| stock-out/index Tab1 FAB ➕ | 1/2/4/5（除维修员） |
| stock-out/detail "审核通过" / "驳回"按钮 | 仅 1/5，且仅 status=Pending |
| stock-out/detail "撤回"按钮 | 仅申请人本人，且仅 status=Pending |
| admin 数据字典管理 — stock_out_region / stock_out_scene | 仅 1 |

## 5. 数据模型

### 5.1 新建集合 `material_requests`

```js
{
  _id: ObjectId,
  request_id: Number,                   // 自增主键（getNextId 在 stockOutManager helpers 实现）
  request_number: String,               // 'CKSQ-YYYYMMDD-XXXX'

  // === 物资快照（提交时刻）===
  material_id: Number,
  material_name: String,
  material_number: String,
  material_image: String,
  category: String,
  spec: String,
  model: String,
  unit: String,

  // === 申请信息 ===
  requester: { user_id, name, role_id },
  requested_quantity: Number,           // 申请数量（>0）
  region: String,                       // 使用区域 label（来自字典）
  scene: String,                        // 使用场景 label（来自字典）
  remark: String,                       // 备注（≤200 字）

  // === 状态机 ===
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled',

  // === 审核+出库（status=Approved 时填充）===
  reviewer: { user_id, name } | null,
  approved_quantity: Number | null,     // 实际出库数量（1..min(申请,库存)）
  out_record_id: Number | null,         // 关联 material_records.record_id

  // === 驳回（status=Rejected 时填充）===
  reject_reason: String | null,

  // === 时间字段 ===
  created_at, updated_at, approved_at, rejected_at, cancelled_at
}
```

**索引建议**：`request_id`、`status`、`requester.user_id`、`created_at`。

### 5.2 改造既有 `material_records`

| 字段 | 类型 | 说明 |
|---|---|---|
| `request_id` | Number \| null | **新增**。关联出库申请单。`null` 表示直接出库（工单完成扣库存路径） |
| `region` | String | **新增**，从申请单冗余写入 |
| `scene` | String | **新增**，同上 |

既有历史记录保留为空字符串/null。**写入由 stockOutManager 完成**，materialManager 的 stockOut action 不动。

### 5.3 集合 `dictionaries` 新增 2 项

| dict_key | dict_name | seed 默认项 |
|---|---|---|
| `stock_out_region` | 使用区域 | 办公区 / 会议室 / 接待区 / 茶水间 / 卫生间 / 餐厅 / 前台 / 电梯间 / 楼梯间 / 储物间 / 室外公共区 / 通用 |
| `stock_out_scene` | 使用场景 | 日常办公 / 会议接待 / 客户接待 / 卫生清洁 / 设备维护 / 活动布置 / 突发事件 / 其他 |

每项 `{value=label, sort=index, enabled:true}`。**仅管理员**可在 admin 数据字典页 CRUD。首次进 stock-out/form 时若字典不存在，由前端自动 seed。

### 5.4 集合 `roles` 新增 1 条

```js
{ role_id: 5, name: '仓管员', module_permissions: [...], active: true }
```

### 5.5 业务编号生成规则

```
request_number = 'CKSQ-' + YYYYMMDD + '-' + 当日序号(4 位)
record_number  = 'CK-'   + YYYYMMDD + '-' + 当日序号(4 位)   // 出库执行时由 stockOutManager 生成
```

### 5.6 字段约束（与 v1 一致）

| 字段 | 约束 |
|---|---|
| `requested_quantity` | 整数，1 ≤ q ≤ 999999 |
| `approved_quantity` | 整数，1 ≤ q ≤ requested_quantity，且 ≤ 当前库存 |
| `region`、`scene` | 必填，从字典 enabled 项中选 |
| `remark` | 选填，≤200 字 |
| `reject_reason` | 驳回时必填，≤200 字 |

## 6. 组件清单

### 6.1 前端

| 文件 | 操作 | 主要内容 |
|---|---|---|
| `miniprogram/utils/constants.js` | 微改 | + `ROLES.WAREHOUSE_KEEPER=5`、`ROLE_DISPLAY_NAMES[5]`；+ `STOCK_OUT_STATUS` 与 display/colors |
| `miniprogram/pages/stock-out/index/{js,wxml,wxss,json}` | 新建 | 主页 Tab1+Tab2 + FAB + 筛选抽屉 |
| `miniprogram/pages/stock-out/form/{js,wxml,wxss,json}` | 新建 | 申请表单 + 物资 picker + 字典加载 |
| `miniprogram/pages/stock-out/detail/{js,wxml,wxss,json}` | 新建 | 详情页 + 状态时间线 + 操作按钮（审核/驳回/撤回） |
| `miniprogram/services/stockOutService.js` | 新建 | 6 个 stockOutManager 方法 + 1 个 getMaterialById（调 materialManager） |
| `miniprogram/services/dictionary.js` | 不动 | 既有 `getOptionsWithLabel/refreshCache` 复用 |
| `miniprogram/services/materialService.js` | **不动** | 不再像 v1 那样加 7 个新方法；getMaterialById 单独放 stockOutService |
| `miniprogram/app.json` | 微改 | + 3 个新页面路径 |
| `miniprogram/pages/home/index.{wxml,js}` | 微改 | 耗品管理 Tab "出库管理"宫格跳 `/pages/stock-out/index`（已存在 11 行 handler 等待 URL 修正） |
| `miniprogram/pages/material/index.{js,wxml,wxss}` | **不动** | v2 不改造，保持 2-Tab `['配件列表', '出库记录']` |

### 6.2 云函数

| 文件 | 操作 | 主要内容 |
|---|---|---|
| `cloudfunctions/stockOutManager/index.js` | 新建 | 单文件路由（与 workOrderManager / materialManager 风格一致），含 6 个 action |
| `cloudfunctions/stockOutManager/helpers.js` | 新建 | db 引用 + getCurrentUser + canAccessStockOut/canRequestStockOut/canApproveStockOut + getNextId + createBatchNotifications（沿用项目通知模式：直写 notifications 集合）|
| `cloudfunctions/stockOutManager/package.json` | 新建 | 仅 wx-server-sdk 依赖 |
| `cloudfunctions/materialManager/` | **不动** | 完全不动 |
| `cloudfunctions/dictionaryManager/index.js` | 微改 | `stock_out_region` / `stock_out_scene` 写权限严格放给 role_id=1（在 admin actions 校验里加分支）；material_category 等其他字典权限**不动** |
| `cloudfunctions/sendNotification/...` | 不动 | 复用既有；通知模板 `stock_out_pending` / `stock_out_approved` / `stock_out_rejected` 在云端配置 |

### 6.3 stockOutManager 6 个 actions

| action | 入参 | 权限 | 职责 |
|---|---|---|---|
| `createStockOutRequest` | `material_id, requested_quantity, region, scene, remark?` | canRequestStockOut | 校验 → 读 materials 取快照 → 写 material_requests(status=Pending) → 通知所有 1+5 用户 |
| `approveStockOutRequest` | `request_id, approved_quantity` | canApproveStockOut | 原子条件更新（status=Pending）→ 直接读写 materials 扣库存 + 写 material_records(type=out, request_id) + 改单 status=Approved → 通知申请人 |
| `rejectStockOutRequest` | `request_id, reject_reason` | canApproveStockOut | 校验 status=Pending → 改单 status=Rejected → 通知申请人 |
| `cancelStockOutRequest` | `request_id` | 申请人本人 | 校验 status=Pending、requester=current → 改单 status=Cancelled |
| `listStockOutRequests` | `status?, requester_user_id?, material_id?, region?, scene?, date_from?, date_to?, keyword?, page, pageSize` | canAccessStockOut | 按权限 + 筛选条件分页（办美只看自己的） |
| `getStockOutRequest` | `request_id` | canAccessStockOut | 详情返回（办美只看自己的） |

## 7. 关键流程时序

### 7.1 提交申请

```
申请人 → /pages/stock-out/index Tab1 → FAB ➕ → /pages/stock-out/form

stock-out/form onLoad
  → 并行 dictionary.getOptionsWithLabel('stock_out_region' / 'stock_out_scene')
       任一不存在 → 自动 seed → 重拉
  → 用户选物资（搜索/分类） → 带快照 → 输入数量 → 选区域 → 选场景 → 备注 → 提交

stockOutService.createStockOutRequest({...})
  → cloud.materialManager 不参与 → 直接调 stockOutManager.createStockOutRequest
  → canRequestStockOut 校验
  → 字段校验 + 物资快照（直接读 materials 集合）
  → getNextId('material_requests') + 'CKSQ-YYYYMMDD-XXXX'
  → material_requests.add({status:'Pending', ...})
  → notifyApprovers via createBatchNotifications → 通知 1+5 用户

stock-out/form → toast '已提交' → navigateBack
```

### 7.2 审核通过（= 出库）

```
仓管员/管理员 → stock-out/index Tab1 待审核 → tap → /pages/stock-out/detail?request_id=

detail → getStockOutRequest → 渲染 + 状态时间线
仅 1/5 + status=Pending：[审核通过] [驳回]

点"审核通过" → 弹底部确认（数量调整，默认=申请数量；上限取 min(申请, 当前库存)）
  → stockOutService.getMaterialById 取最新库存（直接调 materialManager.getMaterialByNumber 或本地新加）
  → 用户确认 → stockOutService.approveStockOutRequest

stockOutManager.approveStockOutRequest:
  → canApproveStockOut + 校验
  → material_requests.where({request_id, status:'Pending'}) 原子条件更新（防并发）
       updateRes.stats.updated === 0 → '单据已被审核'
  → 直接 db.collection('materials').doc(...).update({stock: _.inc(-aqty)}) 扣库存
  → material_records.add({type:'out', request_id, region, scene, ...})
  → material_requests.update(status='Approved', reviewer, approved_quantity, out_record_id, approved_at)
  → notifyRequester 'stock_out_approved'

detail → toast '出库成功' → setData status=Approved
```

### 7.3 驳回

```
仅 1/5 + status=Pending → "驳回" → 弹底部输入驳回原因（必填 ≤200 字）→ 确认

stockOutManager.rejectStockOutRequest:
  → canApproveStockOut + status=Pending 原子校验
  → material_requests.update(status='Rejected', reviewer, reject_reason, rejected_at)
  → notifyRequester 'stock_out_rejected'

detail → toast '已驳回'
```

### 7.4 撤回

```
申请人本人 + status=Pending → "撤回" → modal 确认

stockOutManager.cancelStockOutRequest:
  → 校验 requester.user_id === current && status='Pending'
  → material_requests.update(status='Cancelled', cancelled_at)
  → 不发通知

detail → toast '已撤回'
```

### 7.5 列表查询（按角色 + 筛选）

```
stock-out/index Tab1 onShow → stockOutService.listStockOutRequests({...})

云端按角色过滤：
  if user.role_id === 4 (办美):
    conditions['requester.user_id'] = user.user_id   // 强制限定为自己
  else (1/2/5):
    （无额外限制，可看全部）

子页前端默认筛选：
  · 办美：Tab1 自己的全状态  /  Tab2 自己已结束的
  · 仓管员/管理员：Tab1 status=Pending  /  Tab2 status IN [Approved,Rejected,Cancelled]
  · 经理：Tab1 status=Pending（只读）  /  Tab2 全状态历史

Tab2 多条件筛选 → 顶部"筛选"按钮 → 弹底部抽屉：
  时间范围 / 物资关键词 / 区域 / 场景 / 状态(多选) / 申请人 / 审核人
  → 应用 → listStockOutRequests 带条件
  → 已应用条件以 chip 形式显示，可单独移除
```

## 8. 错误处理与边界

### 8.1 网络与服务端

| 操作 | 错误情况 | 处理 |
|---|---|---|
| `createStockOutRequest` 失败 | 网络抖 / 服务端异常 | toast 服务端 error；按钮恢复；表单数据保留 |
| `approveStockOutRequest` 失败 | 库存不足 / 单已被并发处理 | toast；自动 reload detail 同步状态 |
| `rejectStockOutRequest` 失败 | 单已被并发处理 | 同上 |
| `cancelStockOutRequest` 失败 | 单已被并发处理 | 同上 |
| `listStockOutRequests` 失败 | 网络 | 列表空态 + "加载失败，点击重试" |
| `getStockOutRequest` 失败 | 网络 / 单不存在 / 无权限 | detail 页空态 + "返回"按钮 |

### 8.2 表单校验

| 字段 | 规则 | 反馈 |
|---|---|---|
| 物资 | 必选 | 未选时提交按钮 disabled |
| 申请数量 | 整数、1..999999、≤当前库存 | input type=digit；超库存时另显当前库存值 |
| 区域 / 场景 | 必选（字典 enabled 项） | picker 必选 |
| 备注 | ≤200 字 | maxlength |
| 实际出库数量（审核时） | 整数、1..申请数量、≤当前库存 | 上限取 min(申请, 库存) |
| 驳回原因 | 必填、≤200 字 | 未填时确认按钮 disabled |
| 提交按钮防抖 | loading + disabled | 失败/成功才恢复 |

### 8.3 状态机边界（并发保护）

| 情况 | 处理 |
|---|---|
| 两个仓管员同时点"审核通过" | 云端 `where({request_id, status:'Pending'}).update(...)` 原子条件更新；后到的 `updated=0` → "单据已被审核" |
| 仓管员审核中、申请人同时撤回 | 同样靠 `status='Pending'` 校验；先到的赢 |
| 重复点击 | 前端 loading + disabled；后端 status 校验兜底 |
| 已 Approved/Rejected/Cancelled 单据再次提交动作 | 云端校验拒绝 |
| 非 Pending 单据 | 全部按钮前端不渲染 |

### 8.4 库存边界

| 情况 | 处理 |
|---|---|
| 申请时库存=10、审核时剩 3 | 审核页"实际出库数量"上限自动变 3；提交时云端再校验，超过 → "库存不足" |
| 申请时物资被删除 | 审核时 `materials.where({material_id})` 返回空 → "配件已被删除"；仅可驳回 |
| `approved_quantity = 0` | 不允许；强制 ≥ 1 |
| 数据库扣库存与 records 写入跨节点不一致 | 项目其他模块同样未上分布式事务；接受"极小概率不一致 + 库存预警告警可发现" |

### 8.5 字典边界

| 情况 | 处理 |
|---|---|
| 字典首次不存在 | 进入 stock-out/form 时检测 → 自动 seed → toast → 重拉 |
| seed 失败（断网） | toast "加载失败"；下拉为空 + 提交按钮 disabled |
| 字典项被管理员软删 | `getOptionsWithLabel` 仅返回 enabled=true 项；既有申请单 region/scene 仍显示原 label（字段是字符串快照）|
| 申请人提交时字典已被删 | 前端只能选 enabled 项 |

### 8.6 权限误进

| 情况 | 处理 |
|---|---|
| 维修员 navigateTo `/pages/stock-out/index` | onLoad canAccessStockOut 校验 → toast "无权限访问" → navigateBack |
| 办美员工硬刷看别人的单 | 云函数 `getStockOutRequest` 校验 requester.user_id === current；否则返回"无权限"；前端空态退回 |
| 经理点"审核通过"（理论看不到的按钮） | 云端 `canApproveStockOut` 校验拦下 |
| 硬刷 url 进 stock-out/form 缺参 | 不需要 query；空表单初始化 |
| 硬刷 url 进 stock-out/detail 缺 request_id | onLoad 检测 → toast + navigateBack |

### 8.7 通知失败

| 情况 | 处理 |
|---|---|
| createBatchNotifications 调用失败 | 主流程**不回滚**；云函数日志记录；既有 globalData.unreadCounts 兜底 |
| 接收人列表为空（没有任何 1/5 用户） | createStockOutRequest 仍创建单据，仅日志告警 |

### 8.8 数据兼容

| 情况 | 处理 |
|---|---|
| 既有 `material_records.type='out'` 历史记录无 request_id/region/scene | 在 pages/material/index Tab2 出库记录里仍能显示（既有逻辑），缺字段显示 "-" |
| stock-out/index Tab2 vs material/index Tab2 | 两个独立页面；前者是新申请单视角，后者是旧 material_records 视角 |

## 9. 验证清单

### 9.1 路径回归（按角色）

**申请人（办美员工 role_id=4）**
- [ ] 首页 Tab2 耗品管理宫格"出库管理" → 跳 /pages/stock-out/index
- [ ] Tab1：默认显示自己的申请，看不到其他用户的
- [ ] FAB ➕ → /pages/stock-out/form
- [ ] 区域/场景下拉 12/8 项（首次进 seed）
- [ ] 申请数量超库存 → 拦下；正常 → toast "已提交"
- [ ] 列表顶部新单 status=Pending、'CKSQ-YYYYMMDD-XXXX'
- [ ] tap 自己 Pending 单 → detail 显示"撤回"按钮
- [ ] 撤回 → status=Cancelled
- [ ] 收到审核通知
- [ ] **不能进 pages/material 模块的入库管理 / 分类管理**（v2 这两个权限保留给办美 = [1,2,4]，跟 v1 不同）

**仓管员（role_id=5）**
- [ ] 进 /pages/stock-out 模块成功
- [ ] Tab1 显示所有 status=Pending（待审核工作台）
- [ ] tap → detail 显示"审核通过"+"驳回"
- [ ] 审核通过 → 弹数量调整 → 改小 → 提交 → status=Approved；material_records 多 type=out（含 request_id）；materials.stock 减少
- [ ] 驳回 → 输入原因 → status=Rejected
- [ ] Tab2 全部历史；多条件筛选正常
- [ ] **不能进 pages/material 模块**（v2 不给 5 加入 canAccessMaterial）

**管理员（role_id=1）**
- [ ] 与仓管员相同的全部能力
- [ ] admin 数据字典页能 CRUD `stock_out_region` / `stock_out_scene`

**经理（role_id=2）**
- [ ] Tab1 显示所有 Pending（只读视角）
- [ ] tap Pending 单 → detail 只看不能操作
- [ ] 自己也能提申请；自己 Pending 单可撤回

**维修员（role_id=3）**
- [ ] 首页耗品 Tab 看不到"出库管理"宫格
- [ ] 直接 navigateTo /pages/stock-out/index → toast "无权限" → 退回
- [ ] 工单 completeRepair 仍能扣库存（独立路径）

### 9.2 数据正确性

**提交申请后**
- [ ] `material_requests` 新增：status='Pending'、request_number、requester、物资快照齐全、region/scene 是字典 label
- [ ] `materials.stock` **不变**
- [ ] `material_records` **不变**

**审核通过后**
- [ ] `material_requests` update：status=Approved、reviewer、approved_quantity、out_record_id、approved_at
- [ ] `materials.stock` 减少 = approved_quantity，updated_at 刷新
- [ ] `material_records` 新增：type='out'、request_id、region/scene、record_number、operator=reviewer

**驳回后**：仅 `material_requests` 变化（status=Rejected, reviewer, reject_reason, rejected_at）
**撤回后**：仅 `material_requests` 变化（status=Cancelled, cancelled_at）

### 9.3 边界场景

- [ ] 库存=10、审核时剩 5：上限自动 5；强超 → "库存不足"
- [ ] 两个仓管员同时审核：第二个 → "单据已被审核"
- [ ] 申请数量 0 → 前端 disabled + 服务端兜底
- [ ] 字典软删后：已存在 Pending 单仍显示原 label；新建只能选 enabled 项
- [ ] 物资在 Pending 期间被删除：审核时 → "配件已被删除"，仅可驳回
- [ ] 撤回竞态（撤回 vs 审核）：先到的赢
- [ ] 维修员硬刷 url 进 stock-out/* → 被云端权限拦下

### 9.4 回归非 stock-out 模块

- [ ] 工单提报 / 编辑 / 详情 不受影响
- [ ] 工单完成扣库存（material_records.request_id=null）仍正常
- [ ] **pages/material/ 完全不变**（配件列表 / 出库记录 / 入库管理跳转）
- [ ] **cloudfunctions/materialManager/ 完全不变**（既有 11 个 action 仍工作）
- [ ] admin 用户管理新增 role_id=5 用户能成功
- [ ] admin 数据字典页含 material_category / material_location / stock_out_region / stock_out_scene
- [ ] 既有 material_records 'CK-2024-XXXX' 历史出库记录仍可见

## 10. 已知局限

- 不做扫码出库 / Excel 导出 / 免申请快速出库（未来按需求加）
- 数据库不上跨节点事务（与项目既有模块一致；极小概率不一致由库存预警兜底）
- 申请单 `approved_quantity` 是审核通过时一次性出库的数量；多次部分出库（拆单）不支持
- 通知失败不回滚主流程（与项目既有模块一致）
- 维修员的工单完成扣库存路径仍直写 material_records，不进入审批流（设计上独立）
- 既有 `materials.usage_area` 字段（采购入库时填的物资固定使用区域）与本期"出库申请的 region"语义不同，互不影响
- **v2 决策：仓管员（role_id=5）不获得 pages/material/ 入库 + 分类管理权限**——这与 v1 不同。仓管员只在 stock-out 模块工作。如果未来需要给仓管员入库权限，单独评估。
- 当 role_id IN [1,5] 用户全部不存在或 active=false 时，办美/经理提交的申请会进入 Pending 但无人审核（长期挂起）。规避：admin 用户管理保证至少 1 个 1 或 5 账号 active

## 11. 未做（本期范围之外）

- 扫码出库 / Excel 导出 / 拆单 / 免申请快速出库
- 出库补货建议
- 数据分析模块对耗品出库的统计图表
- 申请单驳回原因模板（预设几个常见值）
- 仓管员"批量审核"操作
- 申请单超时未审核的提醒/自动失效
- pages/material/ 模块的任何改造

---

## 附录 A — 影响文件清单（v2 vs v1 对照）

```
v2 新建（11 文件）：
  miniprogram/pages/stock-out/index/{js,wxml,wxss,json}                    (4)
  miniprogram/pages/stock-out/form/{js,wxml,wxss,json}                     (4)
  miniprogram/pages/stock-out/detail/{js,wxml,wxss,json}                   (4) 注：form 和 detail 各 4，index 各 4，共 12 个文件，写入时合并 stock-out 目录
  miniprogram/services/stockOutService.js                                  (1)
  cloudfunctions/stockOutManager/{index.js, helpers.js, package.json}      (3)

v2 改造（4 文件）：
  miniprogram/utils/constants.js                          (+ROLE 5 / +STATUS)
  miniprogram/app.json                                    (+3 路径)
  miniprogram/pages/home/index.{wxml,js}                  (出库管理宫格 URL → /pages/stock-out/index)
  cloudfunctions/dictionaryManager/index.js               (新字典 stock_out_* 仅 role 1)

v2 不动（v1 改过但 v2 全部恢复）：
  miniprogram/pages/material/                              (完全不动)
  cloudfunctions/materialManager/                          (完全不动)
  miniprogram/services/materialService.js                  (不加方法)
  miniprogram/custom-tab-bar/                              (不动)
```

## 附录 B — 角色权限对照（v2）

| 操作 | 管理员(1) | 经理(2) | 维修员(3) | 办美员工(4) | 仓管员(5) |
|------|:--:|:--:|:--:|:--:|:--:|
| 进入 pages/material/ 模块 | ✓ | ✓ | ✗ | ✓ | ✗（v2 不加） |
| 配件列表 / 入库管理 / 分类管理（既有） | ✓ | ✓ | — | ✓（v2 保留） | ✗（v2 不给） |
| 进入 /pages/stock-out/ 模块 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 提交出库申请 | ✓ | ✓ | — | ✓ | ✓ |
| 审核出库（=出库） | ✓ | ✗（只看） | — | ✗ | ✓ |
| 驳回出库 | ✓ | ✗ | — | ✗ | ✓ |
| 撤回自己的申请 | ✓ | ✓ | — | ✓ | ✓ |
| 查看出库申请单 | 全部 | 全部 | — | 仅自己 | 全部 |
| 查看出库记录历史 | 全部 | 全部 | — | 仅自己提的 | 全部 |
| 区域/场景字典 CRUD | ✓ | ✗ | — | ✗ | ✗ |
| material_category 字典 CRUD（既有） | ✓ | ✓ | — | ✓（v2 保留） | ✗（v2 不给） |
| 工单完成扣库存（独立路径） | — | — | ✓（独立） | — | — |
