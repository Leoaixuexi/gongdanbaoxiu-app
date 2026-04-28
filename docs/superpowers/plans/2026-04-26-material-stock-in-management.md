# 耗品入库管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `pages/material/index` 的 Tab2 从"入库记录"升级为"入库管理"，内含入库记录 / 分类管理两个子页；新增 FAB ➕ 弹 ActionSheet 选扫码入库 / 新品入库；扫码入库走新页面 stock-in-form 完成；分类管理复用 dictionaryManager；维修员从耗品模块移除。

**Architecture:** 微信小程序（WeChat Mini Program）+ 微信云开发（CloudBase）。前端按 spec §3 在既有 `pages/material/index` 内嵌 sub-tabs + swiper；新增 1 个轻量页 `stock-in-form`；2 个云函数微改（materialManager 加 1 action + 收紧权限；dictionaryManager 给 material_category 字典放 canManageMaterial 写权限例外）；分类管理使用既有 `services/dictionaryAdmin` + `services/dictionary`，不引第三方组件。

**Tech Stack:** WXML/WXSS/JS（小程序原生），@vant/weapp 组件库，wx-server-sdk（云函数），CloudBase 数据库（dictionaries / materials / material_records 集合）。无自动化测试，**所有验证通过微信开发者工具的"模拟器 / 云函数测试 / 真机扫码"完成**。

---

## 影响文件结构

```
新建（4 文件）：
  miniprogram/pages/material/stock-in-form/index.js
  miniprogram/pages/material/stock-in-form/index.wxml
  miniprogram/pages/material/stock-in-form/index.wxss
  miniprogram/pages/material/stock-in-form/index.json

改造（7 文件）：
  miniprogram/app.json                           +1 页面路径
  miniprogram/pages/material/index.js            tabs / sub-tabs / FAB / 扫码 / 分类管理 / 移除 showStockIn / 权限收紧
  miniprogram/pages/material/index.wxml          tabs / sub-tabs / FAB / ActionSheet UI / 分类管理子页 / 移除入库弹窗
  miniprogram/pages/material/index.wxss          sub-tabs 样式 / 分类管理列表样式
  miniprogram/pages/material/add/index.js        分类下拉源由硬编码 → dictionary.getOptions
  miniprogram/services/materialService.js        +1 方法 getMaterialByNumber
  miniprogram/pages/home/index.js                consumableFuncRows "入库管理" 接 handler
  cloudfunctions/materialManager/index.js        +1 case getMaterialByNumber
  cloudfunctions/materialManager/helpers.js      canAccessMaterial 移除 role_id=3
  cloudfunctions/dictionaryManager/index.js      material_category 写权限例外
```

## 实现顺序与依赖

```
Phase 1 后端基础（独立）         → Task 1, 2, 3
Phase 2 前端服务层               → Task 4
Phase 3 新页面 stock-in-form     → Task 5, 6
Phase 4 material/index 改造      → Task 7, 8, 9, 10, 11
Phase 5 material/add 微改        → Task 12
Phase 6 入口接入                 → Task 13
Phase 7 全路径手动回归           → Task 14
```

每个 Task 完成后单独提交。Phase 1 三个云函数改完一并部署。

---

## Task 1: 收紧 canAccessMaterial（移除维修员）

**Files:**
- Modify: `cloudfunctions/materialManager/helpers.js:41-43`

**目标**：维修员（role_id=3）不再能访问耗品管理云函数；既有 `canManageMaterial` 已不含 3，无需改。

- [ ] **Step 1: 修改 helpers.js**

把 `canAccessMaterial` 的 role 数组从 `[1, 2, 3, 4]` 改为 `[1, 2, 4]`：

```js
/**
 * 权限校验：是否可以访问物料管理
 * 管理员(1)、行政经理(2)、办美员工(4) 可访问
 */
function canAccessMaterial(user) {
  return user && [1, 2, 4].includes(user.role_id) && user.active !== false;
}
```

- [ ] **Step 2: 部署云函数**

微信开发者工具 → 右键 `cloudfunctions/materialManager` → "上传并部署：云端安装依赖"。等待完成提示。

- [ ] **Step 3: 验证**

微信开发者工具 → 云开发 → 云函数 → `materialManager` → 测试 → 用维修员身份（先在 `users` 集合里准备好一条 role_id=3 的用户）调 action `listMaterials`。预期返回 `{ success: false, error: '无权限访问物料管理' }`。然后用 role_id=1/2/4 调用，预期返回正常数据。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/helpers.js
git commit -m "feat(material): 收紧 canAccessMaterial 移除维修员

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: materialManager 加 getMaterialByNumber action

**Files:**
- Modify: `cloudfunctions/materialManager/index.js`（在 switch 内加新 case，放在 `listMaterials` 之后即可）

**目标**：扫码后用 material_number 查找配件，返回单条或 null。

- [ ] **Step 1: 在 index.js switch 内新增 case**

定位文件第 41 行 `case 'listMaterials':` 之前，新增整段：

```js
      // ===== 按编号查询配件（扫码入库前置） =====
      case 'getMaterialByNumber': {
        const { material_number } = data;
        if (!material_number) {
          return { success: false, error: '缺少 material_number' };
        }

        const { data: list } = await db.collection('materials')
          .where({ material_number })
          .limit(1)
          .get();

        if (list.length === 0) {
          return { success: true, material: null };
        }

        return { success: true, material: list[0] };
      }

```

- [ ] **Step 2: 部署云函数**

同 Task 1：右键 `cloudfunctions/materialManager` → 上传并部署。

- [ ] **Step 3: 验证**

云函数测试面板 → action `getMaterialByNumber` → 入参 `{ "data": { "material_number": "PJ-2024-0156" } }`。预期：
- 库内有对应商品 → 返回 `{ success: true, material: {...} }`
- 库内无对应商品 → 返回 `{ success: true, material: null }`
- 缺 material_number → 返回 `{ success: false, error: '缺少 material_number' }`

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/index.js
git commit -m "feat(material): + getMaterialByNumber action 用于扫码入库前置查询

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: dictionaryManager 加 material_category 写权限例外

**Files:**
- Modify: `cloudfunctions/dictionaryManager/index.js:218-227`

**目标**：dict_key === 'material_category' 时，create/update/delete 由 `canManageMaterial`（role_id ∈ {1,2,4}）通过即可，不必管理员。

- [ ] **Step 1: 改 main 函数权限分支**

定位文件第 218 行的 `const adminActions = ['create', 'update', 'delete'];`，把整个 admin 校验块替换为：

