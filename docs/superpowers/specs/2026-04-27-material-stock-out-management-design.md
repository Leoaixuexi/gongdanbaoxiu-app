# 耗品出库管理设计

**日期**：2026-04-27
**模块**：耗品管理 / 出库
**状态**：Spec 草案，待用户最终审阅

---

## 1. 背景与需求

入库管理已完成（见 `2026-04-26-material-stock-in-management-design.md`）。当前 `pages/material/index` 第 3 个 Tab "出库记录" 仅是只读列表，不承载任何流程；`materialManager.stockOut` 云函数极简（仅 material_id+quantity+remark），无审核流程，被工单完成扣库存路径间接调用。

新需求：

- 引入"申请 → 审核 → 出库"三段式审批流（全部物资强制走审批，不做免申请快速出库）
- 新增"仓管员"角色（role_id=5），作为审核+出库执行的专职岗位
- 出库要带"使用区域 / 使用场景 / 实际出库数量"等业务维度，可被多条件筛选
- 通知贯穿全节点（提交 / 审核通过 / 驳回）
- 配套权限重排：办美员工失去入库 + 分类管理权限；仓管员补位

## 2. 设计决策

| 决策点 | 选择 | 备选 | 选择原因 |
|---|---|---|---|
| 审批粒度 | 完整三段式（pending → approved → rejected/cancelled） | 物资打"需审批"标签 / 完全无审核 | 用户拍板：全部物资走审批 |
| 审核+出库 | **合并为一个动作**（仓管员点"审核通过"时直接扣库存） | 拆为两步（先审、再出） | 简化流程；用户拍板 |
| 申请人角色 | 1/2/4/5 都可申请 | 仅办美员工 | 经理/管理员代提常见，统一开放 |
| 审核+出库角色 | 仅 1（管理员）+ 5（仓管员） | 1/2/5 / 仅 5 | 经理只看不操作；管理员超级兜底 |
| 数据集合 | 单表 `material_requests`（含状态机），出库执行时同步写 `material_records.type=out` | 多表分层 / 复用 records 加 status | 出库申请有独立生命周期，单表最干净 |
| `material_records` 与申请单 | 通过 `request_id` 关联，工单扣库时 request_id=null | 不关联 | 既保留库存流水完整性，又能区分来源 |
| 申请人 vs 领用人 | 默认相同（不要单独字段） | 独立字段 | 小团队 99% 自提自领，简化表单 |
| 区域/场景 | 字典管理（`stock_out_region` / `stock_out_scene`） | 自由文本 / 字典+其他 | 多条件筛选必须数据干净 |
| 字典配置权限 | **仅管理员**（不放给经理/仓管员） | canManageMaterial | 用户拍板 |
| 申请数量 vs 实际数量 | 出库时仓管员可改实际数量（≤ 申请且 ≤ 库存） | 锁定 / 完全自由 | 应对库存不足/部分出库，又防超量 |
| 驳回处理 | 不可编辑重提，只能新建 | 可编辑重提 | 审计追溯更干净 |
| 撤回 | 仅 Pending 可撤；状态变 Cancelled | 不可撤 / 全状态可撤 | 基础体验 |
| 物资选择方式 | 搜索 + 分类筛选 | 仅搜索 / +扫码 | 出库场景扫码使用率低，避免过度设计 |
| 通知 | 全节点（提交→通知 1+5；审核结果→通知申请人） | 仅审核结果 / 完全不通知 | 复用既有 sendNotification |
| Excel 导出 | **本期不做** | 本期做 | 聚焦闭环，导出按需求再加 |
| 落点 | 改造 `material/index` Tab3 为"出库管理"，内嵌 sub-tabs（出库申请 / 出库记录） | 4 顶级 Tab / 独立页面 | 与 Tab2 入库管理对称，认知一致 |
| 入库权限 | 收拢到 1/2/5（办美失去） | 保持 1/2/4 | 仓库职能统一 |
| 分类管理权限 | 收拢到 1/2/5（办美失去） | 保持原状 | 同上 |
| 既有 stockOut popup | 删除（残留代码顺手清理） | 保留 | 已被 stock-out-form 替代 |
| materialManager 拆分 | 按 workOrderManager 模式拆 handlers（crud/stock/request/seed） | 单文件继续累 | 800+ 行单文件不利后续扩展 |

