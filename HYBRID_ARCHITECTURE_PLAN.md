# 方案B：混合架构详细方案

## 🎯 核心思路

**充分利用云开发的便利性，同时保留Node.js后端的灵活性**

```
┌─────────────────────────────────────────────────┐
│              微信小程序前端                        │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
    ┌───▼────┐        ┌────▼─────┐
    │ 云开发  │        │ Node.js  │
    │ (辅助) │        │ (核心)   │
    └───┬────┘        └────┬─────┘
        │                   │
   ┌────┴────┐         ┌───┴────┐
   │ 云数据库 │         │ MySQL  │
   │ 云存储  │         │ Redis  │
   └─────────┘         └────────┘
```

---

## 📋 职责分工

### 云开发负责（简单、高频、标准化）

#### 1. 用户身份认证 ✅
**为什么用云开发**：
- 自动获取openid，无需JWT
- 微信官方保障，安全可靠
- 无需维护token有效期

**实现方式**：
```javascript
// miniprogram/app.js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'your-env-id',
      traceUser: true
    });

    // 自动登录获取openid
    this.getUserOpenId();
  },

  async getUserOpenId() {
    const res = await wx.cloud.callFunction({
      name: 'login'
    });

    this.globalData.openid = res.result.openid;

    // 拿到openid后，再调用Node.js获取完整用户信息
    this.getUserInfo(res.result.openid);
  },

  async getUserInfo(openid) {
    // 调用Node.js后端
    const user = await api.get('/auth/user-by-openid', { openid });
    this.globalData.userInfo = user;
  }
});
```

**云函数代码**：
```javascript
// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  };
};
```

#### 2. 图片存储 ✅
**为什么用云开发**：
- 免费5GB存储空间
- 直接集成，无需配置COS
- 自动CDN加速

**实现方式**：
```javascript
// miniprogram/services/storage.js
const cloudStorage = {
  /**
   * 上传图片到云存储
   */
  async uploadImage(filePath) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const cloudPath = `workorders/${timestamp}_${random}.jpg`;

    const result = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath
    });

    return result.fileID; // 返回云存储文件ID
  },

  /**
   * 删除云存储文件
   */
  async deleteImage(fileID) {
    await wx.cloud.deleteFile({
      fileList: [fileID]
    });
  },

  /**
   * 获取临时访问链接
   */
  async getTempFileURL(fileID) {
    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    });
    return result.fileList[0].tempFileURL;
  }
};

module.exports = cloudStorage;
```

**工单提交时使用**：
```javascript
// miniprogram/pages/property/submit/index.js
async submitWorkOrder() {
  const cloudStorage = require('../../../services/cloudStorage');

  // 1. 先上传图片到云存储
  const photoURLs = [];
  for (const photo of this.data.photos) {
    const fileID = await cloudStorage.uploadImage(photo.tempPath);
    photoURLs.push(fileID);
  }

  // 2. 再调用Node.js后端创建工单
  const workOrder = {
    title: this.data.title,
    description: this.data.description,
    photos: photoURLs, // 存储云存储的fileID
    location: this.data.location,
    priority: this.data.priority
  };

  await api.post('/workorders', workOrder);
}
```

#### 3. 实时消息推送 ✅
**为什么用云开发**：
- 可以使用微信订阅消息
- 免费额度充足
- 无需维护消息队列

**实现方式**：
```javascript
// cloudfunctions/sendNotification/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { toUser, templateId, data, page } = event;

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: toUser,
      page: page,
      data: data,
      templateId: templateId,
      miniprogramState: 'formal'
    });

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err };
  }
};
```

