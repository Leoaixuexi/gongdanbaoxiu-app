# 收费工单 · 数据看板实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重做 `pages/charge-order/index` 的"数据看板" Tab，呈现 总支出 / 月度支出 / 分类占比 / 楼层+设备热点 四类指标，顶部带时间筛选器。

**Architecture:** 纯前端 UI + 基于现有 `store.js` mock 数据聚合；所有改动集中在 `pages/charge-order/` 目录；图表继续使用 `ec-canvas + echarts`，聚合逻辑在 `index.js` 内以纯函数 `computeDashboard(orders, range)` 实现。

**Tech Stack:** 微信小程序（wxml/wxss/js）、Vant Weapp、ec-canvas + echarts、现有 `getNavBarInfo()` 工具。

**Reference Spec:** `docs/superpowers/specs/2026-04-22-charge-order-dashboard-design.md`

**项目约定（来自 CLAUDE.md）**：
- 不自动 commit；每个 Task 完成后可由用户检阅并手动提交。Plan 中的 "Commit" 步骤指"准备好可提交的代码"，并非让 agent 自动执行 git commit。
- 无 npm 测试流程；所有"验证"通过微信开发者工具模拟器观察。

---

## 范围核查

Spec 聚焦单一页面（`charge-order/index` 的第二个 swiper-item），无子系统拆分需要。

---

## 文件结构

**涉及文件**（均为现有文件，修改，不新增文件）：

| 文件 | 职责 |
|---|---|
| `miniprogram/pages/charge-order/store.js` | mock ORDERS 数组扩充至跨 12 个月 |
| `miniprogram/pages/charge-order/index.js` | 新增 `trendData` / `rangeToDates` / `computeDashboard`；重写 trendOption、pieOption；新增 horizontalBarOption() 工厂；重写 Tab 2 相关 data 和事件 |
| `miniprogram/pages/charge-order/index.wxml` | 重写第二个 swiper-item（Tab 2 数据看板）内容 |
| `miniprogram/pages/charge-order/index.wxss` | 新增时间筛选器、KPI 卡、图表卡片等样式；复用列表页已有 `.segmented` / `.modal-overlay` 系列 |

---

## Task 1: 扩充 mock 数据（store.js + trendData）

**Files:**
- Modify: `miniprogram/pages/charge-order/store.js:19-232`（ORDERS 数组末尾追加条目）
- Modify: `miniprogram/pages/charge-order/index.js`（顶部新增常量 `trendData`）

- [ ] **Step 1: 在 store.js 的 ORDERS 数组中追加 12 个月分布的工单**

追加条目插入到现有 `WO-2026-0407` 条目之后（约 line 232 的 `]` 之前）。每条工单需含最基础字段：`id` / `order_number` / `status` / `priority` / `customer` / `order_category` / `floor` / `location` / `created_at` / `totalAmount` / `payStatus`。其他字段（photos/description/...）可用最小值或空字符串。

