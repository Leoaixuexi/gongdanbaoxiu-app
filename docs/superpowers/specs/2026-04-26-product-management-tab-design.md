# 入库管理页：商品管理 Tab + 直接扫码 + Modal 入库 + 位置字段

**日期**：2026-04-26
**模块**：耗品管理 / 入库（在 2026-04-26 拆分独立页之上叠加）
**状态**：Spec 草案，待用户最终审阅

---

## 1. 背景与需求

`pages/material/stock-in/`（独立的入库管理页）已落地，含 sub-tabs **入库记录 / 分类管理** + 右下角 FAB。FAB 当前行为：tap → wx.showActionSheet 选"扫码入库 / 新品入库" → 扫码后跳 stock-in-form 独立页填数量+备注 → stockIn。

新需求要把入库流程进一步收敛为「扫一次」：

- **新增 sub-tab "商品管理"** —— 独立页内含三个 sub-tab：入库记录 / 商品管理 / 分类管理。商品管理 = 全 CRUD（与 `pages/material/index` Tab0 配件列表数据互通，UI 共享）
- **FAB 改为直接扫码** —— 取消 ActionSheet 二次选择
- **扫码识别 → 弹底部 Modal** —— Modal 内 `数量 + 位置 + 备注` 三字段一屏完成；不再跳独立页（`pages/material/stock-in-form/` 删除）
- **扫码不识别 → 引导去商品管理添加** —— Modal 双按钮"取消 / 立即添加"；点立即添加自动切到商品管理 sub-tab + 跳 `pages/material/add`，扫到的编号 prefill 进 form.material_number
- **位置字段** —— 新建 `material_location` 字典；Modal 中位置 picker，默认 = `material.usage_area`，用户可改；提交时**仅写入 material_records.usage_area**，不修改 material 表

## 2. 设计决策

| 决策点 | 选择 | 备选 | 选择原因 |
|---|---|---|---|
| 商品管理 tab 范围 | **L3 全 CRUD**（列表+搜索+筛选+新增+编辑+删除） | L1 仅"新增商品"按钮 / L2 列表+新增 | 用户希望"商品管理"是真正的管理页，不只是入口 |
| 商品管理 与 material/index Tab0 关系 | **保留双入口**，UI 用同一个组件共享 | 合并（删 material/index Tab0） | 工单维修语境下"物料管理"宫格仍需要看商品库；component 抽象避免双重维护 |
| 扫码后呈现形式 | **底部 Modal**（在 stock-in 页内联） | 跳独立页（保留 stock-in-form） | 与"自动弹出"语义吻合；减少页面切换；3-4 字段够用 |
| 旧 stock-in-form 页 | **删除**（4 文件 + app.json 路径条目） | 保留备用 | 不再被任何入口引用，YAGNI |
| 扫码不识别 UI | **modal 双按钮 → 立即添加 prefill 编号** | modal 单按钮 / toast | 一步直达，少跳一次心智负担 |
| 位置语义 | **C：默认 = material.usage_area，可改 → 仅写 material_records** | A 不预填 / B 同步更新 material | 历史位置不丢，体验最优 |
| 位置数据来源 | **b：字典 material_location**（首次自动 seed 6 项） | a 自由输入 / c 复用 floor 字典 | 受控值便于后续筛选/统计；与 material_category 同模式 |
| FAB 行为 | **直接 wx.scanCode** | 保留 ActionSheet | 用户明确要求「点击就是扫码」 |
| sub-tab 顺序 | **入库记录 / 商品管理 / 分类管理** | 商品管理在第 1 位 | 入库是最高频操作，放第一位 |
| material-list 组件抽象 | **高内聚**（搜索/筛选/分页/CRUD 全在组件内） | 受控组件（状态在 page） | 避免两个 page 重复实现搜索筛选逻辑 |
| 删除商品 | **乐观 UI**（先移除再调 cloud，失败回滚） | loading 等云端确认 | 体验更顺，失败回滚极端情况已知 |
| 卡片操作菜单 | **卡片右上角 ⋯ + ActionSheet** | 右滑/长按 | 标准 mobile pattern，可发现性最好 |
| 位置 picker 默认值 fallback | material.usage_area 不在字典中时 → **fallback 字典首项** | fallback 空（强制用户选） | 少一步 tap |

