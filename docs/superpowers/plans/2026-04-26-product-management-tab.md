# 入库管理：商品管理 Tab + Modal + 位置字段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stock-in 页加第 3 个 sub-tab"商品管理"（共享 material-list 组件）；FAB 改为直接扫码 + Modal 收数量/位置/备注；扫不识别 → 引导去商品管理添加（编号 prefill）；新建 material_location 字典；删除旧 stock-in-form 独立页。

**Architecture:** 微信小程序 + 微信云开发。基于已落地的"拆 stock-in 独立页"成果，叠加：(1) 抽 material-list custom component 共享给 material/index Tab0 + stock-in 商品管理 sub-tab；(2) Modal 内联在 stock-in 页（取代 stock-in-form 独立页）；(3) 云函数 stockIn 接收 location 参数仅写入 material_records；(4) dictionaryManager 写权限白名单加 material_location。

**Tech Stack:** WXML / WXSS / JS（小程序原生），@vant/weapp（icon, button, popup, picker），wx-server-sdk（云函数），CloudBase（dictionaries / materials / material_records 集合）。无自动化测试框架，**所有验证通过微信开发者工具的"模拟器 / 云函数测试 / 真机扫码"完成**。

---

## 影响文件结构

```
新建（4 文件）：
  miniprogram/components/material-list/index.js
  miniprogram/components/material-list/index.wxml
  miniprogram/components/material-list/index.wxss
  miniprogram/components/material-list/index.json

改造（7 文件）：
  miniprogram/pages/material/stock-in/index.{js,wxml,wxss,json}    sub-tab 商品管理 + Modal + directScan + loadLocationOptions
  miniprogram/pages/material/index.{js,wxml,wxss}                  Tab0 接入 <material-list>
  miniprogram/pages/material/add/index.js                          onLoad 接 query.material_number prefill
  miniprogram/services/materialService.js                          stockIn 加 location 参数
  cloudfunctions/materialManager/index.js                          stockIn 写 material_records.usage_area = location || material.usage_area
  cloudfunctions/dictionaryManager/index.js                        material_location 加入写权限白名单
  miniprogram/app.json                                             移除 pages/material/stock-in-form/index 路径

删除（4 文件 + 1 个目录）：
  miniprogram/pages/material/stock-in-form/index.{js,wxml,wxss,json}
  miniprogram/pages/material/stock-in-form/                        (空目录最终删除)
```

## 实施顺序

```
Phase 1 后端基础                  → Task 1, 2
Phase 2 前端服务层                 → Task 3
Phase 3 组件 material-list         → Task 4, 5
Phase 4 material/index 接入组件   → Task 6
Phase 5 stock-in 页改造            → Task 7, 8, 9, 10
Phase 6 add 页 prefill            → Task 11
Phase 7 清理 stock-in-form        → Task 12
Phase 8 全路径手动回归            → Task 13
```

每个 Task 完成后单独 commit。

---

## Task 1: dictionaryManager 加 material_location 写权限白名单

**Files:**
- Modify: `cloudfunctions/dictionaryManager/index.js:212-220`

**目标**：把 `isMaterialCategory` 单值判断改为白名单，让 `material_location` 字典也被 canManageMaterial 角色（1/2/4）放行写权限。

- [ ] **Step 1: 替换权限判断块**

定位 `cloudfunctions/dictionaryManager/index.js` 第 212-220 行附近：

```js
      const user = await getCurrentUser(OPENID);
      // material_category 字典：放给 canManageMaterial（管理员/行政经理/办美员工）
      const isMaterialCategory = data && data.dict_key === 'material_category';
      const canManageMaterial = user && [1, 2, 4].includes(user.role_id) && user.active !== false;
      const isAdminUser = user && user.role_id === 1 && user.active !== false;

      const allowed = isAdminUser || (isMaterialCategory && canManageMaterial);
```

替换为：

```js
      const user = await getCurrentUser(OPENID);
      // 物料相关字典：放给 canManageMaterial（管理员/行政经理/办美员工）写
      const MANAGE_MATERIAL_DICTS = ['material_category', 'material_location'];
      const isManageMaterialDict = data && MANAGE_MATERIAL_DICTS.includes(data.dict_key);
      const canManageMaterial = user && [1, 2, 4].includes(user.role_id) && user.active !== false;
      const isAdminUser = user && user.role_id === 1 && user.active !== false;

      const allowed = isAdminUser || (isManageMaterialDict && canManageMaterial);
```

- [ ] **Step 2: 部署云函数**

微信开发者工具 → 右键 `cloudfunctions/dictionaryManager` → "上传并部署：云端安装依赖"。

- [ ] **Step 3: 验证**

云开发 → 云函数 → `dictionaryManager` → 测试 → 用 role_id=4 身份调：
- action `update`, data `{dict_key:'material_location', items:[{value:'测试',label:'测试',sort:0,enabled:true}]}` → 预期 `success:true` 或字典不存在的"X 不存在"错误（**重点：不应该是"无权限"错误**）
- action `update`, data `{dict_key:'department', items:[]}` → 预期 `success:false, error:'无权限：只有管理员可以执行此操作'`

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/dictionaryManager/index.js
git commit -m "$(cat <<'EOF'
feat(dictionary): material_location 字典写权限放给 canManageMaterial

把 isMaterialCategory 单值判断改为白名单 MANAGE_MATERIAL_DICTS，
新加的 material_location 也由办美员工(4)/行政经理(2)写。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: materialManager stockIn 接收 location 参数

**Files:**
- Modify: `cloudfunctions/materialManager/index.js:172-218`（stockIn case）

**目标**：stockIn 入参增加可选 `location`，写入 material_records.usage_area 时优先用 location，无则 fallback 到 material.usage_area。**不修改 material 表**。

- [ ] **Step 1: 改 stockIn case 的解构 + usage_area 写入**

定位 `cloudfunctions/materialManager/index.js` stockIn case，找到：

```js
        const { material_id, quantity, remark = '' } = data;
```

改为：

```js
        const { material_id, quantity, remark = '', location = '' } = data;
```

然后定位同一 case 内 `material_records.add` 的 data 块（约第 201-218 行），找到：

```js
            usage_area: material.usage_area || '',
```

改为：

```js
            usage_area: location || material.usage_area || '',
```

- [ ] **Step 2: 部署云函数**

微信开发者工具 → 右键 `cloudfunctions/materialManager` → "上传并部署"。

- [ ] **Step 3: 验证**

云开发 → 云函数 → `materialManager` → 测试 → action `stockIn`：
- 入参 `{data:{material_id:1, quantity:1, remark:'test', location:'主仓库'}}` → 预期 `success:true`，去数据库查 `material_records` 最新一条 usage_area === '主仓库'
- 入参 `{data:{material_id:1, quantity:1, remark:'test'}}`（不传 location）→ 预期 `success:true`，新记录 usage_area === material.usage_area（向后兼容）
- 查 `materials` 表 material_id=1 → usage_area 字段不变（确认 material 表没被改）

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(material): stockIn 接收 location 参数写入 material_records

material_records.usage_area = location (用户输入) || material.usage_area (fallback)
material 表 usage_area 字段不变。向后兼容：旧调用方不传 location 行为同前。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: materialService.stockIn 加 location 参数

**Files:**
- Modify: `miniprogram/services/materialService.js:31-37`（stockIn 函数）

**目标**：前端 service wrapper 暴露 location 入参，透传到云函数。

- [ ] **Step 1: 改函数签名**

定位 `miniprogram/services/materialService.js` 第 31-37 行的 stockIn：

```js
const stockIn = async (material_id, quantity, remark = '') => {
  return callCloud('materialManager', {
    action: 'stockIn',
    data: { material_id, quantity, remark }
  }, { loadingText: '入库中...' });
};
```

替换为：

```js
const stockIn = async (material_id, quantity, remark = '', location = '') => {
  return callCloud('materialManager', {
    action: 'stockIn',
    data: { material_id, quantity, remark, location }
  }, { loadingText: '入库中...' });
};
```

- [ ] **Step 2: 验证**

模拟器中临时在某 page onLoad 加：

```js
const ms = require('../../services/materialService');
ms.stockIn(1, 1, 'test', '主仓库').then(console.log);
```

