# 微信云开发 - 快速参考

## 🚀 5分钟快速开始

### 1. 开通云开发（只需一次）

```
微信开发者工具 → 点击"云开发"按钮 → 点击"开通" → 创建环境
```

### 2. 配置环境ID（只需一次）

修改 `miniprogram/app.js` 第108行：

```javascript
wx.cloud.init({
  env: 'cloud1-xxxxx', // 替换成你的环境ID
  traceUser: true
});
```

### 3. 上传云函数（只需一次）

```
右键 cloudfunctions/login → 选择"上传并部署：云端安装依赖"
右键 cloudfunctions/uploadImage → 选择"上传并部署：云端安装依赖"
右键 cloudfunctions/sendNotification → 选择"上传并部署：云端安装依赖"
```

**完成！** 🎉

---

## 💻 代码示例

### 云开发登录

```javascript
// miniprogram/pages/login/login.js
const auth = require('../../services/auth');

async handleCloudLogin() {
  try {
    const user = await auth.loginWithCloud();
    console.log('登录成功:', user);
    wx.switchTab({ url: '/pages/index/index' });
  } catch (error) {
    console.error('登录失败:', error);
  }
}
```

### 上传图片到云存储

```javascript
// miniprogram/pages/property/submit/index.js
const cloudStorage = require('../../../services/cloudStorage');

async uploadImages() {
  try {
    const urls = await cloudStorage.chooseAndUploadImages({
      count: 9,
      category: 'workorder'
    });

    this.setData({
      photos: [...this.data.photos, ...urls]
    });
  } catch (error) {
    wx.showToast({
      title: '上传失败',
      icon: 'none'
    });
  }
}
```

### 发送消息通知

```javascript
// 在云函数或后端调用
const cloud = require('../../services/cloud');

async sendNotification(openid) {
  try {
    await cloud.sendNotification(
      openid,
      'templateId-xxxx', // 消息模板ID
      {
        thing1: { value: '您的工单已受理' },
        time2: { value: '2024-01-15 10:00' }
      },
      'pages/work-order-detail/index?id=123'
    );
  } catch (error) {
    console.error('发送失败:', error);
  }
}
```

---

## 📁 文件结构

```
gongdanbaoxiu/
├── cloudfunctions/              # 云函数目录
│   ├── login/                   # 获取openid
│   │   ├── index.js
│   │   └── package.json
│   ├── uploadImage/             # 上传图片
│   │   ├── index.js
│   │   └── package.json
│   └── sendNotification/        # 发送通知
│       ├── index.js
│       └── package.json
├── miniprogram/
│   ├── services/
│   │   ├── cloud.js            # 云服务封装
│   │   ├── cloudStorage.js     # 云存储服务
│   │   └── auth.js             # 认证服务（包含云登录）
│   └── app.js                   # 初始化云开发
└── backend/
    ├── controllers/
    │   └── authController.js   # 添加了 userByOpenIdHandler
    └── routes/
        └── auth.js              # 添加了 POST /auth/user-by-openid
```

---

## 🔧 API参考

### auth.loginWithCloud()

使用云函数登录，自动获取openid

**返回：** Promise<User>

**错误：**
- 获取openid失败
- 后端认证失败

### cloudStorage.chooseAndUploadImages(options)

选择并上传图片到云存储

**参数：**
- `count`: 最多选择图片数量（默认9）
- `category`: 图片分类（默认'workorder'）
- `compress`: 是否压缩（默认true）

**返回：** Promise<Array<string>> - 图片URL数组

### cloud.sendNotification(openid, templateId, data, page)

发送订阅消息

**参数：**
- `openid`: 用户openid
- `templateId`: 消息模板ID
- `data`: 模板数据
- `page`: 跳转页面路径

**返回：** Promise<Object>

---

## 💰 费用说明

### 免费额度（每月）

| 资源 | 免费额度 | 超出费用 |
|------|---------|---------|
| 云函数调用 | 10万次 | ¥0.0133/千次 |
| 云存储空间 | 5GB | ¥0.07/GB/天 |
| 数据库容量 | 2GB | ¥0.07/GB/天 |
| 流量 | 5GB | ¥0.8/GB |

**小型项目完全免费！**

---

## 🐛 常见错误

### 错误1: cloud init error

**原因：** 环境ID未配置

**解决：** 在 `app.js` 中配置正确的环境ID

```javascript
wx.cloud.init({
  env: 'cloud1-xxxxx', // 确保这里是你的真实环境ID
  traceUser: true
});
```

### 错误2: 云函数调用失败

**原因：** 云函数未上传或上传失败

**解决：**
1. 检查云开发控制台是否有该云函数
2. 重新上传云函数
3. 查看云函数日志

### 错误3: 上传图片失败

**原因：**
- 图片过大（>5MB）
- 云存储空间已满

**解决：**
1. 压缩图片
2. 检查云存储使用量
3. 升级套餐或清理旧图片

---

## 📊 监控和调试

### 1. 查看云函数日志

```
云开发控制台 → 云函数 → 选择函数 → 日志查询
```

### 2. 查看云存储文件

```
云开发控制台 → 云存储 → 文件列表
```

### 3. 查看使用量

```
云开发控制台 → 统计分析
```

### 4. 本地调试云函数

```
右键云函数 → 本地调试 → 输入测试参数 → 运行
```

---

## ✅ 检查清单

部署前检查：

- [ ] 已开通云开发
- [ ] 已上传所有云函数
- [ ] 已配置环境ID（app.js）
- [ ] 已测试登录功能
- [ ] 已测试图片上传
- [ ] 已配置安全域名
- [ ] 已设置云存储权限

---

## 🆘 故障排除流程

如果功能不正常：

1. **检查控制台** - 查看错误信息
2. **检查网络** - 确认能访问微信服务器
3. **检查配置** - 确认环境ID正确
4. **检查云函数** - 确认已成功部署
5. **查看日志** - 云开发控制台查看详细日志

---

## 📚 相关文档

- `EXPLAIN_FOR_BEGINNER.md` - 小白级别说明
- `HYBRID_ARCHITECTURE_PLAN.md` - 详细架构文档
- `CLOUD_SETUP_GUIDE.md` - 完整设置指南
- `CLOUD_MIGRATION_PLAN.md` - 迁移方案对比

---

## 🎓 学习资源

**微信官方文档：**
- 云开发快速开始: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
- 云函数: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions.html
- 云存储: https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/storage.html

---

**准备好了？开始使用云开发吧！** 🚀