## 3. 架构

```
首页 Tab2 耗品 → 宫格"出库管理"（新增）
       ▼
pages/material/index?tab=2
├── Tab1 配件列表        ← 不动
├── Tab2 入库管理        ← 不动（已完成）
└── Tab3 出库管理（改造，从既有"只读出库记录"升级）
    ├── sub[0] 出库申请           ← 活动单据，按用户视角变形
    │     · 办美员工(4)：我的申请（自己提的全状态）
    │     · 仓管员(5) / 管理员(1)：待审核工作台 (status=Pending)
    │     · 经理(2)：全部进行中（只读）
    │     · FAB ➕（任何能申请的角色）→ stock-out-form
    │
    └── sub[1] 出库记录           ← 历史完结单据
          · 多条件筛选（时间/物资/区域/场景/状态/申请人/审核人）
          · 按权限过滤（办美只看自己的，其他角色看全部）
```

### 3.1 新增页面

| 路径 | 用途 |
|---|---|
| `/pages/material/stock-out-form/` | 申请人填申请单（搜索物资 + 数量 + 区域 + 场景 + 备注） |
| `/pages/material/stock-out-detail/` | 申请单详情页（生命周期时间线 + 操作按钮，按角色和状态显隐） |

### 3.2 与既有模块的关系

| 关系点 | 说明 |
|---|---|
| `material_records` 既有表 | 出库执行时仍写一条 `type=out` 记录（保留库存流水完整性），新增字段 `request_id` 关联 |
| 工单完成扣库存（独立路径） | **不受影响**，仍写 `material_records.type=out`，request_id=null |
| 既有 Tab3 出库记录 | 历史数据继续可见（在新的 sub[1] 出库记录里），无 request_id 显示成"系统/工单扣库" |
| 既有 popup `showStockOut` | **删除**（这次顺手清理这段历史残留代码） |

## 4. 角色与权限

### 4.1 新增角色

```js
// miniprogram/utils/constants.js
const ROLES = {
  ADMIN: 1, PROPERTY_MANAGER: 2, MAINTENANCE_STAFF: 3, PROPERTY_STAFF: 4,
  WAREHOUSE_KEEPER: 5,           // 仓管员（新增）
};
const ROLE_DISPLAY_NAMES = { ..., 5: '仓管员' };
```

云数据库 `roles` 集合新增一条 `{ role_id:5, name:'仓管员', module_permissions:[...], active:true }`。

### 4.2 出库流程权限矩阵

| 操作 | 管理员(1) | 经理(2) | 维修员(3) | 办美(4) | 仓管员(5) |
|------|:--:|:--:|:--:|:--:|:--:|
| 提交出库申请 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 审核出库（=出库） | ✓ | ✗ | ✗ | ✗ | ✓ |
| 驳回 | ✓ | ✗ | ✗ | ✗ | ✓ |
| 撤回自己的申请 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 查看出库申请单 | 全部 | 全部 | ✗ | 仅自己 | 全部 |
| 查看出库记录（历史） | 全部 | 全部 | ✗ | 仅自己提的 | 全部 |

### 4.3 既有功能连带调整

| 既有功能 | 当前 | 调整后 |
|---|---|---|
| 入库（stockIn / addMaterial） | 1/2/4 | **1/2/5**（办美失去；仓管员加入） |
| 分类管理（material_category 字典 CRUD） | 1/2/4 | **1/2/5** |
| 进入耗品模块（canAccessMaterial） | 1/2/4 | **1/2/4/5**（仓管员加入；办美保留以便提申请） |
| 区域/场景字典 CRUD（新增） | 不存在 | **仅 1**（在 admin 后台分包配置） |

### 4.4 云函数权限函数

```js
// cloudfunctions/materialManager/helpers.js
function canAccessMaterial(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}
function canManageMaterial(user) {
  return user && [1, 2, 5].includes(user.role_id) && user.active !== false;
}
function canApproveStockOut(user) {
  return user && [1, 5].includes(user.role_id) && user.active !== false;
}
function canRequestStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}
```

## 5. 数据模型

### 5.1 新建集合 `material_requests`

