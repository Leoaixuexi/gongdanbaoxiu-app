# 微信小程序云开发迁移方案

## 📋 概述

将当前的 **Node.js + MySQL** 架构迁移到 **微信云开发**平台。

### 云开发优势

✅ **无需搭建服务器** - 微信官方提供后端服务
✅ **免费额度** - 每月有免费配额
✅ **自动扩容** - 根据访问量自动伸缩
✅ **集成度高** - 与小程序无缝集成
✅ **快速部署** - 无需购买域名、SSL证书

---

## 🏗️ 架构对比

### 当前架构（Node.js + MySQL）

```
小程序 -> HTTP API -> Node.js后端 -> MySQL数据库
                     ↓
                  Express + Sequelize
                  JWT认证
                  Redis缓存
```

### 云开发架构

```
小程序 -> 云开发SDK -> 云函数 + 云数据库
                     ↓
                  wx.cloud API
                  权限规则
```

---

## 📊 数据库迁移方案

### 1. MySQL表 → 云数据库集合映射

| MySQL表 | 云数据库集合 | 说明 |
|---------|------------|------|
| users | users | 用户信息 |
| roles | roles | 角色配置 |
| work_orders | workOrders | 工单数据 |
| status_history | statusHistory | 状态历史 |
| fault_types | faultTypes | 故障类型 |
| sla_rules | slaRules | SLA规则 |
| notifications | notifications | 通知记录 |
| audit_logs | auditLogs | 审计日志 |

### 2. 云数据库集合设计

#### users 集合
```json
{
  "_id": "自动生成",
  "_openid": "用户openid（自动获取）",
  "name": "用户名",
  "role_id": 4,
  "contact_phone": "13800000000",
  "department": "物业部",
  "supervisor_id": "上级ID",
  "active": true,
  "last_login_at": "时间戳",
  "created_at": "时间戳",
  "updated_at": "时间戳"
}
```

#### workOrders 集合
```json
{
  "_id": "自动生成",
  "_openid": "提交人openid",
  "title": "工单标题",
  "description": "详细描述",
  "status": "Pending Repair",
  "priority": "Normal",
  "location": "1号楼101",
  "floor": "1F",
  "fault_type_id": "故障类型ID",
  "assigned_to": "维修员ID",
  "photos": ["cloud://图片1", "cloud://图片2"],
  "sla_deadline": "截止时间",
  "is_overdue": false,
  "rework_count": 0,
  "created_at": "时间戳",
  "updated_at": "时间戳"
}
```

---

## 🔧 功能迁移方案

### 1. 用户认证（JWT → 云开发openid）

**当前方式**：
```javascript
// JWT token认证
const token = jwt.sign({ userId: user.id }, SECRET);
```

**云开发方式**：
```javascript
// 自动获取openid，无需JWT
wx.cloud.callFunction({
  name: 'login',
  data: {}
}).then(res => {
  // res.result.openid 自动获取
  // res.result.userInfo 包含用户信息
});
```

### 2. 数据库操作（Sequelize → 云数据库API）

**当前方式**：
```javascript
// Node.js后端
const user = await User.findOne({ where: { id: userId } });
```

**云开发方式**：
```javascript
// 小程序端直接操作
const db = wx.cloud.database();
const user = await db.collection('users')
  .doc(userId)
  .get();
```

### 3. 图片上传（COS → 云存储）

**当前方式**：
```javascript
// 上传到腾讯云COS
wx.uploadFile({
  url: 'https://api.example.com/upload',
  filePath: tempFilePath
});
```

**云开发方式**：
```javascript
// 直接上传到云存储
wx.cloud.uploadFile({
  cloudPath: `workorders/${Date.now()}.jpg`,
  filePath: tempFilePath
});
```

### 4. 业务逻辑（Express路由 → 云函数）

**当前方式**：
```javascript
// backend/src/controllers/workOrderController.js
router.post('/workorders', async (req, res) => {
  const workOrder = await WorkOrder.create(req.body);
  res.json(workOrder);
});
```

**云开发方式**：
```javascript
// cloudfunctions/createWorkOrder/index.js
exports.main = async (event, context) => {
  const db = cloud.database();
  const result = await db.collection('workOrders').add({
    data: event.workOrder
  });
  return result;
};
```

---

## 📁 项目结构调整

### 新增目录结构