```js
// 追加到 ORDERS 数组末尾（现有 5 条之后）。跨越 2025-05 至 2026-04，每月 2~4 条。
// 简化字段：只保留看板聚合所需的维度，其他字段用默认空值
{ id: 'WO-2025-0512', order_number: 'WO-2025-0512', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2025-05-12 09:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 900, partsFee: 0, discount: 0, totalAmount: 900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0525', order_number: 'WO-2025-0525', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-05-25 14:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1500, partsFee: 0, discount: 0, totalAmount: 1500, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0610', order_number: 'WO-2025-0610', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2025-06-10 10:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 800, partsFee: 0, discount: 0, totalAmount: 800, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0622', order_number: 'WO-2025-0622', status: 'Completed', priority: 'Emergency', customer: '龙湖物业', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2025-06-22 11:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2100, partsFee: 0, discount: 0, totalAmount: 2100, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0708', order_number: 'WO-2025-0708', status: 'Completed', priority: 'Normal', customer: '中建信达', order_category: '中央空调', floor: '12楼', location: '办公区', created_at: '2025-07-08 09:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1200, partsFee: 0, discount: 0, totalAmount: 1200, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0720', order_number: 'WO-2025-0720', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '给排水', floor: '3楼', location: '卫生间', created_at: '2025-07-20 15:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 600, partsFee: 0, discount: 0, totalAmount: 600, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0805', order_number: 'WO-2025-0805', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2025-08-05 10:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1800, partsFee: 0, discount: 0, totalAmount: 1800, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0818', order_number: 'WO-2025-0818', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-08-18 13:10', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 900, partsFee: 0, discount: 0, totalAmount: 900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0830', order_number: 'WO-2025-0830', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2025-08-30 09:45', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 700, partsFee: 0, discount: 0, totalAmount: 700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0912', order_number: 'WO-2025-0912', status: 'Completed', priority: 'Emergency', customer: '中建信达', order_category: '中央空调', floor: '12楼', location: '办公区', created_at: '2025-09-12 08:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2400, partsFee: 0, discount: 0, totalAmount: 2400, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-0925', order_number: 'WO-2025-0925', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2025-09-25 14:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1100, partsFee: 0, discount: 0, totalAmount: 1100, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-1008', order_number: 'WO-2025-1008', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-10-08 11:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1600, partsFee: 0, discount: 0, totalAmount: 1600, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-1019', order_number: 'WO-2025-1019', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2025-10-19 16:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1300, partsFee: 0, discount: 0, totalAmount: 1300, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-1105', order_number: 'WO-2025-1105', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '给排水', floor: '3楼', location: '卫生间', created_at: '2025-11-05 09:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 500, partsFee: 0, discount: 0, totalAmount: 500, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-1118', order_number: 'WO-2025-1118', status: 'Completed', priority: 'Normal', customer: '中建信达', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2025-11-18 10:50', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 900, partsFee: 0, discount: 0, totalAmount: 900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-1210', order_number: 'WO-2025-1210', status: 'Completed', priority: 'Emergency', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2025-12-10 14:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2800, partsFee: 0, discount: 0, totalAmount: 2800, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2025-1222', order_number: 'WO-2025-1222', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '中央空调', floor: '12楼', location: '办公区', created_at: '2025-12-22 15:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1400, partsFee: 0, discount: 0, totalAmount: 1400, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0108', order_number: 'WO-2026-0108', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2026-01-08 09:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1200, partsFee: 0, discount: 0, totalAmount: 1200, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0120', order_number: 'WO-2026-0120', status: 'Completed', priority: 'Normal', customer: '中建信达', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2026-01-20 13:40', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1700, partsFee: 0, discount: 0, totalAmount: 1700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0205', order_number: 'WO-2026-0205', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2026-02-05 10:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1900, partsFee: 0, discount: 0, totalAmount: 1900, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0218', order_number: 'WO-2026-0218', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '给排水', floor: '3楼', location: '卫生间', created_at: '2026-02-18 15:00', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 700, partsFee: 0, discount: 0, totalAmount: 700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0310', order_number: 'WO-2026-0310', status: 'Completed', priority: 'Normal', customer: '华润科技', order_category: '中央空调', floor: '8楼', location: '会议中心A区', created_at: '2026-03-10 11:20', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1500, partsFee: 0, discount: 0, totalAmount: 1500, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0325', order_number: 'WO-2026-0325', status: 'Completed', priority: 'Emergency', customer: '中建信达', order_category: '消防系统', floor: 'B1', location: '消防泵房', created_at: '2026-03-25 09:50', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 2200, partsFee: 0, discount: 0, totalAmount: 2200, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0402', order_number: 'WO-2026-0402', status: 'Completed', priority: 'Normal', customer: '龙湖物业', order_category: '强电', floor: 'B2', location: '配电室', created_at: '2026-04-02 10:30', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1300, partsFee: 0, discount: 0, totalAmount: 1300, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
{ id: 'WO-2026-0416', order_number: 'WO-2026-0416', status: 'Completed', priority: 'Normal', customer: '万达物业', order_category: '电梯', floor: '1楼', location: '主楼大厅', created_at: '2026-04-16 14:10', description: '', submitter: { name: '', phone: '' }, photos: [], parts: [], partsChanged: false, laborFee: 1700, partsFee: 0, discount: 0, totalAmount: 1700, payStatus: '已付', startTime: '', endTime: '', duration: '', remark: '', chargeRemark: '' },
```

- [ ] **Step 2: 在 index.js 顶部新增 `trendData` 常量（近 12 个月支出）**

文件开头 `const makeEc = ...` 定义之前（大约 line 5 之前）加入：

```js
// 近 12 个月支出趋势数据（固定 mock，不随时间筛选器变化）
const trendData = [
  { month: '5月', amount: 2400 },
  { month: '6月', amount: 2900 },
  { month: '7月', amount: 1800 },
  { month: '8月', amount: 3400 },
  { month: '9月', amount: 3500 },
  { month: '10月', amount: 2900 },
  { month: '11月', amount: 1400 },
  { month: '12月', amount: 4200 },
  { month: '1月', amount: 2900 },
  { month: '2月', amount: 2600 },
  { month: '3月', amount: 3700 },
  { month: '4月', amount: 3000 },
]
```

- [ ] **Step 3: 在微信开发者工具中打开项目，进入收费工单页，切到"数据看板" Tab**

预期：数据看板 Tab 当前显示不变（仍是旧 mock），但没有报错。store 里的新数据暂不展示。

---

## Task 2: 时间筛选器 UI 骨架

**Files:**
- Modify: `miniprogram/pages/charge-order/index.js`（data 新增字段、加事件处理）
- Modify: `miniprogram/pages/charge-order/index.wxml`（第二个 swiper-item 顶部加 Segmented 和弹窗）
- Modify: `miniprogram/pages/charge-order/index.wxss`（复用/补充样式）

- [ ] **Step 1: index.js data 里新增时间筛选器状态字段**