```js
{
  _id: ObjectId,
  request_id: Number,                   // 自增主键
  request_number: String,               // 'CKSQ-YYYYMMDD-XXXX' 按日切

  // === 物资快照（提交时刻，避免后续改名/删配件污染历史）===
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
  reject_reason: String | null,         // ≤200 字

  // === 时间字段 ===
  created_at: Date,
  updated_at: Date,
  approved_at: Date | null,
  rejected_at: Date | null,
  cancelled_at: Date | null,
}
```

**索引建议**：`request_id`、`status`、`requester.user_id`、`created_at`。

### 5.2 改造既有 `material_records`

| 字段 | 类型 | 说明 |
|---|---|---|
| `request_id` | Number \| null | **新增**。关联出库申请单。`null` 表示直接出库（如工单完成扣库存路径） |
| `region` | String | **新增**，从申请单冗余写入 |
| `scene` | String | **新增**，从申请单冗余写入 |

既有历史记录保留为空字符串/null，向前兼容。

### 5.3 集合 `dictionaries` 新增 2 项

| dict_key | dict_name | seed 默认项 |
|---|---|---|
| `stock_out_region` | 使用区域 | 办公区 / 会议室 / 接待区 / 茶水间 / 卫生间 / 餐厅 / 前台 / 电梯间 / 楼梯间 / 储物间 / 室外公共区 / 通用 |
| `stock_out_scene` | 使用场景 | 日常办公 / 会议接待 / 客户接待 / 卫生清洁 / 设备维护 / 活动布置 / 突发事件 / 其他 |

每项 `{value=label, sort=index, enabled:true}`。**仅管理员**可在 admin 数据字典页 CRUD。首次进出库申请表单时若字典不存在，由前端自动 seed。

### 5.4 业务编号生成规则

```
request_number = 'CKSQ-' + YYYYMMDD + '-' + 当日序号(4 位)
record_number  = 'CK-'   + YYYYMMDD + '-' + 当日序号(4 位)   // 出库执行时生成
```

按日切，跟既有 `material_number` 'M{date}{seq}' 风格保持一致。

### 5.5 字段约束

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
| `miniprogram/utils/constants.js` | 微改 | + `ROLES.WAREHOUSE_KEEPER=5`、`ROLE_DISPLAY_NAMES[5]`；+ `STOCK_OUT_STATUS` 与 `STOCK_OUT_STATUS_DISPLAY_NAMES` |
| `miniprogram/pages/material/index.{js,wxml,wxss,json}` | 改造 | Tab3 升级为"出库管理"，内嵌 sub-tabs（出库申请/出库记录）+ swiper；FAB 按 sub 状态显隐；按角色显示不同列表（我的申请/待审核工作台/全部进行中）；onLoad 支持 `?tab=2&sub=` deeplink；移除 showStockOut popup 残留；canAccessMaterial 加入 5 |
| `miniprogram/pages/material/stock-out-form/` | 新建 | 物资搜索/分类筛选 → 选中带入快照、申请数量、区域下拉、场景下拉、备注；提交 → navigateBack；首次加载 seed 区域/场景字典 |
| `miniprogram/pages/material/stock-out-detail/` | 新建 | query: `request_id`；展示申请单全字段 + 状态时间线；底部按钮按角色和状态显隐 |
| `miniprogram/services/materialService.js` | +6 方法 | `createStockOutRequest / approveStockOutRequest / rejectStockOutRequest / cancelStockOutRequest / listStockOutRequests / getStockOutRequest` |
| `miniprogram/services/dictionary.js` | 不动 | 既有 `getOptions/refreshCache` 复用 |
| `miniprogram/app.json` | 微改 | + 两个新页面路径 |
| `miniprogram/pages/home/index.{wxml,js}` | 微改 | 耗品 Tab 宫格 + "出库管理"，按角色显隐（维修员看不到） |
| `miniprogram/custom-tab-bar/` | 微改 | 加入 role_id=5 的 TabBar 显隐逻辑（与办美/经理类似） |
| `miniprogram/pages/admin/dict/...` | 微改 | dict 列表加入 `stock_out_region`、`stock_out_scene`（如硬编码） |

### 6.2 云函数