**Node.js后端调用云函数发送通知**：
```javascript
// backend/src/services/notificationService.js
const axios = require('axios');

async function sendCloudNotification(openid, templateId, data) {
  // 通过HTTP API调用云函数
  const result = await axios.post(
    `https://api.weixin.qq.com/tcb/invokecloudfunction`,
    {
      env: process.env.CLOUD_ENV_ID,
      name: 'sendNotification',
      data: {
        toUser: openid,
        templateId: templateId,
        data: data
      }
    },
    {
      params: {
        access_token: await getAccessToken()
      }
    }
  );

  return result.data;
}
```

---

### Node.js后端负责（复杂、关键、业务逻辑）

#### 1. 核心业务逻辑 ✅
**为什么用Node.js**：
- 复杂的业务规则
- 需要事务处理
- 便于单元测试

**保留的功能**：
- 工单CRUD操作
- 工单分配算法
- 状态流转控制
- SLA计算和监控
- 权限验证
- 数据统计分析

#### 2. 数据库操作 ✅
**为什么用MySQL**：
- 复杂查询（JOIN、GROUP BY）
- 事务支持（ACID）
- 数据一致性保证
- 便于数据分析和导出

**示例：工单统计**：
```javascript
// backend/src/services/analyticsService.js
async function getWorkOrderStats(userId, roleId) {
  // 复杂的SQL查询，云数据库难以实现
  const stats = await sequelize.query(`
    SELECT
      wo.status,
      COUNT(*) as count,
      AVG(TIMESTAMPDIFF(HOUR, wo.created_at, wo.completed_at)) as avg_hours
    FROM work_orders wo
    WHERE wo.assigned_to = :userId
      AND wo.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY wo.status
  `, {
    replacements: { userId },
    type: QueryTypes.SELECT
  });

  return stats;
}
```

#### 3. 定时任务 ✅
**为什么用Node.js**：
- 复杂的调度逻辑
- 需要访问多个数据源
- 长时间运行的任务

**保留的定时任务**：
```javascript
// backend/src/jobs/slaMonitor.js
const cron = require('node-cron');

// 每分钟检查SLA
cron.schedule('* * * * *', async () => {
  const overdueOrders = await WorkOrder.findAll({
    where: {
      status: ['Pending Repair', 'In Progress'],
      sla_deadline: { [Op.lt]: new Date() },
      is_overdue: false
    }
  });

  for (const order of overdueOrders) {
    // 更新状态
    await order.update({ is_overdue: true });

    // 调用云函数发送通知
    await sendCloudNotification(
      order.assigned_to_openid,
      TEMPLATE_IDS.SLA_WARNING,
      {
        orderNo: order.id,
        deadline: order.sla_deadline
      }
    );
  }
});
```

#### 4. 第三方集成 ✅
**为什么用Node.js**：
- 需要调用外部API
- 复杂的数据处理
- 便于错误处理和重试

**示例**：
- 数据导出（Excel、PDF）
- 短信通知
- 邮件发送
- 与其他系统对接

---

## 🔄 数据流设计

### 场景1：用户登录

```
1. 小程序启动
   ↓
2. 调用云函数获取openid
   wx.cloud.callFunction({ name: 'login' })
   ↓
3. 拿到openid后调用Node.js获取用户信息
   api.get('/auth/user-by-openid', { openid })
   ↓
4. Node.js查询MySQL返回完整用户信息
   (包括角色、权限、部门等)
   ↓
5. 存储到小程序storage
```

### 场景2：提交工单

```
1. 用户选择照片
   ↓
2. 上传到云存储
   wx.cloud.uploadFile()
   ↓
3. 获取fileID数组
   ['cloud://xxx1.jpg', 'cloud://xxx2.jpg']
   ↓
4. 调用Node.js创建工单
   api.post('/workorders', { ..., photos: fileIDs })
   ↓
5. Node.js保存到MySQL
   WorkOrder.create({ photos: JSON.stringify(fileIDs) })
   ↓
6. 触发分配算法
   assignmentService.assignWorkOrder()
   ↓
7. 调用云函数发送通知
   sendCloudNotification(assignedUser.openid, ...)
```

### 场景3：查看工单列表

```
1. 小程序请求工单列表
   api.get('/workorders')
   ↓
2. Node.js查询MySQL
   WorkOrder.findAll({ where: {...}, include: [...] })
   ↓
3. 返回数据（包含云存储fileID）
   [{..., photos: ['cloud://xxx1.jpg']}]
   ↓
4. 小程序显示时自动解析云存储URL
   (云存储fileID可直接在<image>中使用)