```js
    // 需要写权限的操作
    const adminActions = ['create', 'update', 'delete'];
    if (adminActions.includes(action)) {
      const user = await getCurrentUser(OPENID);
      // material_category 字典：放给 canManageMaterial（管理员/行政经理/办美员工）
      const isMaterialCategory = data && data.dict_key === 'material_category';
      const canManageMaterial = user && [1, 2, 4].includes(user.role_id) && user.active !== false;
      const isAdminUser = user && user.role_id === 1 && user.active !== false;

      const allowed = isAdminUser || (isMaterialCategory && canManageMaterial);
      if (!allowed) {
        return {
          success: false,
          error: '无权限：只有管理员可以执行此操作'
        };
      }
    }
```

> 说明：这里不引用 materialManager/helpers，**复制 2-3 行 role_id 判断**（per spec §8 第 4 条已知局限）。

- [ ] **Step 2: 部署云函数**

微信开发者工具 → 右键 `cloudfunctions/dictionaryManager` → 上传并部署。

- [ ] **Step 3: 验证**

云函数测试面板 → 先以 role_id=4（办美员工）身份测：
- action `update`，data `{ dict_key: 'material_category', items: [{value:'电气',label:'电气',sort:0,enabled:true}] }` → 预期 `success: true`（即便字典还不存在 update 也会失败，但**权限不应该 reject**）
- action `update`，data `{ dict_key: 'department', items: [...] }`（其它字典）→ 预期 `success: false, error: '无权限：只有管理员可以执行此操作'`
- 以 role_id=1（管理员）→ 任意 dict_key 都通过

> 如果在该角色下不能直接选用户身份测，可以在 `users` 表里临时把当前微信用户的 role_id 改为 4 跑一次再改回。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/dictionaryManager/index.js
git commit -m "feat(dictionary): material_category 字典写权限放给 canManageMaterial 角色

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: materialService 加 getMaterialByNumber wrapper

**Files:**
- Modify: `miniprogram/services/materialService.js`（在文件末尾 module.exports 之前加新方法）

**目标**：前端封装 Task 2 新增的云函数 action。

- [ ] **Step 1: 在 stockOut 之后加新方法**

定位 `materialService.js` 第 46 行 `};`（stockOut 结束）之后、`/**` 注释之前，插入：

```js
/**
 * 按 material_number 查找配件（扫码入库用）
 * @returns {Promise<{success: boolean, material: object | null}>}
 */
const getMaterialByNumber = async (material_number) => {
  return callCloudSilent('materialManager', {
    action: 'getMaterialByNumber',
    data: { material_number }
  });
};

```

- [ ] **Step 2: 加到 module.exports**

定位文件底部 `module.exports = {` 块，把 `getMaterialByNumber` 加进去（建议放在 `stockIn` / `stockOut` 附近以便阅读）：

```js
module.exports = {
  listMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  stockIn,
  stockOut,
  getMaterialByNumber,
  listRecords,
  getWarnings,
  getMaterialStats,
  getMaterialRecords,
};
```

- [ ] **Step 3: 验证**

模拟器中临时在某个页面 onLoad 加：

```js
const materialService = require('../../services/materialService');
materialService.getMaterialByNumber('PJ-2024-0156').then(console.log);
```

预期 console 输出 `{success:true, material:{...}}`。验证后撤回临时代码。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/services/materialService.js
git commit -m "feat(materialService): + getMaterialByNumber

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 创建 stock-in-form 页面骨架并注册到 app.json

**Files:**
- Create: `miniprogram/pages/material/stock-in-form/index.js`
- Create: `miniprogram/pages/material/stock-in-form/index.wxml`
- Create: `miniprogram/pages/material/stock-in-form/index.wxss`
- Create: `miniprogram/pages/material/stock-in-form/index.json`
- Modify: `miniprogram/app.json:26-27`（在 record-detail 后加新路径）

**目标**：搭出可被 navigateTo 进入的空骨架，参数透传，不做提交逻辑（下一 Task 加）。

- [ ] **Step 1: 创建 index.json**

内容：

```json
{
  "navigationBarTitleText": "入库登记",
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index",
    "van-button": "@vant/weapp/button/index"
  }
}
```

- [ ] **Step 2: 创建 index.js**

内容：

```js
/**
 * 扫码入库 - 轻量补单页
 * Query 入参：material_id, material_name, material_number, current_stock, unit, spec
 */

const materialService = require('../../../services/materialService');

Page({
  data: {
    material_id: 0,
    material_name: '',
    material_number: '',
    current_stock: 0,
    unit: '',
    spec: '',
    quantity: '',
    remark: '',
    submitting: false,
  },

  onLoad(query) {
    const material_id = parseInt(query.material_id, 10);
    if (!material_id) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({
      material_id,
      material_name: decodeURIComponent(query.name || ''),
      material_number: decodeURIComponent(query.number || ''),
      current_stock: parseInt(query.stock || '0', 10),
      unit: decodeURIComponent(query.unit || ''),
      spec: decodeURIComponent(query.spec || ''),
    });
  },

  onQuantityInput(e) {
    this.setData({ quantity: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async onSubmit() {
    // 下一 Task 实现
  },
});
```

- [ ] **Step 3: 创建 index.wxml**

内容：

```xml
<view class="stock-in-form">
  <view class="info-card">
    <view class="info-row">
      <text class="info-label">商品名称</text>
      <text class="info-value">{{material_name}}</text>
    </view>
    <view class="info-row" wx:if="{{material_number}}">
      <text class="info-label">编号</text>
      <text class="info-value">{{material_number}}</text>
    </view>
    <view class="info-row" wx:if="{{spec}}">
      <text class="info-label">规格</text>
      <text class="info-value">{{spec}}</text>
    </view>
    <view class="info-row">
      <text class="info-label">当前库存</text>
      <text class="info-value">{{current_stock}} {{unit}}</text>
    </view>
  </view>

  <view class="form-card">
    <view class="form-item">
      <text class="form-label">入库数量 <text class="required">*</text></text>
      <input
        class="form-input"
        type="number"
        placeholder="请输入入库数量"
        value="{{quantity}}"
        bindinput="onQuantityInput"
      />
      <text class="form-unit">{{unit}}</text>
    </view>
    <view class="form-item">
      <text class="form-label">备注</text>
      <textarea
        class="form-textarea"
        placeholder="选填，最多 100 字"
        maxlength="100"
        value="{{remark}}"
        bindinput="onRemarkInput"
      />
    </view>
  </view>

  <view class="footer">
    <van-button
      type="primary"
      block
      loading="{{submitting}}"
      disabled="{{!quantity || submitting}}"
      bind:click="onSubmit"
    >确认入库</van-button>
  </view>
</view>
```

- [ ] **Step 4: 创建 index.wxss**

内容：

