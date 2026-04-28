# 任务 TODO

<!-- 每次新任务在这里追加规划，完成后加 Review 小节。 -->

## 任务（当前）：根据 `tasks/角色权限清单.xlsx` 重新分配角色权限

**目标**：让代码中的权限校验与该表格一致。表格汇总：

| 功能 | 管理员(1) | 行政经理(2) | 维修员(3) | 办美员工(4) |
|---|---|---|---|---|
| 提交工单 | ✅ | ✅ | ❌ | ✅ |
| 查看工单 | 全部 | 全部 | 部门内 | 全部 |
| 编辑工单 | ✅ | ✅（已提报） | ❌ | ✅（已提报） |
| 删除工单 | ✅ | 已提报状态 | ❌ | 已提报状态 |
| 接单/维修 | ✅ | ❌ | ✅（部门匹配） | ❌ |
| 完成维修 | ✅ | ❌ | ✅ | ❌ |
| 复核验收 | ✅ | ❌ | ❌ | 所有 |
| 催接单/催维修 | ✅ | ✅ | ❌ | ✅ |
| 催复核 | ✅ | ✅ | ✅ | ❌ |
| 导出工单 | ❌ | ✅ | ❌ | ✅ |
| 用户/角色/公告/审计/系统配置/字典 | ✅ | ❌ | ❌ | ❌ |
| 数据分析 | ✅ | 可授权 | ❌ | 可授权 |
| 反馈管理 | 全部 | 自己的 | 自己的 | 自己的 |
| 进入管理后台 | ✅ | ❌ | ❌ | ❌ |

### TODO

**后端 cloudfunctions**
- [x] 1. `workOrderManager/handlers/crud.js` 编辑工单：管理员任意状态；经理/办美员工仅 `Pending Repair`；维修员禁止；去掉"提交人为办美员工"才能改的限制
- [x] 2. `workOrderManager/index.js` 删除工单：允许管理员；经理/办美员工可删所有 `Pending Repair`（去掉"仅本人提交"的限制）
- [x] 3. `workOrderManager/index.js` 导出工单：允许办美员工 (4)
- [x] 4. `workOrderManager/handlers/status.js` 接单/状态流转：移除经理 (2)；保留管理员 + 维修员(部门匹配)
- [x] 5. `workOrderManager/handlers/status.js` 完成维修：增加管理员；维修员保持部门匹配
- [x] 6. `workOrderManager/handlers/status.js` 复核验收：管理员 ✅；办美员工可复核所有；移除"经理/提报人"路径
- [x] 7. `workOrderManager/handlers/notify.js` 催接单/催维修：移除"仅提报人/经理"限制；管理员/经理/办美员工均可催
- [x] 8. `userAuth/handlers/users.js` 用户管理：listUsers / createUser / updateUser 限制为仅管理员 (1)
- [x] 9. `getAnalytics*/index.js` 6 个 + `getEmployeeRanking/index.js`：显式禁止维修员(3)访问

**前端 miniprogram**
- [x] 10. `pages/work-order-detail/index.js`：canEdit 增加管理员；canReview 移除经理，保留管理员 + 办美员工
- [x] 11. `config/workOrderButtons.js`：新增 `adminAll`（4 状态）+ `staffReviewAll` + `managerUrge`；`getButtonConfig` 增加 `isAdmin` 分支；办美员工(role 4) 在 Repaired 状态展示验收按钮、行政经理仅展示催复核
- [x] 12. `pages/index/index.{wxml,js}`：导出按钮显示/handler 检查改为 "经理 || 办美员工"
- [x] 13. `pages/home/index.js`：维修员快捷入口同时隐藏"数据看板"

### 不改动
- 物料管理（清单未涉及）
- 收费工单（清单未涉及）
- 自定义 TabBar、ROLES 常量定义

## Review（角色权限重新分配）

### 改动文件（共 14 个）

**后端**
1. `cloudfunctions/workOrderManager/handlers/crud.js` — `updateWorkOrderDetails`：编辑权限改为"管理员任意状态；经理/办美员工仅已提报"，移除原"办美员工只能改办美员工提交的工单"限制
2. `cloudfunctions/workOrderManager/index.js` — `delete` 分支：允许管理员/经理/办美员工删除任意"已提报"工单（去掉"仅本人提交才能删"的限制）；`exportWorkOrders`：允许 [2,4] 导出
3. `cloudfunctions/workOrderManager/handlers/status.js`
   - `updateOrderStatus`：移除经理(2)的接单权限；只允许管理员或维修员（部门匹配）操作；同时简化状态白名单逻辑（管理员仍跳过，维修员只允许 → In Progress）
   - `completeRepair`：增加管理员
   - `reviewOrder`：管理员任意可审核；办美员工可审核所有；移除"提报人/经理"路径
4. `cloudfunctions/workOrderManager/handlers/notify.js` — `urgeAccept` / `urgeRepair`：去掉"仅提报人"限制
5. `cloudfunctions/userAuth/handlers/users.js` — `handleListUsers` / `handleCreateUser` / `handleUpdateUser`：从 `[1,2]` 收紧到 `1`
6. `cloudfunctions/getAnalyticsByCategory/index.js`、`getAnalyticsByFloor`、`getAnalyticsByResponsible`、`getAnalyticsByStatus`、`getAnalyticsOverview`、`getAnalyticsTrends`、`getEmployeeRanking` —— 7 个云函数权限检查前增加 `if (user.role_id === 3) return error`，显式禁止维修员

**前端**
7. `miniprogram/pages/work-order-detail/index.js` — `isAdmin` 标志；`canEdit` 增加管理员；`canReview` 移除经理保留 admin+办美员工；调用 `getButtonConfig` 时新增 `isAdmin` 入参
8. `miniprogram/config/workOrderButtons.js` — 重构按钮配置：每个状态下新增 `adminAll`（管理员可见全部按钮）；'Repaired' 拆为 `staffReviewAll`（办美员工验收所有）和 `managerUrge`（经理只能催复核）；删除原 `managerAndSubmitter` / `managerNotSubmitter` / `staffSubmitter`
9. `miniprogram/pages/index/index.{wxml,js}` — 导出按钮 visibility & handler 校验改为 `isManager || isPropertyStaff`
10. `miniprogram/pages/home/index.js` — 维修员首页 `workOrderFunctions` 同时过滤掉"数据看板"