```

---

## 🗂️ 数据库设计调整

### MySQL表（保留原有设计）

```sql
-- 用户表（添加openid字段）
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wechat_openid VARCHAR(100) UNIQUE NOT NULL, -- 云开发获取的openid
  name VARCHAR(100),
  role_id INT,
  contact_phone VARCHAR(20),
  password_hash VARCHAR(255), -- 可选：支持账号密码登录
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  INDEX idx_openid (wechat_openid)
);

-- 工单表（photos字段存储云存储fileID）
CREATE TABLE work_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200),
  description TEXT,
  photos JSON, -- 存储云存储fileID数组
  -- 例如: ["cloud://xxx1.jpg", "cloud://xxx2.jpg"]
  status VARCHAR(50),
  priority VARCHAR(50),
  submitted_by INT,
  assigned_to INT,
  created_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_submitted (submitted_by),
  INDEX idx_assigned (assigned_to)
);
```

---

## 📝 代码结构调整

### 小程序端改动

#### 1. 初始化云开发

```javascript
// miniprogram/app.js
App({
  globalData: {
    openid: null,
    userInfo: null,
    cloudEnvId: 'your-env-id' // 云开发环境ID
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.cloudEnvId,
        traceUser: true
      });
      console.log('[App] Cloud init success');
    }

    // 获取openid
    this.getOpenId();
  },

  async getOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login'
      });

      this.globalData.openid = res.result.openid;
      console.log('[App] OpenID:', res.result.openid);

      // 拿到openid后获取用户信息
      await this.loadUserInfo();
    } catch (err) {
      console.error('[App] Get OpenID failed:', err);
    }
  },

  async loadUserInfo() {
    const api = require('./services/api');

    try {
      const user = await api.get('/auth/user-by-openid', {
        openid: this.globalData.openid
      });

      this.globalData.userInfo = user;
      console.log('[App] User info loaded:', user);
    } catch (err) {
      console.error('[App] Load user info failed:', err);
    }
  }
});
```

#### 2. 创建云存储服务

```javascript
// miniprogram/services/cloudStorage.js
/**
 * 云存储服务
 * 负责图片上传、下载、删除
 */

const cloudStorage = {
  /**
   * 上传单张图片
   */
  async uploadImage(filePath, folder = 'workorders') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = filePath.split('.').pop();
    const cloudPath = `${folder}/${timestamp}_${random}.${ext}`;

    try {
      const result = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      });

      console.log('[CloudStorage] Upload success:', result.fileID);
      return result.fileID;
    } catch (err) {
      console.error('[CloudStorage] Upload failed:', err);
      throw err;
    }
  },

  /**
   * 批量上传图片
   */
  async uploadImages(filePaths, folder = 'workorders') {
    const uploadPromises = filePaths.map(path =>
      this.uploadImage(path, folder)
    );

    return Promise.all(uploadPromises);
  },

  /**
   * 删除图片
   */
  async deleteImage(fileID) {
    try {
      await wx.cloud.deleteFile({
        fileList: [fileID]
      });
      console.log('[CloudStorage] Delete success:', fileID);
    } catch (err) {
      console.error('[CloudStorage] Delete failed:', err);
      throw err;
    }
  },

  /**
   * 获取临时下载链接（如需要）
   */
  async getTempFileURL(fileID) {
    try {
      const result = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      });
      return result.fileList[0].tempFileURL;
    } catch (err) {
      console.error('[CloudStorage] Get temp URL failed:', err);
      throw err;
    }
  }
};

module.exports = cloudStorage;
```

#### 3. 修改图片上传组件

```javascript
// miniprogram/components/image-uploader/index.js
const cloudStorage = require('../../services/cloudStorage');
const api = require('../../services/api');

Component({
  methods: {
    async uploadSingleImage(filePath) {
      try {
        // 直接上传到云存储
        const fileID = await cloudStorage.uploadImage(filePath);

        // 更新UI显示上传成功
        const newPhotoList = [...this.data.photoList];
        newPhotoList[index] = {
          url: fileID, // 云存储fileID可直接用作图片URL
          uploading: false,
          failed: false
        };

        this.setData({ photoList: newPhotoList });

        // 触发父组件事件
        this.triggerEvent('upload-success', { fileID });

      } catch (error) {
        console.error('[ImageUploader] Upload failed:', error);
        // 显示上传失败状态
      }
    }
  }
});
```

### Node.js后端改动

#### 1. 新增openid认证接口

```javascript
// backend/src/controllers/authController.js

