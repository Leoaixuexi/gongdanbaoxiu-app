# 未提交改动审查报告

**日期**：2026-05-15
**审查范围**：当前 `main` 分支相对 `origin/main` 的未提交改动（58 个修改文件 + 多个新页面）
**审查方式**：3 个并行 Explore agent 扫描（云函数层 / 前端页面层 / 组件一致性）→ 人工复核

## 审查结论总览

| # | 严重度 | 问题 | 状态 |
|---|---|---|---|
| 1 | 🔴 高 | `backfillPurchasePrice` 孤儿 action + 用随机价污染生产数据 | ✅ 已删除 |
| 2 | 🔴 高 | 前后端字段不匹配：`product/add` 前端去掉 `stock_in_time`/`quantity`/`usage_area`，后端仍写入空值 | ✅ 已清理 |
| 3 | 🟡 中 | `material-list` 已移除 `additem` 事件触发，但 `pages/material/index.wxml` 仍 `bind:additem` | ✅ 已删除死链 |
| 4 | 🟡 中 | `home/index.js` 残留 3 处 `console.log`（生产代码） | ✅ 已删除 |
| 5 | 🟡 中 | `home/index.wxss` 中 `.cs-*` 系列样式（约 297 行）已被 `.ds-*` 取代但未删除 | ✅ 已删除 |
| 6 | 🟡 中 | `purchase_price` 和 `min_stock` 缺少非负数校验 | ✅ 已加 `Math.max(0, ...)` |
| 7 | 🟢 低 | ~~`consumableWarnings` 字段名混乱~~ | ⚠️ 误报（data 与 wxml 已对齐） |
| 8 | 🟢 低 | `flashlight.png` 新增但无引用 | ✅ 已删除 |
| 9 | 🟢 低 | ~~多页面 `index.json` 缺 van-icon 注册~~ | ⚠️ 误报（组件级作用域已声明） |

**最终结果**：7 项真实问题全部修复；2 项 Explore 误报已澄清，无需改动。

---

## 修复明细

### #1 删除 `backfillPurchasePrice` 全部痕迹

**问题**：云函数注册了 `backfillPurchasePrice` action，但前端无任何调用入口；实现内部对所有商品（最多 1000 条）按 category **随机生成**采购价并写入数据库，缺乏 dry-run / 白名单保护，会污染生产数据。

**用户决策**：一次性开发初始化脚本，**直接删除**。

**改动**：
- `cloudfunctions/productManager/index.js`：删除 `ROUTES` 中 `backfillPurchasePrice` 注册（−1 行）
- `cloudfunctions/productManager/handlers/seed.js`：删除 `PRICE_RANGE` 常量、`randPrice` 工具、`backfillPurchasePrice` 函数及其导出（−47 行）

---

### #2 清理 `addProduct` 中废弃字段处理

**问题**：前端 `pages/product/add` 已经移除 `stock_in_time` / `quantity` / `usage_area` 三个表单字段（耗品域不需要"首次入库时间/初始库存/使用区域"），但 `crud.js` 中仍解构这些字段，并在创建商品时附带写入空默认值；`initQty > 0` 时还会自动生成 `product_records` 记录。

**用户决策**：同时删除「商品创建时同步初始库存」逻辑。

**改动**：`cloudfunctions/productManager/handlers/crud.js` 的 `addProduct`：
- 移除入参解构中的 `stock_in_time, quantity = 0, usage_area = ''`
- 移除 `initQty` / `parsedStockInTime` 计算
- 移除 product doc 写入中的 `stock_in_time` / `usage_area` 字段；`stock` 默认值改为 `0`
- 删除 `if (initQty > 0) { ... }` 自动建 product_record 的整段

---

### #3 删除 `material-list` 死链事件绑定

**问题**：`material-list` 组件已移除 `onCardMenuTap` 等方法和对应 `additem` 事件触发（"新增配件"入口移到了页面级 FAB 按钮），但 `pages/material/index.wxml` 第 31 行仍残留 `bind:additem="onAddMaterialTap"`。

**改动**：`miniprogram/pages/material/index.wxml` 删除一行 `bind:additem`；`onAddMaterialTap` 方法本身保留（FAB 按钮还在用）。

---

### #4 删除生产代码中的 `console.log`

**问题**：`pages/home/index.js` 残留 3 处调试日志。

**改动**：
- `onFunctionTap`（L273）— 删除 `console.log('点击功能:', module, label)`
- `onQuickAction`（L368）— 删除 `console.log('快捷操作:', action)`
- `onViewAll`（L395）— 删除 `console.log('查看全部:', module)` 并移除已不再使用的 `dataset.module` 解构

---

### #5 删除 `.cs-*` 孤儿样式

**问题**：`home/index.wxss` 第 441-739 行（约 297 行）属于早期"耗品管理 Tab"的 `.cs-*` 命名空间样式，后被新的 `.ds-*` dashboard 样式完全取代，但旧样式没清理；wxml 中已无任何 `.cs-` 类引用。

