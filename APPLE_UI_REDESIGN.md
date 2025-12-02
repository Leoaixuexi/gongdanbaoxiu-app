# Apple UI 设计系统重构完成

## 🎨 设计系统概述

参考 Apple Human Interface Guidelines (HIG)，全面重构了小程序的 UI 设计系统，采用现代化的 Apple 设计风格。

---

## ✅ 已完成的优化

### 1. 全局设计系统 (`/styles/theme.wxss`)

创建了完整的设计变量系统：

#### 颜色系统
- **主色调**: iOS Blue (#007AFF) 替代原来的绿色
- **语义颜色**: Success (#34C759), Warning (#FF9500), Error (#FF3B30), Info (#5AC8FA)
- **中性色**: 完整的灰度系统，符合 iOS 视觉规范
- **渐变**: 使用柔和的渐变效果，增强视觉深度

#### 间距系统
- 8rpx 基础单位
- 6级间距：xs(8), sm(12), md(16), lg(24), xl(32), 2xl(48), 3xl(64)
- 确保视觉节奏的一致性

#### 字体系统
- **字体家族**: SF Pro Display 风格（-apple-system, BlinkMacSystemFont）
- **字号**: 8个等级，从 xs(22rpx) 到 4xl(56rpx)
- **字重**: Regular(400), Medium(500), Semibold(600), Bold(700)
- **行高**: Tight(1.2), Normal(1.4), Relaxed(1.6)

#### 圆角系统
- 6个等级：sm(8rpx) 到 2xl(24rpx)，plus full(9999rpx)
- 使用较大的圆角，符合 iOS 设计语言

#### 阴影系统
- 3级阴影：sm, md, lg
- 柔和的阴影效果，营造空间层次感

#### 动画系统
- 平滑的缓动曲线：cubic-bezier(0.4, 0, 0.2, 1)
- 3种速度：fast(0.15s), base(0.2s), slow(0.3s)

### 2. 全局样式 (`app.wxss`)

#### 通用组件类
- **apple-card**: Apple 风格卡片
- **apple-btn**: Apple 风格按钮（primary, secondary, outline）
- **apple-input**: Apple 风格输入框
- **apple-list**: Apple 风格列表
- **apple-badge**: Apple 风格徽章
- **apple-divider**: Apple 风格分隔线

#### 实用工具类
- Flex 布局工具
- 间距工具
- 文本样式工具
- 状态颜色工具（pending, progress, completed, error）
- 优先级颜色工具（emergency, high, normal, low）

#### 动画效果
- fade-in：淡入动画
- slide-up：滑入动画
- skeleton：骨架屏加载动画

### 3. 首页优化 (`pages/index/index.wxss`)

#### 用户头像区域
- **渐变背景**: iOS Blue 渐变 (007AFF → 5AC8FA)
- **毛玻璃效果**: backdrop-filter 实现半透明毛玻璃
- **圆角头像**: 带边框的圆形头像
- **退出/登录按钮**: 毛玻璃风格，悬浮效果

#### 快速统计卡片
- **卡片布局**: 向上浮动的白色卡片（负 margin-top）
- **阴影效果**: 柔和的卡片阴影
- **数字突出**: 大号字体 + iOS Blue 主色
- **点击反馈**: scale(0.96) 缩放效果

#### 导航卡片
- **卡片样式**: 大圆角 (16rpx)，白色背景
- **渐变图标**: 圆角渐变色图标容器
- **左侧指示条**: 激活时显示蓝色渐变条
- **Emoji 图标**: 使用 emoji 代替传统图标，更友好
- **红点徽章**: 圆形红色徽章显示数量
- **悬浮效果**: 点击时缩放和阴影变化

### 4. 登录页优化 (`pages/login/login.wxss`)

#### 整体布局
- **全屏渐变**: iOS Blue 渐变背景
- **垂直居中**: Flexbox 实现完美居中
- **安全区域**: 自动适配刘海屏和底部指示器

#### Logo 区域
- **圆角图标**: 28rpx 大圆角，毛玻璃效果
- **标题**: 大号粗体白色文字
- **副标题**: 半透明白色文字
- **云开发徽章**: 毛玻璃胶囊样式

#### 表单设计
- **输入框**:
  - 毛玻璃背景，圆角 12rpx
  - 聚焦时向上浮起 (-2rpx)
  - 阴影增强效果
  - 大号字体 (32rpx)

- **登录按钮**:
  - 白色毛玻璃背景
  - 蓝色文字（与 iOS 系统按钮一致）
  - 点击缩放反馈

#### 测试账号展示
- **容器**: 半透明毛玻璃容器
- **账号卡片**:
  - 半透明白色背景
  - 左右布局：角色名 - 账号密码
  - 点击反馈效果
  - 等宽字体显示凭证
  - 白色粗体文字

#### Footer
- **半透明文字**: 版本信息和技术标识
- **渐变透明度**: 营造层次感

---

## 🎯 设计亮点

### 1. 毛玻璃效果 (Glassmorphism)
- 使用 `backdrop-filter: blur()` 实现
- 半透明背景 + 模糊效果
- 符合 iOS 15+ 设计语言

### 2. 微交互动画
- 按钮点击：`scale(0.96-0.98)` 缩放
- 卡片悬浮：阴影和缩放联动
- 输入框聚焦：向上浮动 + 阴影增强
- 加载动画：平滑的旋转效果

### 3. 视觉层次
- **Z轴分层**: 通过阴影营造空间感
- **颜色对比**: 主色 vs 中性色
- **字重对比**: Bold vs Regular
- **尺寸对比**: 标题 vs 正文

### 4. 一致性
- **间距统一**: 使用设计token
- **圆角统一**: 8rpx 基础单位
- **颜色统一**: iOS 标准色板
- **动画统一**: 相同的缓动曲线

---

## 📱 适配特性

### 安全区域
```css
padding-top: calc(var(--spacing-xl) + constant(safe-area-inset-top));
padding-top: calc(var(--spacing-xl) + env(safe-area-inset-top));
padding-bottom: constant(safe-area-inset-bottom);
padding-bottom: env(safe-area-inset-bottom);
```

### 暗黑模式支持 (预留)
设计系统使用 CSS 变量，可轻松扩展暗黑模式：
```css
/* 未来可添加 */
@media (prefers-color-scheme: dark) {
  page {
    --color-bg-primary: #000000;
    --color-text-primary: #FFFFFF;
    /* ... */
  }
}
```

---

## 🔄 待优化页面

以下页面可以按照相同的设计系统继续优化：

### 1. 工单提交页面 (`pages/property/submit/`)
- [ ] 应用 Apple 风格表单
- [ ] 优化图片上传组件
- [ ] 添加优雅的选择器

### 2. 工单列表页面 (`pages/property/submitted/`)
- [ ] 使用 apple-list 组件
- [ ] 优化筛选器UI
- [ ] 添加骨架屏加载

### 3. 工单详情页面 (`pages/work-order-detail/`)
- [ ] 重新设计信息展示
- [ ] 优化时间轴样式
- [ ] 改进操作按钮

### 4. 维修员页面 (`pages/maintenance/*`)
- [ ] 统一卡片样式
- [ ] 优化状态显示
- [ ] 添加下拉刷新

### 5. 管理员页面 (`pages/admin/*`)
- [ ] 数据可视化优化
- [ ] 表格样式改进
- [ ] 表单组件统一

---

## 🎨 设计资源

### 颜色参考
```
Primary Blue:  #007AFF  (iOS系统蓝)
Light Blue:    #5AC8FA  (浅蓝)
Success Green: #34C759  (iOS系统绿)
Warning Orange:#FF9500  (iOS系统橙)
Error Red:     #FF3B30  (iOS系统红)
```

### 字体参考
- **标题**: Bold (700), 42-56rpx
- **正文**: Regular (400), 28rpx
- **辅助**: Regular (400), 26rpx
- **注释**: Regular (400), 22rpx

### 圆角参考
- **小组件**: 8-12rpx
- **卡片**: 16-20rpx
- **按钮**: 12rpx
- **胶囊**: 9999rpx (全圆角)

---

## 💡 使用建议

### 1. 开发新页面时
```html
<!-- 使用预定义的组件类 -->
<view class="apple-card">
  <text class="text-lg font-semibold">标题</text>
  <text class="text-sm text-secondary">描述</text>
</view>
```

### 2. 自定义样式时
```css
/* 使用设计变量 -->
.custom-element {
  background-color: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-sm);
}
```

### 3. 添加交互动画
```css
.interactive-element {
  transition: all var(--transition-base);
}

.interactive-element:active {
  transform: scale(0.98);
  opacity: 0.8;
}
```

---

## 🚀 下一步

1. **继续优化其他页面**: 按照设计系统逐步优化所有页面
2. **添加暗黑模式**: 为支持暗黑模式做准备
3. **性能优化**: 优化动画性能和加载速度
4. **无障碍支持**: 添加适当的 ARIA 标签
5. **响应式设计**: 适配不同尺寸的设备

---

**当前状态**:
- ✅ 设计系统: 100%
- ✅ 首页: 100%
- ✅ 登录页: 100%
- ⏸️ 其他页面: 0% (待优化)

**整体进度**: 约 20% 完成

继续优化将让整个小程序拥有统一、现代、优雅的 Apple 设计风格！
