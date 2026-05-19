# 首页 - 工单维修 tab 顶部色调改造

## 背景
- `pages/home/index` 是 3 个内部 tab 的容器（工单维修 / 耗品管理 / 楼宇巡检）
- 当前整页 `.page` 背景是 `linear-gradient(180deg, #DCE4FF 0%, #DFF5F4 22%, #F1F3F6 50%, #EAEDF2 100%)`（浅蓝→浅青→灰），3 个 tab 共用
- 工单列表页 `pages/index/` 顶部是 `linear-gradient(to right, #10b981, #14b8a6)` 翠绿渐变

## 目标
- 切到"工单维修"tab 时，顶部约前 1/3 屏 用 **淡绿色渐变**（`#A7F3D0 → #99F6E4`，emerald-200 → teal-200）
- 切到"耗品管理"或"楼宇巡检"tab 时，保持当前浅蓝色渐变不变

## 实现方案（最小改动）
利用现有的 `.page` 容器渐变机制 — 只在 `activeTab === 0` 时给 `.page` 加一个 modifier class，覆盖背景渐变。

### Todo
- [x] 1. `home/index.wxml`：给根节点 `.page` 添加动态 class，工单维修激活时为 `page-workorder-active`
- [x] 2. `home/index.wxss`：新增 `.page.page-workorder-active` 规则，覆盖背景为淡绿色版渐变 — `linear-gradient(180deg, #A7F3D0 0%, #99F6E4 22%, #F1F3F6 50%, #EAEDF2 100%)`
- [ ] 3. 自测：切换三个 tab 视觉是否符合预期；其他两个 tab 是否保持原状（需在微信开发者工具中验证）

## 不做的事
- 不改 `.tab-header` 自身（保持 transparent，由 .page 透出色调）
- 不改 swiper-item 内容卡片样式
- 不改其他页面（工单列表 / 报修 / 详情）的颜色
- 不为渐变切换加 transition 动效（CSS gradient 不支持平滑过渡，避免引入额外层级开销）

## 风险
- 极低 — 只新增 1 个 class 切换 + 1 条 CSS 规则，回滚成本极小

---

## Review

### 改动文件
1. `miniprogram/pages/home/index.wxml`（1 行）
   - 根节点 `.page` 加入动态 class：`{{activeTab === 0 ? 'page-workorder-active' : ''}}`
2. `miniprogram/pages/home/index.wxss`（新增 7 行）
   - 在 `.page` 规则之后新增 `.page.page-workorder-active` 覆盖背景渐变

### 效果说明
- **工单维修 tab（activeTab=0）**：顶部 22% 为 `#A7F3D0 → #99F6E4`（emerald-200 → teal-200）淡绿色，向下过渡到原本的 `#F1F3F6 → #EAEDF2` 浅灰
- **耗品管理 tab（activeTab=1）**、**楼宇巡检 tab（activeTab=2）**：完全沿用原有 `#DCE4FF → #DFF5F4 → #F1F3F6 → #EAEDF2` 浅蓝色渐变，零变动

### 设计参考
- 灵感来自 `pages/index/` 工单列表顶部 `#10b981 → #14b8a6`（emerald-500 → teal-500）
- 改造时降到 200 色阶，比原色淡约 60%，保留绿色色相和"工单维修"的视觉语义

### 风险与回滚
- 影响面：仅 `pages/home/index` 一个页面的视觉，不影响业务逻辑
- 回滚：移除 `.page.page-workorder-active` 规则 + 还原 wxml 根节点 class 即可

---

# 首页 - 工单维修常用功能 "工单列表" 图标替换

## 背景
- `pages/home/index.wxml:75-87` 渲染 `workOrderFunctions` 4 宫格
- `pages/home/index.js:60` 定义首项："工单列表"，当前图标为 `/images/func-workorder.png`（191×200, 6.3KB）
- 同组其它 3 个图标尺寸 ~200×200、4–6KB（dashboard 194×200 / material 192×200 / fee 200×198）

