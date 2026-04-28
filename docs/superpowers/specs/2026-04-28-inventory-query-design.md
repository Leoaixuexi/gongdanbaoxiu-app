# 库存查询模块设计（耗品管理子功能）

- **状态**：待实施
- **日期**：2026-04-28
- **入口**：首页 → 耗品管理 Tab → 「库存查询」按钮（按钮已存在于 `miniprogram/pages/home/index.js:86`，目前点击仅 toast）
- **视觉参考**：Pencil 节点 `AkohR`（详情页）

## 1. 目标与范围

### 目标

为耗品管理模块新增「库存查询」子功能，让管理员/经理/办美员工/仓管员实时查看库存状态，预警低库存，并支持仓管角色调整库存差异（盘盈/盘亏/报废/丢失）。

### 范围（按 PRD 1.0 全包含）

- 库存列表（含 4 状态筛选 + 搜索）
- 库存详情（指标卡 + 趋势图 + 消耗分析 + 流转记录）
- 库存调整（详情页底部抽屉，4 种调整类型）
- 预警机制（列表的预警/缺货筛选 + 详情页标红）

### 不在范围

- 独立的「预警清单」页 —— 用列表的「预警」「缺货」按钮筛选状态实现，不新建页面
- 「智能补货建议」（可用天数预估、建议采购量）—— 一期不做，需积累足量历史数据后再迭代
- 库存调整的审核流程 —— 一期直写直更新；如未来需要审核，调整页可独立成页接审核

## 2. 信息架构

### 入口

```
首页 (home/index)
└─ Tab2 耗品管理
   └─ 功能宫格 → 「库存查询」按钮（已存在，待接通跳转）
       └─ pages/material/inventory/index   ← 新页面
            └─ pages/material/inventory-detail/index?id=<material_id>  ← 新页面
                 └─ 底部抽屉：库存调整（不增加路由）
```

### 路由变更（`miniprogram/app.json`）

`pages` 数组新增 2 条主包页面：
- `pages/material/inventory/index`
- `pages/material/inventory-detail/index`

### 跳转代码（`miniprogram/pages/home/index.js`）

在 `onConsumableFunctionTap` 类的处理器（即 home/index.js 现有 toast fallback 之前）增加：

```js
if (module === 'consumable' && label === '库存查询') {
  wx.navigateTo({ url: '/pages/material/inventory/index' });
  return;
}
```

## 3. 页面规格

### 3.1 库存查询列表 `pages/material/inventory/index`

**布局自上而下：**

| 区域 | 说明 |
|---|---|
| 顶部导航 | 系统标题栏「库存查询」 |
| 搜索栏 | 单行模糊搜索，匹配 `materials.name`，回车/失焦触发 |
| 4 状态按钮（pill 样式） | 全部 / 预警 / 缺货 / 正常；每个按钮带数字 badge；选中态用主色 `#1677FF` 实心，未选用各状态浅底色 + 1px 边框；横向不换行可滚动 |
| 商品卡片列表 | 每条 14px 圆角白色卡 + 浅阴影 + 左侧 4px 状态色条；分页，每页 20 |

**卡片信息（每条）：**
- 标题：`name`（15px 粗体）+ 右上角状态徽章
- 副标题：`category · unit · material_number`（12px 灰）
- 主行：`库存 X / 预警 Y`（库存数字按状态着色：缺货红 / 预警橙 / 正常黑），右侧最近一次入库或出库日期 `MM/DD`

**状态判定（前端按字段计算）：**
- 缺货：`stock === 0`
- 预警：`0 < stock <= min_stock`
- 正常：`stock > min_stock`

**交互：**
- 点击商品卡片 → `wx.navigateTo` 详情页
- 下拉刷新 / 上拉加载更多
- 切换状态按钮 / 输入搜索 → 重新请求列表 + 状态计数

### 3.2 库存详情 `pages/material/inventory-detail/index`

**布局严格按 Pencil `AkohR` 复刻：**