## 3. 架构

```
首页 Tab2 耗品管理 → 宫格"入库管理"
       ▼
pages/material/stock-in/index
   ├ sub-tab[0] 入库记录                                 ← 现有
   │  └ FAB ➕ → wx.scanCode（直接，不再 ActionSheet）
   │       ├ 扫到识别 → loadLocationOptions（首次 seed）
   │       │             → 底部弹 Modal（商品信息只读 + 数量 + 位置picker + 备注）
   │       │             → 提交 → cloudFn stockIn(material_id, qty, remark, location)
   │       │             → 关 modal + 重拉入库记录第 1 页
   │       └ 扫不识别 → wx.showModal 双按钮"取消 / 立即添加"
   │                     → 立即添加：setData activeSubTab=1
   │                                 + navigateTo /pages/material/add?material_number=XXX
   ├ sub-tab[1] 商品管理（新建）                         ← 含 <material-list canManage>
   │  ├ 搜索栏 + 状态筛选（全部/预警/缺货）
   │  ├ 卡片列表（点击进 detail 页 + 右上 ⋯ → ActionSheet "编辑/删除"）
   │  └ 顶部"新增商品" → /pages/material/add（无 prefill）
   └ sub-tab[2] 分类管理                                 ← 现有，不动

pages/material/index                                     ← 不变
   ├ sub-tab[0] 配件列表                                 ← 改用 <material-list canManage>
   └ sub-tab[1] 出库记录                                 ← 不动

pages/material/stock-in-form/                            ← 删除（被 modal 替代）

新增字典 material_location（首次扫码自动 seed 6 项）
新增组件 components/material-list/                       ← stock-in + material/index 共用
```

## 4. 组件清单

### 4.1 前端

#### A. 新建：`components/material-list/`（4 文件）

| properties | 类型 | 说明 |
|---|---|---|
| `canManage` | Boolean | 控制编辑/删除/新增按钮显隐 |

| triggerEvent | 时机 | detail |
|---|---|---|
| `itemtap` | 卡片整体 tap | `{ material }` |
| `additem` | 顶部"新增商品"按钮 tap | `{}`（父页决定是否带 prefill） |

**内部状态**：keyword、materialFilter、materials、loading、loadingMore、page、total。

**内部方法**：
- `loadMaterials(append=false)` — 调 `materialService.listMaterials`
- `applyFilter()` — 全部/预警/缺货 状态筛选
- `onSearchChange / onSearch / onLoadMore`
- `onCardTap(e)` → triggerEvent('itemtap')
- `onCardMenuTap(e)` → wx.showActionSheet ['编辑','删除']
  - tapIndex 0 → 自己内部 wx.navigateTo edit
  - tapIndex 1 → wx.showModal 二次确认 → optimisticDelete
- `optimisticDelete(material_id)` — 先移除再调 cloud，失败回滚
- `onAddTap()` → triggerEvent('additem')
- `reload()` — 暴露给父页 onShow 调用

**WXML**：搜索栏 / 状态筛选 / 卡片 / 卡片菜单图标 / 顶部"新增商品"按钮（仅 canManage）

**依赖**：services/materialService（listMaterials、deleteMaterial）

#### B. 改造：`pages/material/stock-in/index.{js,wxml,wxss,json}`

**data 新增字段**：
```js
subTabs: ['入库记录', '商品管理', '分类管理'],   // 长度从 2 → 3
showStockInModal: false,
scannedMaterial: null,            // {material_id, name, material_number, stock, unit, spec, images, usage_area}
modalQuantity: '',
modalLocation: '',
modalRemark: '',
modalSubmitting: false,
locationOptions: [],              // [{value, label}]
locationIndex: 0,                 // picker 选中索引
```

