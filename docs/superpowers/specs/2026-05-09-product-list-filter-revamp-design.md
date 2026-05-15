# 商品管理筛选模块改版（B 方案）

日期：2026-05-09
作用范围：`miniprogram/components/product-list/`（仅商品管理 tab，不影响 material-list / 其它列表）

## 背景

当前商品管理页面（`pages/product/index`）的筛选弹层有两个维度——**商品类别** 和 **使用区域**。问题：

1. 使用区域字段已从新增/修改/详情页 UI 中移除，新建商品不再录入此字段，筛选维度变成"死维度"。
2. 主使用场景（用户确认）是 **分类导航 + 采购渠道追踪 + 检索定位**，但当前没有"采购渠道"维度。
3. 视觉上 chip 激活态用 `#1677FF` 蓝色，与应用其它位置（详情页修改按钮、列表"全部/预警/缺货" tab）的绿色渐变 `#10b981 → #14b8a6` 主色不统一。
4. 用户调整 chip 时无法预知最终命中数，易出现"筛了空集"的尴尬。

## 目标

- 替换死维度"使用区域"为"采购渠道"
- chip 激活态、确定按钮统一到应用绿色主色
- 弹层内 chip 勾选实时显示 `匹配 N 件`，让用户在点确定前即知结果

## 非目标

- 不加库存状态（正常/预警/缺货）快选
- 不加排序选项
- 不加库存范围 / 是否设置预警值等过滤
- 不加"已选 pill 行"
- 不加服务端筛选（保持客户端过滤已加载的 products）
- 不动 `materialList` / 其它列表的筛选实现

---

## 详细设计

### State（`product-list/index.js` data 字段）

```js
data: {
  // 不变
  keyword: '',
  products: [],
  filteredProducts: [],
  loading: true,
  loadingMore: false,
  productPage: 1,
  productTotal: 0,
  showFilter: false,
  hasActiveFilter: false,
  optCategories: [],
  filterCategories: [],

  // 改：filterUsageAreas / optUsageAreas → filterSources / optSources
  filterSources: [],
  optSources: [],

  // 新增
  matchCount: 0,   // 弹层内实时匹配数（按当前 chip 选择推算）
}
```

`FILTER_GROUP_KEY` 常量同步：
```js
const FILTER_GROUP_KEY = {
  category: 'filterCategories',
  source: 'filterSources',   // 改
};
```

### 筛选选项动态抽取（`_refreshFilterOptions`）

继续从已加载的 `products` 中提取 unique 值：

```js
_refreshFilterOptions() {
  const cats = new Set();
  const srcs = new Set();
  this.data.products.forEach((p) => {
    if (p.category) cats.add(p.category);
    if (p.source) srcs.add(p.source);
  });
  this.setData({
    optCategories: [...cats],
    optSources: [...srcs],
  });
}
```

### 核心过滤函数

拆成两个：

```js
_matchPredicate(p, filterCategories, filterSources) {
  if (filterCategories.length > 0 && filterCategories.indexOf(p.category) < 0) return false;
  if (filterSources.length > 0 && filterSources.indexOf(p.source) < 0) return false;
  return true;
}

_applyFilter() {
  // 真正写入 filteredProducts，影响列表
  const { products, filterCategories, filterSources } = this.data;
  const filtered = products.filter(p => this._matchPredicate(p, filterCategories, filterSources));
  this.setData({ filteredProducts: filtered });
}

_computeMatchCount() {
  // 不动列表，只算"如果点确定，能命中多少"
  const { products, filterCategories, filterSources } = this.data;
  const count = products.filter(p => this._matchPredicate(p, filterCategories, filterSources)).length;
  this.setData({ matchCount: count });
}
```

### 交互入口（5 个）

| 入口 | 状态变更 | 列表过滤 (`_applyFilter`) | 实时计数 (`_computeMatchCount`) |
|------|----------|----------------------------|---------------------------------|
| 搜索框 input → confirm | `keyword` | ✓ | ✓ |
| 弹层 chip 勾/取 | `filterX[]` | ✗ | ✓ |
| 弹层"确定" | `showFilter=false` | ✓ | ✓ |
| 弹层"重置" | `filterX=[]` | ✓ | ✓ |
| 打开弹层 | `showFilter=true` | — | ✓（初始化按钮数字） |

**关键不变量**：chip 勾选只更新 `matchCount`，不立即写 `filteredProducts`。用户点确定才"定稿"到列表。

### 红点 / hasActiveFilter

```js
const hasActiveFilter = filterCategories.length > 0 || filterSources.length > 0;
```

确定后立即 setData，作为筛选按钮右上角红点的开关条件（`wx:if="{{hasActiveFilter}}"`）。

### 死代码清理清单

`product-list/index.js`：
- 删 `filterUsageAreas`、`optUsageAreas`（两处 data）
- 删 `FILTER_GROUP_KEY.usage`
- `_refreshFilterOptions`：删 `usage_area` Set
- `_applyFilter`：删 `filterUsageAreas` 分支
- `onResetFilter`：删 `filterUsageAreas: []`
- `onConfirmFilter`：`hasActiveFilter` 逻辑改

`product-list/index.wxml`：
- 删整段"使用区域" section（含 wx:for、filter-empty 等）
- 加"采购渠道" section（结构对称）
- 确定按钮文案 `确定` → `确定 · {{matchCount}} 件`
- 0 匹配时按钮加 `disabled` style + 文案 `无匹配`