/**
 * 通过openid获取用户信息
 * 用于云开发认证后获取完整用户数据
 */
const getUserByOpenId = async (req, res) => {
  try {
    const { openid } = req.query;

    if (!openid) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        message: 'OpenID is required'
      });
    }

    // 查找用户
    const user = await User.findOne({
      where: { wechat_openid: openid },
      include: [{
        model: Role,
        as: 'role',
        attributes: ['id', 'name', 'display_name', 'permissions_json']
      }]
    });

    if (!user) {
      // 如果用户不存在，创建新用户（首次登录）
      const newUser = await User.create({
        wechat_openid: openid,
        name: '新用户',
        role_id: 4, // 默认：物业人员
        active: true,
        last_login_at: new Date()
      });

      // 重新查询包含角色信息
      const createdUser = await User.findByPk(newUser.id, {
        include: [{
          model: Role,
          as: 'role'
        }]
      });

      return res.json({
        user: formatUserResponse(createdUser),
        isNew: true
      });
    }

    // 更新最后登录时间
    await user.update({ last_login_at: new Date() });

    // 记录审计日志
    await AuditLog.create({
      user_id: user.id,
      action: 'USER_LOGIN',
      resource_type: 'auth',
      details: { method: 'cloud_openid' }
    });

    return res.json({
      user: formatUserResponse(user),
      isNew: false
    });

  } catch (error) {
    logger.error('Get user by openid error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: '获取用户信息失败'
    });
  }
};

// 格式化用户响应数据
function formatUserResponse(user) {
  return {
    id: user.id,
    name: user.name,
    openid: user.wechat_openid,
    role_id: user.role_id,
    role: {
      id: user.role.id,
      name: user.role.name,
      display_name: user.role.display_name,
      permissions: user.role.permissions_json
    },
    contact_phone: user.contact_phone,
    department: user.department,
    active: user.active,
    last_login_at: user.last_login_at
  };
}

module.exports = {
  ...existingExports,
  getUserByOpenId
};
```

#### 2. 添加路由

```javascript
// backend/src/routes/auth.js
router.get('/user-by-openid', authController.getUserByOpenId);
```

#### 3. 调用云函数发送通知

```javascript
// backend/src/services/cloudService.js
const axios = require('axios');

class CloudService {
  constructor() {
    this.envId = process.env.CLOUD_ENV_ID;
    this.accessToken = null;
    this.tokenExpireTime = null;
  }

  /**
   * 获取云开发access_token
   */
  async getAccessToken() {
    // 如果token未过期，直接返回
    if (this.accessToken && this.tokenExpireTime > Date.now()) {
      return this.accessToken;
    }

    const result = await axios.get(
      'https://api.weixin.qq.com/cgi-bin/token',
      {
        params: {
          grant_type: 'client_credential',
          appid: process.env.WECHAT_APPID,
          secret: process.env.WECHAT_SECRET
        }
      }
    );

    this.accessToken = result.data.access_token;
    this.tokenExpireTime = Date.now() + (result.data.expires_in - 300) * 1000;

    return this.accessToken;
  }

  /**
   * 调用云函数
   */
  async invokeFunction(name, data) {
    const accessToken = await this.getAccessToken();

    const result = await axios.post(
      'https://api.weixin.qq.com/tcb/invokecloudfunction',
      {
        env: this.envId,
        name: name,
        data: JSON.stringify(data)
      },
      {
        params: { access_token: accessToken }
      }
    );

    return JSON.parse(result.data.resp_data);
  }

  /**
   * 发送订阅消息
   */
  async sendNotification(openid, templateId, data, page) {
    return this.invokeFunction('sendNotification', {
      toUser: openid,
      templateId: templateId,
      data: data,
      page: page
    });
  }
}

module.exports = new CloudService();
```

#### 4. 在业务逻辑中使用

```javascript
// backend/src/services/notificationService.js
const cloudService = require('./cloudService');

