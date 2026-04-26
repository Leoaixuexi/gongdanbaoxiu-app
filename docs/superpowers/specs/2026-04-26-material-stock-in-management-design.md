# 耗品入库管理设计

**日期**：2026-04-26
**模块**：耗品管理 / 入库
**状态**：Spec 草案，待用户最终审阅

---

## 1. 背景与需求

现有 `pages/material/index` 已有 3 个 Tab — **配件列表 / 入库记录 / 出库记录**，云函数 `materialManager` 已实现 `listMaterials / addMaterial / stockIn / stockOut / listRecords` 等核心 action。当前"入库"是通过列表内"加号 → 弹窗"输入数量完成。

新需求：

- 重组中间 Tab 为"入库管理"，内部含两个子页 **入库记录** + **分类管理**
- 入库记录子页右下角浮 FAB ➕，点击弹 ActionSheet 两项：**扫码入库**（库内已有商品的快捷入库）/ **新品入库**（首次登记新配件）
- 两个按钮跳到不同界面
- "分类管理"是新品入库表单中"商品分类"下拉的字典维护页

## 2. 设计决策

| 决策点 | 选择 | 备选 | 选择原因 |
|---|---|---|---|
| 落点 | 在 `pages/material/index` 内改造 Tab2 | 新建独立页面 / 重构整个 material 为 consumable | 改动最小，导航不变，复用既有云函数 |
| 扫码入库目的页 | 轻量补单（仅数量+备注） | 复用 detail 页弹窗 / 完整表单 | 一屏一动作，最快 |
| 扫不到编号的处理 | modal "未登记" | 自动跳新品入库 | 避免误触把扫码错误带入新品流程 |
| 分类管理数据 | 复用 `dictionaryManager` + 新字典 key `material_category` | 新建独立 collection | 项目已有完整字典系统 |
| 分类编辑权限 | `canManageMaterial`（管理员/行政经理/办美员工） | 仅管理员 | 不必让经理/办美进 admin 后台才能管自己模块 |
| 重命名分类 | **不级联** `materials.category` 字段 | 用 transaction 级联 | 既有商品保留旧名，避免历史污染；规避并发风险 |
| 新品入库表单 | 复用现有 `pages/material/add` | 新建一份 | add 页字段已完整 |
| 入口 | 首页 Tab2 耗品宫格"入库管理" | material/index 顶部 | 与首页耗品语义一致 |
| FAB 样式 | 右下角浮起圆按钮 + ActionSheet | 顶部 + 号 / 内联两按钮 | 标准 mobile pattern，路径短 |
| 维修员权限 | 完全看不到耗品管理 UI | 仅看入库记录 | 简化权限模型；维修员"完成维修"时云端扣库存路径独立 |

## 3. 架构

```
首页 Tab2 耗品 → 宫格"入库管理"
       ▼
pages/material/index?tab=1
├── Tab1 配件列表        ← 不动
├── Tab2 入库管理（改造）
│   ├── sub-tab[0] 入库记录    ← 现有逻辑保留
│   │   └── FAB ➕（仅 canManageMaterial 可见）
│   │        └─ wx.showActionSheet
│   │             ├── "扫码入库"
│   │             │     ├ wx.scanCode → 取 result（material_number）
│   │             │     ├ materialManager.getMaterialByNumber
│   │             │     ├ 命中 → /pages/material/stock-in-form?material_id=&...
│   │             │     └ 未命中 → wx.showModal "未登记"
│   │             └── "新品入库" → /pages/material/add
│   └── sub-tab[1] 分类管理（新建子页）
│        └── dictionaryManager (key='material_category') CRUD
└── Tab3 出库记录        ← 不动
```

## 4. 组件清单

### 4.1 前端