| 区域 | 说明 |
|---|---|
| 顶部导航 | 返回 + 「库存详情」 |
| 商品卡片 | 14px 圆角 + 左侧 4px `#1677FF` 蓝条；显示 `name`/规格/分类/编码 |
| 3 指标卡（横向 1×3） | ① 当前库存（蓝色 `#1677FF` 强调）② 预警值 ③ 30 日消耗；每张白卡 14px 圆角 |
| 库存趋势卡 | 标题 + Tab(入库/出库 切换) + 6 个月柱状图（ec-canvas）+ X 轴月份标签 |
| 消耗分析卡 | 2×2 网格：消耗最多区域 / **消耗最多场景** / 最近采购单价 / 月均消耗 |
| 最近流转记录 | 列表显示最近 3 条；每条左侧 3px 色条（蓝=入库 / 红=出库 / 橙=调整）+ 类型标签 + 日期 + 数量带正负号 |
| 底部固定栏 | 单一主按钮「修改库存」（仅对有调整权限的角色显示；对其他角色隐藏底部栏，只有内容滚动区） |

**预警态强调：** 当 `stock <= min_stock` 时，「当前库存」指标的数字与商品卡片左色条改为对应警示色（橙/红）。

**消耗最多场景的数据约束：** `material_records` 表当前没有 `scene` 字段（出库申请功能已被回滚），本期该格位显示「暂无数据」占位。等出库申请功能回归并写入 scene 后，再接通该字段。

### 3.3 库存调整抽屉（详情页内）

「修改库存」按钮触发底部抽屉（`van-popup` position=bottom）：

| 字段 | 控件 | 校验 |
|---|---|---|
| 调整类型（必填） | 4 个 pill 单选：盘盈 / 盘亏 / 报废 / 丢失 | 必选 |
| 调整数量（必填） | 数字步进器 | 整数 ≥ 1；盘亏/报废/丢失时 `<= current_stock` |
| 调整原因（必填） | textarea | 非空，长度 ≥ 2 |
| 操作人 | 自动填当前用户名（只读展示） | — |

**底部预览**："调整后库存：current ± Δ = newValue"，背景色按调整方向（盘盈绿 / 其余橙）。

**提交流程：**
1. 前端预校验
2. 调用 `materialManager / adjustStock`
3. 成功：toast 「已提交」+ 关闭抽屉 + 刷新详情页所有数据
4. 失败：toast 错误信息，抽屉保留输入

## 4. 数据模型

**复用现有 `materials` + `material_records`**，仅新增字段：

### `materials` 集合

| 字段 | 类型 | 说明 |
|---|---|---|
| `last_purchase_price` | Number? | 最近一次入库的单价；首次为空 |

### `material_records` 集合

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | String | 扩展取值：`'in'` / `'out'` / `'adjust'`（新） |
| `adjust_type` | String? | 仅当 `type='adjust'` 时存在；取值 `'gain'`(盘盈) / `'loss'`(盘亏) / `'scrap'`(报废) / `'lost'`(丢失) |
| `adjust_reason` | String? | 仅当 `type='adjust'` 时存在 |

**调整对库存的影响：**
- `gain`：`stock += quantity`，记录写入 `quantity` 为正
- `loss` / `scrap` / `lost`：`stock -= quantity`，记录写入 `quantity` 为正（出库语义），由 `adjust_type` 表达方向

## 5. 云函数 action（全部加在 `cloudfunctions/materialManager/index.js`）

> **代码组织说明：** 项目近期回滚了 `materialManager` 的 handlers 模块拆分（见 commit `12225d7..`），当前云函数是单一 `index.js` + `helpers.js`，所有 action 通过 `switch (action)` 分发。本次新增 action **直接在 `index.js` 中加 `case` 分支**，与现有风格保持一致；不重新拆 handlers 目录（如未来再次重构再统一处理）。

### 5.1 新增 3 个 action

#### `getInventoryList`

**入参：** `{ status: 'all'|'warning'|'empty'|'normal', keyword?: string, category?: string, page: 1, pageSize: 20 }`

**返回：** `{ success, materials: [...], statusCounts: { all, warning, empty, normal }, total, page, pageSize }`

**实现要点：**
- 状态计数用 4 次 `count()` 并行（`Promise.all`）：`{}`（all），`stock <= min_stock 且 stock > 0`（warning），`stock = 0`（empty），`stock > min_stock`（normal）
- 列表数据按 `status` 过滤（用 `db.command.lte` / `eq` / `gt`），keyword 走 `db.RegExp`
- 每条 material 附带 `last_in_date` 与 `last_out_date`：在该 action 内对每个 material_id 跑 2 次 `material_records` 的 `orderBy('created_at','desc').limit(1)` 查询，并 `Promise.all` 并行（pageSize=20 可接受）。如未来发现性能问题，再在 `materials` 上冗余 `last_in_date` / `last_out_date` 字段并维护