**新增方法**：
- `directScan()` — 替代 onFabTap：直接 wx.scanCode → service.getMaterialByNumber → 命中 openStockInModal / 不命中 showAddPrompt
- `loadLocationOptions()` — 首次自动 seed material_location 字典；缓存 _locationLoaded 标志
- `seedLocations()` — 调 dictionaryAdmin.createDictionary，6 项默认
- `openStockInModal(material)` — 设置 scannedMaterial、locationIndex（按 material.usage_area 匹配，找不到 fallback 0）、showStockInModal=true
- `showAddPrompt(code)` — wx.showModal 双按钮，确认 → setData activeSubTab=1 + navigateTo add 带 material_number prefill
- `closeStockInModal()` — setData showStockInModal=false（清空表单字段）
- `onModalQuantityInput / onModalRemarkInput / onModalLocationChange`
- `submitStockIn()` — 校验 → service.stockIn(id, qty, remark, location) → 成功关 modal + reload 入库记录 / 失败 toast 保持 modal

**移除方法**：`onFabTap` / `scanAndStockIn`（合并到 directScan）

**WXML**：
- 顶部 sub-tabs（数组多一项"商品管理"）
- sub-tab 1（商品管理）渲染 `<material-list canManage="{{canManage}}" id="materialList" bind:itemtap="onMaterialTap" bind:additem="onAddMaterialTap" />`
- 新增 modal 浮层（van-popup position="bottom"，含商品图片+名称+编号+库存只读 + 数量 input + 位置 picker + 备注 textarea + 取消/确认按钮）
- FAB bindtap 改为 `directScan`

**WXSS**：
- modal 内部样式（参考既有 stock-in-form/index.wxss 复制 info-card / form-card / footer 样式）
- 商品管理 sub-tab 顶部"新增商品"按钮在组件内部，page 不需要加样式

**事件 handler 在 page**：
```js
onMaterialTap(e) { wx.navigateTo({ url: `/pages/material/detail/index?id=${e.detail.material.material_id}` }); }
onAddMaterialTap() { wx.navigateTo({ url: '/pages/material/add/index' }); }
```

**onShow 增强**：
```js
onShow() {
  // 现有逻辑保留
  // 新增：reload material-list 组件（如果已挂载）
  if (this.data.activeSubTab === 1) {
    const list = this.selectComponent('#materialList');
    if (list) list.reload();
  }
}
```

#### C. 改造：`pages/material/index.{js,wxml,wxss}`

**Tab0 配件列表**：
- WXML 整段卡片列表（约 60 行）替换为 `<material-list canManage="{{canManage}}" id="materialList" bind:itemtap="onMaterialTap" bind:additem="onAddMaterialTap" />`
- JS 移除 keyword / materials / filteredMaterials / materialFilter / loadMaterials / onSearchChange / onSearch / onLoadMore / onMaterialFilterChange / _applyMaterialFilter / goToDetail / onMaterialScroll / scrollToTop（这些都搬进组件）
- 保留 onLoad（权限校验）/ onShow（加 reload material-list）/ Tab 切换 / Tab1 出库记录全套
- WXSS 移除已迁移到组件的样式（保留 modal、tab、出库 ... 相关样式）
- FAB 仍保留（仅 activeTab=0 显示），bindtap 改为父页方法 `onAddMaterialTap`（与组件 additem 等价）

**Tab1 出库记录**：不动

#### D. 改造：`pages/material/add/index.js`

**onLoad 接收 query.material_number**：
```js
onLoad(query = {}) {
  // 现有权限校验保留
  // 现有 dictionary loadCategories 保留
  if (query.material_number) {
    this.setData({ 'form.material_number': decodeURIComponent(query.material_number) });
  }
}
```

#### E. 删除：`pages/material/stock-in-form/`

- 4 文件（index.js / wxml / wxss / json）
- `app.json` `pages` 数组移除 `pages/material/stock-in-form/index`

### 4.2 服务层

#### F. `services/materialService.js`

`stockIn` 函数签名扩展：

```js
const stockIn = async (material_id, quantity, remark = '', location = '') => {
  return callCloud('materialManager', {
    action: 'stockIn',
    data: { material_id, quantity, remark, location }
  }, { loadingText: '入库中...' });
};
```

向后兼容：老调用方不传 location 时云端 fallback 到 material.usage_area。

### 4.3 云函数

#### G. `cloudfunctions/materialManager/index.js` `stockIn` case

入参解构添加 `location`，写入 material_records 时优先使用 location：