**改动**：
- 删除 `.cs-card` 到 `.cs-activity-time` 的整段（共 297 行）
- 保留 `.ds-*` 区块的注释头，移除其中"避免与 .cs- 命名空间冲突"的过时说明
- 验证：`git grep -nE "\.cs-[a-z]" miniprogram/` 无命中

---

### #6 添加 `purchase_price` / `min_stock` 非负数校验

**问题**：`addProduct` 和 `updateProduct` 中两个数值字段都用 `Number(x) || 0`，会接受负数（虽不致命，但与"价格不能为负"的业务约束冲突）。

**改动**：`cloudfunctions/productManager/handlers/crud.js` 中两处 `addProduct` + 两处 `updateProduct`，统一改为 `Math.max(0, Number(x) || 0)`，把负数和 NaN 都钳到 0。

---

### #8 删除孤儿图片 `flashlight.png`

**问题**：`miniprogram/images/flashlight.png`（3.3 KB）新增但全仓库无引用。

**改动**：删除该文件。后续若需要扫码闪光灯功能可再加回。

---

## 误报澄清

### #7 `consumableWarnings` 字段名

Explore agent 报告 data 默认值用旧字段 `detail`、wxml 用新字段 `current/warning`。**实际复核**：data 已经是 `{ name, current, warning }` 结构，wxml 也对应使用这些字段。报告中提到的 `detail` 实际上是 `consumableApprovals`（出库审核）的字段，与 `consumableWarnings` 是两个独立数据结构，wxml 对应位置也用了 `detail`。

**结论**：data 与 wxml 完全对齐，无需修改。

### #9 页面 `index.json` 缺 van-icon

Explore agent 列出 `property/submit`、`work-order-edit` 等多个 json 没注册 van-icon。**实际复核**：
- `property/submit/index.wxml` 和 `work-order-edit/index.wxml` 都**不直接使用** van-icon
- 它们使用 `custom-header` 组件；该组件 `components/header/header.json` 自己已经声明了 `"van-icon": "@vant/weapp/icon/index"`
- 微信小程序组件作用域规则：组件内使用的子组件，由组件自身 json 声明即可，父页面不需要再声明

**结论**：当前注册结构正确，无需修改。

---

## 文件修改清单

| 文件 | 类型 | 净变化 |
|---|---|---|
| `cloudfunctions/productManager/index.js` | 修改 | −1 行 |
| `cloudfunctions/productManager/handlers/seed.js` | 修改 | −47 行（90 → 43） |
| `cloudfunctions/productManager/handlers/crud.js` | 修改 | 清理 + 校验，约 −20 行 |
| `miniprogram/pages/material/index.wxml` | 修改 | −1 行 |
| `miniprogram/pages/home/index.js` | 修改 | −4 行 |
| `miniprogram/pages/home/index.wxss` | 修改 | −297 行 |
| `miniprogram/images/flashlight.png` | 删除 | −3.3 KB |
| `tasks/audit-report.md` | 新建 | 本文件 |

---

## 验证步骤

部署前：

```bash
git grep -n "backfillPurchasePrice"         # 应无命中
git grep -nE "\.cs-[a-z]" miniprogram/      # 应无命中
grep -n "console\.log" miniprogram/pages/home/index.js   # 应无命中
git grep -n "flashlight" miniprogram/        # 应无命中
grep -n "bind:additem" miniprogram/pages/material/index.wxml   # 应无命中
grep -n "stock_in_time\|parsedStockInTime\|initQty" cloudfunctions/productManager/handlers/crud.js   # 应无命中
```

所有 6 项扫描均已通过 ✓。

部署后端手测：

1. 微信开发者工具上传 `cloudfunctions/productManager`
2. 商品管理 → 新增商品 → 验证创建成功；云开发控制台查看 product 文档无 `stock_in_time` / `usage_area` 多余空字段
3. 编辑商品 → 把 `purchase_price` 输入负数 → 提交后查看实际存为 0
4. 云调用面板执行 `{ name: 'productManager', data: { action: 'backfillPurchasePrice' } }` → 应返回 `"未知操作: backfillPurchasePrice"`

前端手测：

1. 首页 → 控制台不再出现"点击功能/快捷操作/查看全部"日志
2. 物料管理 → 切到配件列表 tab → FAB"+"按钮正常进入新增页
3. 整体打开各页，UI 无样式破损（重点首页耗品 dashboard、property/submit、work-order-edit）

---

## 后续建议（非本批审查范围）

以下内容**不在本次修复中处理**，留给用户后续决定：

1. **timeline-item 样式简化**：状态标签从"胶囊样式"改为"纯文字色"，需确认是否符合设计意图
2. **未跟踪新页面**（`stock-in/add` / `scan` / `category-edit`）：4 件套完整、初步审查通过，但建议在真机扫码场景验证 camera 组件
3. **提交策略**：未提交改动跨多个功能领域（首页 / 商品 / 物料 / 报修）。建议按主题拆 commit：
   - feat: 商品管理（耗品域）独立化
   - feat: 物料入库三件套（scan/add/category-edit）
   - feat: 首页 dashboard 改版
   - refactor: 工单报修 UI 重构