| 文件 | 操作 | 主要内容 |
|---|---|---|
| `cloudfunctions/materialManager/index.js` | 拆分 | 按 workOrderManager 模式拆为：`handlers/crud.js`（list/add/update/delete/getByNumber）、`handlers/stock.js`（stockIn/stockOut/getStats/getWarnings）、`handlers/request.js`（**新**，6 个出库申请 actions）、`handlers/seed.js`（seedTestData）；index.js 改为路由分发 |
| `cloudfunctions/materialManager/helpers.js` | 改 | 调整 `canAccessMaterial`/`canManageMaterial`；+ `canApproveStockOut`/`canRequestStockOut` |
| `cloudfunctions/materialManager/handlers/request.js` | 新建 | 6 个 action 实现（见 6.3） |
| `cloudfunctions/dictionaryManager/index.js` | 微改 | `stock_out_region` / `stock_out_scene` 的 CRUD 严格仅放给 role_id=1（管理员） |
| `cloudfunctions/sendNotification/...` | 不动 | 复用既有体系；本期需在云端通知模板配置中新增 3 个模板 key：`stock_out_pending` / `stock_out_approved` / `stock_out_rejected`（具体落点跟既有工单相关模板配置位置一致） |

### 6.3 新增的 6 个云函数 actions

| action | 入参 | 权限 | 职责 |
|---|---|---|---|
| `createStockOutRequest` | `material_id, requested_quantity, region, scene, remark?` | canRequestStockOut | 校验 → 写 material_requests(status=Pending) → 通知所有 1+5 角色用户 |
| `approveStockOutRequest` | `request_id, approved_quantity` | canApproveStockOut | 校验状态=Pending、approved_quantity ≤ 申请且 ≤ 库存 → 扣库存 + 写 material_records(type=out, request_id=) + 改单 status=Approved → 通知申请人 |
| `rejectStockOutRequest` | `request_id, reject_reason` | canApproveStockOut | 校验状态=Pending → 改单 status=Rejected → 通知申请人 |
| `cancelStockOutRequest` | `request_id` | 申请人本人 | 校验状态=Pending、requester=current → 改单 status=Cancelled |
| `listStockOutRequests` | `status?, requester_user_id?, material_id?, region?, scene?, date_from?, date_to?, keyword?, page, pageSize` | 任何 canAccessMaterial 用户 | 按权限 + 筛选条件分页（办美只能看自己的） |
| `getStockOutRequest` | `request_id` | 任何 canAccessMaterial 用户 | 详情返回（办美只能看自己的） |

## 7. 关键流程时序

### 7.1 提交申请

```
申请人 Tab3 sub[0] → FAB ➕ → stock-out-form

stock-out-form onLoad
  → 并行 dictionary.getOptions('stock_out_region' / 'stock_out_scene')
       任一不存在 → 自动 seed → 重拉
  → 用户搜索/分类选物资 → 选中带入快照
  → 输入数量 → 选区域 → 选场景 → 备注 → 点"提交申请"

cloud.materialManager.createStockOutRequest({...})
  → canRequestStockOut 校验
  → 字段校验（数量 1..999999、region/scene 必填且在字典中、material_id 存在）
  → getNextId('material_requests') + 生成 request_number
  → material_requests.add({status:'Pending', requester, ...})
  → cloud.callFunction('sendNotification', {
       receivers: 所有 role_id IN [1,5] 且 active 的 user,
       template: 'stock_out_pending',
       data: {request_number, material_name, requester_name, quantity, region}
     })
  → return {success:true, request_id, request_number}

stock-out-form → toast '已提交，等待审核' → navigateBack
material/index Tab3 sub[0] onShow → reload page 1 → 新单顶部出现
```

### 7.2 审核通过（= 出库）

```
仓管员/管理员 Tab3 sub[0] 待审核 → tap Pending 单 → stock-out-detail

detail 页 → getStockOutRequest → 渲染快照 + 状态时间线
底部按钮（仅 1/5 + status=Pending）：[审核通过] [驳回]

点"审核通过" → 弹底部确认（含数量调整 input，默认=申请数量）
  → 仓管员可改成实际出库数量（≤ 申请且 ≤ 当前库存）
  → 点"确认出库"

cloud.materialManager.approveStockOutRequest({request_id, approved_quantity})
  → canApproveStockOut 校验
  → material_requests.where({request_id, status:'Pending'}).get() 取单
       未取到 → '单据已被审核'
  → materials.where({material_id}).get() 取最新库存
  → 校验 approved_quantity 范围（1..min(requested, stock)）
  → getNextId('material_records') + 生成 record_number 'CK-YYYYMMDD-XXXX'
  → 并行：
       - materials.update({stock: _.inc(-approved_quantity), updated_at: now})
       - material_records.add({record_id, record_number, type:'out',
           request_id, region, scene, ...物资快照,
           operator: reviewer, quantity: approved_quantity, created_at: now})
       - material_requests.update({
           status:'Approved', reviewer, approved_quantity,
           out_record_id: record_id, approved_at: now, updated_at: now
         })
  → sendNotification → 通知申请人 'stock_out_approved'

detail 页 → toast '出库成功' → setData status=Approved → 按钮自动隐藏
```