```js
case 'stockIn': {
  if (!canManageMaterial(user)) return { success: false, error: '无权限执行入库操作' };
  const { material_id, quantity, remark = '', location = '' } = data;
  // ...既有校验...
  const material = materials[0];
  // ...既有 stock 增加...
  await db.collection('material_records').add({
    data: {
      // ...其它字段...
      usage_area: location || material.usage_area || '',  // ← 改这一行（之前直接 material.usage_area）
      // ...
    }
  });
}
```

#### H. `cloudfunctions/dictionaryManager/index.js` 权限例外加 material_location

将 isMaterialCategory 判断扩展为白名单：

```js
const isManageMaterialDict = data && (data.dict_key === 'material_category' || data.dict_key === 'material_location');
const allowed = isAdminUser || (isManageMaterialDict && canManageMaterial);
```

### 4.4 字典

#### I. `dictionaries.material_location`

首次扫码触发，前端自动 create：

```js
const DEFAULT_LOCATIONS = ['主仓库', '应急储备', '工程仓', '办公耗材区', '外采暂存', '其它'];
```

每项 `{value=label, sort:idx, enabled:true}`。dict_name='物料位置'，description='入库时的位置选项'。

## 5. 数据流

### 5.1 扫码入库（Modal 流程）

```
stock-in 页 入库记录 sub-tab → tap FAB ➕
  → wx.scanCode → result
  ┌─ found
  │   await loadLocationOptions()      // 首次 seed
  │   openStockInModal(material)
  │     → setData scannedMaterial、modalLocation=material.usage_area、locationIndex 匹配字典或 fallback 0
  │     → showStockInModal=true
  │   用户填数量 / 改位置 / 填备注
  │   tap 确认 → submitStockIn()
  │     → 校验 quantity 1-999999 + location 非空
  │     → modalSubmitting=true
  │     → service.stockIn(material_id, qty, remark, location)
  │       → cloudFn stockIn:
  │         materials.update({stock: _.inc(qty)})    // 不改 usage_area
  │         material_records.add({type:'in', quantity, usage_area: location || material.usage_area, ...})
  │     成功 → toast "入库成功" + closeStockInModal() + 重拉入库记录第 1 页
  │     失败 → toast 错误 + modalSubmitting=false（保持 modal 让用户重试）
  │            "配件不存在" → 1.2s 后 closeStockInModal() + reload
  └─ not found
      wx.showModal({title:'未识别', content:`编号「${code}」未登记，是否去商品管理添加？`, cancelText:'取消', confirmText:'立即添加'})
        confirm → setData activeSubTab=1
                  + wx.navigateTo /pages/material/add?material_number=XXX
```

### 5.2 商品管理 sub-tab CRUD

```
切到 sub-tab[1] → <material-list> 组件 onAttached → loadMaterials()
  搜索/筛选/分页/下拉刷新：组件自处理，不通知父页
  tap 卡片 → triggerEvent('itemtap', {material}) → 父页 wx.navigateTo detail
  tap 卡片右上 ⋯ → wx.showActionSheet ['编辑','删除']
    编辑 → wx.navigateTo /pages/material/edit/index?id=...
    删除 → wx.showModal 二次确认 → optimisticDelete:
       1. setData materials = materials.filter(m => m.material_id !== id)  // 先移除
       2. service.deleteMaterial(id)
       3. 失败 → setData materials = prev + toast 错误
  tap 顶部"新增商品" → triggerEvent('additem') → 父页 wx.navigateTo add（无 prefill）

父页 onShow（从 detail/edit/add 返回）：
  selectComponent('#materialList').reload()
```

### 5.3 跨页通讯

| 来源 | 目的页 | 机制 |
|------|--------|------|
| add 提交 → navigateBack | stock-in 父页 onShow | 商品管理 sub-tab reload + 入库记录 sub-tab 第 1 页刷新 |
| detail/edit 改完 → navigateBack | stock-in 商品管理 sub-tab | 父页 onShow → reload |
| modal 提交成功 | 入库记录 sub-tab | 不切页，setData 重拉第 1 页 |
| material/index Tab0 与 stock-in 商品管理 | 双向同步 | 同一份数据，操作即时同步（在哪里删/编辑，对方下次 onShow 都能看到） |