| 文件 | 操作 | 主要内容 |
|------|------|----------|
| `miniprogram/pages/material/index.{js,wxml,wxss,json}` | 改造 | tabs 文案改为 `['配件列表','入库管理','出库记录']`；Tab2 内嵌 segmented sub-tabs（入库记录/分类管理）+ swiper；FAB（仅 canManageMaterial 角色 = 1/2/4 可见）；移除既有 `showStockIn` 弹窗 logic；onLoad 支持 `?tab=&sub=` query；权限校验去掉维修员 |
| `miniprogram/pages/material/stock-in-form/` | 新建 | 路径 `/pages/material/stock-in-form/index`；query 入参 `material_id, material_name, material_number, current_stock, unit, spec`；表单 2 字段（数量必填整数 1–999999、备注 ≤100 字）；提交调 materialService.stockIn → navigateBack |
| `miniprogram/pages/material/add/` | 微改 | "分类"下拉源由硬编码改为 `await dictionary.getOptions('material_category')`；onShow `fresh:true` 拉新 |
| `miniprogram/services/materialService.js` | +1 方法 | `getMaterialByNumber(material_number)` → 调云函数同名 action |
| `miniprogram/services/dictionary.js` | 不动 | 已有 getOptions / refreshCache |

### 4.2 云函数

| 文件 | 操作 | 主要内容 |
|------|------|----------|
| `cloudfunctions/materialManager/index.js` | +1 case | `getMaterialByNumber`：入参 `{material_number}`，出 `{success, material\|null}`；权限 = `canAccessMaterial`（任何能看耗品的人） |
| `cloudfunctions/materialManager/helpers.js` | 微改 | `canAccessMaterial` 移除维修员（role_id=3）；`canManageMaterial` 不动（已不含维修员） |
| `cloudfunctions/dictionaryManager/index.js` | 改权限分支 | 在 adminActions 校验前加例外：`material_category` 字典的 create/update/delete 由 canManageMaterial 通过即可。在该云函数内**复制一份** role_id 判断（不引 materialManager 的 helpers，保持云函数解耦） |

### 4.3 数据集合

| collection | 是否新建 | 字段变更 |
|-----------|---------|----------|
| `materials` | 既有 | 无字段变更 |
| `material_records` | 既有 | 无字段变更 |
| `dictionaries` | 既有 | 新增一条 `dict_key='material_category'`（首次进分类管理时由前端自动 seed） |

## 5. 数据流

### 5.1 扫码入库（最长链路）

```
首页 → 入库管理子页 0 入库记录 → tap FAB → ActionSheet "扫码入库"
  → wx.scanCode({scanType:['qrCode','barCode']}) → result
  → materialService.getMaterialByNumber(result)
       → cloudFn materialManager.getMaterialByNumber
       → db.collection('materials').where({material_number:result}).get()
  ┌─ found
  │   wx.navigateTo('/pages/material/stock-in-form?material_id=...&name=...&...')
  │   用户填数量+备注 → 确认按钮 → materialService.stockIn
  │     → cloudFn materialManager.stockIn
  │     → materials.update({stock: _.inc(qty)}) + material_records.add(type:'in')
  │   wx.navigateBack() → material/index Tab2 入库记录子页 onShow → reload page 1
  │   新记录顶部出现 ✓
  └─ not found
      wx.showModal({title:'未找到', content:'编号「XXX」未登记，请先去新品入库', showCancel:false})
      留在入库记录子页 ✓
```

### 5.2 新品入库

```
FAB → ActionSheet "新品入库" → wx.navigateTo('/pages/material/add')
  现有 add 页表单（编号/名称/分类/规格/型号/初始库存/最低库存/图片/备注/...）
    "分类"下拉源原本：data.categories = ['电气','水暖','门窗','消防','通用']  ← 硬编码
    改造后：onLoad 调 dictionary.getOptions('material_category')
            → setData 一个 {value, label} 数组
            → picker 渲染 label，选择后存 form.category = label（保持既有 string schema）
  提交 → materialService.addMaterial → 既有 cloudFn addMaterial
    （quantity>0 时云端自动写一条 material_records type='in'）
  navigateBack → material/index onShow 刷 Tab1 配件列表 + Tab2 入库记录
```

### 5.3 分类管理 CRUD