```css
.stock-in-form {
  padding: 24rpx;
  background: #F5F7FA;
  min-height: 100vh;
  box-sizing: border-box;
}

.info-card,
.form-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  margin-bottom: 24rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}
.info-row:last-child { border-bottom: none; }

.info-label {
  font-size: 28rpx;
  color: #6B7280;
}
.info-value {
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 500;
  max-width: 60%;
  text-align: right;
}

.form-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}
.form-item:last-child { border-bottom: none; }

.form-label {
  display: block;
  font-size: 28rpx;
  color: #1A1A1A;
  font-weight: 500;
  margin-bottom: 16rpx;
}
.required {
  color: #DC2626;
}

.form-input {
  width: calc(100% - 80rpx);
  display: inline-block;
  height: 72rpx;
  padding: 0 16rpx;
  background: #F8FAFC;
  border-radius: 8rpx;
  font-size: 32rpx;
}
.form-unit {
  display: inline-block;
  margin-left: 16rpx;
  color: #6B7280;
  font-size: 28rpx;
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 16rpx;
  background: #F8FAFC;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.footer {
  padding: 32rpx 0;
}
```

- [ ] **Step 5: 注册到 app.json**

定位 `app.json` 第 26 行 `"pages/material/record-detail/index",` 之后插入：

```json
    "pages/material/record-detail/index",
    "pages/material/stock-in-form/index",
```

- [ ] **Step 6: 验证**

模拟器中在控制台执行：

```js
wx.navigateTo({
  url: '/pages/material/stock-in-form/index?material_id=1&name=' + encodeURIComponent('空气滤芯') + '&number=PJ-2024-0156&stock=45&unit=个&spec=' + encodeURIComponent('200x150x50mm')
})
```

预期：跳转到新页面，顶部 info-card 正确显示商品信息，"入库数量"输入框可输入数字，"确认入库"按钮在数量为空时 disabled。提交点击暂无反应（下一 Task 实现）。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/stock-in-form/ miniprogram/app.json
git commit -m "feat(material): 新建 stock-in-form 页面骨架（扫码入库轻量补单）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: stock-in-form 完成提交逻辑

**Files:**
- Modify: `miniprogram/pages/material/stock-in-form/index.js:39-42`（替换 `onSubmit` 占位）

**目标**：填完数量+备注后调 stockIn → 成功 navigateBack；失败按 spec §6 处理。

- [ ] **Step 1: 替换 onSubmit 实现**

把 Task 5 留下的 `async onSubmit() { /* 下一 Task 实现 */ }` 替换为：

```js
  async onSubmit() {
    const qty = parseInt(this.data.quantity, 10);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    if (qty > 999999) {
      wx.showToast({ title: '数量不能超过 999999', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const result = await materialService.stockIn(
        this.data.material_id,
        qty,
        this.data.remark || ''
      );
      if (result && result.success) {
        wx.showToast({ title: '入库成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      } else {
        const err = (result && result.error) || '入库失败';
        wx.showToast({ title: err, icon: 'none' });
        // 商品不存在 → 该商品在扫码后被删，回退列表刷新
        if (err.includes('配件不存在')) {
          setTimeout(() => wx.navigateBack(), 1200);
        }
        this.setData({ submitting: false });
      }
    } catch (e) {
      console.error('[StockInForm] submit error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
```

- [ ] **Step 2: 验证（正常路径）**

模拟器中复用 Task 5 的 navigateTo 进入页面 → 数量填 5 → 确认入库 → 看到 "入库成功" toast → 自动返回上一页。  
然后云开发数据库查 `materials`：对应 `material_id=1` 的 `stock` 应 +5；查 `material_records`：应有新条 `type='in', quantity:5`。

- [ ] **Step 3: 验证（错误路径）**

把 query 的 material_id 改成 99999（不存在），数量填 5，提交 → 预期 toast "配件不存在" + 1.2s 后 navigateBack。

数量填 0 → toast "请输入有效数量"，不提交。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/material/stock-in-form/index.js
git commit -m "feat(material): stock-in-form 完成提交逻辑（数量校验+错误处理）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: material/index — 改 tabs 文案 + Tab2 内嵌 sub-tabs UI 骨架

**Files:**
- Modify: `miniprogram/pages/material/index.js`（data.tabs / 新增 subTabs 等字段）
- Modify: `miniprogram/pages/material/index.wxml:127-189`（Tab2 整块改造）
- Modify: `miniprogram/pages/material/index.wxss`（追加 sub-tabs 样式）

**目标**：把 Tab2 文案改为"入库管理"，内部用 segmented sub-tabs 切换"入库记录 / 分类管理"两个子页（**仅 UI 骨架**，分类管理子页内容下个 Task 实现）。

- [ ] **Step 1: 改 data.tabs 文案 + 新增 subTabs 字段**

定位 `index.js` 第 35 行 `tabs: ['配件列表', '入库记录', '出库记录'],`，改为：

```js
    tabs: ['配件列表', '入库管理', '出库记录'],
    // Tab2 入库管理 - 子页签
    activeSubTab: 0,                       // 0 入库记录 / 1 分类管理
    subTabs: ['入库记录', '分类管理'],
```

- [ ] **Step 2: 加 subTab 切换 handler**

在 `onSwiperChange` 之后插入：

```js
  // ===== Tab2 sub-tabs =====
  onSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    this.setData({ activeSubTab: sub });
    if (sub === 1) {
      this._ensureCategoriesLoaded();
    }
  },

  _ensureCategoriesLoaded() {
    // Task 9 实现
  },
```

- [ ] **Step 3: 改 wxml Tab2 整体结构**

定位 wxml 第 127 行 `<!-- Tab 2: 入库记录 -->` 整块（到第 189 行 `</swiper-item>` 之前的 swiper-item 闭合），整段替换为：