### 5.4 字典缓存

material_location 复用 `services/dictionary.js` 的 5 分钟内存缓存。stock-in 页 `_locationLoaded` 标志避免每次扫码都重新 fetch。

## 6. 错误处理

### 6.1 扫码

| 情况 | 处理 |
|------|------|
| 用户取消 | 静默 |
| 扫码失败/坏码 | toast "扫码失败，请重试" |
| 编号未识别 | wx.showModal 双按钮 → 立即添加 |
| 扫到后 loadLocationOptions 失败 | toast "位置数据加载失败"，不弹 modal |
| Modal 内提交时商品被删 | stockIn 返回"配件不存在" → toast + 关 modal + reload |

### 6.2 Modal 表单校验

| 字段 | 规则 | 反馈 |
|------|------|------|
| 数量 | 必填、整数、1-999999 | 按钮 disabled；toast 兜底 |
| 位置 | 必填、字典中存在 | picker 默认 = material.usage_area 或字典首项；提交前空校验 |
| 备注 | 选填、≤100 字 | maxlength |
| 防抖 | submitting=true → button loading + disabled | 失败/成功后恢复 |

### 6.3 网络与服务端

| 操作 | 错误 | 处理 |
|------|------|------|
| getMaterialByNumber 失败 | 网络 | toast |
| stockIn 失败 | 校验/transaction | toast 服务端 error；submitting=false |
| listMaterials 失败 | 网络 | 组件空态 + 重试按钮 |
| deleteMaterial 失败 | 引用约束 | toast 错误 + 本地状态回滚 |
| dictionaryAdmin.createDictionary 失败（seed 时） | 权限/网络 | toast "初始化位置失败"，不弹 modal |

### 6.4 字典与位置 fallback

| 情况 | 处理 |
|------|------|
| material_location 字典首次不存在 | 首次扫码自动 seed 6 项 + toast "已创建默认位置" |
| material.usage_area 不在字典中 | picker fallback 字典首项 |
| 字典所有项被软删 | picker 空 → 提交校验失败"请选择位置" |

### 6.5 权限

| 情况 | 处理 |
|------|------|
| 维修员 navigateTo stock-in | onLoad 拦截 + 退回 |
| 非 canManageMaterial 进入商品管理 sub-tab | canManage=false → 编辑/删除/新增按钮全隐藏 |
| 硬刷 add?material_number=XXX 但无权限 | add 页现有权限校验拦截 |

## 7. 验证清单

### 7.1 路径回归（按角色）

**管理员/经理/办美员工**：

- [ ] FAB tap → 直接调起扫码（不再 ActionSheet）
- [ ] 扫已有商品 → 底部 Modal 显示，位置 picker 预填
- [ ] Modal 提交 → 入库记录顶部出现新记录，stock 累加，material_records.usage_area = 用户选的位置
- [ ] 扫不存在编号 → modal 双按钮 → 立即添加 → 切 sub-tab 1 + 跳 add 页带 prefill
- [ ] add 页提交后 → 商品管理 sub-tab 列表新增该商品
- [ ] 取消扫码 → 静默
- [ ] 商品管理 sub-tab 完整 CRUD：搜索 / 筛选 / tap → detail / 编辑 → edit / 删除二次确认 / 新增按钮 → add
- [ ] material/index Tab0 配件列表 显示同一份数据，互通
- [ ] 分类管理 sub-tab 不变（现有）

**维修员**：
- [ ] 首页看不到 Tab2
- [ ] 直接 navigateTo stock-in → toast + 退回
- [ ] 工单 completeRepair → 仍能扣库存

### 7.2 数据正确性

入库提交后：
- `materials`：stock 自增、updated_at 刷新、**usage_area 不变**
- `material_records`：type='in'、quantity 一致、usage_area = 用户选的位置

字典更新后：
- `dictionaries` `dict_key='material_location'` 自动 seed 6 项
- 软删项不在 picker 返回里

商品管理 CRUD：
- 删除 → materials 集合该项消失
- 编辑 → 字段更新，reload 显示新值
- 添加（含 prefill） → material_number 与扫到的一致

### 7.3 跨页通讯