```
Tab2 入库管理 → 切到 sub-tab[1] 分类管理 → onShow
  → dictionaryManager.get({dict_key:'material_category', include_disabled:true})
       ┌─ success → 渲染 items 列表
       └─ error "字典 material_category 不存在"
            → dictionaryManager.create({dict_key, dict_name:'物料分类', items: <12 项默认>})
            → toast "已创建默认分类"
            → 重新 get → 渲染
  → 列表项：value/label + 编辑/删除按钮（仅 canManageMaterial 可见）

新增：tap"新增" → input dialog → label 重名校验
  → dictionaryManager.update(items: [...old, {value, label, sort, enabled:true}])
  → dictionary.refreshCache('material_category') → 重拉

重命名：tap"编辑" → input dialog 预填
  → 改 items[i].label → dictionaryManager.update → refreshCache
  → **不级联** materials.category（既有商品保留旧名）

删除（软删）：tap"删除" → 二次确认
  → items[i].enabled = false → dictionaryManager.update → refreshCache
  → 列表 / 下拉自动隐藏
```

### 5.4 跨页通讯

| 来源 | 目的页 | 机制 |
|------|--------|------|
| stock-in-form 提交成功后 navigateBack | material/index Tab2 入库记录 | 原页 `onShow` 强制 reload page 1 |
| material/add 提交成功 | material/index | 同 onShow reload；Tab1 配件列表 + Tab2 入库记录 |
| 分类管理改完 | material/add（用户下次进） | 提交后 `dictionary.refreshCache('material_category')`，add 页 `onShow` `fresh:true` |

### 5.5 默认 seed 分类（12 项）

首次进分类管理子页且 `material_category` 字典不存在时，前端自动 create：

```
['电气', '水暖', '门窗', '消防', '清洁', '五金',
 '滤芯类', '轴承类', '密封类', '管路类', '油漆涂料', '通用']
```

每项 `{value=label, sort=index, enabled:true}`。

## 6. 错误处理

### 6.1 网络与服务端

| 操作 | 错误情况 | 处理 |
|------|----------|------|
| `getMaterialByNumber` 失败 | 网络抖 | toast "网络错误，请重试"；留原页 |
| `stockIn` 失败 | 库存校验 / 商品被删 | toast 服务端 error；按钮恢复可点；若错误是"配件不存在" → navigateBack + 列表刷新 |
| `dictionaryManager.get` 失败 | 网络 | 分类管理页空态 + "加载失败，点击重试"按钮 |
| `dictionaryManager.update` 失败 | 网络/权限 | toast；本地状态回滚 |

### 6.2 扫码

| 情况 | 处理 |
|------|------|
| 用户取消扫码 | 静默返回 |
| 扫码失败 / 坏码 | toast "扫码失败，请重试" |
| 扫到编号库内查无 | wx.showModal "未登记" |
| 扫码成功 → 填数量期间商品被删 | stockIn 返回"配件不存在" → toast + navigateBack |

### 6.3 表单校验

| 字段 | 规则 | 反馈 |
|------|------|------|
| stock-in-form 数量 | 必填、整数、≥1、≤999999 | input type=number；按钮 disabled；提交前再 toast 兜底 |
| stock-in-form 备注 | 选填、≤100 字 | maxlength |
| 提交按钮防抖 | loading + disabled | 失败/成功后才恢复 |

### 6.4 分类管理边界

| 情况 | 处理 |
|------|------|
| 字典首次不存在 | 自动 seed 12 项 + toast |
| seed 失败（断网） | 空态 + 重试按钮 |
| 新增重名 | toast "该分类已存在"（按 label 去重） |
| 删除最后一个 | 允许；toast 提醒 |
| 重命名 | 不级联 `materials.category` |
| 并发编辑（A 加 X 同时 B 加 Y） | **不做乐观锁**；耗品小团队场景，"后写覆盖"风险已知；写入"已知局限" |

### 6.5 权限与误进

| 情况 | 处理 |
|------|------|
| 维修员 navigateTo material/index | onLoad 校验 → toast "无权限访问" → 1.5s 后 navigateBack |
| 非 canManageMaterial 进入 Tab2 | FAB 隐藏 + 分类管理子页隐藏（subTabs 数组动态过滤为只剩 ['入库记录']） |
| 硬刷 url 进 stock-in-form 缺参 | onLoad 检测 material_id → toast + navigateBack |