在 `data` 对象中，Tab 2 相关字段区域（当前 kpi/ranking 所在位置）加入：

```js
// Tab 2 — 时间筛选器
rangeOptions: ['本月', '上月', '本季度', '本年', '自定义'],
activeRange: '本月',
customRangeLabel: '自定义',
customRange: { start: '', end: '' },
// 自定义日期弹窗
isRangePickerOpen: false,
tempStart: '',
tempEnd: '',
```

- [ ] **Step 2: index.js 加入筛选器点击 / 弹窗事件**

在 Page 对象方法区（`onSearchClear` 之后）追加：

```js
onRangeSelect(e) {
  const { range } = e.currentTarget.dataset
  if (range === '自定义') {
    this.setData({
      isRangePickerOpen: true,
      tempStart: this.data.customRange.start,
      tempEnd: this.data.customRange.end,
    })
    return
  }
  if (range === this.data.activeRange) return
  this.setData({ activeRange: range, customRangeLabel: '自定义' }, () => this.refreshDashboard())
},

closeRangePicker() { this.setData({ isRangePickerOpen: false }) },
stopPropagation() {},

onTempStartChange(e) { this.setData({ tempStart: e.detail.value }) },
onTempEndChange(e) { this.setData({ tempEnd: e.detail.value }) },

cancelRangePicker() { this.setData({ isRangePickerOpen: false }) },

confirmRangePicker() {
  const { tempStart, tempEnd } = this.data
  if (!tempStart || !tempEnd) {
    wx.showToast({ title: '请选择开始和结束日期', icon: 'none' })
    return
  }
  if (tempStart > tempEnd) {
    wx.showToast({ title: '开始日期不能晚于结束', icon: 'none' })
    return
  }
  const fmt = s => s.slice(5).replace('-', '/')
  this.setData({
    activeRange: '自定义',
    customRange: { start: tempStart, end: tempEnd },
    customRangeLabel: `${fmt(tempStart)}-${fmt(tempEnd)}`,
    isRangePickerOpen: false,
  }, () => this.refreshDashboard())
},

refreshDashboard() {
  // 占位，Task 3 会实现
},
```

- [ ] **Step 3: index.wxml 重写第二个 swiper-item 内容结构（清空旧看板，搭建新骨架）**

找到 `<!-- Tab 2: 数据看板 -->` 所在位置（约 line 192），把整个 `<swiper-item>` 块内容替换为：

```xml
    <!-- Tab 2: 数据看板 -->
    <swiper-item>
      <scroll-view scroll-y class="dash-scroll">

        <!-- 时间筛选器 -->
        <view class="dash-segmented">
          <view
            wx:for="{{rangeOptions}}"
            wx:key="*this"
            class="dash-seg-item {{activeRange === item ? 'dash-seg-active' : ''}}"
            data-range="{{item}}"
            bindtap="onRangeSelect"
          >{{item === '自定义' ? customRangeLabel : item}}</view>
        </view>

        <!-- Task 4 将填入：KPI 4 卡 -->
        <!-- Task 5 将填入：趋势图 -->
        <!-- Task 6 将填入：分类占比 -->
        <!-- Task 7 将填入：楼层/设备 TOP -->

        <view style="height: 40px;"></view>
      </scroll-view>

      <!-- 自定义日期范围弹窗 -->
      <view wx:if="{{isRangePickerOpen}}" class="modal-overlay" catchtap="closeRangePicker">
        <view class="modal-content" catchtap="stopPropagation">
          <view class="modal-header">
            <text class="modal-title">选择日期范围</text>
          </view>
          <view class="datetime-picker-content">
            <view class="picker-row">
              <text class="picker-label">开始</text>
              <picker mode="date" value="{{tempStart}}" bindchange="onTempStartChange">
                <view class="datetime-picker-display">
                  <text class="datetime-picker-text">{{tempStart || '请选择日期'}}</text>
                </view>
              </picker>
            </view>
            <view class="picker-row">
              <text class="picker-label">结束</text>
              <picker mode="date" value="{{tempEnd}}" bindchange="onTempEndChange">
                <view class="datetime-picker-display">
                  <text class="datetime-picker-text">{{tempEnd || '请选择日期'}}</text>
                </view>
              </picker>
            </view>
          </view>
          <view class="modal-actions">
            <view class="modal-button modal-button-cancel" bindtap="cancelRangePicker">
              <text class="modal-button-text">取消</text>
            </view>
            <view class="modal-button modal-button-confirm" bindtap="confirmRangePicker">
              <text class="modal-button-text modal-button-text-white">确定</text>
            </view>
          </view>
        </view>
      </view>
    </swiper-item>
```

注意：这里用 `dash-scroll` / `dash-segmented` / `dash-seg-item` / `dash-seg-active` 等 `dash-` 前缀的新 class 避免与列表页 `.scroll-area` / `.segmented` 的样式重叠。

- [ ] **Step 4: index.wxss 补充看板筛选器与弹窗样式**