```xml
    <!-- Tab 2: 入库管理（含 入库记录 + 分类管理 子页） -->
    <swiper-item>
      <view class="tab2-container">
        <!-- Sub-Tabs -->
        <view class="sub-tabs">
          <view
            wx:for="{{subTabs}}"
            wx:key="index"
            class="sub-tab-item {{activeSubTab === index ? 'sub-tab-active' : ''}}"
            data-sub="{{index}}"
            bindtap="onSubTabChange"
          >
            <text class="sub-tab-text">{{item}}</text>
          </view>
        </view>

        <!-- 子页 0：入库记录（既有逻辑保留） -->
        <scroll-view
          wx:if="{{activeSubTab === 0}}"
          scroll-y
          class="sub-tab-content"
          bindscrolltolower="onLoadMoreRecords"
        >
          <view class="search-row">
            <view class="search-bar search-bar-flex">
              <van-icon name="search" size="14px" color="#a3a3a3" custom-class="search-icon" />
              <input class="search-input" placeholder="搜索" placeholder-class="search-placeholder" />
            </view>
            <view class="filter-btn" bindtap="onFilterTap">
              <van-icon name="filter-o" size="18px" color="#737373" />
            </view>
          </view>

          <view wx:if="{{inLoading}}" class="loading-state">
            <text>加载中...</text>
          </view>
          <view wx:elif="{{inRecords.length === 0}}" class="empty-state">
            <van-icon name="orders-o" size="48px" color="#d4d4d4" />
            <text class="empty-text">暂无入库记录</text>
          </view>
          <view wx:else class="card-list">
            <view
              wx:for="{{inRecords}}"
              wx:key="record_id"
              class="m-card"
              bindtap="goToRecordDetail"
              data-record="{{item}}"
            >
              <image
                class="m-card-img"
                src="{{item.material_image || '/images/placeholder.png'}}"
                mode="aspectFill"
              />
              <view class="m-card-body">
                <view class="m-card-title">{{item.material_name}}</view>
                <view class="m-card-meta">
                  <view class="meta-item">
                    <van-icon name="apps-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.category || '-'}}</text>
                  </view>
                  <view class="meta-item">
                    <van-icon name="location-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.usage_area || '-'}}</text>
                  </view>
                </view>
                <view class="m-card-meta">
                  <view class="meta-item">
                    <van-icon name="clock-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.timeText}}</text>
                  </view>
                  <view class="meta-item">
                    <van-icon name="manager-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.operator.name}}</text>
                  </view>
                </view>
              </view>
              <view class="m-card-qty qty-in">+{{item.quantity}}</view>
            </view>
          </view>
          <view wx:if="{{inLoadingMore}}" class="loading-more">
            <text>加载更多...</text>
          </view>
        </scroll-view>

        <!-- 子页 1：分类管理（占位，下个 Task 填充） -->
        <scroll-view
          wx:if="{{activeSubTab === 1}}"
          scroll-y
          class="sub-tab-content"
        >
          <view class="empty-state">
            <text class="empty-text">分类管理（实现中）</text>
          </view>
        </scroll-view>
      </view>
    </swiper-item>
```

- [ ] **Step 4: 追加 wxss 样式**

在 `index.wxss` 文件末尾追加：

```css
/* ====== Tab2 入库管理 - 子页签 ====== */
.tab2-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sub-tabs {
  display: flex;
  background: #F5F7FA;
  padding: 16rpx 24rpx 0;
  gap: 16rpx;
  flex-shrink: 0;
}

.sub-tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  background: #FFFFFF;
  transition: all 0.2s ease;
}

.sub-tab-item.sub-tab-active {
  background: #1677FF;
}

.sub-tab-text {
  font-size: 28rpx;
  font-weight: 500;
  color: #6B7280;
}

.sub-tab-active .sub-tab-text {
  color: #FFFFFF;
  font-weight: 600;
}

.sub-tab-content {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 5: 验证**

模拟器进入 material/index → 切到 Tab2 → 看到顶部"入库管理"+ 下方两个 sub-tab "入库记录"/"分类管理"。点"分类管理"显示"实现中"占位。点回"入库记录"列表正常。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/pages/material/index.js miniprogram/pages/material/index.wxml miniprogram/pages/material/index.wxss
git commit -m "feat(material): Tab2 升级为入库管理，内嵌入库记录/分类管理 sub-tabs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 入库记录子页 FAB + ActionSheet + 扫码入库流程

**Files:**
- Modify: `miniprogram/pages/material/index.js`（新增 onFabTap / 扫码 handler / navigate handler）
- Modify: `miniprogram/pages/material/index.wxml`（FAB 显隐条件）

**目标**：在入库管理 - 入库记录子页右下角放一个 FAB ➕，点击弹 ActionSheet 选扫码入库 / 新品入库。扫码流程接通 service.getMaterialByNumber → stock-in-form 跳转 / modal 提示。

- [ ] **Step 1: 改 wxml — FAB 显隐与图标**

定位现有 wxml 中的 FAB 段（约第 257-260 行）：

```xml
  <!-- FAB 新增配件按钮 -->
  <view wx:if="{{canManage && activeTab === 0}}" class="fab-button" bindtap="goToAddMaterial">
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

改为：