## 7. 验证清单

### 7.1 路径回归（按角色）

**管理员（role_id=1）/ 行政经理（2）/ 办美员工（4）**：
- [ ] 首页 Tab2 → 宫格"入库管理" → 跳转到 material/index Tab2 入库管理
- [ ] FAB ➕ → ActionSheet 两项可见
- [ ] 扫码已有商品 → stock-in-form → 提交 → 列表顶部新记录、stock 正确累加
- [ ] 扫码不存在编号 → modal "未登记"
- [ ] 取消扫码 → 静默返回
- [ ] 新品入库 → add 页 → 分类下拉 12 项 → 提交
- [ ] 切到分类管理 → 12 项默认分类
- [ ] 增/改/删（软删）一项 → add 页刷新后下拉同步

**维修员（role_id=3）**：
- [ ] 首页看不到 Tab2 耗品（既有 isMaintenanceWorker 控制）
- [ ] 直接 navigateTo `/pages/material/index` → toast "无权限访问" → 退回
- [ ] 工单 completeRepair → 仍能扣库存（独立路径）

### 7.2 数据正确性

入库提交后：
- `materials` 对应记录：`stock` 自增、`updated_at` 刷新
- `material_records` 新增一条：`type='in'` 等字段对齐

字典更新后：
- `dictionaries` `dict_key='material_category'` items 数组按预期变动
- `enabled=false` 项不在 `getOptions` 返回里

### 7.3 回归非耗品模块

- [ ] 工单提报/编辑/详情 不受影响
- [ ] admin/dict 后台仍能管理 material_category（管理员）
- [ ] 既有 material_records / materials 数据 显示无异常

## 8. 已知局限

- 分类**重命名不级联**：既有商品 `materials.category` 字段保留旧名。前端展示按字段值即可；如未来需统一，单独迁移脚本处理
- 字典**软删**而非硬删：items[i].enabled=false 保留历史项；DB 大小不显著影响
- 分类编辑**不做乐观锁**：耗品小团队并发风险低；"后写覆盖前写"已知；如未来出现冲突，再加 expected_updated_at 校验
- `canManageMaterial` 判断在 dictionaryManager 里**复制一份**而非共享 require：保持云函数间解耦，2-3 行 role_id 检查重复可接受

## 9. 未做

- 出库相关任何改动（Tab3 出库记录不动）
- 数据分析模块对耗品的统计（不在本期）
- 入库批量操作（一次扫多个 / Excel 导入）
- 二维码生成功能（假定二维码已在物理标签上贴好，由其它流程产出，本期仅消费）
- 分类的图标 / 颜色字段（首版仅 label，未来需要再加 icon 字段不破坏兼容）

---

## 附录 A — 影响文件清单

```
新建：
  miniprogram/pages/material/stock-in-form/index.{js,wxml,wxss,json}    (4 文件)

改造：
  miniprogram/pages/material/index.{js,wxml,wxss,json}                  (Tab2 改造 + FAB + 子页)
  miniprogram/pages/material/add/index.js                               (分类下拉源)
  miniprogram/services/materialService.js                               (+ getMaterialByNumber)
  miniprogram/app.json                                                  (+ stock-in-form 路径)
  cloudfunctions/materialManager/index.js                               (+ getMaterialByNumber action)
  cloudfunctions/materialManager/helpers.js                             (canAccessMaterial 移除维修员)
  cloudfunctions/dictionaryManager/index.js                             (material_category 权限例外)
```

## 附录 B — 角色权限对照

| 操作 | 管理员(1) | 行政经理(2) | 维修员(3) | 办美员工(4) |
|------|:---:|:---:|:---:|:---:|
| 进入耗品管理模块 | ✓ | ✓ | ✗ | ✓ |
| 看入库记录 | ✓ | ✓ | — | ✓ |
| 扫码入库 | ✓ | ✓ | — | ✓ |
| 新品入库 | ✓ | ✓ | — | ✓ |
| 分类管理 CRUD | ✓ | ✓ | — | ✓ |
| 工单完成时扣库存 | ✓ | — | ✓（独立路径） | — |