在文件末尾追加：

```css
/* ========== Dashboard Tab ========== */
.dash-scroll { padding: 0; }

/* 时间筛选器 */
.dash-segmented {
  display: flex;
  background: #eef2f7;
  margin: 16px 16px 12px;
  border-radius: 12rpx;
  padding: 6rpx;
  gap: 4rpx;
}
.dash-seg-item {
  flex: 1;
  padding: 7px 0;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  text-align: center;
  border-radius: 10rpx;
  transition: all 0.2s;
}
.dash-seg-active {
  background: #ffffff;
  color: #1e40af;
  font-weight: 600;
  box-shadow: 0 2rpx 6rpx rgba(15,23,42,0.08);
}

/* 日期范围弹窗（复刻编辑页） */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.5); z-index: 1000;
  display: flex; align-items: flex-end; justify-content: center;
}
.modal-content {
  width: 100%; background-color: white;
  border-radius: 32rpx 32rpx 0 0; padding: 32rpx;
  animation: dash-slide-up 0.3s ease-out;
}
@keyframes dash-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.modal-header { display: flex; align-items: center; justify-content: center; margin-bottom: 48rpx; }
.modal-title { font-size: 36rpx; font-weight: 500; color: #333; }
.datetime-picker-content { margin-bottom: 64rpx; }
.picker-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24rpx 0; border-bottom: 1rpx solid #f0f0f0;
}
.picker-row:last-child { border-bottom: none; }
.picker-label { font-size: 32rpx; color: #333; font-weight: 500; }
.datetime-picker-display {
  flex: 1; display: flex; justify-content: flex-end;
  padding: 16rpx 24rpx; background-color: #f9fafb;
  border-radius: 12rpx; margin-left: 32rpx;
}
.datetime-picker-text { font-size: 30rpx; color: #333; }
.modal-actions { display: flex; gap: 32rpx; }
.modal-button {
  flex: 1; height: 88rpx; display: flex;
  align-items: center; justify-content: center; border-radius: 16rpx;
}
.modal-button-cancel { background-color: white; border: 1rpx solid #DDDDDD; }
.modal-button-confirm { background: linear-gradient(to right, #10b981, #14b8a6); }
.modal-button-text { font-size: 32rpx; font-weight: 500; color: #666; }
.modal-button-text-white { color: white; }
```

- [ ] **Step 5: 在微信开发者工具中验证**

预期：切到"数据看板" Tab 顶部出现 5 个筛选 chip，本月选中；点击不同选项高亮切换；点击"自定义"弹出底部 modal，两个日期 picker 可点选，取消/确定都能关闭；确定后 Segmented 最后一项文字变成 `MM/DD-MM/DD`。
看板空内容（图表还未加）但无报错。

---

## Task 3: 日期范围工具 + 聚合函数 computeDashboard

**Files:**
- Modify: `miniprogram/pages/charge-order/index.js`（新增工具函数 + refreshDashboard 实现）

- [ ] **Step 1: 在 index.js 顶部（`trendData` 之后、`makeEc` 之前）新增日期范围工具**

```js
// 日期工具：把 range 名称解析为 {start: Date, end: Date}
function rangeToDates(range, customRange) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()  // 0-based
  if (range === '本月') {
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) }
  }
  if (range === '上月') {
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) }
  }
  if (range === '本季度') {
    const qStart = Math.floor(m / 3) * 3
    return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 1) }
  }
  if (range === '本年') {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }
  }
  if (range === '自定义' && customRange.start && customRange.end) {
    const s = new Date(customRange.start + 'T00:00:00')
    const e = new Date(customRange.end + 'T00:00:00')
    e.setDate(e.getDate() + 1)  // 包含结束日当天
    return { start: s, end: e }
  }
  // 兜底：本月
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) }
}

// 等长度的"前一段"区间（用于环比）
function previousRange({ start, end }) {
  const len = end.getTime() - start.getTime()
  return { start: new Date(start.getTime() - len), end: new Date(start.getTime()) }
}

function parseCreatedAt(s) {
  if (!s) return null
  // 兼容 "YYYY-MM-DD HH:mm" 与 "YYYY-MM-DD"
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0))
}

function inRange(order, range) {
  const d = parseCreatedAt(order.created_at)
  if (!d) return false
  return d >= range.start && d < range.end
}
```

- [ ] **Step 2: 新增聚合主函数 computeDashboard**

紧接上面工具函数之后：