#### `getInventoryDetail`

**入参：** `{ material_id }`

**返回：**
```
{
  success,
  material: { ...materials 字段, last_purchase_price },
  currentStock, minStock, last30dConsume,
  trend: [{ month: '2025-11', in: 80, out: 60 }, ...] // 最近 6 个月
  topArea: '3 楼办公区',  // 来自 material_records.usage_area Top 1
  topScene: null,          // 当前无数据来源，前端显示「暂无数据」
  monthlyAvg: 42,
  recentRecords: [{ type, adjust_type?, quantity, created_at }, ...] // 最近 3 条
}
```

**实现要点：**
- `last30dConsume`：聚合 `material_records` 中 `type='out'` 或 `(type='adjust' AND adjust_type IN ['loss','scrap','lost'])`，且 `created_at >= now - 30d`
- `trend`：6 个月（含当月）按月分组聚合 `in` 与 `out` 总量（云函数内 JS 分组即可，量可控）
- `topArea`：基于 `material_records.usage_area` 的出库次数（出库 + 出库类调整）排行第一；为空则返回空字符串
- `topScene`：返回 `null`，前端展示占位
- `monthlyAvg`：6 个月出库总量 / 6（向下取整）

#### `adjustStock`

**入参：** `{ material_id, adjust_type, quantity, reason }`

**权限：** 复用 `helpers.js` 的 `canManageMaterial(user)`（管理员 1 / 行政经理 2 / 仓管员 5）—— 与现有项目权限规则一致。详见 §6。

**返回：** `{ success, message?, error? }`

**实现：**
1. 校验 `adjust_type ∈ {gain, loss, scrap, lost}`、`quantity > 0`、`reason` 非空
2. 查 material 当前 stock
3. 若是出库类调整（loss/scrap/lost）且 `quantity > stock` → 拒绝并返回错误
4. 条件更新（乐观锁）：`db.collection('materials').where({ _id, stock: _.eq(currentStock) }).update({ stock: 新值, updated_at: now })`，受影响行数 = 0 视为冲突
5. 写一条 `material_records`：`type='adjust'`, `adjust_type`, `adjust_reason=reason`, `quantity`(正数), `operator`, `created_at`, `material_name`, `material_number`, `category`, `usage_area=material.usage_area`
6. 乐观锁失败时重试 1 次（再读 stock 再判断再写）；仍失败则返回 `{ success:false, error:'数据已更新，请刷新重试' }`

### 5.2 扩展现有 action

#### `stockIn`

入参增加可选 `unit_price?: Number`；当传入时同时更新 `materials.last_purchase_price`，并把 `unit_price` 写入 `material_records`（新字段，可选）。本期前端入库表单**不必改**（保持兼容），仅保留参数通道。`last_purchase_price` 字段没有迁移历史数据，老配件首次新入库后才有值，前端列表/详情显示「—」表示暂无。

### 5.3 路由注册

在 `cloudfunctions/materialManager/index.js` 的 `switch (action)` 中追加 3 个新 case：

```js
case 'getInventoryList':   /* ... */ break;
case 'getInventoryDetail': /* ... */ break;
case 'adjustStock':        /* ... */ break;
```

## 6. 权限矩阵

| 角色 | 进入库存查询 | 看详情 | 调整库存 |
|---|---|---|---|
| 1 管理员 | ✓ | ✓ | ✓ |
| 2 行政经理 | ✓ | ✓ | ✓ |
| 4 办美员工 | ✓ | ✓ | ✗ |
| 5 仓管员 | ✓ | ✓ | ✓ |
| 3 维修员 | ✗ | ✗ | — |

**实现：** 直接复用 `helpers.js` 已有的两个权限函数：
- `canAccessMaterial(user)` → 角色 1/2/4/5 均可进入库存查询和详情
- `canManageMaterial(user)` → 角色 1/2/5 可调整库存

详情页内通过 `canAdjust = canManageMaterial(user)` 标志控制底部固定栏（含「修改库存」按钮）的显示。办美员工进入详情页时不渲染底部固定栏，仅滚动内容区。

