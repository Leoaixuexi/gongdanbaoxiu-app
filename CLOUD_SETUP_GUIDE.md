# 微信云开发混合架构 - 完整设置指南

## 📚 前置阅读

在开始之前，建议先阅读：
- `EXPLAIN_FOR_BEGINNER.md` - 小白级别的架构说明
- `HYBRID_ARCHITECTURE_PLAN.md` - 详细的技术架构文档

---

## 🎯 设置概览

我们将完成以下步骤：

1. **开通微信云开发** (10分钟)
2. **上传云函数** (5分钟)
3. **配置小程序** (5分钟)
4. **更新数据库** (5分钟) - 可选
5. **测试功能** (5分钟)

**总计：约30分钟**

---

## 第一步：开通微信云开发

### 1.1 打开微信开发者工具

1. 打开您的小程序项目（gongdanbaoxiu）
2. 点击左侧工具栏的 **"云开发"** 按钮

### 1.2 开通云开发服务

如果是第一次使用：

1. 点击 **"开通"** 按钮
2. 填写环境名称：`dev`（开发环境）
3. 选择基础版（免费）
4. 确认并开通

### 1.3 获取环境ID

开通成功后：

1. 进入云开发控制台
2. 在顶部可以看到 **环境ID**，例如：`cloud1-xxxxx`
3. **复制这个环境ID**，后面会用到

---

## 第二步：上传云函数

### 2.1 打开云函数目录

在微信开发者工具的文件树中：

1. 找到 `cloudfunctions` 文件夹
2. 展开后可以看到三个文件夹：
   - `login` - 获取用户openid
   - `uploadImage` - 上传图片到云存储
   - `sendNotification` - 发送消息通知

### 2.2 上传第一个云函数：login

1. **右键点击** `cloudfunctions/login` 文件夹
2. 选择 **"上传并部署：云端安装依赖"**
3. 等待上传完成（约30秒-1分钟）
4. 看到 ✓ 成功提示

### 2.3 上传第二个云函数：uploadImage

1. **右键点击** `cloudfunctions/uploadImage` 文件夹
2. 选择 **"上传并部署：云端安装依赖"**
3. 等待上传完成

### 2.4 上传第三个云函数：sendNotification

1. **右键点击** `cloudfunctions/sendNotification` 文件夹
2. 选择 **"上传并部署：云端安装依赖"**
3. 等待上传完成

### 2.5 验证云函数

在云开发控制台：

1. 点击 **"云函数"** 标签
2. 应该能看到三个云函数：
   - `login`
   - `uploadImage`
   - `sendNotification`
3. 每个函数的状态应该是 **"部署成功"**

---

## 第三步：配置小程序

### 3.1 更新环境ID

打开文件：`miniprogram/app.js`

找到第108行：

```javascript
wx.cloud.init({
  env: 'your-env-id', // Change this to your cloud environment ID
  traceUser: true
});
```

**把 `'your-env-id'` 替换成您在第一步获取的环境ID**

例如：

```javascript
wx.cloud.init({
  env: 'cloud1-xxxxx', // 替换成你的真实环境ID
  traceUser: true
});
```

### 3.2 保存文件

按 `Ctrl + S` 保存文件

---

## 第四步：更新数据库（可选）

**如果您还没有运行过数据库迁移，请跳过此步骤**

如果您已经运行过数据库，需要更新表结构：

### 4.1 打开命令行

在项目根目录打开命令行（Git Bash）

### 4.2 进入后端目录

```bash
cd backend
```

### 4.3 运行新的数据库迁移

```bash
npx sequelize-cli db:migrate
```

这个迁移会：
- 让 `wechat_openid` 字段变为可选（支持密码登录）
- 添加 `password_hash` 字段（支持密码登录）

---

## 第五步：测试功能

### 5.1 测试云函数：login

在微信开发者工具中：

1. 点击 **"云开发"** 按钮
2. 进入 **"云函数"** 标签
3. 点击 `login` 函数
4. 点击 **"测试"** 按钮
5. 不需要输入参数，直接点击 **"运行"**

**期望结果：**

```json
{
  "success": true,
  "openid": "oBvDQ5xxxxxxxxxxxxxxxxxxxx",
  "appid": "wx8553f910840a6bf1",
  "timestamp": 1699999999999
}
```

如果看到 `"success": true`，说明云函数正常工作！

### 5.2 测试云函数：uploadImage（可选）

这个函数需要上传图片时才会被调用，暂时不需要测试。

### 5.3 测试云函数：sendNotification（可选）

这个函数需要消息模板ID，等配置消息模板后再测试。

---

## 🎊 完成！

现在您的混合架构已经配置完成！

### 您现在有两种登录方式：

#### 方式1：云开发登录（推荐）

使用云函数自动获取微信openid登录：

```javascript
const auth = require('./services/auth');

// 云开发登录
const user = await auth.loginWithCloud();
```