```js
// 颜色板（分类占比 + 兜底）
const CATEGORY_COLORS = ['#3B82F6', '#06B6D4', '#F59E0B', '#EF4444', '#10B981', '#94a3b8']

function computeDashboard(orders, range, prevRange) {
  const curr = orders.filter(o => inRange(o, range))
  const prev = orders.filter(o => inRange(o, prevRange))

  const sumAmount = arr => arr.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
  const currTotal = sumAmount(curr)
  const prevTotal = sumAmount(prev)
  const currCount = curr.length
  const avgOrder = currCount > 0 ? Math.round(currTotal / currCount) : 0
  const momPct = prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0

  // 分类占比：按 order_category 聚合金额，取 TOP 5，其余合并为"其他"
  const catMap = {}
  curr.forEach(o => {
    const k = o.order_category || '未分类'
    catMap[k] = (catMap[k] || 0) + (Number(o.totalAmount) || 0)
  })
  const catSorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const catTop = catSorted.slice(0, 5)
  const catRest = catSorted.slice(5).reduce((s, [, v]) => s + v, 0)
  const categoryData = catTop.map(([name, value], i) => ({
    name, value, color: CATEGORY_COLORS[i],
  }))
  if (catRest > 0) {
    categoryData.push({ name: '其他', value: catRest, color: CATEGORY_COLORS[5] })
  }

  // 楼层 TOP 5（按工单数）
  const floorMap = {}
  curr.forEach(o => {
    const k = o.floor || '未知'
    floorMap[k] = (floorMap[k] || 0) + 1
  })
  const topFloors = Object.entries(floorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // 设备 TOP 5（按工单数，维度同样是 order_category）
  const devMap = {}
  curr.forEach(o => {
    const k = o.order_category || '未分类'
    devMap[k] = (devMap[k] || 0) + 1
  })
  const topDevices = Object.entries(devMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  return {
    kpi: { total: currTotal, count: currCount, avg: avgOrder, momPct },
    categoryData,
    topFloors,
    topDevices,
  }
}
```

- [ ] **Step 3: 实现 refreshDashboard 并在相关时机调用**

替换 Task 2 中留下的 `refreshDashboard` 占位，以及 `onLoad`、`onSwiperChange`（切到 Tab 2 时也重算一次）：

```js
refreshDashboard() {
  const orders = chargeOrderStore.getAll()
  const range = rangeToDates(this.data.activeRange, this.data.customRange)
  const prev = previousRange(range)
  const result = computeDashboard(orders, range, prev)
  this.setData({ dash: result })
},
```

并在 `data` 里加初始字段 `dash: { kpi: { total: 0, count: 0, avg: 0, momPct: 0 }, categoryData: [], topFloors: [], topDevices: [] }`。

修改 `onLoad`：在 setData 之后调用 `this.refreshDashboard()`：

```js
onLoad() {
  const { headerHeight } = getNavBarInfo()
  this.setData({
    headerHeight: Math.ceil(headerHeight),
    ecTrend: makeEc(trendOption),
    ecPie: makeEc(pieOption),
  }, () => this.refreshDashboard())
},
```

- [ ] **Step 4: 验证**

- 打开开发者工具控制台，切到"数据看板" Tab
- 在 console 里运行 `getCurrentPages().slice(-1)[0].data.dash`
- 预期：得到包含 `kpi / categoryData / topFloors / topDevices` 的对象；切换筛选器后值会刷新
- UI 上仍看不到变化（等 Task 4）

---

## Task 4: KPI 4 卡网格

**Files:**
- Modify: `miniprogram/pages/charge-order/index.js`（补一个金额格式化助手并暴露到 data 或直接在 setData 时序列化）
- Modify: `miniprogram/pages/charge-order/index.wxml`（在时间筛选器下加 KPI 网格）
- Modify: `miniprogram/pages/charge-order/index.wxss`（KPI 卡样式）

- [ ] **Step 1: index.js 增加金额格式化并写入 data 友好字段**

在 `refreshDashboard` 中把数字直接转成 UI 友好格式，避免 wxml 里硬做格式化：

```js
refreshDashboard() {
  const orders = chargeOrderStore.getAll()
  const range = rangeToDates(this.data.activeRange, this.data.customRange)
  const prev = previousRange(range)
  const result = computeDashboard(orders, range, prev)

  const fmtMoney = n => '¥' + Math.round(n).toLocaleString('en-US')
  const fmtMom = p => {
    const abs = Math.abs(p).toFixed(1) + '%'
    if (p > 0) return { text: '↑ ' + abs, color: '#ef4444' }  // 支出上升=警示红
    if (p < 0) return { text: '↓ ' + abs, color: '#16a34a' }  // 支出下降=好=绿
    return { text: '— 0.0%', color: '#94a3b8' }
  }
  const mom = fmtMom(result.kpi.momPct)

  const kpiCards = [
    { label: '总支出', value: fmtMoney(result.kpi.total), accent: true },
    { label: '工单数', value: String(result.kpi.count) },
    { label: '平均单次', value: fmtMoney(result.kpi.avg) },
    { label: '环比变化', value: mom.text, color: mom.color },
  ]

  this.setData({ dash: result, kpiCards })
},
```

data 初始 `kpiCards: []`。

- [ ] **Step 2: index.wxml 在 Segmented 下方插入 KPI 网格**

把 `<!-- Task 4 将填入：KPI 4 卡 -->` 替换为：