### 影响面
- **维修员**：失去"数据看板"入口；仍可催复核；不能看后台数据分析
- **行政经理**：失去验收权限（只能催复核）；失去用户管理权限；失去接单/维修操作权限；新增删除任意已提报工单的能力（之前仅本人提交）
- **办美员工**：可验收所有工单（之前仅"办美员工提交的"）；可导出工单；可删除任意已提报工单
- **管理员**：新增可编辑任意状态、删除任意已提报、完成维修、验收的能力，并在工单详情按钮上看到对应入口

### 部署须知
1. 微信开发者工具中右键以下云函数 → 上传并部署：
   - `workOrderManager`
   - `userAuth`
   - `getAnalyticsByCategory` / `getAnalyticsByFloor` / `getAnalyticsByResponsible` / `getAnalyticsByStatus` / `getAnalyticsOverview` / `getAnalyticsTrends`
   - `getEmployeeRanking`
2. 前端：刷新模拟器即可（仅改 .js / .wxml）

### 自检清单
- 管理员：编辑任意状态工单；删除已提报工单；接单 → 完成 → 验收（端到端）
- 行政经理：仅能编辑/删除"已提报"；尝试接单/验收应被拒；可催接单/催维修/催复核；无用户列表入口；可查看数据分析（如配置开放）
- 维修员：无"数据看板"入口；调用任一 getAnalytics* 应被拒；接单/完成维修受部门匹配限制
- 办美员工：可导出工单；可验收任意工单（包括经理或管理员提交的）；可删除已提报工单；不能催复核


## 任务（当前）：首页顶部渐变改为薄荷绿（取自 Pencil 5sXUY）

**目标**：把 `miniprogram/pages/home/index.wxss` 的 `.page` 背景渐变，按 Pencil 文件 `5sXUY` 节点的渐变结构落地，但把原渐变里的"淡紫蓝 `#DCE4FF`"替换为"薄荷绿"，整体走 `mint → 浅mint → 近白` 的从上到下过渡。

### Pencil 原始渐变（线性 180°）
| 位置 | 原色 | 备注 |
|------|------|------|
| 0%   | `#DCE4FF` | 淡紫蓝 ← **本次替换** |
| 30%  | `#DFF5F4` | 淡薄荷绿（保留） |
| 55%  | `#FAFAFA` | 近白（保留） |

### 新方案（替换后）
| 位置 | 新色 | 说明 |
|------|------|------|
| 0%   | `#C8F0E8` | 薄荷绿，比 30% 略深，保留视觉层次 |
| 30%  | `#DFF5F4` | 不动 |
| 55%  | `#FAFAFA` | 不动 |
| 100% | `#FAFAFA` | 平铺到底（保持 55% 之后无再变化） |

### TODO
- [x] 1. `miniprogram/pages/home/index.wxss` `.page`：用单层 `linear-gradient(180deg, #C8F0E8 0%, #DFF5F4 30%, #FAFAFA 55%, #FAFAFA 100%)` 替换现有的 4 层 radial-gradient + 1 层 linear-gradient 复合背景
- [x] 2. `page` 选择器底色 `#E8FAE5` 同步换成 `#C8F0E8`，保证下拉/超出区也是薄荷绿，与首屏顶部连续
- [x] 3. 不动其它任何样式（KPI 卡片、功能入口、快捷入口、最近记录、Tab Header）

## Review（首页顶部薄荷绿渐变）

### 改动
- 仅一个文件：`miniprogram/pages/home/index.wxss`
  - `page { background: #E8FAE5 }` → `#C8F0E8`
  - `.page` 复合背景（4 个 radial + 1 个 linear，共 23 行 CSS）压缩为单层 `linear-gradient(180deg, #C8F0E8 0%, #DFF5F4 30%, #FAFAFA 55%, #FAFAFA 100%)`

### 颜色逻辑
- Pencil 5sXUY 原渐变 `#DCE4FF → #DFF5F4 → #FAFAFA` 中的"淡紫蓝 `#DCE4FF`"按需求替换为薄荷绿 `#C8F0E8`，其它两段保留，整体改为统一的"薄荷绿淡入白"基调
- `#C8F0E8` 与现有 30% 的 `#DFF5F4` 同为青绿系，过渡自然；两色都偏浅，整体不会盖过卡片内容

### 影响面
- 仅首页 `pages/home` 的背景视觉。其它页面、TabBar、组件库样式、JS、wxml 完全未触碰。
- 微信开发者工具内"模拟器刷新"即可看到效果，无需"构建 npm"或上传云函数。

### 微调入口
- 想更绿：把两处 `#C8F0E8` 改 `#BFE9DC`
- 想更淡：把两处 `#C8F0E8` 改 `#D6F2EA`

### 二轮迭代：下半段改淡灰，强化卡片立体感
- `.page` 渐变 4 段重排：`#C8F0E8 0%` → `#DFF5F4 22%` → `#F1F3F6 50%` → `#EAEDF2 100%`
  - 上 1/4 仍是薄荷绿，中段 22%–50% 由薄荷过渡到中性色
  - 下半部 50%–100% 是淡灰，与卡片白底形成清晰对比
- `page` 兜底色同步从 `#C8F0E8`（薄荷）改为 `#EAEDF2`（淡灰），保证下拉/超出区也是底部淡灰，不会突兀变薄荷
- 卡片样式（KPI、func-card、record-item）原本是 `rgba(255,255,255,0.8→0.6)` 半透明 + 多层阴影 — 下半段背景从近白 `#FAFAFA` 换成 `#EAEDF2` 后，阴影对比度变高，卡片自然"浮起"

## 任务：工单维修模块 Bug 修复 + 后端补全 + 适度精简

**目标**：以前端现有页面为基础，不重设计前端、不改已完善按钮交互；先排查工单维修模块的 bug，必要时做最小修复；补齐未跑通的后端逻辑；合并明显重复代码。

详细方案：`/Users/lvleo/.claude/plans/bug-harmonic-dolphin.md`。

### TODO（按 4 批推进）

**第 1 批 严重 Bug**
- [x] 1.1 `index.js` L351/L357：urgeRepair/urgeReview 改用 `openid`
- [x] 1.2 `crud.js` createWorkOrder：`assigned_technician` 增加 `avatar` 字段（refreshStatusHistoryAvatars 现有空值过滤已可用）
- [x] 1.3 `status.js` completeRepair：`db.runTransaction` 原子化"扣库存 + 写 material_records + 更新工单"