预期：返回 `{success:true, message:'入库成功'}`。验证后撤回临时代码。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/services/materialService.js
git commit -m "$(cat <<'EOF'
feat(materialService): stockIn 加 location 参数

向后兼容默认 location=''。stock-in modal 提交时传入用户在 picker 选的位置值。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 创建 material-list 组件（骨架 + 列表渲染 + reload）

**Files:**
- Create: `miniprogram/components/material-list/index.json`
- Create: `miniprogram/components/material-list/index.js`
- Create: `miniprogram/components/material-list/index.wxml`
- Create: `miniprogram/components/material-list/index.wxss`

**目标**：抽出商品列表 UI 为 custom component。本任务做骨架 + 列表渲染 + reload 方法（不含搜索/筛选/CRUD 菜单 — 下个 task）。

- [ ] **Step 1: 创建 index.json**

```json
{
  "component": true,
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index"
  }
}
```

- [ ] **Step 2: 创建 index.js（骨架版）**

```js
/**
 * 商品列表组件（共享）
 * 用于 stock-in 页 商品管理 sub-tab + material/index Tab0 配件列表
 */

const materialService = require('../../services/materialService');

Component({
  properties: {
    canManage: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    keyword: '',
    materialFilter: '全部',
    materials: [],
    filteredMaterials: [],
    warningCount: 0,
    shortageCount: 0,
    loading: true,
    loadingMore: false,
    materialPage: 1,
    materialTotal: 0,
  },

  lifetimes: {
    attached() {
      this.loadMaterials();
    },
  },

  methods: {
    async loadMaterials(append = false) {
      if (!append) {
        this.setData({ loading: true, materialPage: 1 });
      }
      try {
        const result = await materialService.listMaterials(
          this.data.keyword,
          this.data.materialPage
        );
        const all = append
          ? [...this.data.materials, ...result.materials]
          : result.materials;
        this.setData({
          materials: all,
          materialTotal: result.total,
          loading: false,
          loadingMore: false,
        });
        this._applyFilter();
      } catch (e) {
        console.error('[MaterialList] Load error:', e);
        this.setData({ loading: false, loadingMore: false });
      }
    },

    _applyFilter() {
      const { materials, materialFilter } = this.data;
      const warningCount = materials.filter(m => m.min_stock > 0 && m.stock > 0 && m.stock <= m.min_stock).length;
      const shortageCount = materials.filter(m => m.stock === 0).length;
      let filtered;
      if (materialFilter === '缺货') {
        filtered = materials.filter(m => m.stock === 0);
      } else if (materialFilter === '预警') {
        filtered = materials.filter(m => m.min_stock > 0 && m.stock > 0 && m.stock <= m.min_stock);
      } else {
        filtered = materials;
      }
      this.setData({ filteredMaterials: filtered, warningCount, shortageCount });
    },

    onLoadMore() {
      if (this.data.loadingMore) return;
      if (this.data.materials.length >= this.data.materialTotal) return;
      this.setData({
        loadingMore: true,
        materialPage: this.data.materialPage + 1,
      });
      this.loadMaterials(true);
    },

    onCardTap(e) {
      const material = e.currentTarget.dataset.material;
      this.triggerEvent('itemtap', { material });
    },

    // 公开方法：父页 onShow 时主动刷新
    reload() {
      this.loadMaterials();
    },
  },
});
```

- [ ] **Step 3: 创建 index.wxml（骨架版 — 仅卡片渲染）**

```xml
<view class="material-list">
  <scroll-view scroll-y class="list-scroll" bindscrolltolower="onLoadMore">
    <view wx:if="{{loading}}" class="loading-state">
      <text>加载中...</text>
    </view>

    <view wx:elif="{{filteredMaterials.length === 0}}" class="empty-state">
      <van-icon name="gift-o" size="48px" color="#d4d4d4" />
      <text class="empty-text">暂无配件</text>
    </view>

    <view wx:else class="card-list">
      <view
        wx:for="{{filteredMaterials}}"
        wx:key="material_id"
        class="m-card"
        bindtap="onCardTap"
        data-material="{{item}}"
      >
        <image
          class="m-card-img"
          src="{{item.images[0] || '/images/placeholder.png'}}"
          mode="aspectFill"
        />
        <view class="m-card-body">
          <view class="m-card-title">{{item.name}} {{item.material_number || ''}}</view>
          <view class="m-card-fields">
            <view class="m-card-field-col">
              <view class="m-card-meta" wx:if="{{item.spec}}">
                <van-icon name="description-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.spec}}</text>
              </view>
              <view class="m-card-meta" wx:if="{{item.usage_area}}">
                <van-icon name="location-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.usage_area}}</text>
              </view>
            </view>
            <view class="m-card-field-col">
              <view class="m-card-meta" wx:if="{{item.category}}">
                <van-icon name="apps-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.category}}</text>
              </view>
              <view class="m-card-meta" wx:if="{{item.model}}">
                <van-icon name="label-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.model}}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="m-card-stock {{item.stock === 0 ? 'stock-danger' : (item.stock <= item.min_stock && item.min_stock > 0 ? 'stock-warning' : 'stock-ok')}}">
          {{item.stock}}
        </view>
        <view class="stock-tag {{item.stock === 0 ? 'stock-tag-danger' : (item.stock <= item.min_stock && item.min_stock > 0 ? 'stock-tag-warning' : 'stock-tag-ok')}}">
          {{item.stock === 0 ? '缺货' : (item.stock <= item.min_stock && item.min_stock > 0 ? '预警' : '正常')}}
        </view>
      </view>
    </view>

    <view wx:if="{{loadingMore}}" class="loading-more">
      <text>加载更多...</text>
    </view>
  </scroll-view>
</view>
```

- [ ] **Step 4: 创建 index.wxss**

```css
.material-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 24rpx 32rpx;
  box-sizing: border-box;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
  color: #a3a3a3;
  font-size: 28rpx;
}

.empty-text {
  margin-top: 16rpx;
  color: #a3a3a3;
  font-size: 28rpx;
}

.loading-more {
  text-align: center;
  padding: 24rpx;
  color: #a3a3a3;
  font-size: 24rpx;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.m-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  position: relative;
  overflow: hidden;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24rpx;
  padding: 24rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.95);
  border-left: 1rpx solid rgba(255, 255, 255, 0.6);
  border-right: 1rpx solid rgba(255, 255, 255, 0.6);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.03);
  box-shadow:
    inset 0 2rpx 4rpx rgba(255, 255, 255, 0.8),
    inset 0 -1rpx 3rpx rgba(0, 0, 0, 0.015),
    0 2rpx 4rpx rgba(0, 0, 0, 0.02),
    0 8rpx 16rpx rgba(0, 0, 0, 0.035),
    0 16rpx 32rpx -8rpx rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.m-card:active {
  transform: scale(0.98);
  opacity: 0.85;
}

.m-card-img {
  width: 148rpx;
  height: 152rpx;
  margin: -16rpx 0 -16rpx -16rpx;
  border-radius: 10rpx 16rpx 16rpx 10rpx;
  flex-shrink: 0;
  background: #f0f0f0;
}

.m-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.m-card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-top: -6rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  overflow: hidden;
  white-space: nowrap;
}

.m-card-meta {
  font-size: 22rpx;
  color: #a3a3a3;
  display: flex;
  align-items: center;
  gap: 4rpx;
  overflow: hidden;
  white-space: nowrap;
}

.m-card-fields {
  display: flex;
  gap: 48rpx;
}

.m-card-field-col {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.m-card-stock {
  font-size: 40rpx;
  font-weight: 700;
  flex-shrink: 0;
  min-width: 60rpx;
  text-align: right;
}

.stock-ok { color: #16A34A; }
.stock-warning { color: #F59E0B; }
.stock-danger { color: #DC2626; }

.stock-tag {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 20rpx;
  font-weight: 500;
  padding: 6rpx 16rpx;
  border-radius: 0 24rpx 0 12rpx;
}

.stock-tag-ok { color: #16A34A; background: #ECFDF5; }
.stock-tag-warning { color: #F59E0B; background: #FFFBEB; }
.stock-tag-danger { color: #DC2626; background: #FEF2F2; }
```