```xml
<!-- KPI 4 卡 -->
<view class="dash-kpi-grid">
  <view wx:for="{{kpiCards}}" wx:key="label" class="dash-kpi-card">
    <text class="dash-kpi-label">{{item.label}}</text>
    <text class="dash-kpi-value {{item.accent ? 'dash-kpi-accent' : ''}}" style="{{item.color ? 'color:' + item.color + ';' : ''}}">{{item.value}}</text>
  </view>
</view>
```

- [ ] **Step 3: index.wxss 添加 KPI 卡样式**

追加到文件末尾：

```css
.dash-kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  padding: 0 32rpx;
  margin-bottom: 24rpx;
}
.dash-kpi-card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(15,23,42,0.04);
}
.dash-kpi-label { font-size: 24rpx; color: #64748b; }
.dash-kpi-value { font-size: 36rpx; color: #1a1a1a; font-weight: 700; }
.dash-kpi-accent { color: #ef4444; }
```

- [ ] **Step 4: 验证**

- 打开开发者工具，数据看板 Tab 顶部 Segmented 下方应出现 4 张卡，呈 2×2 网格
- 总支出红色；工单数/平均单次黑色；环比根据当前月 vs 上月数据显示 ↑/↓ + 百分比
- 切换"本月/上月/本季度/本年"，卡片数值应刷新
- 选自定义范围后，数值再次刷新

---

## Task 5: 月度支出趋势柱状图（复用 ec-canvas，刷新 trendOption）

**Files:**
- Modify: `miniprogram/pages/charge-order/index.js`（重写 trendOption 以 trendData 为数据源）
- Modify: `miniprogram/pages/charge-order/index.wxml`（在 KPI 下方插入趋势图卡）
- Modify: `miniprogram/pages/charge-order/index.wxss`（图表卡样式）

- [ ] **Step 1: index.js 重写 trendOption**

把现有 `trendOption = { ... }`（约 line 14-38）整段替换为：

```js
const trendOption = {
  grid: { left: 56, right: 20, top: 20, bottom: 36 },
  tooltip: { trigger: 'axis', formatter: p => `${p[0].axisValue} ¥${p[0].data.toLocaleString('en-US')}` },
  xAxis: {
    type: 'category',
    data: trendData.map(d => d.month),
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#737373', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    axisLine: { show: false },
    splitLine: { lineStyle: { color: '#f0f0f0' } },
    axisLabel: { color: '#a3a3a3', fontSize: 10, formatter: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v },
  },
  series: [{
    type: 'bar',
    data: trendData.map(d => d.amount),
    itemStyle: {
      borderRadius: [6, 6, 0, 0],
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#60a5fa' }] },
    },
    barWidth: 12,
  }],
}
```

- [ ] **Step 2: index.wxml 在 KPI 卡下方插入趋势图卡**

把 `<!-- Task 5 将填入：趋势图 -->` 替换为：

```xml
<!-- 月度支出趋势 -->
<view class="dash-chart-card">
  <view class="dash-chart-header">
    <text class="dash-chart-title">月度支出趋势</text>
    <text class="dash-chart-sub">近 12 个月</text>
  </view>
  <view class="dash-chart-box-trend">
    <ec-canvas ec="{{ ecTrend }}"></ec-canvas>
  </view>
</view>
```

- [ ] **Step 3: index.wxss 添加图表卡通用样式**

追加到文件末尾：

```css
.dash-chart-card {
  background: #ffffff;
  border-radius: 20rpx;
  margin: 0 32rpx 24rpx;
  padding: 24rpx 20rpx 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(15,23,42,0.04);
}
.dash-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 12rpx;
  margin-bottom: 8rpx;
}
.dash-chart-title { font-size: 28rpx; font-weight: 600; color: #1a1a1a; }
.dash-chart-sub { font-size: 22rpx; color: #94a3b8; }
.dash-chart-box-trend { width: 100%; height: 400rpx; }
```

- [ ] **Step 4: 验证**

- 数据看板 Tab，KPI 网格下方出现趋势图卡；12 个月柱子，蓝渐变
- 点击柱体出现 tooltip 显示 "X月 ¥NNN,NNN"
- 切换时间筛选器时，趋势图**不变**（符合 spec "独立于筛选器"）

---

## Task 6: 分类占比环形图

**Files:**
- Modify: `miniprogram/pages/charge-order/index.js`（pieOption 改为读取 dash.categoryData，分类变化后要能刷新图表）
- Modify: `miniprogram/pages/charge-order/index.wxml`（插入占比卡，含图表 + 右侧图例）
- Modify: `miniprogram/pages/charge-order/index.wxss`（环形图卡样式）

- [ ] **Step 1: 修改 pieOption 为工厂函数 + 改造渲染路径**

把现有 `const pieOption = { ... }`（约 line 40-59）整段替换为：

```js
function buildPieOption(categoryData) {
  const safeData = (categoryData && categoryData.length > 0) ? categoryData : []
  return {
    tooltip: { trigger: 'item', formatter: p => `${p.name}: ¥${p.data.value.toLocaleString('en-US')} (${p.percent}%)` },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['42%', '60%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      data: safeData.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } })),
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
    }],
  }
}
```