`product-list/index.wxss`：
- chip 激活态色块完全替换
- 确定按钮色块完全替换
- 加 disabled 样式（opacity 0.5、不可点）
- chip 内边距 `12/24 → 14/28rpx`
- chip 普通态 background `#F3F4F6 → rgba(0,0,0,0.04)`
- chip 加 transition + active scale
- section 间距 `.filter-section { margin-top: 24rpx → 28rpx }`

---

## 视觉规范

### 配色

| 元素 | 当前 | 改为 |
|------|------|------|
| chip color（激活） | `#1677FF` | `#FFFFFF` |
| chip background（激活） | `#E6F0FF` | `linear-gradient(to right, #10b981, #14b8a6)` |
| chip border（激活） | `1rpx solid #1677FF` | `transparent` |
| chip background（普通） | `#F3F4F6` | `rgba(0,0,0,0.04)` |
| 确定按钮 background | `#1677FF` | `linear-gradient(to right, #10b981, #14b8a6)` |
| 重置按钮 | `#F3F4F6` 中性灰 | 不变 |

### chip 微调
- padding `12/24rpx → 14/28rpx`
- `transition: all 0.15s ease`
- `:active { transform: scale(0.95) }`

### section 标题加图标

| section | icon |
|---------|------|
| 商品类别 | `apps-o`（与商品卡片字段图标一致） |
| 采购渠道 | `shop-o` |

图标尺寸 `14px`、颜色 `#737373`，紧贴标题左侧 8rpx 间距。

### 底部按钮

```
┌─────────────┬──────────────────────────────┐
│   重置       │  确定 · 23 件                  │
└─────────────┴──────────────────────────────┘
```

- 默认（无 chip 选中）= `products.length`，即"显示全部 N 件"
- 0 匹配：文案改 `无匹配`，按钮 `opacity: 0.5; pointer-events: none`

### panel 头部辅助文案

`筛选` 标题下方加一行 22rpx / `#a3a3a3` 提示：`可多选 · 已选 N 项`，其中 `N = filterCategories.length + filterSources.length`（两个 section 的选中数总和），实时跟随 chip 变化。

---

## 边界 / Edge cases

1. **products 为空（首次加载未完成）**：弹层内 chip 选项也为空，提示 `暂无选项`（已有 `filter-empty` 样式可复用）。matchCount 默认 0，按钮 `无匹配` 状态。
2. **products 加载更多分页**：每次 `loadProducts` 末尾都调 `_refreshFilterOptions`，新页带来的新类别/渠道会出现在弹层（已选 chip 保持不变）。
3. **chip 选项发生变化但用户已选了某项**：例如分页加载后 `optCategories` 仍含已选项 → 不变；若 reload（搜索切换）后某已选项不在新 options 中 → 仍保留在 `filterCategories` 但 chip 不渲染（隐性"未生效"）。简单做法：reload 时如已选项不再有匹配，提示用户重置。**实际方案：** 不做特殊处理，让用户自行重置（侵入性最小）。
4. **searchKeyword 与 filter 同时使用**：现状 keyword 经云函数下发到 listProducts 接口，filter 是客户端二次过滤。组合行为：先按关键词搜索 → 再 chip 过滤。已被现有结构支持。
5. **product 的 `source` 字段缺失**：旧数据可能没有此字段。`if (p.source) srcs.add(p.source)` 已防御。`p.source === undefined` 在 `indexOf` 比较时不会命中任何 chip。
6. **panel 高度溢出**：`scroll-view scroll-y` 已包裹 body，溢出滚动正常。

---

## 涉及文件清单

仅 3 个：
- `miniprogram/components/product-list/index.js`
- `miniprogram/components/product-list/index.wxml`
- `miniprogram/components/product-list/index.wxss`

`index.json` 不动（`van-popup` 已注册）。

云函数 / service / 其它页面：**无改动**。

---

## 手工验收清单

- [ ] 打开筛选弹层：商品类别和采购渠道两个 section，每个 section 的 chip 来自当前已加载 products 的 unique 值
- [ ] chip 激活时为绿色渐变填充 + 白字，无蓝色残留
- [ ] 弹层底部"确定"按钮显示当前匹配数，如 `确定 · 12 件`
- [ ] 取消所有 chip 后按钮显示 `确定 · 总数`
- [ ] 勾选多个 chip 至无任何商品命中：按钮变 `无匹配`、置灰、点击不响应
- [ ] 点击"确定"：弹层关闭，列表更新为筛选后结果，筛选按钮右上出现红点
- [ ] 点击"重置"：所有 chip 清空，列表恢复全量，红点消失
- [ ] 关闭弹层后再打开：之前确定的 chip 状态保留，matchCount 自动同步
- [ ] 搜索框输入并回车 + 已有 chip 筛选：列表显示"既匹配关键词又匹配 chip"的子集
- [ ] 加载更多分页：新分页的类别/渠道出现在 chip 选项中，已选 chip 不变
- [ ] 旧数据无 `source` 字段：弹层"采购渠道" section 不会出现空 chip，filter 不误命中
- [ ] 与 material-list 对比：material 的筛选不被改动，颜色仍为旧蓝色（确认作用范围）

---

## 后续可拓展（不在本次范围）

- 已选 pill 行（C 方案的剩余部分）
- 排序选项（最近添加 / 库存高低）
- 服务端筛选（products 规模 > 千条时再考虑）