### 7.3 驳回

```
仓管员/管理员 detail 页 → 点"驳回"
  → 弹底部输入框，必填驳回原因（≤200 字）→ 确认

cloud.materialManager.rejectStockOutRequest({request_id, reject_reason})
  → canApproveStockOut + 校验 status === 'Pending'
  → material_requests.update({
      status:'Rejected', reviewer, reject_reason, rejected_at: now
    })
  → sendNotification → 通知申请人 'stock_out_rejected'（含驳回原因摘要）

detail 页 → toast '已驳回' → setData
```

### 7.4 撤回

```
申请人 detail 页（status=Pending）→ 点"撤回"
  → modal '确认撤回？撤回后无法恢复'

cloud.materialManager.cancelStockOutRequest({request_id})
  → 取单 → 校验 requester.user_id === current && status === 'Pending'
  → material_requests.update({status:'Cancelled', cancelled_at: now})
  → 不发通知

detail 页 → toast '已撤回' → setData
```

### 7.5 列表查询（按角色 + 筛选）

```
Tab3 sub[0] 出库申请 onShow
  → cloud.materialManager.listStockOutRequests({...})

云端按角色过滤：
  if user.role_id === 4 (办美):
    conditions['requester.user_id'] = user.user_id
  // 1/2/5 无额外限制

子页前端默认筛选：
  · 办美：sub[0] 自己的全状态  /  sub[1] 自己已结束的
  · 仓管员/管理员：sub[0] status=Pending  /  sub[1] status IN [Approved,Rejected,Cancelled]
  · 经理：sub[0] status=Pending（只读视角）  /  sub[1] 全状态历史

Tab3 sub[1] 多条件筛选 → 顶部"筛选"按钮 → 弹底部抽屉：
  时间范围 / 物资关键词 / 区域 / 场景 / 状态(多选) / 申请人 / 审核人
  → 应用 → listStockOutRequests 带条件请求
  → 已应用条件以 chip 形式显示在列表上方，可单独移除
```

## 8. 错误处理与边界

### 8.1 网络与服务端

| 操作 | 错误情况 | 处理 |
|---|---|---|
| `createStockOutRequest` 失败 | 网络抖 / 服务端异常 | toast 服务端 error；按钮恢复；表单数据保留 |
| `approveStockOutRequest` 失败 | 库存不足 / 单已被并发处理 | toast；自动 reload detail 同步最新状态 |
| `rejectStockOutRequest` 失败 | 单已被并发处理 | 同上 |
| `cancelStockOutRequest` 失败 | 单已被并发处理 | 同上 |
| `listStockOutRequests` 失败 | 网络 | 列表空态 + "加载失败，点击重试" |
| `getStockOutRequest` 失败 | 网络 / 单不存在 / 无权限 | detail 页空态 + "返回"按钮 |

### 8.2 表单校验（前端先校验，云端再兜底）

| 字段 | 规则 | 反馈 |
|---|---|---|
| 物资 | 必选 | 未选时提交按钮 disabled |
| 申请数量 | 整数、1..999999、≤当前库存 | input type=digit；超库存时另显当前库存值 |
| 区域 / 场景 | 必选（字典 enabled 项） | picker 必选 |
| 备注 | ≤200 字 | maxlength |
| 实际出库数量（审核时） | 整数、1..申请数量、且≤当前库存 | 上限取 min(申请, 库存)，超过自动夹到上限 |
| 驳回原因 | 必填、≤200 字 | 未填时确认按钮 disabled |
| 提交按钮防抖 | loading + disabled | 失败/成功才恢复 |

### 8.3 状态机边界（并发保护）