在 `refreshDashboard` 末尾再调用一次 ecPie 刷新。由于 ec-canvas 第一次 onInit 之后，后续数据变化需要通过 `chart.setOption` 更新；可用 ref 保存 chart 实例：

改 `makeEc`：

```js
const makeEc = (getOption) => ({
  lazyLoad: false,
  onInit: (canvas, width, height, dpr) => {
    const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
    chart.setOption(getOption())
    canvas.setChart(chart)
    return chart
  },
})
```

在 `onLoad` 里保留 `ecTrend: makeEc(() => trendOption)`；并新增 `ecPie: makeEc(() => buildPieOption(this.data.dash.categoryData))`。但因为 `this.data.dash` onLoad 时还没有计算，需要在 refreshDashboard 后重新绑定。

简化策略：**不热更新 ECharts 实例，改为"每次切换 range 重建 ec-canvas"**。在 wxml 上用 `wx:if` 包一层，切换时先 `ecPie: null`，下一 tick 再赋值：

```js
// 在 refreshDashboard 最后
const self = this
this.setData({ ecPie: null }, () => {
  self.setData({ ecPie: makeEc(() => buildPieOption(result.categoryData)) })
})
```

- [ ] **Step 2: index.wxml 在趋势图下方插入分类占比卡**

把 `<!-- Task 6 将填入：分类占比 -->` 替换为：

```xml
<!-- 按工单分类费用占比 -->
<view class="dash-chart-card">
  <view class="dash-chart-header">
    <text class="dash-chart-title">按工单分类费用占比</text>
  </view>
  <block wx:if="{{dash.categoryData.length > 0}}">
    <view class="dash-pie-row">
      <view class="dash-pie-canvas">
        <ec-canvas wx:if="{{ecPie}}" ec="{{ ecPie }}"></ec-canvas>
      </view>
      <view class="dash-pie-legend">
        <view wx:for="{{dash.categoryData}}" wx:key="name" class="dash-legend-item">
          <view class="dash-legend-dot" style="background:{{item.color}};"></view>
          <text class="dash-legend-name">{{item.name}}</text>
        </view>
      </view>
    </view>
  </block>
  <view wx:else class="dash-empty">暂无数据</view>
</view>
```

- [ ] **Step 3: index.wxss 添加环形图卡和图例样式**

追加到文件末尾：

```css
.dash-pie-row {
  display: flex;
  align-items: center;
  height: 360rpx;
}
.dash-pie-canvas { flex: 1; height: 100%; }
.dash-pie-legend {
  flex: 0 0 220rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-right: 12rpx;
}
.dash-legend-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: #525252;
}
.dash-legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex: 0 0 auto;
}
.dash-legend-name { flex: 1; }

.dash-empty {
  padding: 60rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #94a3b8;
}
```

- [ ] **Step 4: 验证**

- 数据看板，趋势图下方出现环形图卡；左侧环形，右侧竖直列出类别 legend（圆点 + 类别名）
- 切换时间筛选器 → 环形扇区和图例随之更新
- 选中一个数据稀疏的自定义范围 → 显示"暂无数据"占位

---

## Task 7: 楼层 / 设备 TOP 横向条形图 + 空态

**Files:**
- Modify: `miniprogram/pages/charge-order/index.js`（新增 `buildHBarOption(items, color)` 工厂 + 两个 ec 绑定）
- Modify: `miniprogram/pages/charge-order/index.wxml`（插入两张卡）
- Modify: `miniprogram/pages/charge-order/index.wxss`（条形图卡样式）

- [ ] **Step 1: index.js 新增横向条形图 option 工厂**

在 `buildPieOption` 之后追加：

```js
function buildHBarOption(items, color) {
  const names = items.map(i => i.name)
  const values = items.map(i => i.count)
  return {
    grid: { left: 100, right: 40, top: 10, bottom: 20 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#a3a3a3', fontSize: 10 },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      minInterval: 1,
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#525252', fontSize: 11 },
      inverse: true,
    },
    series: [{
      type: 'bar',
      data: values,
      barWidth: 14,
      itemStyle: { borderRadius: [0, 6, 6, 0], color },
      label: {
        show: true,
        position: 'right',
        formatter: '{c} 单',
        color: '#525252',
        fontSize: 10,
      },
    }],
  }
}
```

- [ ] **Step 2: 在 refreshDashboard 里绑定楼层/设备 ec 实例**

扩展 refreshDashboard 的末尾：

```js
const self = this
this.setData({
  ecPie: null,
  ecFloor: null,
  ecDevice: null,
}, () => {
  self.setData({
    ecPie: makeEc(() => buildPieOption(result.categoryData)),
    ecFloor: makeEc(() => buildHBarOption(result.topFloors, '#F59E0B')),
    ecDevice: makeEc(() => buildHBarOption(result.topDevices, '#06B6D4')),
  })
})
```

