# 微信订阅消息配置指南

> 完成本配置后，用户将能收到工单状态变更的微信推送通知
> 预计配置时间：1-3天（取决于微信审核速度）

---

## 📋 目录

1. [什么是订阅消息](#什么是订阅消息)
2. [配置前提条件](#配置前提条件)
3. [步骤一：申请订阅消息模板](#步骤一申请订阅消息模板)
4. [步骤二：更新云函数配置](#步骤二更新云函数配置)
5. [步骤三：用户授权处理](#步骤三用户授权处理)
6. [步骤四：测试验证](#步骤四测试验证)
7. [常见问题](#常见问题)
8. [附录：模板示例](#附录模板示例)

---

## 什么是订阅消息

订阅消息是微信小程序向用户推送消息的官方方式。与传统的模板消息不同：

- ✅ **用户授权**: 需要用户主动订阅才能发送
- ✅ **灵活性高**: 可在任意时间发送，不受时间限制
- ✅ **到达率高**: 消息直接推送到微信服务通知
- ⚠️ **需要审核**: 模板需要微信官方审核通过

### 本系统使用场景

我们的工单系统在以下5个场景发送订阅消息：

1. **工单分配** - 维修员收到新工单分配
2. **维修开始** - 物业人员收到维修开始通知
3. **维修完成** - 物业人员收到维修完成通知
4. **验收通过** - 维修员收到验收通过通知
5. **需要返工** - 维修员收到返工要求通知

---

## 配置前提条件

### 1. 小程序已发布

- 订阅消息只能在已发布的小程序中使用
- 测试阶段可以使用体验版

### 2. 管理员权限

- 需要小程序管理员或开发者权限
- 能够登录[微信公众平台](https://mp.weixin.qq.com/)

### 3. 云开发已配置

- 确认云开发环境已开通
- 云函数 `sendNotification` 已部署

---

## 步骤一：申请订阅消息模板

### 1.1 登录微信公众平台

1. 访问 [https://mp.weixin.qq.com/](https://mp.weixin.qq.com/)
2. 使用管理员微信扫码登录
3. 选择对应的小程序

### 1.2 进入订阅消息管理

1. 左侧菜单选择 **功能** → **订阅消息**
2. 点击 **选用公共模板**

### 1.3 搜索并添加模板

我们需要添加 **5个模板**，建议搜索关键词：

#### 模板 1: 工单分配通知
```
搜索关键词: "任务通知" 或 "工单通知"

建议模板字段:
- 工单编号 (thing)
- 任务内容 (thing)
- 分配时间 (time)
- 备注说明 (thing)
```

#### 模板 2: 维修进度通知
```
搜索关键词: "进度提醒" 或 "状态更新"

建议模板字段:
- 工单编号 (thing)
- 当前状态 (phrase)
- 更新时间 (time)
- 温馨提示 (thing)
```

#### 模板 3: 维修完成通知
```
搜索关键词: "完成通知" 或 "服务完成"

建议模板字段:
- 工单编号 (thing)
- 完成时间 (time)
- 处理结果 (thing)
- 备注说明 (thing)
```

#### 模板 4: 验收通知
```
搜索关键词: "审核通知" 或 "验收结果"

建议模板字段:
- 工单编号 (thing)
- 审核结果 (phrase)
- 审核时间 (time)
- 备注说明 (thing)
```

#### 模板 5: 返工通知
```
搜索关键词: "待办提醒" 或 "任务提醒"

建议模板字段:
- 工单编号 (thing)
- 任务内容 (thing)
- 截止时间 (time)
- 备注说明 (thing)
```

### 1.4 记录模板ID

添加每个模板后，会生成一个唯一的 **模板ID**，格式类似：
```
Abc1234567890XYZabc_1234567890
```

**重要**: 请将5个模板ID记录下来，格式如下：

```
工单分配: ________________________
维修进度: ________________________
维修完成: ________________________
验收通知: ________________________
返工通知: ________________________
```

---

## 步骤二：更新云函数配置

### 2.1 找到云函数文件

文件路径:
```
cloudfunctions/sendNotification/index.js
```

### 2.2 更新模板ID

找到文件中的 `NOTIFICATION_TEMPLATES` 配置（约第22行）：

```javascript
const NOTIFICATION_TEMPLATES = {
  ORDER_ASSIGNED: {
    id: 'TEMPLATE_ID_ORDER_ASSIGNED',  // ← 替换这里
    name: '工单分配通知',
    page: 'pages/work-order-detail/index',
  },
  ORDER_STARTED: {
    id: 'TEMPLATE_ID_ORDER_STARTED',   // ← 替换这里
    name: '维修开始通知',
    page: 'pages/work-order-detail/index',
  },
  ORDER_COMPLETED: {
    id: 'TEMPLATE_ID_ORDER_COMPLETED', // ← 替换这里
    name: '维修完成通知',
    page: 'pages/work-order-detail/index',
  },
  ORDER_REVIEWED: {
    id: 'TEMPLATE_ID_ORDER_REVIEWED',  // ← 替换这里
    name: '验收完成通知',
    page: 'pages/work-order-detail/index',
  },
  ORDER_REWORK: {
    id: 'TEMPLATE_ID_ORDER_REWORK',    // ← 替换这里
    name: '返工通知',
    page: 'pages/work-order-detail/index',
  }
};
```

**替换后示例**:
```javascript
const NOTIFICATION_TEMPLATES = {
  ORDER_ASSIGNED: {
    id: 'Abc1234567890XYZabc_1234567890',  // 实际模板ID
    name: '工单分配通知',
    page: 'pages/work-order-detail/index',
  },
  // ... 其他模板
};
```

### 2.3 重新部署云函数

#### 方法1: 使用微信开发者工具

1. 打开微信开发者工具
2. 在左侧找到 `cloudfunctions/sendNotification`
3. 右键选择 **上传并部署：云端安装依赖**
4. 等待部署完成

#### 方法2: 使用命令行

```bash
# 进入云函数目录
cd cloudfunctions/sendNotification

# 安装依赖
npm install

# 部署
wx-server-sdk deploy
```

### 2.4 验证部署

在微信开发者工具的云开发控制台：
1. 选择 **云函数**
2. 找到 `sendNotification`
3. 确认 **最后更新时间** 是最新的

---

## 步骤三：用户授权处理

### 3.1 授权流程

订阅消息需要用户主动授权，建议在以下场景请求授权：

#### 场景1: 提交工单后
```javascript
// pages/property/submit/index.js
// 在工单提交成功后

wx.requestSubscribeMessage({
  tmplIds: [
    'YOUR_TEMPLATE_ID_1',  // 维修进度通知
    'YOUR_TEMPLATE_ID_2',  // 维修完成通知
  ],
  success: (res) => {
    console.log('订阅成功', res);
  },
  fail: (err) => {
    console.log('订阅失败', err);
  }
});
```

#### 场景2: 接受工单后
```javascript
// pages/maintenance/pending/index.js
// 在维修员接受工单后

wx.requestSubscribeMessage({
  tmplIds: [
    'YOUR_TEMPLATE_ID_3',  // 验收通知
    'YOUR_TEMPLATE_ID_4',  // 返工通知
  ],
  success: (res) => {
    console.log('订阅成功', res);
  }
});
```

### 3.2 添加授权代码示例

在 `pages/property/submit/index.js` 的提交成功回调中添加：

```javascript
// 提交工单成功后
onSubmitSuccess: function(orderId) {
  // 原有的成功提示
  wx.showToast({
    title: '提交成功',
    icon: 'success'
  });

  // 请求订阅授权
  this.requestNotificationPermission();
},

// 新增方法
requestNotificationPermission: function() {
  wx.requestSubscribeMessage({
    tmplIds: [
      'YOUR_ORDER_STARTED_TEMPLATE_ID',
      'YOUR_ORDER_COMPLETED_TEMPLATE_ID'
    ],
    success: (res) => {
      console.log('[Submit] Subscription success:', res);
      // res 的格式: { errMsg: "requestSubscribeMessage:ok", TEMPLATE_ID: "accept" }
      // accept: 用户同意
      // reject: 用户拒绝
      // ban: 已被后台封禁
    },
    fail: (err) => {
      console.error('[Submit] Subscription fail:', err);
      // 不影响主流程，静默失败
    }
  });
}
```

### 3.3 最佳实践

1. **不要过度请求**: 一次最多请求3个模板
2. **合适的时机**: 在用户完成关键操作后请求
3. **静默失败**: 用户拒绝不影响主流程
4. **说明价值**: 在请求前说明订阅的好处

---

## 步骤四：测试验证

### 4.1 测试准备

1. 确保云函数已部署最新版本
2. 确保小程序已发布或使用体验版
3. 准备两个测试账号（物业人员 + 维修员）

### 4.2 测试流程

#### 测试1: 工单分配通知

1. 使用物业人员账号登录
2. 提交一个新工单
3. 同意订阅消息授权（如果弹出）
4. 使用管理员账号分配工单给维修员
5. **验证**: 维修员微信应该收到"工单分配通知"

#### 测试2: 维修完成通知

1. 使用维修员账号登录
2. 开始维修某个工单
3. 标记为"已完成"
4. **验证**: 物业人员微信应该收到"维修完成通知"

#### 测试3: 验收通过通知

1. 使用物业人员账号登录
2. 审核已完成的工单
3. 选择"通过"
4. **验证**: 维修员微信应该收到"验收通过通知"

#### 测试4: 返工通知

1. 使用物业人员账号登录
2. 审核已完成的工单
3. 选择"需要返工"
4. **验证**: 维修员微信应该收到"返工通知"

### 4.3 检查推送日志

在云开发控制台查看云函数日志：

1. 打开云开发控制台
2. 选择 **云函数** → `sendNotification`
3. 点击 **日志**
4. 查看最近的调用记录

成功的日志应该包含:
```
[SendNotification] Subscription message sent successfully
```

失败的日志可能显示:
```
[SendNotification] Subscription message failed: [错误信息]
```

### 4.4 常见测试问题

**问题1: 用户没有收到推送**
- 检查用户是否授权订阅
- 检查模板ID是否正确
- 查看云函数日志错误信息

**问题2: 提示"模板ID不存在"**
- 确认模板ID是否正确复制
- 确认云函数是否已重新部署

**问题3: 提示"用户拒绝"**
- 用户之前拒绝过授权
- 需要用户在小程序设置中重新开启

---

## 常见问题

### Q1: 一定要配置订阅消息吗？

**不一定**。即使不配置订阅消息，系统也能正常运行：

- ✅ 数据库通知：所有通知都会保存到数据库
- ✅ 应用内查看：用户可以在"通知"页面查看
- ✅ 未读徽章：首页会显示未读数量
- ❌ 微信推送：无法发送微信服务通知

**建议**:
- 测试阶段可以先不配置
- 正式上线前必须配置，提升用户体验

---

### Q2: 用户拒绝授权怎么办？

用户拒绝授权后：

- 系统会继续保存数据库通知
- 用户可以在小程序内查看通知
- 不会影响其他功能

引导用户重新授权：
1. 在通知页面添加提示
2. 引导用户进入小程序设置
3. 重新开启订阅消息

---

### Q3: 订阅消息有次数限制吗？

有限制，取决于用户行为：

- **一次性订阅**: 每次授权只能发送1条
- **长期订阅**: 需要申请长期订阅权限（企业小程序）

**本系统使用方式**:
- 每次关键操作后请求授权
- 用户可以选择性授权部分模板
- 即使不授权也不影响使用

---

### Q4: 模板审核被拒怎么办？

常见拒绝原因：

1. **字段类型错误**: 使用了不允许的字段类型
2. **用途不符**: 模板用途与小程序类目不符
3. **内容违规**: 包含敏感词汇

**解决方法**:
- 根据审核意见修改模板
- 选择更通用的公共模板
- 联系微信客服咨询

---

### Q5: 如何查看发送成功率？

在云开发控制台：

1. 选择 **云函数** → `sendNotification`
2. 点击 **监控**
3. 查看调用次数和错误率
4. 导出日志分析具体原因

也可以在数据库中统计：
```javascript
// 查询最近发送的通知
db.collection('notifications')
  .where({
    sent_at: _.gte(recentDate)
  })
  .get()
```

---

### Q6: 用户更换手机后还能收到吗？

可以，只要：

- 用户使用同一微信号登录
- 用户重新授权订阅
- OpenID 保持不变

如果用户卸载重装小程序，需要重新授权。

---

## 附录：模板示例

### 示例1: 工单分配通知模板

**模板标题**: 任务通知

**模板内容**:
```
工单编号：{{thing1.DATA}}
任务内容：{{thing2.DATA}}
分配时间：{{time3.DATA}}
温馨提示：{{thing4.DATA}}
```

**数据示例**:
```javascript
{
  thing1: { value: 'WO20250113001' },
  thing2: { value: '办公室空调维修' },
  time3: { value: '2025-01-13 14:30:00' },
  thing4: { value: '请尽快处理' }
}
```

**推送效果**:
```
【任务通知】
工单编号：WO20250113001
任务内容：办公室空调维修
分配时间：2025-01-13 14:30:00
温馨提示：请尽快处理
```

---

### 示例2: 维修完成通知模板

**模板标题**: 服务完成通知

**模板内容**:
```
工单编号：{{character_string1.DATA}}
完成时间：{{time2.DATA}}
处理结果：{{thing3.DATA}}
备注说明：{{thing4.DATA}}
```

**数据示例**:
```javascript
{
  character_string1: { value: 'WO20250113001' },
  time2: { value: '2025-01-13 16:30:00' },
  thing3: { value: '已维修完成' },
  thing4: { value: '请验收' }
}
```

---

### 示例3: 验收通过通知模板

**模板标题**: 审核结果通知

**模板内容**:
```
工单编号：{{thing1.DATA}}
审核结果：{{phrase2.DATA}}
审核时间：{{time3.DATA}}
备注说明：{{thing4.DATA}}
```

**数据示例**:
```javascript
{
  thing1: { value: 'WO20250113001' },
  phrase2: { value: '审核通过' },
  time3: { value: '2025-01-13 17:00:00' },
  thing4: { value: '工单已完成' }
}
```

---

## 📞 技术支持

### 相关文档

- [微信订阅消息官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)
- [本项目通知系统文档](./NOTIFICATION_SYSTEM_IMPLEMENTATION.md)
- [云函数开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html)

### 遇到问题？

1. 查看云函数日志
2. 检查模板ID是否正确
3. 确认用户已授权
4. 参考常见问题章节

---

## 🎯 配置检查清单

完成以下所有项目即配置成功：

- [ ] 在微信公众平台添加了5个订阅消息模板
- [ ] 记录了所有模板的ID
- [ ] 更新了 `cloudfunctions/sendNotification/index.js` 中的模板ID
- [ ] 重新部署了 `sendNotification` 云函数
- [ ] 在关键页面添加了授权请求代码
- [ ] 测试了工单分配通知
- [ ] 测试了维修完成通知
- [ ] 测试了验收通过通知
- [ ] 测试了返工通知
- [ ] 查看了云函数日志确认发送成功

---

**文档版本**: 1.0
**最后更新**: 2025-01-13
**作者**: Claude (Anthropic)
**项目**: 工单报修管理微信小程序

---

*🎉 配置完成后，用户将能实时收到工单状态变更的微信通知！*
