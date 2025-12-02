# 快速参考 - 方案B和C功能

> 快速查找新实现的功能和使用方法

---

## 📦 新增功能清单

### 1️⃣ SLA告警系统

#### 使用SLA倒计时组件
```wxml
<!-- 在工单详情页中使用 -->
<sla-countdown
  createdAt="{{workOrder.created_at}}"
  priority="{{workOrder.priority}}"
  visible="{{true}}"
  bind:slachange="onSLAChange"
/>
```

#### 查看SLA告警页面
```
路径：pages/admin-manager/sla-alerts/index
入口：管理员首页 → SLA告警
```

#### SLA计算工具
```javascript
const slaCalculator = require('../../utils/slaCalculator');

// 计算单个工单SLA
const sla = slaCalculator.calculateSLA(
  workOrder.created_at,
  workOrder.priority,
  workOrder.completed_at
);

// 批量计算
const ordersWithSLA = slaCalculator.calculateWorkOrdersSLA(workOrders);

// 获取告警工单
const alerts = slaCalculator.getAlertWorkOrders(workOrders, ['critical', 'overdue']);

// 生成统计报告
const report = slaCalculator.generateSLAReport(workOrders);
```

---

### 2️⃣ 报表导出功能

#### 导出工单报表
```javascript
const reportExport = require('../../services/reportExport');

// 导出所有工单
await reportExport.exportWorkOrders();

// 导出筛选后的工单
await reportExport.exportWorkOrders({
  status: 'Completed',
  priority: 'High',
  start_date: '2025-01-01',
  end_date: '2025-01-31'
});
```

#### 导出SLA报表
```javascript
// 导出当前SLA状态报表
await reportExport.exportSLAReport();
```

#### 导出用户报表
```javascript
// 导出所有用户信息
await reportExport.exportUserReport();
```

---

### 3️⃣ 密码迁移

#### 云函数控制台执行
```json
{
  "action": "migratePasswords",
  "test_openid": "管理员的openid"
}
```

#### 小程序中执行
```javascript
const { migratePasswords } = require('../../scripts/migrate-passwords');

// 确保当前用户是系统管理员
await migratePasswords();
```

---

### 4️⃣ 管理功能入口

#### 用户管理
```
路径：pages/admin/users/index
功能：用户列表、添加、编辑、删除、搜索、筛选
```

#### 角色管理
```
路径：pages/admin/roles/index
功能：角色列表、权限配置
```

#### 审计日志
```
路径：pages/admin/audit-logs/index
功能：操作记录查看、筛选
```

#### 系统配置
```
路径：pages/admin/config/index
功能：SLA配置、通知设置、系统参数
```

---

### 5️⃣ 数据分析

#### 管理仪表板
```
路径：pages/admin-manager/dashboard/index
功能：实时数据概览、统计图表、绩效排行
```

#### 高级分析
```
路径：pages/admin-manager/analytics/index
功能：多维度分析、趋势预测、数据钻取
```

---

## 🎨 UI组件使用

### Apple设计风格表单
```wxml
<!-- 页面头部 -->
<view class="page-header">
  <view class="page-title">标题</view>
  <view class="page-subtitle">副标题</view>
</view>

<!-- 提示卡片 -->
<view class="form-tips">
  <view class="tips-title">
    <text class="tips-icon">💡</text>
    提示标题
  </view>
  <view class="tips-content">
    <view class="tips-list">
      <view class="tips-item">提示内容1</view>
      <view class="tips-item">提示内容2</view>
    </view>
  </view>
</view>
```

---

## ⚙️ 配置文件

### app.json 添加新页面
```json
{
  "pages": [
    "pages/admin-manager/sla-alerts/index"
  ],
  "usingComponents": {
    "sla-countdown": "/components/sla-countdown/index"
  }
}
```

---

## 🔧 常用命令

### 部署云函数
```bash
# 进入云函数目录
cd cloudfunctions/exportReport

# 安装依赖
npm install

# 在微信开发者工具中：右键 → 上传并部署
```

### 查看日志
```bash
# 云函数日志
云开发控制台 → 云函数 → 选择函数 → 日志

# 审计日志
小程序 → 管理 → 审计日志
```

---

## 📊 SLA时限配置

| 优先级 | SLA时限 | 警告阈值 | 紧急阈值 |
|--------|---------|----------|----------|
| Emergency | 2小时 | <30分钟 | <12分钟 |
| High | 4小时 | <1小时 | <24分钟 |
| Normal | 8小时 | <2小时 | <48分钟 |
| Low | 24小时 | <6小时 | <2.4小时 |

---

## 🎯 快速测试

### 测试SLA告警
```
1. 创建紧急工单
2. 等待12分钟
3. 查看SLA告警页面，应显示紧急状态
4. 工单详情页应显示红色倒计时
```

### 测试报表导出
```
1. 进入数据分析页
2. 点击导出按钮
3. 选择导出类型
4. 确认文件生成成功
```

### 测试密码迁移
```
1. 在测试环境执行迁移
2. 检查用户密码格式（应包含:分隔符）
3. 尝试登录验证
4. 查看迁移日志
```

---

## 📱 页面路由

### 新增路由
```javascript
// SLA告警
wx.navigateTo({
  url: '/pages/admin-manager/sla-alerts/index'
});

// 用户管理
wx.navigateTo({
  url: '/pages/admin/users/index'
});

// 添加用户
wx.navigateTo({
  url: '/pages/admin/users/add/index'
});

// 编辑用户
wx.navigateTo({
  url: '/pages/admin/users/edit/index?id=USER_ID'
});
```

---

## 🔐 权限要求

### 功能权限对应

| 功能 | 需要权限 | 角色 |
|------|---------|------|
| SLA告警 | view_analytics | Admin Manager+ |
| 报表导出 | view_analytics | Admin Manager+ |
| 用户管理 | manage_users | System Admin |
| 角色管理 | manage_roles | System Admin |
| 审计日志 | view_audit_logs | System Admin |
| 系统配置 | manage_system | System Admin |

---

## 📞 帮助文档

- 完整文档：`IMPLEMENTATION_COMPLETE_SUMMARY.md`
- 订阅消息：`WECHAT_SUBSCRIPTION_MESSAGE_GUIDE.md`
- 故障排除：`TROUBLESHOOTING.md`
- 快速开始：`QUICK_START.md`

---

**最后更新**: 2025-01-17