| 情况 | 处理 |
|---|---|
| 两个仓管员同时点"审核通过" | 云端用 `where({request_id, status:'Pending'}).update(...)` 原子条件更新；后到的影响行数=0 → "单据已被审核" |
| 仓管员审核中、申请人同时撤回 | 同样靠 `status='Pending'` 校验保护；先到的赢 |
| 重复点击审核按钮 | 前端 loading + disabled；后端 status 校验兜底 |
| 已 Approved/Rejected/Cancelled 单据再次提交动作 | 云端校验 status === 'Pending'，否则拒绝 |
| 非 Pending 单据 | 全部按钮（撤回/审核/驳回）前端不渲染 |

### 8.4 库存边界

| 情况 | 处理 |
|---|---|
| 申请时库存=10、审核时剩 3 | 审核页"实际出库数量"上限自动变 3；提交时云端再校验，超过 → "库存不足，当前库存:3"；仓管员可改小或驳回 |
| 申请时物资被删除 | 审核时 `materials.where({material_id})` 返回空 → "配件已被删除"；仅可驳回 |
| `approved_quantity = 0` | 不允许（业务上等同驳回）；强制 ≥ 1 |
| 数据库扣库存与 records 写入跨节点不一致 | 项目其他模块同样未上分布式事务；接受"极小概率不一致 + 库存预警告警可发现"；不在本期处理 |

### 8.5 字典边界

| 情况 | 处理 |
|---|---|
| 区域/场景字典首次不存在 | 进入 stock-out-form 时检测 → 自动 seed → toast → 重拉 |
| seed 失败（断网） | toast "加载失败"；下拉为空 + 提交按钮 disabled |
| 字典项被管理员软删 | `getOptions` 仅返回 enabled=true 项；既有申请单 region/scene 仍显示原 label（字段是字符串快照） |
| 申请人提交时字典已被删 | 前端只能选 enabled 项；老缓存兜底由 `dictionary.refreshCache` 处理 |

### 8.6 权限误进

| 情况 | 处理 |
|---|---|
| 维修员 navigateTo `/pages/material/index` | onLoad canAccess 校验 → toast "无权限访问" → 1.5s navigateBack |
| 办美员工硬刷看别人的单 | 云函数 `getStockOutRequest` 校验 requester.user_id === current 或 canApproveStockOut；否则返回"无权限"；前端空态退回 |
| 经理点"审核通过"（理论看不到的按钮） | 云端 `canApproveStockOut` 校验拦下 |
| 硬刷 url 进 stock-out-form 缺参 | 不需要 query；空表单初始化 |
| 硬刷 url 进 stock-out-detail 缺 request_id | onLoad 检测 → toast + navigateBack |

### 8.7 通知失败

| 情况 | 处理 |
|---|---|
| `sendNotification` 调用失败 | 主流程**不回滚**（出库已成功是事实）；云函数日志记录；既有 globalData.unreadCounts 兜底 |
| 接收人列表为空（没有任何 1/5 用户） | createStockOutRequest 仍创建单据，仅日志告警；前端正常成功 toast |
| 通知模板未配置 | 沿用既有 sendNotification 容错（已在历史模块跑稳） |

### 8.8 数据兼容

| 情况 | 处理 |
|---|---|
| 既有 `material_records.type='out'` 历史记录无 request_id/region/scene | 新 sub[1] 用 `record.request_id ? '申请出库' : '系统/工单扣库'` 区分；缺字段显示 "-" |
| 'CK-2024-XXXX' 与 'CK-YYYYMMDD-XXXX' 编号格式共存 | 字符串字段，无需迁移 |

## 9. 验证清单

### 9.1 路径回归（按角色）

**申请人（办美员工 role_id=4）**
- [ ] 首页 Tab2 耗品宫格能看到"出库管理" → 跳转 material/index?tab=2
- [ ] Tab3 sub[0]：默认显示自己的申请，看不到其他用户的
- [ ] FAB ➕ → stock-out-form：能搜索物资 + 分类筛选选中
- [ ] 区域/场景下拉有 12/8 个默认项（首次进会 seed）
- [ ] 申请数量超库存 → 提交时被拦下；正常数量 → toast "已提交"
- [ ] 列表顶部出现新单（status=Pending、request_number 形如 CKSQ-20260427-0001）
- [ ] tap 自己的 Pending 单 → detail 页显示"撤回"按钮（无审核/驳回）
- [ ] 点撤回 → modal → 状态变 Cancelled
- [ ] 收到通知（审核通过/驳回时）
- [ ] 看不到入库 FAB 和分类管理子页（既有功能权限收回）
- [ ] 看不到 admin 区域/场景字典管理入口