**第 2 批 中度问题**
- [x] 2.1 `status.js` updateOrderStatus：手动变 In Progress/Completed 时通知相关方
- [x] 2.2 ✅ 原本已实现 — `index.js` delete 含云存储清理
- [x] 2.3 `status.js` updateOrderStatus：状态前置白名单 `STATUS_TRANSITIONS`（管理员跳过）
- [x] 2.4 `crud.js` updateDetails：`slice(0, 3)` → `slice(0, 9)`
- [x] 2.5 `crud.js` updateDetails：reportTime 改用 `${date}T${time}:00+08:00`
- [x] 2.6 `notify.js` urgeAccept/urgeRepair/urgeReview：补 `user.active === false` 校验

**第 3 批 轻度问题与精简**
- [x] 3.1 `helpers.js` 新增 `ROLE` 枚举 + `canViewOrder`，接入 `getById/getByNumber`
- [x] 3.2 `helpers.js` 新增 `writeAuditLog`，接入 `updateStatus/completeRepair/reviewOrder/delete/updateDetails`
- [x] 3.3 `status.js` completeRepair：去掉 `_doc_id` 兼容分支，统一用 `material_id`
- [x] 3.4 `status.js` updateOrderStatus 接单分支：维修员 In Progress ≥ 5 拒绝接单
- [x] 3.5 ✅ 原本已实现 — `helpers.enhanceWorkOrder` 已读 `total_duration_seconds`

**第 4 批 前端去重**
- [x] 4.1 `services/workOrder.js` 新增 `acceptOrder`；`pages/index/index.js`、`pages/work-order-detail/index.js` 复用
- [x] 4.2 ⏭ 跳过 — `work-order-detail/index.js` L370 早已在调用 `getButtonConfig`，不存在硬编码权限块；setData 9 个 `showXxx` 字段是 wxml `wx:if` 必需的平铺，强行精简会引入风险

## Review

### 改动文件（共 8 个）
- `cloudfunctions/workOrderManager/index.js` — urge openid 一致 / canViewOrder 替换硬编码权限 / delete 写审计日志 / 引入 ROLE/canViewOrder/writeAuditLog
- `cloudfunctions/workOrderManager/helpers.js` — 新增 `ROLE` 枚举、`canViewOrder(user, order)`、`writeAuditLog({...})` 三个工具函数并导出
- `cloudfunctions/workOrderManager/handlers/crud.js` — assigned_technician 加 avatar / updateDetails photos 上限 9 / updateDetails 时区 +08:00 / 接入 writeAuditLog(update_details)
- `cloudfunctions/workOrderManager/handlers/status.js` — `STATUS_TRANSITIONS` 白名单 / `MAX_CONCURRENT_ORDERS_PER_TECHNICIAN=5` 接单并发限制 / updateStatus 通知（In Progress 通知提交者，Completed 通知双方）/ completeRepair `db.runTransaction` 事务化（库存二次校验+扣减、写记录、更新工单原子）/ 三个 action 写 audit_logs
- `cloudfunctions/workOrderManager/handlers/notify.js` — urgeAccept/urgeRepair/urgeReview 三处补 `user.active === false` 拦截
- `miniprogram/services/workOrder.js` — 新增 `acceptOrder(orderId)`，封装 `updateWorkOrderStatus(parseInt(id), 'In Progress', '维修员接单开始维修')`
- `miniprogram/pages/index/index.js` — handleAcceptOrder 改用 `acceptOrder`
- `miniprogram/pages/work-order-detail/index.js` — handleAcceptOrder 改用 `acceptOrder`

### 影响面
- **不动**前端任何 wxml/wxss、自定义 TabBar、按钮文案位置、状态显示。
- **新增数据**：`audit_logs` 集合（云端首次写入时自动创建，无需迁移）；`assigned_technician.avatar` 字段（仅对新工单生效）。
- **行为变更**：经理/管理员手动变状态会发通知（之前不发）；维修员同一时刻 In Progress 工单 ≥ 5 时拒绝再接单；非管理员不能跨白名单跳状态；账号被停用的人无法发催办；完成维修若库存不足整体回滚（之前可能扣库存但工单不更新）。
- **未引入**：新组件、新页面、新 npm 依赖、wxml 改动。

### 部署须知
本轮只改了 `workOrderManager` 云函数和 3 个前端 .js 文件。

1. 微信开发者工具中右键 `cloudfunctions/workOrderManager` → 上传并部署（云端安装依赖）
2. 微信开发者工具中点"工具 → 构建 npm"（前端 services/pages 修改，需重新预览或刷新模拟器）
3. 按计划的"自检清单"在工具内回归测试每批改动

### 自检清单（详见 plan）
计划文件 `~/.claude/plans/bug-harmonic-dolphin.md` 内含 4 批共 16 项手动验证步骤 + 端到端流程回归。本轮代码改动 + 静态语法检查均已 OK；运行时验证需在微信开发者工具中执行。

### 已知局限 / 未做
- 4.2 跳过原因见 TODO 段。
- audit_logs 集合首次写入需要云开发数据库自动创建权限（默认开启）；如部署环境关闭了自动建集合，需要手工建。
- `db.runTransaction` 在云开发标准环境支持；如遇环境不兼容需要回退到"先工单后库存"方案，目前未做兜底。
- 老工单 `assigned_technician` 没有 avatar 字段，前端展示时需要 `||''` 兜底（现有代码已处理）。
- 未对 `enhanceWorkOrder` 的 console.log 做清理（不属于本轮范畴）。
- ROLE 枚举只在新加的 `canViewOrder` 中使用，原有 handler 中的 `role_id === 1/2/3/4` 字面量未做大面积替换（避免 diff 过大；约定本轮"只去明显重复"）。

## 任务（当前）：收费列表 待维修卡片 对齐普通工单列表卡片

**目标**：`pages/charge-order/index.wxml` 中 "待维修" 分支的卡片，视觉结构 & 显示字段 与 `pages/index/index.wxml` 的 `.ticket-card` 保持一致；Completed（已完成）分支 **不动**。详情页 `charge-order/detail.wxml` 待维修区字段已与目标一致，本轮不改。

### 目标卡片字段对照（Pending Repair）