- [ ] **Step 5: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/components/material-list/index.js
```

预期：无输出（无语法错误）。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/components/material-list/
git commit -m "$(cat <<'EOF'
feat(component): 新建 material-list 组件骨架（列表+分页+reload）

抽出商品卡片列表 UI 为 custom component。本任务含：
- 数据 + listMaterials 调用 + 分页加载更多
- 卡片渲染（图/名/编号/规格/位置/分类/型号/库存）
- triggerEvent('itemtap') + reload() 方法
不含：搜索/筛选/CRUD 菜单（下一 Task）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: material-list 加搜索 / 筛选 / CRUD（编辑/删除/新增）

**Files:**
- Modify: `miniprogram/components/material-list/index.js`
- Modify: `miniprogram/components/material-list/index.wxml`
- Modify: `miniprogram/components/material-list/index.wxss`

**目标**：在 Task 4 骨架上加搜索栏、状态筛选（全部/预警/缺货）、卡片右上角 ⋯ 菜单（编辑/删除）+ 顶部"新增商品"按钮（仅 canManage）。

- [ ] **Step 1: 在 index.js 加事件 handler**

打开 `miniprogram/components/material-list/index.js`，在 `onCardTap` 之后插入：

```js
    onCardMenuTap(e) {
      // 阻止冒泡到卡片 tap
      const material = e.currentTarget.dataset.material;
      wx.showActionSheet({
        itemList: ['编辑', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.navigateTo({ url: `/pages/material/edit/index?id=${material.material_id}` });
          } else if (res.tapIndex === 1) {
            this._confirmDelete(material);
          }
        },
      });
    },

    _confirmDelete(material) {
      wx.showModal({
        title: '确认删除',
        content: `删除「${material.name}」？此操作不可撤销。`,
        success: (res) => {
          if (res.confirm) this._optimisticDelete(material);
        },
      });
    },

    async _optimisticDelete(material) {
      const prev = this.data.materials;
      const next = prev.filter(m => m.material_id !== material.material_id);
      this.setData({ materials: next });
      this._applyFilter();
      try {
        const result = await materialService.deleteMaterial(material.material_id);
        if (!result || !result.success) {
          this.setData({ materials: prev });
          this._applyFilter();
          wx.showToast({ title: (result && result.error) || '删除失败', icon: 'none' });
        } else {
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      } catch (e) {
        console.error('[MaterialList] delete error:', e);
        this.setData({ materials: prev });
        this._applyFilter();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    },

    onAddTap() {
      this.triggerEvent('additem', {});
    },

    onSearchInput(e) {
      this.setData({ keyword: e.detail.value });
    },

    onSearchConfirm() {
      this.loadMaterials();
    },

    onFilterTap(e) {
      const filter = e.currentTarget.dataset.filter;
      if (filter === this.data.materialFilter) return;
      this.setData({ materialFilter: filter });
      this._applyFilter();
    },
```

- [ ] **Step 2: 改 index.wxml — 顶部加搜索栏 + 筛选 + 新增按钮 + 卡片加菜单图标**

替换整个 `index.wxml` 内容为：

```xml
<view class="material-list">
  <view class="ml-header">
    <view class="ml-search-row">
      <view class="ml-search-bar">
        <van-icon name="search" size="14px" color="#a3a3a3" />
        <input
          class="ml-search-input"
          placeholder="搜索配件名称、编号"
          placeholder-class="ml-search-placeholder"
          value="{{keyword}}"
          bindinput="onSearchInput"
          bindconfirm="onSearchConfirm"
        />
      </view>
      <view wx:if="{{canManage}}" class="ml-add-btn" bindtap="onAddTap">
        <van-icon name="plus" size="18px" color="#FFFFFF" />
        <text class="ml-add-text">新增</text>
      </view>
    </view>

    <view class="ml-filter">
      <view
        class="ml-filter-tag {{materialFilter === '全部' ? 'ml-filter-active' : ''}}"
        data-filter="全部"
        bindtap="onFilterTap"
      >全部</view>
      <view
        class="ml-filter-tag {{materialFilter === '预警' ? 'ml-filter-active' : ''}}"
        data-filter="预警"
        bindtap="onFilterTap"
      >预警<text wx:if="{{warningCount > 0}}" class="ml-badge ml-badge-warning">{{warningCount}}</text></view>
      <view
        class="ml-filter-tag {{materialFilter === '缺货' ? 'ml-filter-active' : ''}}"
        data-filter="缺货"
        bindtap="onFilterTap"
      >缺货<text wx:if="{{shortageCount > 0}}" class="ml-badge ml-badge-danger">{{shortageCount}}</text></view>
    </view>
  </view>

  <scroll-view scroll-y class="list-scroll" bindscrolltolower="onLoadMore">
    <view wx:if="{{loading}}" class="loading-state">
      <text>加载中...</text>
    </view>

    <view wx:elif="{{filteredMaterials.length === 0}}" class="empty-state">
      <van-icon name="gift-o" size="48px" color="#d4d4d4" />
      <text class="empty-text">暂无配件</text>
    </view>

    <view wx:else class="card-list">
      <view
        wx:for="{{filteredMaterials}}"
        wx:key="material_id"
        class="m-card"
        bindtap="onCardTap"
        data-material="{{item}}"
      >
        <image
          class="m-card-img"
          src="{{item.images[0] || '/images/placeholder.png'}}"
          mode="aspectFill"
        />
        <view class="m-card-body">
          <view class="m-card-title">{{item.name}} {{item.material_number || ''}}</view>
          <view class="m-card-fields">
            <view class="m-card-field-col">
              <view class="m-card-meta" wx:if="{{item.spec}}">
                <van-icon name="description-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.spec}}</text>
              </view>
              <view class="m-card-meta" wx:if="{{item.usage_area}}">
                <van-icon name="location-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.usage_area}}</text>
              </view>
            </view>
            <view class="m-card-field-col">
              <view class="m-card-meta" wx:if="{{item.category}}">
                <van-icon name="apps-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.category}}</text>
              </view>
              <view class="m-card-meta" wx:if="{{item.model}}">
                <van-icon name="label-o" size="11px" color="#a3a3a3" />
                <text style="margin-left: 4rpx;">{{item.model}}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="m-card-stock {{item.stock === 0 ? 'stock-danger' : (item.stock <= item.min_stock && item.min_stock > 0 ? 'stock-warning' : 'stock-ok')}}">
          {{item.stock}}
        </view>
        <view class="stock-tag {{item.stock === 0 ? 'stock-tag-danger' : (item.stock <= item.min_stock && item.min_stock > 0 ? 'stock-tag-warning' : 'stock-tag-ok')}}">
          {{item.stock === 0 ? '缺货' : (item.stock <= item.min_stock && item.min_stock > 0 ? '预警' : '正常')}}
        </view>

        <view
          wx:if="{{canManage}}"
          class="m-card-menu"
          catchtap="onCardMenuTap"
          data-material="{{item}}"
        >
          <van-icon name="ellipsis" size="20px" color="#9CA3AF" />
        </view>
      </view>
    </view>

    <view wx:if="{{loadingMore}}" class="loading-more">
      <text>加载更多...</text>
    </view>
  </scroll-view>
</view>
```

> **关键**：卡片右上角菜单按钮使用 `catchtap="onCardMenuTap"`（不是 bindtap）阻止事件冒泡到卡片本身，避免点 ⋯ 同时触发详情跳转。

- [ ] **Step 3: 在 index.wxss 末尾追加新样式**

```css
/* ====== Header ====== */
.ml-header {
  flex-shrink: 0;
  padding: 16rpx 24rpx 0;
}

.ml-search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.ml-search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 20rpx;
  padding: 0 24rpx;
  height: 72rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}

.ml-search-input {
  flex: 1;
  font-size: 26rpx;
  color: #0a0a0a;
  margin-left: 12rpx;
}

.ml-search-placeholder {
  color: #c0c0c0;
  font-size: 26rpx;
}

.ml-add-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background: #1677FF;
  border-radius: 20rpx;
  padding: 0 22rpx;
  height: 72rpx;
}

.ml-add-btn:active { opacity: 0.85; }