```xml
  <!-- FAB：Tab1 = 新增配件 / Tab2 入库记录子页 = 扫码/新品入库 ActionSheet -->
  <view
    wx:if="{{canManage && (activeTab === 0 || (activeTab === 1 && activeSubTab === 0))}}"
    class="fab-button"
    bindtap="onFabTap"
  >
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

- [ ] **Step 2: 加 onFabTap / 扫码 handler / 跳转 handler**

在 `index.js` 的 `onSubTabChange` 之后插入：

```js
  // ===== FAB =====
  onFabTap() {
    const tab = this.data.activeTab;

    // Tab1：保持原"新增配件"行为
    if (tab === 0) {
      this.goToAddMaterial();
      return;
    }

    // Tab2 入库记录子页：弹 ActionSheet
    wx.showActionSheet({
      itemList: ['扫码入库', '新品入库'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.scanAndStockIn();
        } else if (res.tapIndex === 1) {
          this.goToAddMaterial();
        }
      },
    });
  },

  // 注：goToAddMaterial 已在文件 ~L374 定义，无需重定义

  // ===== 扫码入库 =====
  async scanAndStockIn() {
    let scanResult;
    try {
      scanResult = await wx.scanCode({ scanType: ['qrCode', 'barCode'] });
    } catch (e) {
      // 用户取消，静默
      return;
    }
    const code = (scanResult.result || '').trim();
    if (!code) {
      wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      return;
    }

    let result;
    try {
      result = await materialService.getMaterialByNumber(code);
    } catch (e) {
      console.error('[Material] scan lookup error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      return;
    }

    if (!result || !result.success) {
      wx.showToast({ title: (result && result.error) || '查询失败', icon: 'none' });
      return;
    }

    if (!result.material) {
      wx.showModal({
        title: '未找到',
        content: `编号「${code}」未登记，请先去新品入库`,
        showCancel: false,
      });
      return;
    }

    const m = result.material;
    const url = '/pages/material/stock-in-form/index'
      + `?material_id=${m.material_id}`
      + `&name=${encodeURIComponent(m.name || '')}`
      + `&number=${encodeURIComponent(m.material_number || '')}`
      + `&stock=${m.stock || 0}`
      + `&unit=${encodeURIComponent(m.unit || '')}`
      + `&spec=${encodeURIComponent(m.spec || '')}`;
    wx.navigateTo({ url });
  },
```

- [ ] **Step 3: onShow 加入库记录刷新**

定位 `onShow()`（约第 105 行）：

```js
  onShow() {
    this.loadMaterials();
    this._tabLoaded = { 0: true };
  },
```

替换为：

```js
  onShow() {
    // 首次：只加载 Tab1
    if (!this._tabLoaded) {
      this._tabLoaded = { 0: true };
      this.loadMaterials();
      return;
    }
    // 从 stock-in-form 返回：当前在 Tab2 入库记录子页，强制刷新前 1 页
    if (this.data.activeTab === 1 && this.data.activeSubTab === 0) {
      this.loadRecords('in');
    }
    // 从 add 页返回：刷 Tab1 配件列表 + Tab2 入库记录
    if (this.data.activeTab === 0) {
      this.loadMaterials();
      // Tab2 入库记录数据若已加载过，也刷
      if (this._tabLoaded && this._tabLoaded[1]) this.loadRecords('in');
    }
  },
```

- [ ] **Step 4: 验证（管理员/办美/经理身份）**

进 material/index Tab2 入库管理 → 子页 0 入库记录 → 看到右下角 FAB ➕。

点 FAB → ActionSheet 弹"扫码入库 / 新品入库"。

选 **新品入库** → 跳到 add 页（既有）→ 返回 → 入库记录列表刷新。

选 **扫码入库** → 真机扫一个对应商品的二维码（编码内容是 material_number，如 PJ-2024-0156）→ 跳转 stock-in-form 页面，商品信息正确显示 → 提交 → 返回 → 列表顶部出现新记录。

测试不存在编号：调试用模拟器开发者工具的"扫码模拟器"输入 `NOT_EXIST_CODE` → 看到 modal "未找到"。

测试取消扫码：调起扫码后按取消 → 静默返回，无 toast。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/index.js miniprogram/pages/material/index.wxml
git commit -m "feat(material): 入库记录子页 FAB+ActionSheet 接通扫码入库流程

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 分类管理子页 — 列表 + seed 检测

**Files:**
- Modify: `miniprogram/pages/material/index.js`（_ensureCategoriesLoaded / loadCategories / seedCategories）
- Modify: `miniprogram/pages/material/index.wxml`（替换"实现中"占位）
- Modify: `miniprogram/pages/material/index.wxss`（分类列表样式）

**目标**：进分类管理子页时，从 dictionaryAdmin.getDictionary 取数据；不存在时调 createDictionary 自动 seed 12 项；展示 enabled=true 的项 + 操作按钮（按钮 handler 下个 Task 实现）。

- [ ] **Step 1: 引入 dictionaryAdmin + dictionary（顶部 require）**

定位 `index.js` 第 6-7 行：

```js
const materialService = require('../../services/materialService');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');
```

改为：

```js
const materialService = require('../../services/materialService');
const dictionaryAdmin = require('../../services/dictionaryAdmin');
const dictionary = require('../../services/dictionary');
const { ROLES, STORAGE_KEYS } = require('../../utils/constants');

const DEFAULT_MATERIAL_CATEGORIES = [
  '电气', '水暖', '门窗', '消防', '清洁', '五金',
  '滤芯类', '轴承类', '密封类', '管路类', '油漆涂料', '通用',
];
```

- [ ] **Step 2: 在 data 末尾加分类管理字段**

定位 data 对象的最后一行（`materialScrollTopTarget: -1,` 后面），在 `}` 之前加：

```js
    // 分类管理（material_category 字典）
    categoriesLoading: false,
    categoryItems: [],            // [{value, label, sort, enabled}]
    categoriesLoaded: false,
```

- [ ] **Step 3: 替换 _ensureCategoriesLoaded 占位 + 实现 loadCategories / seedCategories**

把 Task 7 留下的 `_ensureCategoriesLoaded()` 占位替换为：

```js
  async _ensureCategoriesLoaded() {
    if (this.data.categoriesLoaded) return;
    await this.loadCategories();
  },

  async loadCategories() {
    this.setData({ categoriesLoading: true });
    try {
      const result = await dictionaryAdmin.getDictionary('material_category');
      if (result && result.success && result.data) {
        const items = (result.data.items || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this.setData({
          categoryItems: items,
          categoriesLoading: false,
          categoriesLoaded: true,
        });
        return;
      }
      // 不存在 → 自动 seed
      if (result && !result.success && (result.error || '').includes('不存在')) {
        await this.seedCategories();
        return;
      }
      // 其他错误
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ categoriesLoading: false });
    } catch (e) {
      console.error('[Material] loadCategories error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ categoriesLoading: false });
    }
  },

  async seedCategories() {
    const items = DEFAULT_MATERIAL_CATEGORIES.map((label, idx) => ({
      value: label,
      label,
      sort: idx,
      enabled: true,
    }));
    try {
      const result = await dictionaryAdmin.createDictionary({
        dict_key: 'material_category',
        dict_name: '物料分类',
        description: '新品入库的商品分类',
        items,
      });
      if (result && result.success) {
        wx.showToast({ title: '已创建默认分类', icon: 'success' });
        dictionary.refreshCache('material_category');
        this.setData({
          categoryItems: items,
          categoriesLoading: false,
          categoriesLoaded: true,
        });
      } else {
        wx.showToast({ title: (result && result.error) || '初始化失败', icon: 'none' });
        this.setData({ categoriesLoading: false });
      }
    } catch (e) {
      console.error('[Material] seedCategories error:', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.setData({ categoriesLoading: false });
    }
  },
```

- [ ] **Step 4: 替换 wxml 子页 1 占位**

定位 Task 7 中加的"分类管理（实现中）"占位整段，替换为：

```xml
        <!-- 子页 1：分类管理 -->
        <scroll-view
          wx:if="{{activeSubTab === 1}}"
          scroll-y
          class="sub-tab-content"
        >
          <view class="cat-header" wx:if="{{canManage}}">
            <view class="cat-add-btn" bindtap="onAddCategoryTap">
              <van-icon name="plus" size="14px" color="#1677FF" />
              <text class="cat-add-text">新增分类</text>
            </view>
          </view>

          <view wx:if="{{categoriesLoading}}" class="loading-state">
            <text>加载中...</text>
          </view>
          <view wx:elif="{{categoryItems.length === 0}}" class="empty-state">
            <van-icon name="apps-o" size="48px" color="#d4d4d4" />
            <text class="empty-text">暂无分类</text>
          </view>
          <view wx:else class="cat-list">
            <view
              wx:for="{{categoryItems}}"
              wx:key="value"
              class="cat-item {{!item.enabled ? 'cat-disabled' : ''}}"
              wx:if="{{item.enabled !== false}}"
            >
              <text class="cat-name">{{item.label}}</text>
              <view class="cat-actions" wx:if="{{canManage}}">
                <view class="cat-btn" data-index="{{index}}" bindtap="onRenameCategoryTap">
                  <van-icon name="edit" size="16px" color="#6B7280" />
                </view>
                <view class="cat-btn cat-btn-danger" data-index="{{index}}" bindtap="onDeleteCategoryTap">
                  <van-icon name="delete-o" size="16px" color="#DC2626" />
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
```

- [ ] **Step 5: 追加分类管理样式**

在 `index.wxss` 末尾追加：

```css
/* ====== 分类管理 ====== */
.cat-header {
  display: flex;
  justify-content: flex-end;
  padding: 16rpx 24rpx;
}

.cat-add-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 20rpx;
  background: #EBF5FF;
  border-radius: 999rpx;
}