| 位置 | 字段 | 来源 |
|------|------|------|
| 右上 status-badge | 状态文本 + 浅蓝底/深蓝字 | `statusText`（仍为"待维修"）+ class `status-reported` |
| 左上 ticket-id | `order_number`（绿色 30rpx 粗体） | 同主列表 |
| id 旁 priority | "紧急" 红底白字 | `priority === 'Emergency'` |
| description-box | `description` 灰底胶囊 | 同主列表 |
| metadata 第 1 行 | 责任方 + 报修人 + 工单类型（person/user/building 三图标） | `responsible_party` / `submitter.name` / `order_category` |
| metadata 第 2 行 | 楼层/位置 + 时间（location/time 两图标） | `floor` · `location` / `created_at` |
| 底部 photo-action-row | 最多 3 张 `photos`（无接单按钮） | `photos` |

去除现卡片的底部提示"待维修方处理 → 办美/经理补录"（冗余，卡片样式自解释）。

### 决策点（若不同意请在确认时告诉我）

1. **状态文字保留"待维修"**（非"已提报"），因为收费模块语境就是维修外包，文字不碰。
2. **状态视觉**：复用主列表 `.status-reported`（浅蓝 + 深蓝），不再使用 store 里的 `statusBg/statusColor` 内联（那两项在 detail 页仍保留使用，不动）。
3. **ticket-id 颜色**：绿色 `#10b981`（完全对齐主列表）。如果希望保留收费模块蓝色主题，改 `#1d4ed8`。默认绿色。
4. **已完成卡片、detail 页、数据看板**：完全不动。

### TODO

- [x] 1. `charge-order/index.wxml`：Pending Repair / Completed 拆分为 `<block wx:for>` 内的 `wx:if`/`wx:else` 两个独立卡片；待维修换用 `ticket-card` 结构（`status-badge`、`ticket-id`、`priority-badge`、`description-box`、两行 metadata、photo-action-row）。
- [x] 2. `charge-order/index.wxss`：追加 `ticket-card` / `::before` / `:active` / `status-badge` / `status-reported` / `ticket-header` / `ticket-id-row` / `ticket-id` / `priority-badge` / `priority-emergency` / `description-box` / `metadata-wrapper` / `metadata-line(+left/center/right)` / `metadata-item` / `metadata-text` / `location-separator` / `icon(+person/user/building/location/time)` / `photo-action-row` / `photo-list` / `photo-placeholder` / `photo-image` — 共约 60 行。同时清掉因改 WXML 已变孤儿的 `.desc-wrap` / `.meta-list` / `.meta-chip` / `.footer-hint`。
- [x] 3. `charge-order/store.js` `enrich()`：新增 `STATUS_CLASS` 映射 + `statusClass` 字段（`Pending Repair` → `status-reported`，`Completed` → `status-completed`）。
- [x] 4. 未改：`detail.wxml` / `detail.wxss` / `edit.*` / Tab 2 数据看板 / Completed 卡片样式。
- [x] 5. 未引入图片加载态 JS（`onPhotoError/onPhotoLoad`） — mock 数据 `photos: []` 全为空，静态 `<image>` 足够。

### 原则
- 仅改 3 个文件（wxml / wxss / store.js），其中 wxml 只替换一个分支，wxss 只做追加，store.js 只加一个字段。
- 不引入组件化、不抽公共样式（WXSS 无法跨页共享，组件化属于大改，下一轮再说）。
- 不碰普通工单模块、详情页、数据看板。

## 任务（当前）：收费工单"待维修"详情页对齐主工单详情 Info 页

**目标**：`pages/charge-order/detail.wxml` 的 **Pending Repair 分支**（第 23-90 行）视觉对齐 `pages/work-order-detail/index.wxml` 的 **工单信息（Info Tab）** 页——即玻璃拟态 `.info-card` 里一列 `.info-row`（左标签 + 右内容），并用大字号、右对齐的值、带圆角渐变的优先级标签、两行日期时间、内联照片网格。

**Completed 分支完全不动**。主工单详情页完全不动。

### 现状 vs 目标字段对照

| 行 | 当前（Pending Repair 现状） | 目标（work-order-detail Info 风格） |
|----|----|----|
| 工单编号 | 第 1 张 card 的 `.order-id-big` | `info-row` 首行，右侧灰字 |
| 楼层 | 第 2 张 card info-grid | 同左 |
| 具体位置 | 同上 | 同左 |
| 工单类别 | 同上 | 同左 |
| 责任方 | 同上 | 同左 |
| 优先级 | 第 1 张 card 下方 `.emergency-tag` | 独立一行，`.priority-tag .priority-red/green`，胶囊渐变 |
| 报修时间 | 第 2 张 card 底部 | `info-value-datetime`（日期 + 时间两列） |
| 问题描述 | 第 1 张 card 的 `.desc-block`（带背景） | 普通 `info-row`，纯文本 |
| 现场照片 | 第 3 张 card | `info-row-photos` + `photo-grid-inline`（140rpx × N） |
| 报修人 | 第 2 张 card | `info-row` |
| 联系电话 | 同上 | `info-row` |
| 提示卡 | `.tip-card`（橙色警示） | 保留，放在 info-card 下方 |

### 命名冲突处理

`detail.wxss` 已有 `.info-card` / `.info-row` / `.info-label` / `.info-value` 四个类名——**被已完成详情用过**，语义不同。**不能直接覆盖**。

方案：用 **父选择器作用域** `.pending-info .xxx`，所有新样式都挂在 `.pending-info` 容器下，不会影响 Completed 分支。

### TODO

- [x] 1. `detail.wxml` Pending Repair 分支：包进 `<view class="pending-info">`，内用 1 张 `.info-card` + 11 个 `.info-row`（工单编号、楼层、具体位置、工单类别、责任方、优先级、报修时间、问题描述、[现场照片]、报修人、联系电话）。`.tip-card` 保留放底部。
- [x] 2. `detail.wxss` 追加 ~90 行 `.pending-info xxx` 作用域下的样式：`.info-card/.info-row/.info-label/.info-value/.priority-tag/.priority-red/.priority-green/.info-row-photos/.info-value-photos/.photo-grid-inline/.photo-item-wrapper/.photo-item-inline`。Completed 分支的全局 `.info-card/.info-row/...` 不受影响。
- [x] 3. 省略 `.info-value-datetime` / `.datetime-date` / `.datetime-time` —— mock 数据的 `created_at` 已经是 "YYYY-MM-DD HH:MM" 完整字符串，WXML 无法 split，单行 `.info-value` 即可达到相同视觉（同字号同色）。
- [x] 4. 清理因重写产生的孤立样式：`.emergency-tag`、`.desc-block`、`.block-label`、`.block-value`、`.mt6` 从 `detail.wxss` 删除（`.mt8`/`.mt10`/`.info-block` 仍被 Completed 用到，保留）。
- [x] 5. 未改：`detail.js`、`edit.*`、`index.*`、Completed 分支、导航栏、底部操作栏、stepper/Tab 导航。

