# 任务 TODO

<!-- 每次新任务在这里追加规划，完成后加 Review 小节。 -->

## 任务（当前）：工单维修模块 Bug 修复 + 后端补全 + 适度精简

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