async function notifyWorkOrderAssigned(workOrder, assignedUser) {
  try {
    await cloudService.sendNotification(
      assignedUser.wechat_openid,
      process.env.TEMPLATE_ID_WORK_ORDER_ASSIGNED,
      {
        orderNo: { value: workOrder.id },
        title: { value: workOrder.title },
        location: { value: workOrder.location },
        time: { value: workOrder.created_at }
      },
      `/pages/work-order-detail/index?id=${workOrder.id}`
    );

    logger.info('Notification sent via cloud:', assignedUser.id);
  } catch (error) {
    logger.error('Send cloud notification failed:', error);
  }
}
```

---

## 🚀 部署步骤

### 步骤1：开通云开发

1. 打开微信开发者工具
2. 点击顶部"云开发"按钮
3. 开通云开发服务
4. 创建环境（建议：development 和 production）
5. 记录环境ID（env-xxxxx）

### 步骤2：创建云函数

在微信开发者工具中：

```bash
# 1. 在项目根目录创建 cloudfunctions 目录
# 2. 右键 cloudfunctions -> 新建Node.js云函数
# 3. 创建以下云函数：
#    - login（登录获取openid）
#    - sendNotification（发送订阅消息）
```

**login 云函数**：
```javascript
// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  return {
    success: true,
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID
  };
};
```

**sendNotification 云函数**：
```javascript
// cloudfunctions/sendNotification/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { toUser, templateId, data, page } = event;

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: toUser,
      page: page || 'pages/index/index',
      data: data,
      templateId: templateId,
      miniprogramState: 'formal'
    });

    return {
      success: true,
      msgid: result.msgid
    };
  } catch (err) {
    console.error('Send notification failed:', err);
    return {
      success: false,
      error: err.errMsg
    };
  }
};
```

上传云函数：
- 右键云函数目录 -> 上传并部署：云端安装依赖

### 步骤3：配置小程序

```javascript
// miniprogram/app.js
App({
  globalData: {
    cloudEnvId: 'your-env-id-here' // 替换为您的云开发环境ID
  },

  onLaunch() {
    wx.cloud.init({
      env: this.globalData.cloudEnvId,
      traceUser: true
    });
  }
});
```

### 步骤4：配置Node.js后端

```bash
# backend/.env
CLOUD_ENV_ID=your-cloud-env-id
WECHAT_APPID=your-appid
WECHAT_SECRET=your-secret
```

### 步骤5：数据库迁移

为users表添加openid字段：

```sql
ALTER TABLE users
ADD COLUMN wechat_openid VARCHAR(100) UNIQUE
AFTER id;

CREATE INDEX idx_openid ON users(wechat_openid);
```

---

## 💰 成本分析

### 云开发成本（月）
- **存储**：5GB（免费）
- **云函数调用**：10万次（免费）
- **数据库**：2GB（免费）
- **CDN流量**：5GB（免费）

**预估**：小型项目完全够用，¥0/月

### Node.js后端成本（月）
- **云服务器**：¥100/月（保留）
- **MySQL**：¥50/月（保留）
- **Redis**：¥30/月（可选）

**总计**：¥100-180/月

### 对比纯云开发
- 灵活性更高
- 可扩展性更强
- 成本略高但可控

---

## ✅ 优势总结

### 相比纯Node.js架构
✅ **降低50%成本** - 图片存储、推送消息用云开发
✅ **简化认证** - 无需维护JWT token
✅ **提升可靠性** - 云存储自动备份

### 相比纯云开发
✅ **灵活性高** - 复杂业务用Node.js
✅ **无平台锁定** - 未来可以扩展到Web、App
✅ **数据库强大** - MySQL支持复杂查询
✅ **便于调试** - 本地可以完整测试

---

## 📚 下一步

我可以帮您：

1. ✅ 创建完整的云函数代码
2. ✅ 修改小程序代码适配混合架构
3. ✅ 调整Node.js后端支持openid认证
4. ✅ 提供完整的部署文档
5. ✅ 创建数据库迁移脚本

**现在开始实施吗？**