.cat-add-text {
  font-size: 26rpx;
  color: #1677FF;
  font-weight: 500;
}

.cat-list {
  padding: 0 24rpx 32rpx;
}

.cat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  background: #FFFFFF;
  border-radius: 12rpx;
  margin-bottom: 12rpx;
}

.cat-name {
  font-size: 30rpx;
  color: #1A1A1A;
  font-weight: 500;
}

.cat-actions {
  display: flex;
  gap: 12rpx;
}

.cat-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F5F7FA;
}

.cat-btn-danger {
  background: #FEF2F2;
}
```

- [ ] **Step 6: 验证**

模拟器进入 material/index Tab2 → 点"分类管理"sub-tab。

第一次进（数据库 dictionaries 表里没有 material_category）：
- 看到"加载中"短暂显示
- 然后 toast "已创建默认分类"
- 列表渲染 12 项默认分类（电气、水暖、门窗、消防、清洁、五金、滤芯类、轴承类、密封类、管路类、油漆涂料、通用）

后续进（已存在）：
- 直接渲染列表，不再 seed

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/index.js miniprogram/pages/material/index.wxml miniprogram/pages/material/index.wxss
git commit -m "feat(material): 分类管理子页 - 列表渲染 + 首次自动 seed 12 项默认

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 分类管理 — 新增 / 重命名 / 删除（软删）

**Files:**
- Modify: `miniprogram/pages/material/index.js`（onAddCategoryTap / onRenameCategoryTap / onDeleteCategoryTap + 共用 _saveCategoryItems）

**目标**：实现 dialog 收集输入 → 调 dictionaryAdmin.updateDictionary → 提交后 refreshCache + 重拉。重名校验。删除走软删（enabled=false）。

- [ ] **Step 1: 在 seedCategories 之后追加 3 个 handler 与 1 个 helper**

```js
  onAddCategoryTap() {
    wx.showModal({
      title: '新增分类',
      editable: true,
      placeholderText: '输入分类名称',
      success: (res) => {
        if (!res.confirm) return;
        const label = (res.content || '').trim();
        if (!label) {
          wx.showToast({ title: '名称不能为空', icon: 'none' });
          return;
        }
        // 重名校验（只看 enabled 项）
        const exists = this.data.categoryItems.some(
          i => i.enabled !== false && i.label === label
        );
        if (exists) {
          wx.showToast({ title: '该分类已存在', icon: 'none' });
          return;
        }
        const next = [
          ...this.data.categoryItems,
          {
            value: label,
            label,
            sort: this.data.categoryItems.length,
            enabled: true,
          },
        ];
        this._saveCategoryItems(next);
      },
    });
  },

  onRenameCategoryTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.categoryItems[index];
    if (!item) return;
    wx.showModal({
      title: '重命名分类',
      editable: true,
      content: item.label,
      placeholderText: '输入新的分类名称',
      success: (res) => {
        if (!res.confirm) return;
        const label = (res.content || '').trim();
        if (!label) {
          wx.showToast({ title: '名称不能为空', icon: 'none' });
          return;
        }
        if (label === item.label) return; // 没变
        const dup = this.data.categoryItems.some(
          (i, idx) => idx !== index && i.enabled !== false && i.label === label
        );
        if (dup) {
          wx.showToast({ title: '该分类已存在', icon: 'none' });
          return;
        }
        const next = this.data.categoryItems.map((i, idx) =>
          idx === index ? { ...i, label, value: label } : i
        );
        this._saveCategoryItems(next);
      },
    });
  },

  onDeleteCategoryTap(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.categoryItems[index];
    if (!item) return;
    wx.showModal({
      title: '确认删除',
      content: `删除分类「${item.label}」？已使用该分类的商品保留旧值。`,
      success: (res) => {
        if (!res.confirm) return;
        const next = this.data.categoryItems.map((i, idx) =>
          idx === index ? { ...i, enabled: false } : i
        );
        const remaining = next.filter(i => i.enabled !== false).length;
        this._saveCategoryItems(next, () => {
          if (remaining === 0) {
            wx.showToast({ title: '已删除最后一个分类，新品入库无可选项', icon: 'none', duration: 2500 });
          }
        });
      },
    });
  },

  async _saveCategoryItems(items, onSuccess) {
    const prev = this.data.categoryItems;
    this.setData({ categoryItems: items });   // 乐观 UI
    try {
      const result = await dictionaryAdmin.updateDictionary('material_category', items);
      if (result && result.success) {
        dictionary.refreshCache('material_category');
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        // 失败回滚
        this.setData({ categoryItems: prev });
        wx.showToast({ title: (result && result.error) || '保存失败', icon: 'none' });
      }
    } catch (e) {
      console.error('[Material] saveCategoryItems error:', e);
      this.setData({ categoryItems: prev });
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },
```

- [ ] **Step 2: 验证（按管理员/办美/经理）**

进分类管理子页 → 点"新增分类"→ 输入"测试 X"→ 确认 → 列表新增。

再点"新增分类"→ 输入"测试 X"→ 确认 → toast "该分类已存在"。

点列表"测试 X"右侧 ✏️ → 改成"测试 Y"→ 确认 → 列表项更新。

点"测试 Y"→ 🗑 → 二次确认 → 列表中消失。云开发数据库 `dictionaries` 表里 material_category items 仍有该项但 `enabled: false`。

- [ ] **Step 3: 验证错误回滚**

故意改 `dictionaryAdmin.updateDictionary` 的 dict_key（临时改成 `xxx`）让请求失败 → UI 回滚 → toast 错误。验证后改回。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/material/index.js
git commit -m "feat(material): 分类管理 CRUD - 新增/重命名/软删 + 失败回滚

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 维修员权限收紧 + 移除旧 showStockIn 弹窗 + sub-tab 角色过滤

**Files:**
- Modify: `miniprogram/pages/material/index.js`（onLoad 权限校验 / canManage 字段 / 移除 showStockIn 相关 data 与方法）
- Modify: `miniprogram/pages/material/index.wxml`（移除入库弹窗整段）

**目标**：维修员（role_id=3）进 material/index 直接 toast + navigateBack；非 canManageMaterial 用户看不见 FAB / 分类管理 sub-tab；删除既有 stockIn / stockOut 弹窗 UI 与 JS（出库弹窗也是冗余 — 仍保留一段时间，**只删入库的**）。

- [ ] **Step 1: 改 onLoad 权限校验（移除维修员）**

定位 `index.js` 第 92-103 行 onLoad：

```js
  onLoad() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || ![ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF, ROLES.MAINTENANCE_STAFF].includes(userInfo.role_id)) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({
      canManage: [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id)
    });
  },