### 决策点（若不同意请告知）

1. **是否保留 `.tip-card`（橙色"该工单已转入收费流程…"提示）**：默认保留。如果希望删除、或换成 work-order-detail 风格的 `.remark-row` 展示，告诉我。
2. **是否需要 stepper / Tab（工单进度）**：默认不做。本轮只对齐 Info Tab 的字段区。
3. **导航栏 / 底部"转为已完成"按钮**：维持现状不动（与请求无关）。

### 原则
- 仅改 2 个文件（`detail.wxml` / `detail.wxss`），`detail.wxml` 只动 Pending Repair 分支，`detail.wxss` 只追加。
- 用作用域前缀避开命名冲突，保证 Completed 分支完全无感。
- 不引入组件、不跨页复用（WXSS 无法跨页 @import 已知）。

## 历史任务

## 任务：删除收费工单模块 - 收费列表顶部数据模块

**目标**：移除 `miniprogram/pages/charge-order/index` 收费列表 Tab 顶部的蓝色渐变 Hero 数据模块（显示"本月概览 / 本月工单 / 本月收费 / 待付款"），只保留搜索栏、筛选、列表。

**影响范围**：仅影响 `pages/charge-order/index.wxml` / `index.js` / `index.wxss` 三个文件，收费列表 Tab 1。Tab 2（数据看板）完全不动。

### TODO
- [x] 1. WXML：删除 `<view class="hero">...</view>` 整块
- [x] 2. WXSS：删除所有 `.hero*` 样式；`.search-float` 改为 `padding: 12px 16px 0;`（原 `margin-top: -20px` 的浮起效果随 Hero 一起移除）
- [x] 3. JS：清理 data 中的 `heroMonth`、`heroStats`，以及 onLoad 里的 `heroMonth` 赋值
- [x] 4. 自检：grep `heroMonth|heroStats`、`.hero*` 类名，确认项目内无残留引用

## Review

### 变更摘要
- `miniprogram/pages/charge-order/index.wxml`：移除 Hero 渐变区整块（标题+副标题+3 项统计）。
- `miniprogram/pages/charge-order/index.wxss`：删除 `.hero` / `.hero-bg` / `.hero-inner` / `.hero-title` / `.hero-sub` / `.hero-stats` / `.hero-stat` / `.hero-stat-row` / `.hero-stat-value` / `.hero-stat-unit` / `.hero-stat-label` 共 11 条样式（约 44 行）；`.search-float` 由原本的"浮动在 Hero 下方"改为普通上下间距。
- `miniprogram/pages/charge-order/index.js`：移除 `data.heroMonth`、`data.heroStats` 字段，移除 `onLoad` 中计算/写入 `heroMonth` 的代码（不再需要 `new Date()`）。

### 影响面
- 仅影响收费列表 Tab 顶部视觉。筛选、搜索、列表卡片、Tab 2 数据看板完全未触碰。
- 其他页面/组件无引用上述字段或类名。

### 未做
- 未变更 Tab 2 数据看板（KPI、图表、排行榜），依旧保留原有数据展示。
- 未调整顶部导航和 Tab 切换样式。

### Simplify 复核修复（2026-04-21）
对本次改动周围的代码做了一轮简化，仅动明确无风险的项：

- **死代码**：删除未使用的 `const app = getApp()`；删除从未调用的 `ensureMonthTrendChart(that)`。
- **require 提升**：把 `require('../../components/ec-canvas/echarts')` 从 onInit 回调内提到模块顶部，并抽 `makeEc(option)` 工厂消除两个 onInit 的复制粘贴。
- **setData 合并**：`onLoad` 原来的两次 `setData`（先 `statusBarHeight`，再 `ecTrend/ecPie`）合并为一次。
- **tab 切换去重**：`onTabChange` 与 `onSwiperChange` 的相同逻辑抽到私有 `_setTab(index)`。
- **过滤去重**：`onFilterChange` 补齐同值守卫 `if (filter === this.data.activeFilter) return`。
- **类名修正**：`index.wxss` 中 `.mt6 { margin-top: 2px }` 名不副实（6 vs 2px），重命名为 `.mt2`，同步 `index.wxml:102` 的 class；`detail.wxss` 的 `.mt6` 保持不变（其值真是 6px）。

跳过（明确超出本次清理 scope）：
- `.search-float` 类名（Hero 删除后"float"语义残留），但仅视觉容器，功能正常。
- WXML 中多处 `<!-- ... -->` 描述型注释，属于既有代码风格，非本次引入。
- `'Pending Repair'` / `'Completed'` / `'全部'` / `'待维修'` 等字面量可接入 `utils/constants.js` 的 `STATUS_DISPLAY_NAMES`，但属重构范畴。
- `onSearchInput` 防抖与 `applyFilter` setData payload 瘦身，属性能优化方向，非本次目标。

---

## 任务（当前）：删除耗品管理的 3 个按钮

**目标**：在首页耗品管理 Tab 下移除"库存盘点 / 申领审批 / 预警管理"三个按钮入口。

### 影响范围（grep 结果）
- `miniprogram/pages/home/index.js`
  - 第 87 行：`{ icon: 'records-o', label: '库存盘点', bg: '#7B61FF' }`（功能宫格第 1 行第 4 列）
  - 第 92 行：`{ icon: 'sign', label: '申领审批', bg: '#FF4D4F' }`（功能宫格第 2 行第 3 列）
  - 第 93 行：`{ icon: 'warning-o', label: '预警管理', bg: '#EB2F96' }`（功能宫格第 2 行第 4 列）
- `miniprogram/pages/home/index.wxml`
  - 第 225 行：待办事项卡片"库存预警"，`data-label="预警管理"` → tap 目标即将被删
  - 第 234 行：待办事项卡片"出库审核"，`data-label="申领审批"` → tap 目标即将被删

### TODO
- [x] 1. `miniprogram/pages/home/index.js` `consumableFuncRows`：移除 库存盘点 / 申领审批 / 预警管理
- [x] 2. `miniprogram/pages/home/index.wxml` 待办两张卡片去掉 `data-module/data-label/bindtap`（方案 A）
- [ ] 3. 实机预览首页耗品 Tab，确认布局不错位（待用户在微信开发者工具中验证）