**为什么经理可调整：** 与项目当前的 `canManageMaterial` 规则保持一致（管理员 1 / 经理 2 / 仓管 5），避免在本模块引入与其他 material 操作不同的权限逻辑。如未来业务上要求收紧到「仅仓管员能调整」，可单独定义 `canAdjustStock(user)` 函数，本期不做。

## 7. 趋势图技术

- 复用 `miniprogram/components/ec-canvas`（项目已有 ECharts 集成）
- 图表类型：分组柱状图，x 轴 `['10月','11月','12月','1月','2月','3月']`（动态生成），series 两条 `入库`/`出库`
- Tab 切换不触发重绘——两条 series 一直在，Tab 仅控制视觉高亮（其中一条变浅 `#1677FF25`）

## 8. 错误处理与边界

| 场景 | 行为 |
|---|---|
| 网络异常 | `cloudCall.js` 统一拦截 → toast |
| 调整数量超过库存 | 前端预校验 + 云端拒绝 + toast 「库存不足」 |
| 并发调整冲突 | 乐观锁失败 → 自动重试 1 次 → 仍失败时 toast 「数据已更新，请刷新重试」 |
| 列表空 | 显示空态插画 + 文案 |
| 流转记录空 | 显示「暂无记录」占位（沿用项目空状态样式） |
| 趋势数据空 | 趋势卡显示「暂无数据」占位，不显示空 chart |
| 用户无访问权限 | onLoad 直接 toast 「无权限访问」+ 1.5s 后 `wx.navigateBack` |

## 9. UI 风格规范

参考 Pencil `AkohR` 节点：

- **主色**：`#1677FF`（蓝）
- **状态色**：预警 `#FF9500`（橙）/ 缺货 `#FF4D4F`（红）/ 正常 `#1A1A1A` 或 `#1677FF`
- **背景色**：页面底色 `#F5F6F8`，卡片 `#FFFFFF`
- **圆角**：大卡 14px / 小卡 10px / Tab 8px / pill 16px
- **阴影**：`0 2px 8px #0000000A`（极浅）
- **字体**：中文 Inter / 大数字 DM Mono / 大数字 22px 600 weight letterSpacing -1
- **间距**：卡片间 12px / 内 padding 14-16px

## 10. 实施清单（高层）

> 详细任务拆分将由 writing-plans 阶段输出。

**后端：**
- [ ] `materialManager/index.js` 直接新增 3 个 case 分支：`getInventoryList` / `getInventoryDetail` / `adjustStock`（不重新拆 handlers 目录，与现有结构对齐）
- [ ] `materialManager/index.js` 扩展现有 `stockIn` case 接收 `unit_price`，写入 `materials.last_purchase_price` + `material_records.unit_price`
- [ ] 数据库字段：`materials.last_purchase_price` / `material_records.adjust_type` / `material_records.adjust_reason` / `material_records.unit_price` 均为新增可选字段，**不需要历史数据迁移**（新写入时填充，老数据为空时前端显示「—」）

**前端：**
- [ ] `miniprogram/services/materialService.js` 增 3 个调用封装
- [ ] `miniprogram/pages/material/inventory/{index.js,wxml,wxss,json}` 新建列表页
- [ ] `miniprogram/pages/material/inventory-detail/{index.js,wxml,wxss,json}` 新建详情页
- [ ] 详情页内嵌调整抽屉（同一文件，不独立子组件除非复杂度超过单文件 200 行）
- [ ] `miniprogram/pages/home/index.js` 接通「库存查询」按钮跳转
- [ ] `miniprogram/app.json` 注册 2 条路由

**部署：**
- [ ] 微信开发者工具部署 `materialManager` 云函数
- [ ] 前端在工具内重新编译；如新引入 ec-canvas 子组件需「构建 npm」

## 11. 自检清单（实施完后）

- 管理员：列表 4 状态筛选正确；调整盘亏 5 包后库存数字 -5；流转记录显示新条目
- 仓管员：能调整；列表过滤、详情完整可见
- 行政经理：能进入查询、看详情；详情页**显示**「修改库存」按钮（与 §6 矩阵一致，沿用 `canManageMaterial` 包含角色 2）
- 办美员工：能进入；详情页**不显示**「修改库存」按钮
- 维修员：从首页耗品 Tab 进不来（沿用现有规则）
- 状态计数 badge 与列表实际数据一致
- 切换状态时 ec-canvas 重渲染不闪烁
- 调整后趋势图 / 30 日消耗 / 最近流转记录全部刷新