```

替换为：

```js
  onLoad(query = {}) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    // 维修员（MAINTENANCE_STAFF=3）已被移除耗品访问权
    const canAccess = userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id);
    if (!canAccess) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // canManage = 与 canAccess 同集合（ADMIN/PROPERTY_MANAGER/PROPERTY_STAFF）
    const subTabsForRole = ['入库记录', '分类管理'];
    this.setData({
      canManage: true,
      subTabs: subTabsForRole,
    });

    // 支持 ?tab= & ?sub= deeplink
    const tab = parseInt(query.tab, 10);
    const sub = parseInt(query.sub, 10);
    if (!isNaN(tab) && tab >= 0 && tab <= 2) {
      this.setData({ activeTab: tab });
      if (tab === 1 && !isNaN(sub) && sub >= 0 && sub <= 1) {
        this.setData({ activeSubTab: sub });
        if (sub === 1) {
          this._ensureCategoriesLoaded();
        }
      }
    }
  },
```

> 说明：当前规则下 `canAccess === canManage`（都是 1/2/4）。spec §6.5 中"非 canManageMaterial 进入 Tab2"的"FAB 隐藏 + 分类管理子页隐藏"分支已不会触发（因为他们根本进不来）。这里 subTabsForRole 留给未来如果需要拆分时调整。

- [ ] **Step 2: 移除 data 中 showStockIn / stockInForm 字段**

定位 data 中：

```js
    // 弹窗
    showStockIn: false,
    showStockOut: false,

    // 入库表单
    stockInForm: {
      material_id: 0,
      material_name: '',
      quantity: '',
      remark: ''
    },
```

把 `showStockIn` / `stockInForm` 整段删除（保留 `showStockOut` / `stockOutForm` — 出库改造不在本期）：

```js
    // 出库弹窗
    showStockOut: false,
    stockOutForm: {
      material_id: 0,
      material_name: '',
      current_stock: 0,
      unit: '',
      quantity: '',
      remark: ''
    },
```

- [ ] **Step 3: 移除 showStockInModal / closeStockInModal / onStockInQtyInput / onStockInRemarkInput / doStockIn 方法**

在 `index.js` 文件中搜索并整块删除以下 5 个方法（约 280-360 行的范围，具体行号视改动而异）：
- `showStockInModal(e)`
- `closeStockInModal()`
- `onStockInQtyInput(e)`
- `onStockInRemarkInput(e)`
- `doStockIn()`

> 出库相关 5 个 (`showStockOutModal` 等) 保留不动。

- [ ] **Step 4: 移除 wxml 入库弹窗整段**

定位 wxml 第 268-305 行 `<!-- 入库弹窗 -->` 的 `<van-popup show="{{showStockIn}}" ...>` 到 `</van-popup>` 整段，**删除**。

> 出库弹窗（接下来一个 `<van-popup show="{{showStockOut}}" ...>`）保留。

- [ ] **Step 5: 验证（管理员）**

进 material/index → Tab2 → FAB 显示 → 分类管理 sub-tab 显示 → 一切正常。

进 material/detail → 不再有"入库"按钮触发的弹窗（因为我们没有调用过 showStockInModal 的入口；需要看看 detail 页是否还在调它）。

> ⚠️ 如果搜索 `showStockInModal` 在其它页面（如 detail）仍有引用，需要把那些引用删掉。Step 6 会扫一下。

- [ ] **Step 6: 扫描其它页面对已删方法的引用**

```bash
grep -rn "showStockInModal\|stockInForm\|showStockIn" miniprogram --include="*.js" --include="*.wxml" 2>/dev/null
```

预期：除 stock-in-form 这个新页面外，无其它引用。如果有，删除/改造之。

- [ ] **Step 7: 验证（维修员）**

把当前微信用户的 `users.role_id` 临时改为 3，刷新模拟器 → 首页不显示耗品 Tab（既有 isMaintenanceWorker 控制）→ 直接控制台 `wx.navigateTo({url:'/pages/material/index'})` → toast "无权限访问" → 1.5s 后退回。验证完改回原 role_id。

- [ ] **Step 8: 提交**

```bash
git add miniprogram/pages/material/index.js miniprogram/pages/material/index.wxml
git commit -m "refactor(material): 维修员权限收紧 + 移除入库弹窗（被 stock-in-form 页面替代）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: material/add 分类下拉源切换为字典

**Files:**
- Modify: `miniprogram/pages/material/add/index.js`

**目标**：把 add 页 data.categories 的硬编码改为运行时调 `dictionary.getOptions('material_category')`；onShow 强制 fresh 拉新（这样分类管理改完后下次 add 进来就同步）。

- [ ] **Step 1: 引入 dictionary 服务**

定位 add/index.js 顶部 require 区，在已有 require 之后追加：

```js
const dictionary = require('../../../services/dictionary');
```

- [ ] **Step 2: 改 data.categories 初始为空数组**

定位 data 中 `categories: ['电气', '水暖', '门窗', '消防', '通用'],` 改为：

```js
    categories: [],
```

- [ ] **Step 3: 加 onLoad / onShow 拉字典**

如果文件已有 onLoad / onShow，把 `loadCategories` 调用加到末尾。如果没有 onShow，新增之。整体形态：

```js
  async onLoad() {
    await this.loadCategories();
  },

  async onShow() {
    // 来自分类管理回流，强制 fresh
    dictionary.refreshCache('material_category');
    await this.loadCategories();
  },

  async loadCategories() {
    const options = await dictionary.getOptions('material_category');
    this.setData({
      categories: options || [],
    });
  },
```

> 注意：如果原 add/index.js 已存在 onLoad / onShow，**不要**整段替换，而是把上面 3 个方法体合并到既有方法里（onLoad 末尾追加 `await this.loadCategories()`，onShow 同理）。

- [ ] **Step 4: 验证**

进入 material/add 页 → 点"分类"下拉 → 应当看到当前 material_category 字典里 enabled=true 的所有项（首次约 12 项，已通过分类管理增删后会跟随变化）。