**仓管员（role_id=5，新角色）**
- [ ] 进入耗品模块成功
- [ ] Tab3 sub[0] 默认显示所有 status=Pending（待审核工作台）
- [ ] tap Pending 单 → detail 页显示"审核通过"+"驳回"按钮
- [ ] 点审核通过 → 弹底部确认（含数量调整）→ 数量默认=申请数量 → 改小 → 确认
- [ ] 提交后 status=Approved；material_records 新增一条 type=out（含 request_id）；materials.stock 减少
- [ ] 申请人收到通知
- [ ] 点驳回 → 输入原因 → 状态变 Rejected → 申请人收到通知
- [ ] Tab3 sub[1]：能看全部历史；多条件筛选正常工作
- [ ] 入库管理 + 分类管理可用
- [ ] 自己也能提申请

**管理员（role_id=1）**
- [ ] 与仓管员相同的全部能力
- [ ] 额外：admin 数据字典页能 CRUD `stock_out_region` / `stock_out_scene`

**经理（role_id=2）**
- [ ] Tab3 sub[0] 显示所有 Pending（只读视角）
- [ ] tap Pending 单 → detail 页**只看不能操作**（无审核/驳回）
- [ ] 自己也能提申请；自己的 Pending 单可撤回
- [ ] 入库管理 + 分类管理仍可用
- [ ] 看不到 admin 区域/场景字典管理入口

**维修员（role_id=3）**
- [ ] 首页耗品 Tab 看不到"出库管理"宫格
- [ ] 直接 navigateTo material/index → toast "无权限访问" → 退回
- [ ] 工单 completeRepair 仍能扣库存（独立路径）

### 9.2 数据正确性

**提交申请后**
- [ ] `material_requests` 新增：`status='Pending'`、`request_number` 格式正确、`requester` 含 user_id/name/role_id、物资快照齐全、`region`/`scene` 是字典 label
- [ ] `materials.stock` **不变**（pending 不扣库存）
- [ ] `material_records` **不变**

**审核通过后**
- [ ] `material_requests` update：status=Approved、reviewer、approved_quantity、out_record_id、approved_at
- [ ] `materials.stock` 减少 = approved_quantity，updated_at 刷新
- [ ] `material_records` 新增：type='out'、request_id、region/scene、record_number 'CK-YYYYMMDD-XXXX'、operator=reviewer

**驳回后**
- [ ] `material_requests`：status=Rejected、reviewer、reject_reason、rejected_at
- [ ] `materials` / `material_records` 不变

**撤回后**
- [ ] `material_requests`：status=Cancelled、cancelled_at
- [ ] 其余表不变

### 9.3 边界场景

- [ ] 库存=10，仓管员审核时只剩 5：审核数量上限自动变 5；强超 → "库存不足"
- [ ] 两个仓管员同时点"审核通过"：第二个收到 "单据已被审核"
- [ ] 申请数量 0 → 前端 disabled + 服务端兜底
- [ ] 区域/场景字典被管理员软删一项后：
  - 已存在的 Pending 单仍显示原 label（字段是快照）
  - 新建申请时下拉项不再含被软删项
- [ ] 物资在 Pending 期间被仓管员删除：审核时返回"配件已被删除"，仅可驳回
- [ ] 申请人撤回 Pending 单时被并发审核了：返回"单据已被审核"，刷新页面同步
- [ ] 维修员硬刷 url 进 stock-out-form/detail：被云端权限拦下

### 9.4 回归非耗品模块

- [ ] 工单提报 / 编辑 / 详情 不受影响
- [ ] 工单完成扣库存仍能正常（material_records.request_id=null 区分于申请出库）
- [ ] 既有 admin 用户管理新增 role_id=5 用户能成功
- [ ] 既有 admin 数据字典管理列表完整（含 material_category / stock_out_region / stock_out_scene）
- [ ] 既有入库管理（Tab2）功能不变；办美员工进入会被 canManageMaterial 拦下（按预期）
- [ ] 既有 material_records 'CK-2024-XXXX' 历史数据仍可查看