.ml-add-text {
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 600;
}

.ml-filter {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.ml-filter-tag {
  padding: 8rpx 26rpx;
  border-radius: 28rpx;
  font-size: 22rpx;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.6);
  color: #737373;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  position: relative;
}

.ml-filter-active {
  background: #1a1a1a;
  color: #FFFFFF;
  border-color: #1a1a1a;
}

.ml-badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  font-size: 18rpx;
  font-weight: 600;
  line-height: 28rpx;
  text-align: center;
  color: white;
}

.ml-badge-warning { background: #F59E0B; }
.ml-badge-danger { background: #EF4444; }

/* 卡片菜单按钮 */
.m-card-menu {
  position: absolute;
  top: 8rpx;
  right: 36rpx;
  padding: 12rpx;
}
.m-card-menu:active {
  opacity: 0.6;
}
```

- [ ] **Step 4: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/components/material-list/index.js
```

预期：无输出。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/components/material-list/
git commit -m "$(cat <<'EOF'
feat(component): material-list 加搜索/筛选/CRUD 菜单

- 顶部搜索栏 + 状态筛选（全部/预警/缺货）+ 新增按钮（仅 canManage）
- 卡片右上 ⋯ → ActionSheet（编辑/删除）
- 删除：modal 确认 + 乐观 UI（先移除再调云函数，失败回滚）
- triggerEvent('additem') 给父页跳 add 页

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: material/index Tab0 接入 material-list 组件

**Files:**
- Modify: `miniprogram/pages/material/index.json`
- Modify: `miniprogram/pages/material/index.js`
- Modify: `miniprogram/pages/material/index.wxml`
- Modify: `miniprogram/pages/material/index.wxss`

**目标**：material/index Tab0 配件列表整段（搜索栏+筛选+卡片渲染+列表逻辑）替换为 `<material-list>` 组件，删除已迁入组件的 page 内 JS/WXSS。

- [ ] **Step 1: 改 index.json — 注册 material-list 组件**

定位 `miniprogram/pages/material/index.json`，在 `usingComponents` 块加：

```json
{
  "navigationBarTitleText": "物料管理",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index",
    "van-search": "@vant/weapp/search/index",
    "van-tag": "@vant/weapp/tag/index",
    "van-field": "@vant/weapp/field/index",
    "van-popup": "@vant/weapp/popup/index",
    "material-list": "/components/material-list/index"
  }
}
```

- [ ] **Step 2: 改 index.wxml — Tab0 改用组件**

定位 `miniprogram/pages/material/index.wxml` Tab 1 整个 swiper-item 块（约第 25-124 行的"配件列表"段），替换为：

```xml
    <!-- Tab 1: 配件列表 -->
    <swiper-item>
      <material-list
        id="materialList"
        canManage="{{canManage}}"
        bind:itemtap="onMaterialTap"
        bind:additem="onAddMaterialTap"
      />
    </swiper-item>
```

其它 Tab 不动。

- [ ] **Step 3: 改 index.js — 删迁移到组件的方法 + 添加新事件 handler**

定位 `miniprogram/pages/material/index.js`，删除以下数据/方法（已搬到组件）：

- data 中：`keyword`、`materials`、`filteredMaterials`、`materialFilter`、`loading`、`loadingMore`、`materialPage`、`materialTotal`、`warningCount`（如果存在）、`shortageCount`（如果存在）、`showBackToTop`、`materialScrollTopTarget`
- 方法：`loadMaterials`、`onSearchChange`、`onSearch`、`onLoadMore`、`onMaterialFilterChange`、`_applyMaterialFilter`、`goToDetail`、`onMaterialScroll`、`scrollToTop`

保留的 data 字段（仅出库相关）：
```js
data: {
  activeTab: 0,
  tabs: ['配件列表', '出库记录'],
  canManage: false,

  // 出库记录
  outRecords: [],
  outLoading: true,
  outLoadingMore: false,
  outPage: 1,
  outTotal: 0,

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
},
```

修改 onShow（删原 loadMaterials 调用，改为通过组件 reload）：

```js
onShow() {
  if (!this._tabLoaded) {
    this._tabLoaded = { 0: true };
    return;
  }
  // 从 add/edit/detail 返回 → 商品列表 reload
  if (this.data.activeTab === 0) {
    const list = this.selectComponent('#materialList');
    if (list) list.reload();
    if (this._tabLoaded && this._tabLoaded[1]) this.loadRecords('out');
  }
},
```

修改 _ensureTabLoaded（移除 0 索引的 loadMaterials）：

```js
_ensureTabLoaded(index) {
  if (this._tabLoaded && this._tabLoaded[index]) return;
  if (!this._tabLoaded) this._tabLoaded = {};
  this._tabLoaded[index] = true;

  if (index === 1) this.loadRecords('out');
  // index 0 配件列表由组件自加载，无需 page 处理
},
```

修改 onPullDownRefresh:

```js
onPullDownRefresh() {
  if (this.data.activeTab === 0) {
    const list = this.selectComponent('#materialList');
    if (list) list.reload();
    setTimeout(() => wx.stopPullDownRefresh(), 300);
  } else if (this.data.activeTab === 1) {
    this.loadRecords('out').then(() => wx.stopPullDownRefresh());
  } else {
    wx.stopPullDownRefresh();
  }
},
```

新增（替代 goToAddMaterial 和 goToDetail 的事件 handler）：

```js
onMaterialTap(e) {
  const material = e.detail.material;
  wx.navigateTo({ url: `/pages/material/detail/index?id=${material.material_id}` });
},

onAddMaterialTap() {
  wx.navigateTo({ url: '/pages/material/add/index' });
},
```

保留旧的 `goToAddMaterial`（FAB bindtap 仍指向它）— 让其内部调 `onAddMaterialTap`，或直接把 wxml FAB 的 `bindtap="goToAddMaterial"` 改成 `bindtap="onAddMaterialTap"` 后**删除** `goToAddMaterial` 方法。建议改 wxml + 删 method，更干净。

- [ ] **Step 4: 改 index.wxml — FAB bindtap 切换**

定位 wxml 中 FAB 段：

```xml
  <view wx:if="{{canManage && activeTab === 0}}" class="fab-button" bindtap="goToAddMaterial">
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

改 `bindtap="goToAddMaterial"` → `bindtap="onAddMaterialTap"`：

```xml
  <view wx:if="{{canManage && activeTab === 0}}" class="fab-button" bindtap="onAddMaterialTap">
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

回到 index.js，**删除** `goToAddMaterial` 方法整段。

- [ ] **Step 5: 改 index.wxss — 删迁入组件的样式**

打开 `miniprogram/pages/material/index.wxss`，**删除**以下样式选择器（已迁入组件，page 不再使用）：

- `.search-bar` / `.search-input` / `.search-placeholder` / `.search-row` / `.search-bar-flex` / `.filter-btn` 整组
- `.warn-filter` / `.warn-filter-tag` / `.warn-filter-active` / `.filter-badge` / `.badge-warning` / `.badge-danger` 整组
- `.card-list` / `.m-card` / `.m-card-img` / `.m-card-body` / `.m-card-title` / `.m-card-meta` / `.m-card-fields` / `.m-card-field-col` / `.m-card-stock` / `.stock-ok/warning/danger` / `.stock-tag` 等组（出库 Tab 的卡片仍在 wxml 里 inline 用 — 注意不能全删，只删 page wxml 不再使用的）

**简化做法**：保留所有现有样式（不主动删），后续随便。本任务**只确保功能正常**，CSS 死代码清理可在 Task 13 验证后做。**WXSS 不动**。

- [ ] **Step 6: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/index.js
```

预期：无输出。

- [ ] **Step 7: 模拟器实测**

打开微信开发者工具，进入物料管理（首页 Tab1 → 物料管理宫格）：
- 应正常显示配件列表（搜索/筛选/卡片）
- 点卡片 → 进 detail
- 点右上 ⋯ → ActionSheet（编辑/删除）
- 点 FAB ➕ → 跳 add 页
- 切到出库 Tab → 不动
- 进 add → 提交 → 返回 → 列表自动刷新

- [ ] **Step 8: 提交**

```bash
git add miniprogram/pages/material/index.js miniprogram/pages/material/index.wxml miniprogram/pages/material/index.json
git commit -m "$(cat <<'EOF'
refactor(material): material/index Tab0 接入 material-list 组件

- index.json 注册 material-list
- Tab0 wxml 整段卡片列表替换为 <material-list>
- 删 page 内已迁入组件的方法（loadMaterials/onSearch/onLoadMore/筛选/scroll）
- onShow / onPullDownRefresh / _ensureTabLoaded 改为通过 selectComponent reload
- FAB bindtap 改为 onAddMaterialTap（删旧 goToAddMaterial）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: stock-in 加 商品管理 sub-tab

**Files:**
- Modify: `miniprogram/pages/material/stock-in/index.json`
- Modify: `miniprogram/pages/material/stock-in/index.js`
- Modify: `miniprogram/pages/material/stock-in/index.wxml`

**目标**：把 stock-in 页 sub-tabs 从 2 项扩到 3 项（入库记录 / 商品管理 / 分类管理），加新 sub-tab 的 wxml 区段（用 material-list 组件）+ 事件 handler。

- [ ] **Step 1: 改 index.json — 注册 material-list**

```json
{
  "navigationBarTitleText": "入库管理",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index",
    "van-button": "@vant/weapp/button/index",
    "material-list": "/components/material-list/index"
  }
}
```

- [ ] **Step 2: 改 index.js — subTabs 数组扩展 + 加事件 handler**

定位 `miniprogram/pages/material/stock-in/index.js`，找到 data 里：

```js
    activeSubTab: 0,
    subTabs: ['入库记录', '分类管理'],
```

改为：

```js
    activeSubTab: 0,
    subTabs: ['入库记录', '商品管理', '分类管理'],
```

修改 `onSubTabChange` 让 sub=2 触发分类加载、sub=1 触发商品列表 reload：

```js
  onSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    this.setData({ activeSubTab: sub });
    if (sub === 1) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
    }
    if (sub === 2) {
      this._ensureCategoriesLoaded();
    }
  },
```

在 onShow 末尾加（如果当前 activeSubTab=1 也 reload 商品列表）：

```js
  onShow() {
    // 首次：加载入库记录
    if (!this._loaded) {
      this._loaded = true;
      this.loadRecords();
      return;
    }
    // 从 stock-in-form / add 页返回：当前在入库记录子页 → 强制刷新
    if (this.data.activeSubTab === 0) {
      this.loadRecords();
    }
    // 从 detail/edit/add 返回 商品管理 sub-tab → reload
    if (this.data.activeSubTab === 1) {
      const list = this.selectComponent('#materialList');
      if (list) list.reload();
    }
  },
```

在文件末尾（最后一个方法之后、Page 闭合括号之前）加：

```js
  onMaterialTap(e) {
    const material = e.detail.material;
    wx.navigateTo({ url: `/pages/material/detail/index?id=${material.material_id}` });
  },

  onAddMaterialTap() {
    wx.navigateTo({ url: '/pages/material/add/index' });
  },
```

- [ ] **Step 3: 改 index.wxml — 在子页 1 (旧"分类管理") 之前插入新的"商品管理"sub-tab，调整子页顺序**

定位 wxml 中"子页 1：分类管理"整段（注释 + scroll-view），替换为如下两段（先商品管理，再分类管理）：

```xml
    <!-- 子页 1：商品管理 -->
    <view wx:if="{{activeSubTab === 1}}" class="sub-tab-content sub-tab-content-flex">
      <material-list
        id="materialList"
        canManage="{{canManage}}"
        bind:itemtap="onMaterialTap"
        bind:additem="onAddMaterialTap"
      />
    </view>

    <!-- 子页 2：分类管理 -->
    <scroll-view
      wx:if="{{activeSubTab === 2}}"
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
          class="cat-item"
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

> **关键**：商品管理子页用 `<view>` 而不是 `<scroll-view>`，因为组件内部已含 scroll-view，避免双层滚动。`sub-tab-content-flex` 是新加的 class（无 padding，直接撑开内部组件）。

- [ ] **Step 4: 在 index.wxss 末尾追加新样式**

```css
/* 商品管理 sub-tab 容器（无 padding，让组件填满） */
.sub-tab-content-flex {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 5: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in/index.js
```

预期：无输出。

- [ ] **Step 6: 模拟器实测**

进入 stock-in 页（首页 Tab2 耗品 → 入库管理宫格）：
- 顶部 sub-tabs 显示 3 项（入库记录 / 商品管理 / 分类管理）
- 切到商品管理 → 看到商品列表（与 material/index Tab0 同款）
- 切到分类管理 → 旧逻辑不变（首次自动 seed 12 项）

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/stock-in/index.{js,wxml,wxss,json}
git commit -m "$(cat <<'EOF'
feat(material/stock-in): 加 商品管理 sub-tab（共享 material-list 组件）

sub-tabs 由 2 项扩展为 3 项：入库记录 / 商品管理 / 分类管理。
商品管理 sub-tab 嵌入 <material-list> 组件，与 material/index Tab0 同源。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: stock-in Modal UI（data + WXML + WXSS）

**Files:**
- Modify: `miniprogram/pages/material/stock-in/index.js`（data 字段）
- Modify: `miniprogram/pages/material/stock-in/index.wxml`（追加 modal 浮层）
- Modify: `miniprogram/pages/material/stock-in/index.wxss`（追加 modal 样式）

**目标**：搭出 modal 的纯 UI（数据字段 + WXML + WXSS），不接逻辑（下个 Task 接 directScan + submitStockIn）。

- [ ] **Step 1: 改 index.js data — 追加 modal 字段**

定位 stock-in/index.js data 块末尾，追加：

```js
    // === Modal: 扫码后入库表单 ===
    showStockInModal: false,
    scannedMaterial: null,    // { material_id, name, material_number, stock, unit, spec, images, usage_area }
    modalQuantity: '',
    modalLocation: '',        // 选中的位置（用于提交）
    modalRemark: '',
    modalSubmitting: false,
    locationOptions: [],      // [{value, label}]
    locationIndex: 0,
```

- [ ] **Step 2: 改 index.wxml — 在 sub-tabs 容器外、page 根容器内追加 modal**

定位 `</view>` (stock-in-page 闭合) 之前，追加：

```xml
  <!-- 扫码入库 Modal -->
  <view wx:if="{{showStockInModal}}" class="modal-mask" bindtap="closeStockInModal"></view>
  <view wx:if="{{showStockInModal}}" class="modal-sheet" catchtap="">
    <view class="modal-header">
      <text class="modal-title">入库登记</text>
      <view class="modal-close" bindtap="closeStockInModal">×</view>
    </view>

    <view class="modal-body">
      <!-- 商品信息只读 -->
      <view class="modal-info">
        <image
          wx:if="{{scannedMaterial.images && scannedMaterial.images[0]}}"
          src="{{scannedMaterial.images[0]}}"
          class="modal-info-img"
          mode="aspectFill"
        />
        <view wx:else class="modal-info-img modal-info-placeholder"></view>
        <view class="modal-info-text">
          <text class="modal-info-name">{{scannedMaterial.name || ''}}</text>
          <text class="modal-info-meta">编号：{{scannedMaterial.material_number || '-'}}</text>
          <text class="modal-info-meta" wx:if="{{scannedMaterial.spec}}">规格：{{scannedMaterial.spec}}</text>
          <text class="modal-info-stock">当前库存：{{scannedMaterial.stock || 0}} {{scannedMaterial.unit || ''}}</text>
        </view>
      </view>

      <view class="modal-form">
        <view class="modal-field">
          <text class="modal-label">入库数量 <text class="modal-required">*</text></text>
          <input
            class="modal-input"
            type="number"
            placeholder="请输入数量"
            value="{{modalQuantity}}"
            bindinput="onModalQuantityInput"
          />
          <text class="modal-unit">{{scannedMaterial.unit || ''}}</text>
        </view>

        <view class="modal-field">
          <text class="modal-label">入库位置 <text class="modal-required">*</text></text>
          <picker
            mode="selector"
            range="{{locationOptions}}"
            range-key="label"
            value="{{locationIndex}}"
            bindchange="onModalLocationChange"
          >
            <view class="modal-picker">
              <text class="modal-picker-text">{{modalLocation || '请选择位置'}}</text>
              <van-icon name="arrow-down" size="14px" color="#9CA3AF" />
            </view>
          </picker>
        </view>

        <view class="modal-field">
          <text class="modal-label">备注</text>
          <textarea
            class="modal-textarea"
            placeholder="选填，最多 100 字"
            maxlength="100"
            value="{{modalRemark}}"
            bindinput="onModalRemarkInput"
          />
        </view>
      </view>
    </view>

    <view class="modal-footer">
      <view class="modal-btn modal-btn-cancel" bindtap="closeStockInModal">取消</view>
      <view
        class="modal-btn modal-btn-confirm {{(!modalQuantity || !modalLocation || modalSubmitting) ? 'modal-btn-disabled' : ''}}"
        bindtap="submitStockIn"
      >{{modalSubmitting ? '提交中...' : '确认入库'}}</view>
    </view>
  </view>
```

- [ ] **Step 3: 在 index.wxss 末尾追加 modal 样式**

```css
/* ========== 扫码入库 Modal ========== */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
}

.modal-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  border-radius: 24rpx 24rpx 0 0;
  z-index: 201;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  padding-bottom: env(safe-area-inset-bottom);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 16rpx;
  border-bottom: 1rpx solid #F0F0F0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1A1A1A;
}

.modal-close {
  font-size: 48rpx;
  color: #9CA3AF;
  line-height: 1;
  padding: 0 8rpx;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24rpx 32rpx;
}

.modal-info {
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  background: #F8FAFC;
  border-radius: 16rpx;
  margin-bottom: 28rpx;
}

.modal-info-img {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #E5E7EB;
}

.modal-info-placeholder {
  background: #F0F0F0;
}

.modal-info-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.modal-info-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-info-meta {
  font-size: 24rpx;
  color: #6B7280;
}

.modal-info-stock {
  font-size: 24rpx;
  color: #16A34A;
  font-weight: 600;
  margin-top: 4rpx;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.modal-field {
  position: relative;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.modal-label {
  display: block;
  font-size: 26rpx;
  color: #525252;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.modal-required {
  color: #DC2626;
}

.modal-input {
  width: calc(100% - 80rpx);
  display: inline-block;
  height: 64rpx;
  padding: 0 16rpx;
  background: #F8FAFC;
  border-radius: 8rpx;
  font-size: 30rpx;
}

.modal-unit {
  display: inline-block;
  margin-left: 16rpx;
  color: #6B7280;
  font-size: 26rpx;
}

.modal-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64rpx;
  padding: 0 16rpx;
  background: #F8FAFC;
  border-radius: 8rpx;
}

.modal-picker-text {
  font-size: 28rpx;
  color: #1A1A1A;
}

.modal-textarea {
  width: 100%;
  min-height: 120rpx;
  padding: 16rpx;
  background: #F8FAFC;
  border-radius: 8rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 32rpx 24rpx;
  border-top: 1rpx solid #F0F0F0;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.modal-btn-cancel {
  background: #F5F5F5;
  color: #525252;
}

.modal-btn-confirm {
  background: #1677FF;
  color: #FFFFFF;
}

.modal-btn-confirm:active {
  opacity: 0.85;
}

.modal-btn-disabled {
  background: #C0D7F5;
  color: rgba(255, 255, 255, 0.85);
  pointer-events: none;
}
```

- [ ] **Step 4: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in/index.js
```

预期：无输出。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/stock-in/index.{js,wxml,wxss}
git commit -m "$(cat <<'EOF'
feat(material/stock-in): Modal 入库表单 UI 骨架

- data 增加 modal 相关字段（showStockInModal/scannedMaterial/modalQuantity/...）
- WXML 追加底部弹起 modal（商品信息只读 + 数量/位置 picker/备注 + 取消/确认）
- WXSS 追加 modal 样式
- 仅 UI，未接逻辑（下 Task 加 handler）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: stock-in directScan + 失败引导 modal

**Files:**
- Modify: `miniprogram/pages/material/stock-in/index.js`

**目标**：FAB 行为从 ActionSheet 改为直接扫码；扫到识别 → 准备调 openStockInModal（下个 Task 实现）；扫不识别 → modal 双按钮引导添加。

- [ ] **Step 1: 删除旧 onFabTap + scanAndStockIn**

定位 stock-in/index.js 中 `onFabTap` 方法（含 wx.showActionSheet 调用）和 `scanAndStockIn` 方法，**整段删除**。`goToAddMaterial` 方法**也删除**（已被 onAddMaterialTap 替代，没有其他调用方）。

- [ ] **Step 2: 替换 wxml FAB bindtap**

定位 stock-in/index.wxml 中 FAB 段：

```xml
  <view
    wx:if="{{canManage && activeSubTab === 0}}"
    class="fab-button"
    bindtap="onFabTap"
  >
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

改为：

```xml
  <view
    wx:if="{{canManage && activeSubTab === 0}}"
    class="fab-button"
    bindtap="directScan"
  >
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

- [ ] **Step 3: 在 stock-in/index.js 加 directScan 方法**

在 `onSubTabChange` 之后插入：

```js
  // ===== 直接扫码（替代旧 ActionSheet） =====
  async directScan() {
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
      console.error('[StockIn] scan lookup error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      return;
    }

    if (!result || !result.success) {
      wx.showToast({ title: (result && result.error) || '查询失败', icon: 'none' });
      return;
    }

    if (!result.material) {
      // 扫到不识别 → modal 双按钮引导添加
      wx.showModal({
        title: '未识别',
        content: `编号「${code}」未登记，是否去商品管理添加？`,
        cancelText: '取消',
        confirmText: '立即添加',
        success: (modalRes) => {
          if (modalRes.confirm) {
            this.setData({ activeSubTab: 1 });
            wx.navigateTo({
              url: `/pages/material/add/index?material_number=${encodeURIComponent(code)}`,
            });
          }
        },
      });
      return;
    }

    // 命中 → 弹 Modal（loadLocationOptions + openStockInModal 下 Task 实现）
    await this.openStockInModal(result.material);
  },

  // 占位 — Task 10 实现
  async openStockInModal(material) {
    console.log('[StockIn] openStockInModal placeholder', material);
    wx.showToast({ title: 'Modal 待实现', icon: 'none' });
  },
```

- [ ] **Step 4: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in/index.js
```

预期：无输出。

- [ ] **Step 5: 模拟器实测（部分）**

进 stock-in 页 → 入库记录子页 → tap FAB → 直接调起扫码（不再 ActionSheet）。
模拟器扫码模拟器输入 `NOT_EXIST_CODE` → 看到 modal 双按钮"取消 / 立即添加"。点立即添加 → 切到 sub-tab 1 商品管理 + 跳 add 页（编号 prefill 在 Task 11 接通，本步暂时 add 页可能不会 prefill — 不影响此 Task 验收）。

扫已存在编号（如 PJ-2024-0156）→ console.log 显示"openStockInModal placeholder"+ toast"Modal 待实现"。说明 directScan 路径走通。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/pages/material/stock-in/index.{js,wxml}
git commit -m "$(cat <<'EOF'
feat(material/stock-in): FAB 改为 directScan + 扫码失败引导 modal

- 删除旧 onFabTap (ActionSheet) + scanAndStockIn + goToAddMaterial
- FAB bindtap 改为 directScan：直接 wx.scanCode → service 查询
- 命中 → 调 openStockInModal (placeholder, 下 Task 接通)
- 不识别 → modal 双按钮，立即添加 → 切 sub-tab 1 + 跳 add?material_number=XXX

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: stock-in Modal 完整逻辑（loadLocationOptions / openStockInModal / submitStockIn）

**Files:**
- Modify: `miniprogram/pages/material/stock-in/index.js`

**目标**：补齐 Modal 的所有 handler — 位置字典 seed/load、Modal 打开/关闭、表单输入、提交。

- [ ] **Step 1: 在文件顶部 require 区追加常量**

定位 stock-in/index.js 顶部（DEFAULT_MATERIAL_CATEGORIES 之后）：

```js
const DEFAULT_MATERIAL_CATEGORIES = [...];
```

之后追加：

```js
const DEFAULT_MATERIAL_LOCATIONS = [
  '主仓库', '应急储备', '工程仓',
  '办公耗材区', '外采暂存', '其它',
];
```

- [ ] **Step 2: 替换占位 openStockInModal + 加位置加载/提交逻辑**

把 Task 9 留下的：

```js
  async openStockInModal(material) {
    console.log('[StockIn] openStockInModal placeholder', material);
    wx.showToast({ title: 'Modal 待实现', icon: 'none' });
  },
```

替换为：

```js
  async openStockInModal(material) {
    // 首次扫码触发 loadLocationOptions（含 seed）
    await this.loadLocationOptions();

    // material.usage_area 在字典中找 idx；找不到 fallback 0
    const usage = material.usage_area || '';
    let idx = this.data.locationOptions.findIndex(o => o.value === usage);
    if (idx < 0) idx = 0;
    const initLocation = (this.data.locationOptions[idx] && this.data.locationOptions[idx].value) || '';

    this.setData({
      showStockInModal: true,
      scannedMaterial: material,
      modalQuantity: '',
      modalLocation: initLocation,
      modalRemark: '',
      modalSubmitting: false,
      locationIndex: idx,
    });
  },

  async loadLocationOptions() {
    if (this._locationLoaded && this.data.locationOptions.length > 0) return;
    try {
      const result = await dictionaryAdmin.getDictionary('material_location');
      if (result && result.success && result.data) {
        const items = (result.data.items || [])
          .filter(i => i.enabled !== false)
          .sort((a, b) => (a.sort || 0) - (b.sort || 0))
          .map(i => ({ value: i.value, label: i.label || i.value }));
        this.setData({ locationOptions: items });
        this._locationLoaded = true;
        return;
      }
      if (result && !result.success && (result.error || '').includes('不存在')) {
        await this._seedLocations();
        return;
      }
      throw new Error('加载位置失败');
    } catch (e) {
      console.error('[StockIn] loadLocationOptions error:', e);
      wx.showToast({ title: '位置数据加载失败', icon: 'none' });
      throw e;
    }
  },

  async _seedLocations() {
    const items = DEFAULT_MATERIAL_LOCATIONS.map((label, idx) => ({
      value: label,
      label,
      sort: idx,
      enabled: true,
    }));
    const result = await dictionaryAdmin.createDictionary({
      dict_key: 'material_location',
      dict_name: '物料位置',
      description: '入库时的位置选项',
      items,
    });
    if (result && result.success) {
      wx.showToast({ title: '已创建默认位置', icon: 'success' });
      dictionary.refreshCache('material_location');
      this.setData({
        locationOptions: items.map(i => ({ value: i.value, label: i.label })),
      });
      this._locationLoaded = true;
    } else {
      wx.showToast({ title: (result && result.error) || '初始化位置失败', icon: 'none' });
      throw new Error('seed locations failed');
    }
  },

  closeStockInModal() {
    this.setData({
      showStockInModal: false,
      scannedMaterial: null,
      modalQuantity: '',
      modalLocation: '',
      modalRemark: '',
      modalSubmitting: false,
    });
  },

  onModalQuantityInput(e) {
    this.setData({ modalQuantity: e.detail.value });
  },

  onModalRemarkInput(e) {
    this.setData({ modalRemark: e.detail.value });
  },

  onModalLocationChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const opt = this.data.locationOptions[idx];
    if (!opt) return;
    this.setData({
      locationIndex: idx,
      modalLocation: opt.value,
    });
  },

  async submitStockIn() {
    const qty = parseInt(this.data.modalQuantity, 10);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    if (qty > 999999) {
      wx.showToast({ title: '数量不能超过 999999', icon: 'none' });
      return;
    }
    if (!this.data.modalLocation) {
      wx.showToast({ title: '请选择入库位置', icon: 'none' });
      return;
    }

    this.setData({ modalSubmitting: true });
    try {
      const result = await materialService.stockIn(
        this.data.scannedMaterial.material_id,
        qty,
        this.data.modalRemark || '',
        this.data.modalLocation
      );
      if (result && result.success) {
        wx.showToast({ title: '入库成功', icon: 'success' });
        this.closeStockInModal();
        this.loadRecords();
      } else {
        const err = (result && result.error) || '入库失败';
        wx.showToast({ title: err, icon: 'none' });
        this.setData({ modalSubmitting: false });
        if (err.includes('配件不存在')) {
          setTimeout(() => {
            this.closeStockInModal();
            this.loadRecords();
          }, 1200);
        }
      }
    } catch (e) {
      console.error('[StockIn] submitStockIn error:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      this.setData({ modalSubmitting: false });
    }
  },
```

- [ ] **Step 3: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in/index.js
```

预期：无输出。

- [ ] **Step 4: 模拟器全流程实测**

进 stock-in 页 → 入库记录 → FAB → 模拟器扫已存在编号 → 弹起 Modal：
- 商品图/名/编号/规格/库存正确显示
- 位置 picker 默认选中 material.usage_area（若在字典中），否则字典首项
- 数量 input + 位置 picker + 备注 textarea 都可输入
- 数量空时按钮 disabled
- 数量为 0 / >999999 提示
- 提交 → toast"入库成功" → modal 自动关闭 → 入库记录顶部出现新条记录

去云开发数据库查 `material_records` 最新一条：`type:'in'`，`usage_area` = 你在 picker 中选的位置；查 `materials` 表对应 material_id：`stock` 自增、`usage_area` **不变**。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/stock-in/index.js
git commit -m "$(cat <<'EOF'
feat(material/stock-in): 补齐 Modal 完整逻辑

- DEFAULT_MATERIAL_LOCATIONS 6 项默认（首次自动 seed material_location 字典）
- openStockInModal: 打开 + 默认 picker idx 按 material.usage_area 匹配 fallback 0
- loadLocationOptions / _seedLocations
- closeStockInModal / onModalQuantity/Remark/LocationChange
- submitStockIn: 校验 → service.stockIn(id, qty, remark, location) → 成功关 modal + reload 入库记录 / 失败 toast 保持 modal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: pages/material/add 接 query.material_number prefill

**Files:**
- Modify: `miniprogram/pages/material/add/index.js:37-51`（onLoad）

**目标**：add 页 onLoad 接收 `query.material_number`（来自扫码失败引导 modal），prefill 到 form.material_number。

- [ ] **Step 1: 改 onLoad 签名 + 末尾追加 prefill**

定位 add/index.js 第 37-51 行 onLoad 方法：

```js
  async onLoad() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || ![ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id)) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight),
      'form.stock_in_time': new Date().toISOString().split('T')[0]
    });
    await this.loadCategories();
  },
```

替换为：

```js
  async onLoad(query = {}) {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    if (!userInfo || ![ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF].includes(userInfo.role_id)) {
      wx.showToast({ title: '无权限', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const { headerHeight } = getNavBarInfo();
    this.setData({
      headerHeight: Math.ceil(headerHeight),
      'form.stock_in_time': new Date().toISOString().split('T')[0],
    });

    // 来自扫码失败引导 → prefill 编号
    if (query.material_number) {
      this.setData({
        'form.material_number': decodeURIComponent(query.material_number),
      });
    }

    await this.loadCategories();
  },
```

- [ ] **Step 2: 验证语法**

```bash
node -c /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/add/index.js
```

预期：无输出。

- [ ] **Step 3: 模拟器实测**

进 stock-in 页 → 入库记录 → FAB → 模拟器扫码模拟器输入"NOT_EXIST_999" → modal 双按钮 → 立即添加 → add 页打开 → "配件编号"字段已 prefill "NOT_EXIST_999"。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/material/add/index.js
git commit -m "$(cat <<'EOF'
feat(material/add): onLoad 接 query.material_number prefill

来自 stock-in 页扫码失败引导（立即添加）时，把扫到的编号
作为 form.material_number 默认值，避免用户重复手输。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 删除 pages/material/stock-in-form/ + 移除 app.json 路径

**Files:**
- Delete: `miniprogram/pages/material/stock-in-form/index.js`
- Delete: `miniprogram/pages/material/stock-in-form/index.wxml`
- Delete: `miniprogram/pages/material/stock-in-form/index.wxss`
- Delete: `miniprogram/pages/material/stock-in-form/index.json`
- Delete: `miniprogram/pages/material/stock-in-form/`（空目录）
- Modify: `miniprogram/app.json`（移除 `pages/material/stock-in-form/index` 一行）

**目标**：旧的扫码后跳转的独立补单页已被 Modal 替代，无任何引用，整个目录删除。

- [ ] **Step 1: 全局扫描确认无残留引用**

```bash
grep -rn "stock-in-form\|stockInForm\|/material/stock-in-form/" /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram --include="*.js" --include="*.wxml" --include="*.json" 2>/dev/null
```

预期：仅 `miniprogram/app.json` 一行匹配（要删的那条），`pages/material/stock-in-form/` 自身的 4 个文件匹配（要删的）。**不应该有其它页面引用**。如果发现其它引用，先处理那里再回来。

- [ ] **Step 2: 删 4 个文件 + 目录**

```bash
rm /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in-form/index.js
rm /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in-form/index.wxml
rm /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in-form/index.wxss
rm /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in-form/index.json
rmdir /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram/pages/material/stock-in-form
```

- [ ] **Step 3: 改 app.json 移除路径**

定位 `miniprogram/app.json` 中：

```json
    "pages/material/stock-in-form/index",
    "pages/material/stock-in/index",
```

删除第一行（保留 stock-in 行）：

```json
    "pages/material/stock-in/index",
```

- [ ] **Step 4: 再次扫描确认彻底无残留**

```bash
grep -rn "stock-in-form\|stockInForm" /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram --include="*.js" --include="*.wxml" --include="*.json" 2>/dev/null
```

预期：**零匹配**。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/stock-in-form/ miniprogram/app.json
git commit -m "$(cat <<'EOF'
refactor(material): 删除旧 stock-in-form 独立页（Modal 已替代）

scan → form 流程已搬到 stock-in 页内置 modal，旧独立页无任何引用。
app.json 同步移除 pages/material/stock-in-form/index 路径。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: 全路径手动回归

**Files:** —

**目标**：按 spec §7 验证清单跑完整回归，把通过项标记 ✓。本任务无代码改动，仅手动测试 + 标记。

> ⚠️ 本任务**必须先**完成 Phase 1 云函数部署（Task 1 + 2）才能跑全流程：
> - 微信开发者工具 → 右键 cloudfunctions/dictionaryManager → 上传并部署
> - 微信开发者工具 → 右键 cloudfunctions/materialManager → 上传并部署

### 13.1 角色：管理员（1）/ 行政经理（2）/ 办美员工（4）— 各跑一次

- [ ] 首页 Tab2 → 宫格"入库管理" → 进 stock-in 页，3 sub-tab 显示
- [ ] FAB tap → 直接调起扫码（**不再** ActionSheet）
- [ ] 扫已有商品 → 底部 Modal 显示，位置 picker 预填 material.usage_area（若在字典中），否则首项
- [ ] Modal 提交 → 入库记录顶部出现新记录，stock 累加，material_records.usage_area = 用户选的位置
- [ ] 取消扫码 → 静默
- [ ] 扫不存在编号 → modal 双按钮"取消 / 立即添加"
- [ ] 立即添加 → 自动切 sub-tab 1 + 跳 add 页 + form.material_number 已 prefill
- [ ] add 页提交后 navigateBack → stock-in 商品管理 sub-tab 列表 reload + 入库记录 sub-tab 刷新
- [ ] 切到 sub-tab 1 商品管理 → 看到商品列表（与 material/index Tab0 配件列表内容一致）
- [ ] 商品管理顶部"新增" → 跳 add 页（无 prefill）
- [ ] tap 卡片 → detail 页
- [ ] tap 卡片右上 ⋯ → ActionSheet "编辑/删除"
  - 编辑 → edit 页改保存 → 返回 → 列表显示新值
  - 删除 → modal 二次确认 → 列表立刻移除（乐观 UI）
- [ ] material/index 配件列表 显示同一份数据，操作互通
- [ ] 切到 sub-tab 2 分类管理 → 旧逻辑不变（首次自动 seed 12 项 material_category）

### 13.2 角色：维修员（3）

- [ ] 首页看不到 Tab2 耗品（既有 isMaintenanceWorker 控制）
- [ ] 直接 navigateTo `/pages/material/stock-in/index` → toast "无权限访问" → 退回
- [ ] material/index 同样拒入
- [ ] 工单 completeRepair → 仍能扣库存（独立路径）

### 13.3 数据正确性

- [ ] 入库提交：`materials.stock` += qty；`materials.usage_area` 不变；`material_records.usage_area` = 用户选的位置
- [ ] 字典首次 seed：`dictionaries` 表新增 `dict_key='material_location'`，items 6 项；后续扫码不再 seed
- [ ] 软删字典项 enabled=false 不在 picker 返回里

### 13.4 错误路径

- [ ] 数量空 → 按钮 disabled
- [ ] 数量 0 → toast "请输入有效数量"
- [ ] 数量 >999999 → toast "数量不能超过 999999"
- [ ] 位置空 → 按钮 disabled
- [ ] Modal 提交时商品已被删 → toast "配件不存在" + 1.2s 后自动关 modal + reload
- [ ] 关闭 modal（点遮罩 / 取消按钮 / X 按钮）→ 表单字段全清

### 13.5 回归非新增功能

- [ ] 工单提报/编辑/详情 不受影响
- [ ] admin/dict 后台仍能管理 material_category + material_location 两个字典
- [ ] material_records 老数据展示无异常
- [ ] material/index Tab1 出库记录 不变（出库流程沿用）

### 13.6 旧逻辑彻底清理

```bash
grep -rn "stock-in-form\|stockInForm\|onFabTap\|scanAndStockIn" /Users/lvleo/Desktop/gongdanbaoxiu/miniprogram --include="*.js" --include="*.wxml" --include="*.json"
```

- [ ] 预期：零匹配（旧的 ActionSheet 入口、独立补单页、旧 onFabTap 全部清理干净）

### 13.7 总结收尾提交

如果全部通过：

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(material): 商品管理 Tab + Modal + 位置字段 改造回归测试通过

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

如有缺陷 → 回到对应 Task 修复并加 commit。

---

## 已知风险 & 可能的踩坑

1. **wx.scanCode 真机权限**：模拟器扫码功能会自动弹"扫码模拟器"输入框，输入字符串即返回。真机首次需要授权相机权限。
2. **dictionaries 集合自动建**：CloudBase 默认开启"按需自建集合"。若环境关闭，material_location 字典 seed 时 createDictionary 会失败 — 需要管理员手动在云开发控制台建 `dictionaries` 集合。
3. **dictionary.js 缓存**：modal 提交后 `dictionary.refreshCache('material_location')` 仅在 seed 时调用。后续修改字典需要 admin/dict 用户主动 refresh，否则 stock-in 页内 _locationLoaded 标志会沿用旧 options。**该问题非阻塞 — 当前 spec 不要求实时联动**。
4. **catchtap on m-card-menu**：Task 5 用了 `catchtap`（不是 bindtap）阻止冒泡。如果不阻止，点 ⋯ 会同时触发卡片 tap，跳到 detail 页 — 验证时务必看清这点。
5. **stock-in 页 onShow 三分支**：(a) 首次加载入库记录 (b) activeSubTab=0 刷新入库记录 (c) activeSubTab=1 商品管理 reload。注意三分支不要互相覆盖（顺序：先首次判断，再分别处理 sub 0/1）。
6. **app.json 注册顺序**：删除 stock-in-form 路径后，剩余 material 路径顺序不重要，但确保不要意外删错其它路径条目。
7. **Modal 与位置 picker**：picker 是 wx 原生组件，需要 range 数组里每项有 label 字段（spec 要求 `range-key="label"`）— locationOptions 数组已经准备成 `{value, label}` 格式，不能误存为字符串数组。
8. **m-card-menu 定位**：组件内的 `.m-card-menu` 用 `position: absolute` 定位到卡片右上 — 测试时如果发现"ellipsis 图标被库存数字遮挡"，可调整 right/top 像素值。