测试同步：
1. 在分类管理子页新增一个"测试 Z"
2. 立刻进 add 页 → 下拉里包含"测试 Z" ✓
3. 在分类管理删除"测试 Z"
4. 进 add 页 → 下拉里**不再**有"测试 Z" ✓

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/add/index.js
git commit -m "feat(material): add 页分类下拉源改为字典 material_category

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 首页 Tab2 耗品宫格"入库管理"接通跳转

**Files:**
- Modify: `miniprogram/pages/home/index.js`（onFunctionTap 路由 case）

**目标**：首页"入库管理"宫格按钮点击 → navigateTo `/pages/material/index?tab=1&sub=0`。

> **现状**：`miniprogram/pages/home/index.js:254-298` 的 `onFunctionTap` 里 module 为 `consumable` 的所有 label 当前都落到末尾 `wx.showToast({ title: label, icon: 'none' })` 占位 toast。

- [ ] **Step 1: 在 onFunctionTap 末尾 toast 之前插入 consumable 分支**

定位 `pages/home/index.js:296-298`：

```js
    // 后续添加页面跳转
    wx.showToast({ title: label, icon: 'none' })
  },
```

在 `// 后续添加页面跳转` 这行**之前**插入：

```js
    // 耗品管理 - 入库管理
    if (module === 'consumable' && label === '入库管理') {
      wx.navigateTo({
        url: '/pages/material/index?tab=1&sub=0',
        fail: (err) => {
          console.error('navigateTo failed:', err)
          wx.reLaunch({ url: '/pages/material/index?tab=1&sub=0' })
        }
      })
      return
    }

```

> 其它 consumable 项（出库管理 / 库存查询 / 库存盘点 / 快递管理 / 数据报表 / 申领审批 / 预警管理）依然走末尾 toast，不属于本期。

- [ ] **Step 3: 验证**

模拟器登录管理员 → 首页 → 切到 Tab2 耗品管理 → 点宫格"入库管理"→ 进入 material/index 直接落在 Tab2 的入库记录子页 → 顶部为"入库管理" sub-tabs 状态正确。

登录维修员 → 首页看不到 Tab2（既有 isMaintenanceWorker 控制） ✓

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/home/index.js
git commit -m "feat(home): 耗品宫格 入库管理 接通跳转

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: 全路径手动回归（按 spec §7）

**Files:** —

**目标**：按 spec 的验证清单跑完整回归，把通过项标记 ✓。

- [ ] **管理员（role_id=1）/ 行政经理（2）/ 办美员工（4）** — 各角色至少跑一次：

  - [ ] 首页 Tab2 → 宫格"入库管理" → 落在 material/index Tab2 入库记录子页
  - [ ] FAB ➕ 显示 → 点击 → ActionSheet 两项可见（扫码入库 / 新品入库）
  - [ ] 扫码已有商品 → stock-in-form 跳转，商品信息正确 → 数量+备注 → 提交 → 列表顶部新记录、materials.stock 累加正确
  - [ ] 扫码不存在编号（用 DevTools 模拟扫码输入随机字符串）→ modal "未登记"
  - [ ] 取消扫码 → 静默返回，无 toast
  - [ ] FAB → "新品入库" → add 页打开 → 分类下拉显示 12 项（首次）→ 提交 → 配件列表与入库记录都已刷新
  - [ ] 切到分类管理 sub-tab → 12 项默认分类
  - [ ] 新增"测试X" → 列表立即出现 → 进 add 页下拉同步含"测试X"
  - [ ] 重命名"测试X"为"测试Y" → 列表更新 → add 页下拉同步
  - [ ] 删除"测试Y" → 列表移除 → add 页下拉无"测试Y"；查 dictionaries 表对应 items 中 `{label:'测试Y', enabled:false}` 软删保留
  - [ ] 删除最后一个分类 → toast 提醒"已删除最后一个分类，新品入库无可选项"

- [ ] **维修员（role_id=3）**：

  - [ ] 首页看不到 Tab2 耗品（既有 isMaintenanceWorker 控制）
  - [ ] 直接 navigateTo `/pages/material/index` → toast "无权限访问" → 1.5s 后 navigateBack
  - [ ] 工单 completeRepair → 仍能正常扣库存（在工单详情页测试一次完成维修）

- [ ] **数据正确性**：

  - [ ] 扫码入库提交后，云开发数据库 `materials` 对应记录 `stock` 自增、`updated_at` 更新
  - [ ] 同时 `material_records` 新增一条 `type='in'`，所有字段与入参对齐
  - [ ] 分类管理改完后 `dictionaries` 表 `dict_key='material_category'` 的 items 数组按预期变化
  - [ ] enabled=false 项不在 dictionary.getOptions 返回里（add 页下拉无该项）

- [ ] **回归非耗品模块**：

  - [ ] 工单提报/编辑/详情 不受影响
  - [ ] admin/dict 后台仍能管理 material_category 字典（用管理员账号进 admin/dict/items?dict_key=material_category，能看到含本期改动后所有 items）
  - [ ] 既有 material_records / materials 数据 显示无异常

- [ ] **总结收尾提交**

如果全部通过，无需额外代码改动；如果发现缺陷，回到对应 Task 修复并加 commit。验证完成后追加一条空 commit 标记完成：

```bash
git commit --allow-empty -m "chore(material): 入库管理改造回归测试通过

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 已知风险 & 可能的踩坑

1. **wx.scanCode 真机权限**：模拟器扫码功能会自动唤起 DevTools 的"扫码模拟器"，输入字符串后即返回。真机首次需要授权相机权限。
2. **dictionaries 集合自动建**：CloudBase 默认开启"按需自建集合"。若环境关闭，分类管理 seed 时 createDictionary 会失败 — 需要用管理员手动在云开发控制台建 `dictionaries` 集合。
3. **dictionary.js 缓存**：分类管理改完调了 `refreshCache('material_category')`。但 add 页若已经在路由栈里没销毁，setData 不会主动触发；onShow 强制 refreshCache 保证下次进 add 是新鲜数据。
4. **app.json 注册顺序**：新页面 `pages/material/stock-in-form/index` 必须放在 `pages` 数组中，否则 navigateTo 会找不到。Task 5 已加入。
5. **stock-in-form 与 ActionSheet 取消**：iOS 上 `wx.showActionSheet` 取消会触发 reject，需要 `success` 处理；目前用 `success` callback，取消会进 `fail`，这里**不需要处理**（相当于啥也不做）。如要兼容也可加 `fail() {}`。
6. **既有 admin/dict 与新分类管理共存**：管理员既能在新页面管，也能在 admin/dict/items?dict_key=material_category 管。两边操作同一份字典，互相生效。无冲突。