### Review
- 用户确认方案 A：保留待办卡片仅作展示。
- `index.js` `consumableFuncRows` 由 2×4 改为：第 1 行 3 个（入库/出库/库存查询）、第 2 行 2 个（快递管理/数据报表），共 5 项。
- `index.wxml` 待办两张卡片移除 `data-module="consumable"`、`data-label`、`bindtap="onFunctionTap"`，class 不动；点击不再触发跳转。
- `onFunctionTap` 没有针对被删 3 个 label 的专属分支，无需修改 handler。
- 未触碰 `consumableActivities` 中"库存盘点完成，差异3项"这条文案动态（属于演示数据，与按钮无关）。

---

## 任务（当前）：按 `~/Desktop/DESIGN.md`（Apple 画廊风）重构首页样式

**目标**：把 `miniprogram/pages/home/index.{wxss,wxml}` 的视觉语言切换到 DESIGN.md 规范——单一 `#0066cc` 行动色、零装饰渐变、零卡片阴影、SF Pro 字号梯度、pill 主按钮 + hairline 卡片。结构（3 Tab + KPI + 功能宫格 + 快捷入口 + 最近记录）保持不动。

### 当前现状（要砍掉的装饰层）
- `page` 渐变背景 `#DCE4FF→#DFF5F4→#F1F3F6→#EAEDF2`（home/index.wxss:9-13）
- KPI 卡片：`linear-gradient` 白底 + `backdrop-filter: blur(20px)` + 4 层 box-shadow + 4 边渐变 border + `::after` 渐变蓝半圆（kpi-card / kpi-card::after）
- 功能图标渐变方块 `#E8EDFF→#D3DDFF` + 紫色阴影（func-icon）
- 快捷按钮渐变胶囊：薄荷蓝→紫 / 黄→珊瑚 + 多重阴影（quick-btn-primary / quick-btn-secondary）
- record-item 卡片：同款 8 边 border + 4 层阴影 + 渐变背景
- 顶部 tab：橙色 `#F0A030` 下划线
- Tab2 耗品管理整套 `cs-*` 样式（白卡 + 蓝渐变图标）

### 关键取舍——你需要拍板（A vs B）

| 项 | A. 严格执行 DESIGN.md（极简） | B. 务实精神化（推荐） |
|---|---|---|
| KPI 数值色 | 全部 `#1d1d1f` 黑（DESIGN.md "no second accent"）—4 个数字看起来一样，状态识别靠 label | 保留状态色（橙/蓝/紫/绿）作为**信息色**，按钮和链接走 `#0066cc` |
| record-status-badge | 全部 `#1d1d1f` 文字 + 灰底 | 保留状态色（已提报蓝、维修中青、待复核紫、已完成绿）|
| 工单维修区 vs 耗品管理区 | 用 `#ffffff` ↔ `#f5f5f7`（parchment）做色块切换 | 全部 `#ffffff`，用 80rpx 段间距分隔 |
| 顶部 tab 下划线 | 不要下划线，黑字粗体表示 active（Apple 不用下划线 tab）| 保留下划线但改成 `#0066cc` |
| 整体激进度 | 砍得最干净，可能"看起来都一样" | 保留功能性识别色，去掉所有装饰 |

> **我的推荐：B**。理由：DESIGN.md 是 Apple 营销页规范，目标是"产品独白、UI 隐身"；当前是工具型小程序仪表板，KPI 数字色承担"快速扫视识别状态"的功能（非装饰），完全砍掉会损伤可用性。但 DESIGN.md 的核心精神（无装饰渐变 / 无卡片阴影 / 单一行动色按钮 / pill CTA / hairline 卡片 / 收紧字号梯度）我们 100% 执行。

### Token 翻译表（DESIGN.md px → 小程序 rpx，按 1:2）

| Token | px | rpx | 用在哪 |
|---|---|---|---|
| `colors.primary` #0066cc | — | — | 所有 CTA、链接、tab active 下划线 |
| `colors.canvas` #ffffff | — | — | page 背景、卡片底 |
| `colors.canvas-parchment` #f5f5f7 | — | — | 段落分隔（仅 B 路线用）|
| `colors.ink` #1d1d1f | — | — | 标题、正文 |
| `colors.body-muted` `#525252`/`#737373` | — | — | 次级文本（label / caption）|
| `colors.hairline` #e0e0e0 | — | — | 卡片 1rpx 实线边（取代多层阴影）|
| `rounded.lg` | 18px | 36rpx | 卡片圆角（KPI / func / record）|
| `rounded.sm` | 8px | 16rpx | 内嵌图片圆角 |
| `rounded.pill` | 9999px | 9999rpx | 主按钮、徽章 |
| `spacing.lg` | 24px | 48rpx | 卡片内 padding |
| `spacing.xl` | 32px | 64rpx | 段间距 |
| `spacing.section` | 80px | 160rpx | 区段大间距（适度缩到 96rpx，小程序屏窄）|
| `display-lg` | 40px / 600 | 56rpx 600（KPI 数字 38rpx 改 56rpx）| KPI 大数字、section 标题|
| `body` | 17px / 400 / -0.374px | 30rpx 400 letter-spacing -0.4rpx | 列表正文 |
| `caption` | 14px / 400 / -0.224px | 24rpx 400 letter-spacing -0.3rpx | KPI 标签、时间文本 |
| `tagline` | 21px / 600 / 0.231px | 38rpx 600 letter-spacing 0.5rpx | tab 文字 |
| product-shadow `rgba(0,0,0,0.22) 3px 5px 30px` | — | — | **本次不用**（全文无产品图）|

### TODO（按 CLAUDE.md 简单原则，全部局限在 home/ 三件套）

**前置：等用户选 A 还是 B（推荐 B），再开工**

