# 入库记录详情页替换计划（基于 Pencil N5Q4OL）

## 背景
- 现有入库记录卡片（`pages/material/stock-in/index` 和 `pages/material/index`）点击后跳转到 `pages/material/record-detail/`，目前是简易"两栏 label-value"列表样式。
- 设计稿 N5Q4OL「商品入库详情」是更精致的 3 段卡片布局：商品卡 + 入库信息卡 + 数量信息卡 + 底部操作栏。

## 现有数据模型（来自 cloudfunctions/productManager/handlers/stock.js）
record 字段：`record_id / product_id / product_name / product_code / product_image / category / spec / model / usage_area / type / quantity / operator{user_id,name} / remark / created_at`

stock-in 入口还会桥接 `material_name = product_name`，`material_number = product_code`，`material_image = product_image`。

注意：商品在 2026 年新增了 `purchase_price`（采购单价）字段，但**入库记录 product_records 没有同步保留该字段**——即入库时点价没有快照到记录上。

## 设计稿字段 vs 实际数据映射
| 设计稿区块 | 设计稿字段 | 数据来源 | 处理 |
|---|---|---|---|
| 商品卡 | 商品图片 | product_image / material_image | ✅ 用现有字段 |
| 商品卡 | 商品名 + 数量徽章 | product_name + quantity | ✅ |
| 商品卡 | 编号 | product_code / material_number | ✅ |
| 商品卡 | 规格副标 | spec / model | ✅ 拼接 |
| 入库信息 | 入库单号 | record_id（格式 `#${id}` 或 `RH${id补零}`） | ✅ 用 record_id 格式化 |
| 入库信息 | 入库时间 | created_at | ✅ fullTime |
| 入库信息 | 入库仓位 | usage_area | ✅ |
| 入库信息 | 接收人 | operator.name | ✅ |
| 入库信息 | 采购单号 | ❌ 不存在 | 显示 "-" |
| 入库信息 | 供应商 | ❌ 不存在 | 显示 "-" |
| 入库信息 | 入库类型 | 由 type 推导 | "采购入库" / "出库" |
| 入库信息 | 备注 | remark | ✅ "暂无" 占位 |
| 数量信息 | 入库数量 | quantity | ✅ 突出展示 |
| 数量信息 | 单价 / 总价 | ❌ 入库记录无快照 | **方案二选一** |
| 底部按钮 | 分享 / 编辑 / 删除 | 现有页面无对应逻辑 | **方案二选一** |

## 待决策的两处取舍

**A. 数量信息卡的三栏（数量 / 单价 / 总价）**
- A1：保留三栏布局，单价和总价显示 "-" 占位（保留设计稿原貌）
- A2：仅保留"入库数量"单栏大字展示（去掉无数据列）

**B. 底部操作栏（分享 / 编辑 / 删除）**
- B1：暂时不实现，移除底部栏
- B2：保留 UI 但点击提示"功能开发中"
- B3：实现"分享"（wx.showShareMenu），移除编辑/删除

## 实施任务
- [x] 1. 调整 `pages/material/record-detail/index.js`：增加单号格式化、规格副标拼接、入库类型推导
- [x] 2. 重写 `pages/material/record-detail/index.wxml`：商品卡 + 入库信息卡（带左侧蓝色竖条标题）+ 数量信息卡
- [x] 3. 重写 `pages/material/record-detail/index.wxss`：按设计稿样式（白色卡片 24rpx 圆角、左侧 #2563EB 竖条标题）

## 范围限制
- 不改云函数、不改数据模型
- 不改 stock-in / material 列表的导航逻辑
- 仅替换 record-detail 页本身（JS 微调 + wxml/wxss 重写）

## Review
取舍最终方案：**A2 + B1**（数量卡单栏大字 + 移除底部操作栏），坚持"不造假占位、不假按钮"原则。

### 代码改动（仅 3 个文件）
1. **`pages/material/record-detail/index.js`**：原 13 行的 onLoad 扩展为派生展示字段 `isIn / specSubtitle / recordNumber / typeLabel / quantityText`；增加图片预览 `onPreviewImage`；导航栏标题改成"商品入库详情/商品出库详情"。
2. **`pages/material/record-detail/index.wxml`**：原"两栏 label-value"重构为三段卡片：
   - **商品卡**（图片 160rpx + 商品名 + 数量徽章 + 编号/规格副标）
   - **入库信息卡**（左侧 6rpx 蓝色竖条标题 + 7 行 label-value：单号/时间/仓位/接收人/分类/类型 tag/备注）
   - **数量信息卡**（同款标题 + 56rpx 大字数量）
3. **`pages/material/record-detail/index.wxss`**：page bg `#F5F7FA`；卡片白底 24rpx 圆角 + 微阴影；类型 tag 蓝/橙色背景；入库数量绿色、出库红色。

### 字段映射策略
- 单号：`record_id` 不存在用 `-`，存在则格式化为 `RH00000123` / `CH00000123`
- 入库类型 tag：type='in' → "采购入库"（蓝）；type='out' → "领用出库"（橙）
- 规格副标：`spec · model` 拼接，两者都没则不渲染
- 备注：空时显示"暂无"（灰色）
- 入库数量：`+58` / `-58` 大字，带颜色

### 兼容性
- 保留双类型（in/out）支持，文案动态切换
- 桥接字段 `material_name` / `material_number` / `material_image` 与原 `product_*` 字段都能正常显示
- 入口（stock-in、material/index）无任何改动

## 二次迭代：完全复刻设计稿
用户反馈"没有完全复刻"，恢复了 4 项原本被精简掉的设计元素：

1. **数量信息 3 列**（入库数量 / 单价 / 总价）
   - 入库数量：数据真实，绿色 / 红色大字
   - 单价：`record.unit_price` 不存在时显示 `¥-`，存在则 `¥{value}/{unit}`
   - 总价：`unit_price × quantity` 自动计算，缺则 `¥-`
   - 三列等宽，中列加左右细分隔线

2. **恢复 采购单号 / 供应商 两行**
   - 字段不存在时显示 `-`
   - 有真实值时右侧显示复制图标，点击 `wx.setClipboardData` 复制 + Toast

3. **复制图标**（入库单号 / 采购单号 / 供应商）
   - 用 `van-icon name="todo-list-o"` 14px #9CA3AF
   - 仅当值不为 `-` 时渲染（避免给空数据假交互）

4. **底部固定按钮栏**（position: fixed）
   - 分享：`<button open-type="share">` + 页面级 `onShareAppMessage`（真实可分享）
   - 编辑 / 删除：Toast 提示"功能开发中"
   - 配色：分享/编辑 #F3F4F6 浅灰底；删除 #DC2626 红底白字
   - 加 `safe-area-inset-bottom` 适配刘海屏
   - 内容区底部加 160rpx 占位防遮挡