## 10. 已知局限

- 不做扫码出库（出库场景下使用率低，未来需要再加 FAB 一项即可）
- 不做 Excel 导出（本期范围排除）
- 不做"免申请快速出库"（与"全部走审批"决策冲突）
- 数据库不上跨节点事务（与项目既有模块一致；极小概率不一致由库存预警兜底）
- 申请单 `approved_quantity` 是审核通过时一次性出库的数量；多次部分出库（拆单）不支持，一单一次性出完
- 通知失败不回滚主流程（与项目既有模块一致）
- 维修员的工单完成扣库存路径仍直写 material_records，不进入审批流（设计上独立）
- 既有 `materials.usage_area` 字段（采购入库时填的物资固定使用区域）与本期"出库申请的 region"语义不同，互不影响
- 经理（role_id=2）保留入库 + 分类管理权限是有意设计，与"经理在出库流程只看"并不矛盾——出库流程独立
- 当 role_id IN [1,5] 的用户全部不存在或 active=false 时，办美/经理提交的申请会进入 Pending 状态但无人审核（长期挂起）。规避：admin 用户管理保证至少 1 个管理员或仓管员账号 active

## 11. 未做

- 出库扫码 / Excel 导出 / 免申请快速出库
- 拆单（一张申请分多次部分出库）
- 出库补货建议（需求 §8.1，作为后期增强）
- 数据分析模块对耗品出库的统计图表
- 申请单审核回复模板（驳回原因预设几个常见值）
- 仓管员的"批量审核"操作
- 申请单超时未审核的提醒/自动失效

---

## 附录 A — 影响文件清单

```
新建：
  miniprogram/pages/material/stock-out-form/index.{js,wxml,wxss,json}    (4)
  miniprogram/pages/material/stock-out-detail/index.{js,wxml,wxss,json}  (4)
  cloudfunctions/materialManager/handlers/crud.js                        (拆出)
  cloudfunctions/materialManager/handlers/stock.js                       (拆出)
  cloudfunctions/materialManager/handlers/request.js                     (新)
  cloudfunctions/materialManager/handlers/seed.js                        (拆出)

改造：
  miniprogram/pages/material/index.{js,wxml,wxss,json}    (Tab3 改造)
  miniprogram/utils/constants.js                          (+ROLE 5 / +STATUS)
  miniprogram/services/materialService.js                 (+6 方法)
  miniprogram/app.json                                    (+2 路径)
  miniprogram/pages/home/index.{wxml,js}                  (+出库管理宫格)
  miniprogram/custom-tab-bar/index.js                     (+role 5 显隐)
  miniprogram/pages/admin/dict/...                        (+2 字典 key)
  cloudfunctions/materialManager/index.js                 (路由分发改造)
  cloudfunctions/materialManager/helpers.js               (权限函数调整+新增)
  cloudfunctions/dictionaryManager/index.js               (新字典权限例外)
```

## 附录 B — 角色权限对照（耗品全模块）

| 操作 | 管理员(1) | 经理(2) | 维修员(3) | 办美员工(4) | 仓管员(5) |
|------|:--:|:--:|:--:|:--:|:--:|
| 进入耗品模块 | ✓ | ✓ | ✗ | ✓ | ✓ |
| 查看配件列表 | ✓ | ✓ | — | ✓ | ✓ |
| 入库（既有） | ✓ | ✓ | — | ✗（**收回**） | ✓ |
| 分类管理 CRUD | ✓ | ✓ | — | ✗（**收回**） | ✓ |
| 提交出库申请 | ✓ | ✓ | — | ✓ | ✓ |
| 审核出库（=出库） | ✓ | ✗（只看） | — | ✗ | ✓ |
| 驳回出库 | ✓ | ✗ | — | ✗ | ✓ |
| 撤回自己的申请 | ✓ | ✓ | — | ✓ | ✓ |
| 查看出库申请单 | 全部 | 全部 | — | 仅自己 | 全部 |
| 查看出库记录历史 | 全部 | 全部 | — | 仅自己提的 | 全部 |
| 区域/场景字典 CRUD | ✓ | ✗ | — | ✗ | ✗ |
| 工单完成扣库存（独立路径） | — | — | ✓（独立） | — | — |