- [ ] 1. `home/index.wxss` `page` 改纯白 `#ffffff`，删 4 段渐变；`.page` 同步改纯色
- [ ] 2. KPI 卡片去装饰：删 `linear-gradient` 白底 / `backdrop-filter` / 4 层 box-shadow / `::after` 半圆；改 `background: #fff` + `border: 1rpx solid #e0e0e0` + `border-radius: 36rpx` + 不要阴影
- [ ] 3. KPI 字号：`.kpi-value` 38rpx→56rpx，`font-weight: 600`（不再 800），`letter-spacing: -0.6rpx`；color 处理见 A/B 取舍
- [ ] 4. `.func-icon` 删渐变 `#E8EDFF→#D3DDFF` 和紫色阴影；改纯白 `#fff` + 1rpx hairline + 36rpx 圆角；图标颜色统一 `#0066cc`
- [ ] 5. `.func-card` 删 backdrop-filter / 多层 box-shadow / 4 边渐变 border；改纯白 + 1rpx hairline
- [ ] 6. `.quick-btn-primary` / `.quick-btn-secondary` 改 button-primary：`background: #0066cc`、`border-radius: 9999rpx`、`box-shadow: none`、字色 `#fff`；删两套渐变 + 紫/珊瑚阴影。**两个按钮颜色统一**（DESIGN.md 不允许第二行动色）
- [ ] 7. `.record-item` 同 KPI 处理：删 backdrop-filter / 4 层阴影 / 8 边渐变 border；改纯白 + 1rpx hairline + 36rpx 圆角；`.record-status-badge` 处理见 A/B
- [ ] 8. `.tab-text`：38rpx 600 letter-spacing 0.5rpx；`.tab-underline` 颜色 `#F0A030`→`#0066cc`（B 路线）或整体删除（A 路线）
- [ ] 9. `.section-title`：30rpx 600 #525252 → 38rpx 600 #1d1d1f letter-spacing -0.5rpx
- [ ] 10. `.cs-*` 系列（耗品 Tab）：同样处理——删所有渐变蓝图标、删多层阴影、`#1677FF` 全局换 `#0066cc`、border-radius 18→36rpx 统一
- [ ] 11. `.cs-overview-value` 56rpx 700→64rpx 600 letter-spacing -0.7rpx；`.cs-stat-icon` 蓝 `#EAF2FF` 底改纯白 + hairline；`.cs-todo-icon-orange` / `.cs-todo-icon-blue` 改纯白 + hairline；图标色统一 `#0066cc`
- [ ] 12. `.cs-quick-fill` `#1677FF` → `#0066cc`，删阴影；`.cs-quick-outline` border `2rpx #1677FF` → `1rpx #0066cc`，删阴影
- [ ] 13. `home/index.wxml` 同步：`van-icon` 出现的 hardcoded color（`#4F6DF5` / `#5C8DFF` / `#1677FF` / `#fafafa`）全部改 `#0066cc` 或 `#fff`；KPI 卡片 inline `style="color: #..."` 处理见 A/B
- [ ] 14. `home/index.js` 检查：`STATUS_TEXT_COLORS` / `STATUS_BG_COLORS` / `inspectionRecords[].dotColor` / `consumableActivities[].badgeBg/timeColor`——A 路线全部统一灰，B 路线保留
- [ ] 15. 微信开发者工具实机预览三个 Tab，确认布局不错位、点击区域不变（待用户验证）
- [ ] 16. 跑 `code simplifier`（CLAUDE.md 第 10 条）

### 不做（YAGNI 红线）
- 不动 wxml 结构（不删 KPI、不并段、不改 swiper 顺序）
- 不动 home/index.js 业务逻辑（除上面 14 提到的颜色常量）
- 不动 TabBar / 其他页面（DESIGN.md 设计语言全站推广是另一个任务）
- 不引入新组件、不重写 cs-* 为新命名空间
- 不实现 Apple 的"alternating tile"全屏色块切换（小程序滚动语境不适用）
- 不引入 SF Pro Display 字面量字体声明（小程序已用 `-apple-system` 系统栈，iOS 已经能拿到 SF Pro，Android 走 fallback 即可）

### 验证清单（用户实机）
1. 三个 Tab 切换无错位、动画顺畅
2. 没有任何卡片有可见阴影；没有任何渐变（page、卡片、按钮、图标）
3. 所有 CTA / 链接 / 链状元素颜色都是 `#0066cc`（不再有紫 #6366e8 / 橙 #FF6A00 / 蓝 #1677FF）
4. KPI 卡片、record-item、func-card 都是 1rpx hairline 边、36rpx 圆角、纯白底
5. 字号梯度收紧：tab > section-title > KPI value > body > caption 阶梯清晰
6. （B 路线）状态徽章和 KPI 数字仍能一眼分辨工单状态

### Review
（实施完成后填写：实际改动文件、关键决策、未达成项、需后续跟进）

---

## 任务（当前·已批准）：商品管理（耗品域）彻底独立化

**目标**：把"商品管理"从 stock-in 的 sub-tab 升级为耗品域独立页面 `/pages/product/index`，前后端两层与 `materials` / `<material-list>` 完全解耦。维修域代码零修改。

**完整 plan**：`/Users/lvleo/.claude/plans/silly-moseying-newell.md`

### TODO（按 plan 阶段顺序）

**阶段 1：后端**
- [x] 1. 复制 `cloudfunctions/materialManager/` → `cloudfunctions/productManager/`，重命名字段（`material_id`→`product_id`、`material_number`→`product_code`、`materials`→`products`、`material_records`→`product_records`），权限白名单 `canAccessMaterial`/`canManageMaterial` → `canAccessProduct`/`canManageProduct`
- [x] 2. `cloudfunctions/dictionaryManager/index.js`：白名单 `MANAGE_MATERIAL_DICTS` 加 `product_category` / `product_location`

**阶段 2：服务层**
- [x] 3. 新建 `miniprogram/services/productService.js`（从 materialService 复制 + 字段+服务名重命名）

**阶段 3：组件**
- [x] 4. 新建 `miniprogram/components/product-list/{js,wxml,wxss,json}`（从 material-list 复制 + 文案"配件"→"商品" + placeholder/empty-text 改）

**阶段 4：商品独立页**
- [x] 5. 新建 `miniprogram/pages/product/index.{js,wxml,wxss,json}`（NavBar "商品管理"，挂 `<product-list>` + canManage 校验 + 跳详情/新增）
- [x] 6. 新建 `miniprogram/pages/product/detail/index.*` + `pages/product/edit/index.*`（从 material/detail + material/edit 复制 + 字段重命名 + 服务切换；plan 漏写 edit 页，实施时一并补上）
- [x] 7. 新建 `miniprogram/pages/product/add/index.*`（从 material/add 复制 + 字段重命名 + 服务切换 + onLoad 接 `query.product_code`）
- [x] 8. `miniprogram/app.json`：注册 4 个新页面（product/index、detail、edit、add）