- [ ] add 提交 → 商品管理列表 reload + 入库记录刷新
- [ ] detail/edit 改完 → 商品管理 reload
- [ ] Modal 提交 → 不切页，入库记录立即刷新
- [ ] material/index Tab0 与 stock-in 商品管理 操作互通

### 7.4 回归非新增功能

- [ ] 工单提报/编辑/详情 不受影响
- [ ] admin/dict 后台仍能管理 material_category + material_location
- [ ] material_records 老数据展示无异常
- [ ] material/index Tab1 出库记录 不变

### 7.5 旧版逻辑清理

```bash
grep -rn "stock-in-form\|stockInForm\|/material/stock-in-form/" miniprogram --include="*.js" --include="*.wxml" --include="*.json"
```

预期：无任何匹配。

## 8. 已知局限

- `canManageMaterial` 判断在 dictionaryManager 里**继续复制一份**而非共享 require — 为给 material_location 加权限例外，沿用既有处理方式
- 位置字典**软删**而非硬删：items[i].enabled=false 保留历史项
- 位置字段**只写 material_records，不写 material**：商品的"默认位置"可能与最后一次入库位置不同步，由用户 / 编辑页主动维护
- 删除商品**乐观 UI**：网络抖动时可能短暂消失再回来；极端情况下用户已 tap 别的卡片但 deleteMaterial 在后台失败 — 当前实现 toast 错误并 reload，可接受
- 同一商品**两端并发编辑**（material/index 编辑 + stock-in 删除）：依赖 onShow 重拉，最后一次操作覆盖 — 小团队场景风险低
- 扫码 picker fallback 字典首项可能跨地点入库时误填：用户应主动改 picker；首版不做"上次选择记忆"

## 9. 未做

- 扫码 OCR 文本识别 / 多码批量
- 入库照片上传（仅入库流程不做，新增商品仍走 add 页可上传）
- 出库流程改造（仍走 material/index Tab1 弹窗；本期不动）
- 数据分析对入库位置的统计
- 位置字段的等级 / 区域分组 / 下拉嵌套
- 商品管理筛选维度扩展（如按分类筛选） — 沿用现有"全部/预警/缺货"三态
- material-list 组件的虚拟滚动 — 列表数据量小，无需

---

## 附录 A — 影响文件清单

```
新建（4 文件）：
  miniprogram/components/material-list/index.{js,wxml,wxss,json}    (新组件 — stock-in 商品管理 + material/index 配件列表共用)

改造（7 文件）：
  miniprogram/pages/material/stock-in/index.{js,wxml,wxss,json}     +商品管理 sub-tab + Modal + directScan + loadLocationOptions
  miniprogram/pages/material/index.{js,wxml,wxss}                   Tab0 改用 <material-list>，移除内联列表逻辑
  miniprogram/pages/material/add/index.js                           onLoad 接 query.material_number prefill
  miniprogram/services/materialService.js                           stockIn 加 location 参数
  cloudfunctions/materialManager/index.js                           stockIn case 写 material_records.usage_area = location || material.usage_area
  cloudfunctions/dictionaryManager/index.js                         material_location 加入写权限例外白名单
  miniprogram/app.json                                              移除 pages/material/stock-in-form/index 路径

删除（4 文件）：
  miniprogram/pages/material/stock-in-form/index.{js,wxml,wxss,json}
```

## 附录 B — 角色权限对照

| 操作 | 管理员(1) | 行政经理(2) | 维修员(3) | 办美员工(4) |
|------|:---:|:---:|:---:|:---:|
| 进入耗品管理模块 | ✓ | ✓ | ✗ | ✓ |
| FAB 扫码入库 | ✓ | ✓ | — | ✓ |
| Modal 选位置/提交 | ✓ | ✓ | — | ✓ |
| 商品管理 列表查看 | ✓ | ✓ | — | ✓ |
| 商品管理 新增/编辑/删除 | ✓ | ✓ | — | ✓ |
| 分类管理 / 位置字典 CRUD | ✓ | ✓ | — | ✓ |
| material/index Tab0 配件列表 | ✓ | ✓ | — | ✓ |
| 工单完成时扣库存 | ✓ | — | ✓（独立路径） | — |