**优点：**
- 不需要输入账号密码
- 微信自动识别用户
- 更安全

#### 方式2：密码登录（现有方式）

使用账号密码登录：

```javascript
const auth = require('./services/auth');
const api = require('./services/api');

// 密码登录
const response = await api.post('/auth/login', {
  username: 'property',
  password: '123456'
});
```

**优点：**
- 不依赖微信
- 可以自己管理账号

---

## 🖼️ 使用云存储上传图片

现在您可以使用云存储服务上传图片了！

### 基础用法：

```javascript
const cloudStorage = require('./services/cloudStorage');

// 选择并上传图片
const imageUrls = await cloudStorage.chooseAndUploadImages({
  count: 9,  // 最多选择9张
  category: 'workorder',  // 图片分类
  compress: true  // 是否压缩
});

console.log('上传成功的图片:', imageUrls);
// ['https://...', 'https://...']
```

### 在工单提交页面使用：

修改 `miniprogram/pages/property/submit/index.js` 中的图片上传部分：

```javascript
// 方式1：使用云存储（推荐）
const cloudStorage = require('../../../services/cloudStorage');

async chooseImages() {
  try {
    const imageUrls = await cloudStorage.chooseAndUploadImages({
      count: 9,
      category: 'workorder'
    });

    this.setData({
      photos: [...this.data.photos, ...imageUrls]
    });
  } catch (error) {
    console.error('Upload error:', error);
  }
}
```

---

## 📊 云开发资源监控

### 查看使用量

1. 打开云开发控制台
2. 点击 **"统计分析"** 标签
3. 可以看到：
   - 云函数调用次数
   - 云存储空间使用量
   - 数据库读写次数

### 免费额度

**每月免费：**
- 云函数：10万次调用
- 云存储：5GB 空间
- 数据库：2GB 容量
- 流量：5GB/月

**对于小型项目完全够用！**

---

## ❓ 常见问题

### Q1: 找不到"云开发"按钮？

**答：** 请确保：
1. 使用的是企业小程序账号（个人小程序无法使用云开发）
2. 微信开发者工具版本 ≥ 1.02.1904090
3. 基础库版本 ≥ 2.2.3

在 `project.config.json` 中检查：

```json
{
  "libVersion": "2.32.0",  // 确保 >= 2.2.3
  "cloudfunctionRoot": "cloudfunctions/"
}
```

### Q2: 上传云函数失败？

**答：** 可能原因：
1. 网络问题 - 重试几次
2. 权限问题 - 确认您是小程序管理员
3. 环境问题 - 确认云开发环境已开通

**解决方法：**
- 检查控制台错误信息
- 尝试手动安装依赖：在云函数目录运行 `npm install`
- 重新上传

### Q3: 云函数测试返回错误？

**答：** 常见错误：

**错误1：`cloud init error`**
- 原因：app.js 中的环境ID未配置或错误
- 解决：检查并更新 `miniprogram/app.js` 中的环境ID

**错误2：`errCode: -1`**
- 原因：云函数代码有语法错误
- 解决：检查云函数代码，查看云开发控制台的日志

### Q4: 如何切换回纯密码登录？

**答：** 不需要任何修改！

- 密码登录仍然可用
- 只是多了云开发登录选项
- 两种方式可以同时存在

如果您想完全禁用云开发登录，只需要在登录页面不调用 `loginWithCloud()` 即可。

### Q5: 云存储的图片会过期吗？

**答：** 不会！

- 上传到云存储的图片永久保存
- `tempURL` 是临时访问链接，2小时有效
- 可以随时通过 `fileID` 重新获取临时链接

### Q6: 如何备份云存储的图片？

**答：** 在云开发控制台：

1. 点击 **"云存储"** 标签
2. 选择要备份的文件
3. 点击 **"下载"** 按钮
4. 批量下载到本地

---

## 🔐 安全建议

### 1. 配置安全域名

在微信公众平台：

1. 登录小程序管理后台
2. 设置 → 开发设置 → 服务器域名
3. 添加您的后端API域名

### 2. 开启云函数日志

在云开发控制台：

1. 云函数 → 日志查询
2. 开启日志收集
3. 定期查看异常日志

### 3. 设置云存储权限

在云开发控制台：

1. 云存储 → 权限设置
2. 设置合理的读写权限
3. 建议：只允许小程序用户读写自己上传的文件

---

## 📞 需要帮助？

如果遇到问题：

1. **查看控制台日志** - 微信开发者工具控制台
2. **查看云函数日志** - 云开发控制台 → 云函数 → 日志
3. **参考文档** - EXPLAIN_FOR_BEGINNER.md
4. **提问** - 告诉我具体的错误信息

---

## 🎉 下一步

现在您可以：

1. ✅ 使用云开发登录
2. ✅ 使用云存储上传图片
3. ✅ 发送消息通知（需要配置模板）
4. ✅ 继续使用原有的Node.js后端

**享受混合架构的便利吧！** 🚀