```
gongdanbaoxiu/
├── miniprogram/               # 小程序前端（保留）
│   ├── pages/
│   ├── components/
│   ├── utils/
│   └── app.js
├── cloudfunctions/            # 云函数目录（新增）
│   ├── login/                 # 登录云函数
│   ├── createWorkOrder/       # 创建工单
│   ├── assignWorkOrder/       # 分配工单
│   ├── updateWorkOrder/       # 更新工单
│   ├── getWorkOrders/         # 查询工单
│   ├── reviewWorkOrder/       # 审核工单
│   ├── getAnalytics/          # 数据分析
│   ├── slaMonitor/            # SLA监控（定时触发器）
│   └── sendNotification/      # 发送通知
└── database/                  # 数据库配置（新增）
    ├── collections/           # 集合定义
    └── permissions/           # 权限规则
```

---

## 🚀 迁移步骤

### 步骤1：开通云开发

1. 登录微信公众平台
2. 进入小程序管理后台
3. 点击"云开发" → "开通"
4. 创建云开发环境（建议创建2个：development、production）

### 步骤2：初始化云开发

在 `miniprogram/app.js` 中：

```javascript
App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'your-env-id', // 云开发环境ID
        traceUser: true
      });
    }
  }
});
```

### 步骤3：创建云数据库集合

在微信开发者工具中：
1. 点击"云开发"按钮
2. 选择"数据库"标签
3. 点击"新建集合"
4. 创建以下集合：
   - users
   - roles
   - workOrders
   - statusHistory
   - faultTypes
   - slaRules
   - notifications
   - auditLogs

### 步骤4：配置数据库权限

为每个集合设置权限规则：

```json
// workOrders 集合权限示例
{
  "read": "doc._openid == auth.openid || auth.hasRole('admin')",
  "write": "doc._openid == auth.openid || auth.hasRole('admin')",
  "create": true,
  "delete": "auth.hasRole('admin')"
}
```

### 步骤5：迁移业务逻辑到云函数

创建云函数目录并上传：

```bash
# 在微信开发者工具中
# 1. 右键 cloudfunctions 目录
# 2. 选择"新建Node.js云函数"
# 3. 输入云函数名称
# 4. 编写代码后右键"上传并部署"
```

### 步骤6：更新小程序代码

替换API调用：

```javascript
// 之前：HTTP API
const response = await api.post('/workorders', data);

// 现在：云函数
const result = await wx.cloud.callFunction({
  name: 'createWorkOrder',
  data: { workOrder: data }
});
```

### 步骤7：数据迁移

将MySQL数据导出并导入到云数据库：

```javascript
// 使用云函数批量导入
// cloudfunctions/importData/index.js
exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  const users = event.users; // 从MySQL导出的数据

  for (const user of users) {
    await db.collection('users').add({
      data: user
    });
  }

  return { success: true };
};
```

---

## 💰 成本对比

### 当前架构成本（年）
- 云服务器：¥1200/年
- MySQL数据库：¥600/年
- Redis缓存：¥400/年
- 域名+SSL：¥200/年
- **总计：¥2400/年**

### 云开发成本（年）
- 基础版（免费额度）：¥0/月
  - 数据库：2GB
  - 存储：5GB
  - 云函数：10万次/月
  - 流量：5GB/月

- 如需更多资源，按量付费
- **预估：¥0-500/年**（小型项目足够用免费版）

---

## ⚠️ 注意事项

### 优点
✅ 开发简单，无需后端开发
✅ 维护成本低，无需运维
✅ 安全性高，微信官方保障
✅ 与小程序集成好

### 缺点
❌ 平台锁定，只能用于微信生态
❌ 云函数有调用次数限制
❌ 数据库查询能力弱于SQL
❌ 难以做复杂的数据分析

### 适用场景
✅ 小程序独立项目
✅ 中小型应用
✅ 快速原型开发
✅ 预算有限的项目

### 不适用场景
❌ 需要跨平台（小程序+Web+App）
❌ 复杂的数据分析需求
❌ 大量复杂的业务逻辑
❌ 需要自定义后端架构

---

## 🎯 推荐方案

基于您的项目特点，我推荐：

### 方案A：完全云开发（推荐用于学习/演示）
- 适合快速上线、成本控制
- 开发周期：3-5天
- 完全依赖微信生态

### 方案B：混合架构（推荐用于生产）
- 保留Node.js后端，添加云开发作为辅助
- 认证：使用云开发openid
- 图片：使用云存储
- 核心业务：保留Node.js
- 开发周期：1-2天

### 方案C：保持现有架构（推荐用于企业级）
- 适合需要完整控制权的项目
- 可扩展性强
- 便于后期添加Web端、App端

---

## 📝 下一步行动

请告诉我您的选择：

1. **完全迁移到云开发** - 我将创建完整的云函数和数据库配置
2. **混合架构** - 我将创建云开发辅助方案
3. **保持现有架构** - 我将帮您完善Node.js后端启动和测试

您想选择哪种方案？