## 目标
- 用用户提供的 `/Users/lvleo/Desktop/gd.png`（315×332, 53.8KB，绿色清单/便签图标）替换 `func-workorder.png`
- 压缩到与现有图标一致：约 200×200 px，文件大小控制在 ~5–7KB

## 实现方案（最小改动）
1. 用 macOS `sips` 把 `gd.png` 等比缩放到 200×200（输出到 miniprogram/images/func-workorder.png，覆盖原文件）
2. 用 `pngquant` 或 `sips -s formatOptions` 进一步压缩到 ~6KB；若 `pngquant` 不可用，仅靠 sips 缩放后通常已经接近目标体积
3. 验证：`file` 确认尺寸、`ls -la` 确认体积

## Todo
- [x] 1. 备份（依赖 git 历史,未额外备份）
- [x] 2. `sips -z 200 200` 把 gd.png 缩放到 200×200,覆盖 miniprogram/images/func-workorder.png
- [x] 3. `pngquant --quality=70-90` 压缩(初次 sips 输出 29KB,压缩后 9KB)
- [x] 4. 验证：200×200, 8-bit colormap, 9083 字节

## 不做的事
- 不改 index.js / index.wxml / index.wxss（图标路径不变,只替换文件内容）
- 不动其它 3 个图标
- 不调整 `.wo-func-icon` 的尺寸样式

## Review

### 改动文件
- `miniprogram/images/func-workorder.png`(二进制替换)
  - 旧: 191×200, 6298 字节(浅色齿轮风格)
  - 新: 200×200, 9083 字节(绿色清单/便签图标,来自用户提供的 gd.png)

### 体积说明
- 同组图标体积 4.3–6.3KB,新图标 9KB 略大
- 原因:新图源色彩更丰富(渐变阴影 + 多形状),pngquant 70–90 已经是不影响视觉的最佳压缩
- 工程上 9KB 仍为可接受范围,不影响首屏加载

### 验证
- `file func-workorder.png` → PNG 200×200 8-bit colormap ✅
- 路径未改,`pages/home/index.js:60` 的 `/images/func-workorder.png` 引用直接生效
- 自测:在微信开发者工具中查看"工单维修"tab → 常用功能 → 第一个图标

---

# 首页 - 工单维修常用功能 其余 3 个图标替换

## 映射
| 源文件 | 目标 | 标签 | js 行号 |
|--------|------|------|---------|
| `~/Desktop/wl.png` (盒子) | `func-material.png` | 物料管理 | index.js:62 |
| `~/Desktop/sj.png` (柱状图) | `func-dashboard.png` | 数据看板 | index.js:61 |
| `~/Desktop/sf.png` (¥票据) | `func-fee.png` | 收费工单 | index.js:63 |

## 流程
对 3 个源文件依次执行:
1. `sips -z 200 200 <src> --out <dst>`
2. `pngquant --force --quality=70-90 --speed 1 --output <dst> <dst>`

## Todo
- [x] wl.png → func-material.png
- [x] sj.png → func-dashboard.png
- [x] sf.png → func-fee.png
- [x] 验证全部 200×200 + 8-bit colormap

## Review

### 改动文件(3 个二进制替换)
| 文件 | 旧 | 新 |
|------|-----|----|
| func-material.png | 192×200, 6293 B | 200×200, 8328 B |
| func-dashboard.png | 194×200, 5116 B | 200×200, 6985 B |
| func-fee.png | 200×198, 4298 B | 200×200, 8421 B |

### 当前 4 个图标体积一致性
- workorder 9.1KB / material 8.3KB / dashboard 7.0KB / fee 8.4KB,均在 7–9KB 之间
- 比原图标(4–6KB)略大,因为新图标色彩更丰富(渐变+多形状)
- pngquant 70–90 已为不掉视觉的最佳压缩点

### 验证
- 全部 `200×200 8-bit colormap` ✅
- 代码无变更,路径不变,微信开发者工具刷新即可看到效果