data 里加初始：`ecFloor: null, ecDevice: null`。

- [ ] **Step 3: index.wxml 在分类占比下方插入两张热点卡**

把 `<!-- Task 7 将填入：楼层/设备 TOP -->` 替换为：

```xml
<!-- 楼层 TOP 5 -->
<view class="dash-chart-card">
  <view class="dash-chart-header">
    <text class="dash-chart-title">楼层维修热点 TOP 5</text>
    <text class="dash-chart-sub">按工单数</text>
  </view>
  <view wx:if="{{dash.topFloors.length > 0}}" class="dash-chart-box-hbar">
    <ec-canvas wx:if="{{ecFloor}}" ec="{{ ecFloor }}"></ec-canvas>
  </view>
  <view wx:else class="dash-empty">暂无数据</view>
</view>

<!-- 设备 TOP 5 -->
<view class="dash-chart-card">
  <view class="dash-chart-header">
    <text class="dash-chart-title">设备维修热点 TOP 5</text>
    <text class="dash-chart-sub">按工单数</text>
  </view>
  <view wx:if="{{dash.topDevices.length > 0}}" class="dash-chart-box-hbar">
    <ec-canvas wx:if="{{ecDevice}}" ec="{{ ecDevice }}"></ec-canvas>
  </view>
  <view wx:else class="dash-empty">暂无数据</view>
</view>
```

- [ ] **Step 4: index.wxss 添加条形图容器样式**

追加到文件末尾：

```css
.dash-chart-box-hbar {
  width: 100%;
  height: 340rpx;
}
```

- [ ] **Step 5: 验证**

- 数据看板底部新增两张卡
- 楼层卡：琥珀色条形，从上到下降序（条越长越靠上），右侧显示 "X 单"
- 设备卡：青色条形，同样从上到下降序
- 切换"本月 / 上月 / 本年" → 排名随之更新
- 自定义范围选中一段无工单的日期 → 两张卡都显示"暂无数据"

---

## 验证清单（整页联调）

任务全部完成后，按 spec 中的"验证"条目跑一遍：

1. 打开微信开发者工具，进入 `charge-order/index` → 切到"数据看板" Tab
2. 顶部 5 个筛选器可点，默认"本月"高亮
3. 切换"上月 / 本季度 / 本年"：
   - KPI 4 卡数值变化
   - 分类占比环形图扇区与图例更新
   - 楼层 / 设备 TOP 条形图排名更新
   - **月度趋势图保持不变**
4. 点"自定义" → 底部弹窗 → 选开始/结束日期 → 确定 → Segmented 显示 `MM/DD-MM/DD`，各卡数据按自定义范围刷新
5. KPI：总支出红色；环比↑红/↓绿
6. 趋势图：蓝渐变柱，点击有 tooltip
7. 环形图：中心无特殊文字（v1 未做，spec 中提及可后续加），右侧 legend 6 行内
8. 楼层卡琥珀 / 设备卡青色，条形右端显示 "N 单"
9. 选中一段确实无数据的范围：分类占比和两个 TOP 卡都显示"暂无数据"，KPI 显示 `¥0 / 0 / ¥0 / — 0.0%`
10. 整页滚动顺畅，卡间距 24rpx 一致

---

## Self-Review（已完成）

**Spec coverage:**
- ✅ 时间筛选器（本月/上月/本季度/本年/自定义）— Task 2
- ✅ KPI 4 卡（总支出/工单数/平均单次/环比）— Task 4
- ✅ 月度支出趋势（近 12 个月固定）— Task 5
- ✅ 分类占比（order_category，TOP 5 + 其他）— Task 6
- ✅ 楼层/设备 TOP 条形图 — Task 7
- ✅ 移除维修方 TOP 5 榜单（Task 2 已清空旧内容）
- ✅ Mock 数据扩充 — Task 1
- ✅ 空态处理 — Task 6 / Task 7
- ✅ 环比配色（上升红/下降绿）— Task 4

**Placeholder scan:** 无 TBD/TODO；每段代码可直接粘贴使用。

**Type consistency:** `dash` 对象字段名在 computeDashboard 返回值、setData、wxml 引用三处一致：`kpi / categoryData / topFloors / topDevices`；ec 实例命名一致：`ecTrend / ecPie / ecFloor / ecDevice`。

---

## Notes

- 本 plan 遵循项目 CLAUDE.md 约定：**未包含 git commit 步骤**，任务完成后由用户选择何时提交
- 所有代码块均可直接使用；`inRange` 与 `parseCreatedAt` 能同时兼容 `YYYY-MM-DD HH:mm` 和 `YYYY-MM-DD` 两种 created_at 格式
- Task 6/7 采用"重建 ec-canvas"策略而非 `chart.setOption` 热更新，是因为 ec-canvas 的 onInit 在微信小程序里更可靠；代价是切换 range 有短暂的"重新绘制"闪烁，v1 可接受