**阶段 5：改造 stock-in**
- [x] 9. `pages/material/stock-in/index.js`：`subTabs` 删"商品管理"项 + 删 onMaterial 回调 + `directScan`/`submitStockIn` 切到 productService + 扫码失败跳 `/pages/product/add/?product_code=` + 字典 key 改 `product_*` + goToRecordDetail 加 product→material 字段桥接复用 record-detail 旧页
- [x] 10. `pages/material/stock-in/index.wxml`：删 sub-tab 1 整段（`<material-list>` 块）+ scannedMaterial → scannedProduct + product_image/product_name/product_code 字段同步
- [x] 11. `pages/material/stock-in/index.json`：移除 `material-list` 组件注册

**阶段 6：首页**
- [x] 12. `pages/home/index.js`：`consumableFuncRows` 加"商品管理"宫格（icon: gift-o，紫色 #7C3AED）+ `onFunctionTap` 加分支跳 `/pages/product/index`

**阶段 7：清理 + 验证**
- [x] 13. 所有新建 `.js` 跑 `node -c` 静态校验（13 文件全过）
- [x] 14. 跑 `code simplifier`（CLAUDE.md 第 10 条）— 子代理审查 17 文件确认零冗余，无修改
- [ ] 15. 部署 `productManager` + `dictionaryManager` 云函数（用户在微信开发者工具中执行）
- [ ] 16. 用户实机回归（plan 验证章节 6 项）

### 不做（YAGNI 红线）
- 不实现 products 出库流程、不实现"库存查询/快递管理/数据报表"宫格
- 不动 `materials` 集合、不写迁移脚本
- 不重构 `materialService.js` / `<material-list>` / `pages/material/index`
- 不引入 products / materials 的统一抽象层

### Review（商品管理彻底独立化）

#### 改动文件清单（21 个文件）

**新建 18 个**：
- 后端 6：`cloudfunctions/productManager/{package.json, helpers.js, index.js, handlers/crud.js, handlers/stock.js, handlers/seed.js}`（seed 为开发用测试数据 handler，幂等：products 非空时拒绝）
- 服务层 1：`miniprogram/services/productService.js`
- 组件 4：`miniprogram/components/product-list/{json,js,wxml,wxss}`
- 商品列表页 4：`miniprogram/pages/product/index.{json,js,wxml,wxss}`
- 商品详情页 4：`miniprogram/pages/product/detail/index.{json,js,wxml,wxss}`（wxss 直接 cp）
- 商品新增页 4：`miniprogram/pages/product/add/index.{json,js,wxml,wxss}`（json/wxss 直接 cp）
- 商品编辑页 4：`miniprogram/pages/product/edit/index.{json,js,wxml,wxss}`（wxss 直接 cp）

> 注：商品详情/新增/编辑各 4 个文件，但部分（json/wxss）是 cp 不变，所以新建总数按文件数算；扣除原始模板复制份数=新建独立逻辑文件 17 项。

**改造 4 个**：
- `cloudfunctions/dictionaryManager/index.js`：白名单加 `product_category` / `product_location`
- `miniprogram/app.json`：注册 4 个新页面路由
- `miniprogram/pages/material/stock-in/index.{js,wxml,json}`：subTabs 缩 2 项、扫码改 productService、字典 key 改 product_*、wxml 删商品管理 sub-tab、json 移除 material-list 组件注册
- `miniprogram/pages/home/index.js`：耗品宫格加"商品管理"项 + onFunctionTap 加分支

#### 关键决策与偏离

1. **edit 页补建（plan 漏）**：原 plan 只列了 detail + add，实施时发现 product-list 组件的"编辑"菜单跳 `/pages/product/edit/index`，必须建。在 P6 范围内补 4 个文件（含 json/wxml/js + cp wxss）。
2. **record-detail 字段桥接（plan 未涉及）**：stock-in 入库记录详情页 `/pages/material/record-detail/` 仍按 material_* 字段名展示。我在 stock-in/index.js 的 goToRecordDetail 加了 3 行字段映射（product_name → material_name 等），不复制整个 record-detail 页。这是 product_records 集合保持 product_* 命名干净 vs UI 复用之间的最小成本桥接。
3. **耗品域权限白名单**：照搬 materialManager 的 `[1,2,4,5]` / `[1,2,5]`，未做收紧。
4. **耗品分类/位置默认值**：抛弃了维修配件的"电气/水暖/门窗/消防"，改成"办公耗品/清洁用品/日用百货/食品饮料/五金杂货/通用"。位置默认值（"主仓库/应急储备/工程仓/办公耗材区/外采暂存/其它"）保留了原值——这些位置对耗品域同样适用。
5. **既有 `materials` 数据零迁移**（D3）：商品域从空白 products 集合开始。
6. **后置补丁：material/index 加回"入库记录" Tab**：上一轮拆分把维修域的入库记录视图一并拿走，本轮修复——`pages/material/index` 改回 3 Tab（配件列表 / 入库记录 / 出库记录），数据来自 `material_records.type='in'`。
7. **后置补丁：productManager 加 seed handler**：Plan 原本说"耗品从空开始"，但回归阶段需要测试数据，加了 `handlers/seed.js`（幂等保护：products 非空时拒绝），通过 `seedTestData` action 一键插入 5 条商品 + 3 条入库流水。

#### 部署须知

用户需在微信开发者工具中执行：
- 右键 `cloudfunctions/productManager/` → 上传并部署所有文件（首次部署会创建该云函数 + 安装 wx-server-sdk 依赖）
- 右键 `cloudfunctions/dictionaryManager/` → 上传并部署所有文件（白名单已扩 product_*）
- 工具 → 构建 npm（前端代码）
- 真机/模拟器实际跑回归

#### 自检清单

- [ ] 首页耗品 Tab → 商品管理宫格 → 进 /pages/product/index，NavBar "商品管理"，列表为空
- [ ] FAB → /pages/product/add，提交一条 → 回列表见 1 条
- [ ] 列表项点击 → 详情页；详情"修改"→ edit 页；编辑后回详情可见
- [ ] 列表项菜单"删除"→ 乐观删除生效
- [ ] 耗品 Tab → 入库管理 → /pages/material/stock-in，仅 2 sub-tab
- [ ] FAB 扫码：扫到已存在 product → Modal；扫不存在 → showModal "立即添加" → 跳 product/add 预填 code
- [ ] 入库提交后 product_records 表 type=in，products.stock 增加
- [ ] 工单维修 → 物料管理 → /pages/material/index 仍是 2 Tab（配件列表/出库记录），materials 表数据原样
- [ ] 维修员 role_id=3 在耗品 Tab 隐藏所有商品域入口
