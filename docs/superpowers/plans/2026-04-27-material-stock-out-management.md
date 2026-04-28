# 耗品出库管理 Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `miniprogram/pages/stock-out/` 新建独立的出库管理页面（含 index/form/detail 3 个子页 + 共 12 文件），新建独立云函数 `cloudfunctions/stockOutManager`（含 6 个 action）实现完整三段式审批流。**完全不动 `pages/material/` 和 `cloudfunctions/materialManager/`**，保持工单维修 Tab 的"物料管理"入口零影响。新增"仓管员"角色（role_id=5），办美员工/仓管员的角色权限调整严格限定在新模块内。

**Architecture:** 微信小程序 + 微信云开发。前端按 spec v2 §3 新建独立 `/pages/stock-out/{index,form,detail}/`，使用 sub-tabs 切换出库申请/出库记录；后端新建独立 stockOutManager 云函数（单文件路由，与 workOrderManager / materialManager 风格一致），含 6 个出库申请 action；通知复用现有 `createBatchNotifications` 直写 `notifications` 集合（非 cloud.callFunction sendNotification）；区域/场景字典在 `dictionaryManager` 加权限分支（仅 role_id=1 可写）。

**Tech Stack:** WXML/WXSS/JS（小程序原生），@vant/weapp 组件库，wx-server-sdk（云函数），CloudBase 数据库（dictionaries / materials / material_records / **新建 material_requests** 集合 / notifications）。无自动化测试，所有验证通过微信开发者工具的"模拟器 / 云函数测试 / 真机"完成。

**Spec 引用:** `docs/superpowers/specs/2026-04-27-material-stock-out-management-design.md`（v2，commit `197acc0`）

---

## v2 与 v1 的差异（实施层面）

| 维度 | v1（旧 plan） | v2（新 plan） |
|---|---|---|
| 后端云函数 | 拆 materialManager 为 handlers/ + 加 6 action | 新建独立 stockOutManager |
| 前端页面 | 改造 material/index Tab2 + 新建 stock-out-form / stock-out-detail | 新建 pages/stock-out/{index,form,detail}/ |
| 服务层 | 在 materialService 加 7 方法 | 新建 stockOutService |
| 权限函数 | 改 materialManager/helpers.js | 在 stockOutManager/helpers.js 自带 |
| material 模块改动 | canAccessMaterial / canManageMaterial 角色集合调整 | 完全不动 |
| 任务总数 | 22 | 21（删 Task 2 handlers 拆分；合并 Task 17-19 为新建独立页） |

---

## 影响文件结构

```
新建（15 文件）：
  miniprogram/pages/stock-out/index/{js,wxml,wxss,json}                    (4)
  miniprogram/pages/stock-out/form/{js,wxml,wxss,json}                     (4)
  miniprogram/pages/stock-out/detail/{js,wxml,wxss,json}                   (4)
  miniprogram/services/stockOutService.js                                  (1)
  cloudfunctions/stockOutManager/index.js                                  (1)
  cloudfunctions/stockOutManager/helpers.js                                (1)
  cloudfunctions/stockOutManager/package.json                              (1)

改造（4 文件）：
  miniprogram/utils/constants.js                          (+ROLE 5 / +STOCK_OUT_STATUS)
  miniprogram/app.json                                    (+3 路径)
  miniprogram/pages/home/index.js                         (出库管理宫格 → /pages/stock-out/index)
  cloudfunctions/dictionaryManager/index.js               (stock_out_region/scene 仅 role 1 写)

不动（v2 关键）：
  miniprogram/pages/material/                             (完全不动)
  cloudfunctions/materialManager/                         (完全不动)
  miniprogram/services/materialService.js                 (不加方法)

云端配置（手动）：
  数据库 collection material_requests（首次写入自动创建）
  数据库 collection roles + 一条 role_id=5 仓管员
  通知模板 3 个 key（如项目通知系统需预注册）
```

## 实现顺序与依赖

```
Phase 1 后端独立云函数（无依赖）         → Task 1, 2, 3, 4, 5, 6, 7, 8
Phase 2 字典权限收紧                    → Task 9
Phase 3 前端基础                        → Task 10, 11
Phase 4 stock-out 主页（含双 Tab）       → Task 12, 13, 14
Phase 5 stock-out 申请表单页             → Task 15, 16
Phase 6 stock-out 详情页                → Task 17, 18
Phase 7 入口接入                        → Task 19
Phase 8 云端配置 + 全路径回归            → Task 20, 21
```

每个 Task 完成后单独提交。Phase 1-2 后端全部部署后再开始前端。

---

## Task 1: 新建 stockOutManager 云函数 + helpers.js + package.json

**Files:**
- Create: `cloudfunctions/stockOutManager/index.js`（路由分发框架，初始仅一个 ping action）
- Create: `cloudfunctions/stockOutManager/helpers.js`
- Create: `cloudfunctions/stockOutManager/package.json`

**目标**：建立独立云函数空骨架，可部署、可被 cloud.callFunction 调用。

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "stockOutManager",
  "version": "1.0.0",
  "description": "耗品出库审批流云函数（独立模块）",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: 创建 helpers.js**

```js
/**
 * 出库管理 - 共享工具函数
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取有效的 OpenID
 */
function getEffectiveOpenId(wxContext, event) {
  const { test_openid, adminToken } = event || {};
  const requiredAdminToken = process.env.ADMIN_TOKEN;
  const canUseTestOpenid = !!(
    test_openid &&
    process.env.ALLOW_TEST_OPENID === 'true' &&
    requiredAdminToken &&
    adminToken === requiredAdminToken
  );
  return canUseTestOpenid ? test_openid : wxContext.OPENID;
}

/**
 * 获取用户信息
 */
async function getUserByOpenId(openid) {
  const { data } = await db.collection('users').where({ wechat_openid: openid }).get();
  return data.length > 0 ? data[0] : null;
}

/**
 * 进入 stock-out 模块：管理员/经理/办美/仓管员（维修员排除）
 */
function canAccessStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 提交出库申请：1/2/4/5 都可
 */
function canRequestStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 审核+执行出库：仅管理员 + 仓管员
 */
function canApproveStockOut(user) {
  return user && [1, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 自增 ID 生成器
 */
async function getNextId(collection) {
  const idFieldMap = {
    'material_requests': 'request_id',
    'material_records': 'record_id',
  };
  const idField = idFieldMap[collection];
  if (!idField) throw new Error(`getNextId: 未知 collection ${collection}`);

  const { data } = await db.collection(collection)
    .orderBy(idField, 'desc')
    .limit(1)
    .get();

  if (data.length === 0) return 1;
  return (data[0][idField] || 0) + 1;
}

/**
 * 批量创建通知（沿用项目通知模式：直写 notifications 集合）
 */
async function createBatchNotifications(userIds, type, title, message, data = {}) {
  if (!userIds || !userIds.length) return;
  const now = new Date();
  const docs = userIds.map(user_id => ({
    user_id,
    type,
    title,
    message,
    data,
    is_read: false,
    created_at: now,
  }));
  for (const doc of docs) {
    await db.collection('notifications').add({ data: doc });
  }
}

module.exports = {
  cloud,
  db,
  _,
  getEffectiveOpenId,
  getUserByOpenId,
  canAccessStockOut,
  canRequestStockOut,
  canApproveStockOut,
  getNextId,
  createBatchNotifications,
};
```

- [ ] **Step 3: 创建 index.js（初始路由框架，仅 ping）**

```js
/**
 * 出库管理云函数（路由分发）
 */
const {
  cloud, getEffectiveOpenId, getUserByOpenId, canAccessStockOut,
} = require('./helpers');

const ROUTES = {
  ping: async () => ({ success: true, message: 'stockOutManager pong' }),
  // Task 2-7 加入：
  // createStockOutRequest, approveStockOutRequest, rejectStockOutRequest,
  // cancelStockOutRequest, listStockOutRequests, getStockOutRequest
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) return { success: false, error: '无法获取微信身份' };

  console.log(`[StockOutManager] Action: ${action}, OpenID: ${openid}`);

  try {
    const user = await getUserByOpenId(openid);
    if (!user) return { success: false, error: '用户不存在' };

    if (!canAccessStockOut(user)) {
      return { success: false, error: '无权限访问出库管理' };
    }

    const handler = ROUTES[action];
    if (!handler) return { success: false, error: `未知操作: ${action}` };

    return await handler({ data, user, openid, event });
  } catch (error) {
    console.error('[StockOutManager] Error:', error);
    return { success: false, error: error.message };
  }
};
```

- [ ] **Step 4: 自查（语法 stub）**

```bash
mkdir -p /tmp/stub/node_modules/wx-server-sdk
cat > /tmp/stub/node_modules/wx-server-sdk/index.js <<'EOF'
module.exports = {
  init: () => {},
  database: () => ({
    command: { in: () => {}, gt: () => {}, gte: () => {}, lte: () => {}, and: () => {}, inc: () => {}, _: {} },
    RegExp: () => ({}),
    collection: () => ({
      where: () => ({ get: async () => ({data:[]}), count: async () => ({total:0}), update: async () => ({stats:{updated:0}}), limit: () => ({get: async () => ({data:[]})}), orderBy: () => ({skip: () => ({limit: () => ({get: async () => ({data:[]})})})}) }),
      doc: () => ({ update: async () => ({}) }),
      add: async () => ({}),
      orderBy: () => ({ limit: () => ({get: async () => ({data:[]})}) }),
    }),
  }),
  callFunction: async () => ({}),
  getWXContext: () => ({ OPENID: 'test' }),
  DYNAMIC_CURRENT_ENV: 'test',
};
EOF
NODE_PATH=/tmp/stub/node_modules node -e "
require('./cloudfunctions/stockOutManager/index.js');
require('./cloudfunctions/stockOutManager/helpers.js');
console.log('all loaded');
"
rm -rf /tmp/stub
```

预期：`all loaded`。

- [ ] **Step 5: 提交**

```bash
git status
git add cloudfunctions/stockOutManager/
git status
git commit -m "$(cat <<'EOF'
feat(stockOut): 新建独立云函数 stockOutManager 骨架

含 helpers.js（独立权限函数 canAccess/Request/Approve + getNextId
+ createBatchNotifications）和 index.js 路由框架（仅 ping）。
Task 2-7 在此骨架上追加 6 个出库申请 action。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: createStockOutRequest action

**Files:**
- Modify: `cloudfunctions/stockOutManager/index.js`（追加函数 + ROUTES 挂载）

**目标**：申请人提交出库申请单 → 写 material_requests(status=Pending) → 通知 1+5 用户。

- [ ] **Step 1: 在 index.js 顶部 require 之后追加 createStockOutRequest 函数**

在 `const ROUTES = {...}` 之前加：

```js
async function generateRequestNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CKSQ-${dateStr}-`;
  const { db } = require('./helpers');
  const { total } = await db.collection('material_requests')
    .where({ request_number: db.RegExp({ regexp: `^${prefix}` }) })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

async function notifyApprovers(payload) {
  try {
    const { db, _, createBatchNotifications } = require('./helpers');
    const { data: approvers } = await db.collection('users')
      .where({ role_id: _.in([1, 5]), active: true })
      .limit(100)
      .get();
    if (!approvers.length) {
      console.warn('[StockOut] no approvers active');
      return;
    }
    const userIds = approvers.map(u => u.user_id);
    await createBatchNotifications(
      userIds,
      'stock_out_pending',
      '新的出库申请待审核',
      `${payload.requester_name} 申请 ${payload.material_name} × ${payload.quantity}（${payload.region}）`,
      payload
    );
  } catch (err) {
    console.error('[StockOut] notify approvers fail', err);
  }
}

async function createStockOutRequest({ data, user }) {
  const { canRequestStockOut, db, getNextId } = require('./helpers');
  if (!canRequestStockOut(user)) return { success: false, error: '无权限提交出库申请' };

  const { material_id, requested_quantity, region, scene, remark = '' } = data;

  if (!material_id) return { success: false, error: '请选择物资' };
  const qty = Number(requested_quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999999) {
    return { success: false, error: '申请数量需为 1-999999 的整数' };
  }
  if (!region || !scene) return { success: false, error: '区域和场景必填' };
  if (remark && remark.length > 200) return { success: false, error: '备注不能超过 200 字' };

  // 直接读 materials 集合取快照（不依赖 materialManager）
  const { data: mats } = await db.collection('materials').where({ material_id }).get();
  if (!mats.length) return { success: false, error: '配件不存在' };
  const material = mats[0];

  const requestId = await getNextId('material_requests');
  const requestNumber = await generateRequestNumber();
  const now = new Date();

  await db.collection('material_requests').add({
    data: {
      request_id: requestId,
      request_number: requestNumber,
      material_id,
      material_name: material.name,
      material_number: material.material_number || '',
      material_image: (material.images && material.images[0]) || '',
      category: material.category || '',
      spec: material.spec || '',
      model: material.model || '',
      unit: material.unit || '',
      requester: { user_id: user.user_id, name: user.name, role_id: user.role_id },
      requested_quantity: qty,
      region, scene, remark,
      status: 'Pending',
      reviewer: null,
      approved_quantity: null,
      out_record_id: null,
      reject_reason: null,
      created_at: now,
      updated_at: now,
      approved_at: null,
      rejected_at: null,
      cancelled_at: null,
    }
  });

  notifyApprovers({
    request_number: requestNumber,
    material_name: material.name,
    requester_name: user.name,
    quantity: qty,
    region,
  });

  return {
    success: true,
    request_id: requestId,
    request_number: requestNumber,
    message: '已提交，等待审核',
  };
}
```

- [ ] **Step 2: ROUTES 挂载**

```js
  createStockOutRequest,
```

放在 ping 后。

- [ ] **Step 3: 自查 + 提交**

```bash
# 同 Task 1 Step 4 的 stub 测试
git add cloudfunctions/stockOutManager/index.js
git commit -m "feat(stockOut): + createStockOutRequest action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: approveStockOutRequest action

**Files:**
- Modify: `cloudfunctions/stockOutManager/index.js`

**目标**：原子条件更新 + 直接读写 materials 扣库存 + 写 material_records + 通知申请人。

- [ ] **Step 1: 追加函数（在 createStockOutRequest 之后）**

```js
async function generateOutRecordNumber() {
  const { db } = require('./helpers');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CK-${dateStr}-`;
  const { total } = await db.collection('material_records')
    .where({ record_number: db.RegExp({ regexp: `^${prefix}` }), type: 'out' })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

async function notifyRequester(requesterUserId, type, title, message, payload) {
  try {
    const { createBatchNotifications } = require('./helpers');
    await createBatchNotifications([requesterUserId], type, title, message, payload);
  } catch (err) {
    console.error('[StockOut] notify requester fail', err);
  }
}

async function approveStockOutRequest({ data, user }) {
  const { canApproveStockOut, db, _, getNextId } = require('./helpers');
  if (!canApproveStockOut(user)) return { success: false, error: '无权限审核出库' };

  const { request_id, approved_quantity } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };
  const aqty = Number(approved_quantity);
  if (!Number.isInteger(aqty) || aqty < 1) {
    return { success: false, error: '实际出库数量需为 ≥1 的整数' };
  }

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];
  if (req.status !== 'Pending') return { success: false, error: '单据已被处理' };

  if (aqty > req.requested_quantity) {
    return { success: false, error: `实际出库数量不能超过申请数量 ${req.requested_quantity}` };
  }

  // 直接读 materials 取最新库存
  const { data: mats } = await db.collection('materials').where({ material_id: req.material_id }).get();
  if (!mats.length) return { success: false, error: '配件已被删除' };
  const material = mats[0];
  if (material.stock < aqty) {
    return { success: false, error: `库存不足，当前库存: ${material.stock}` };
  }

  const now = new Date();
  const recordId = await getNextId('material_records');
  const recordNumber = await generateOutRecordNumber();

  // 原子条件更新申请单
  const updateRes = await db.collection('material_requests')
    .where({ request_id, status: 'Pending' })
    .update({
      data: {
        status: 'Approved',
        reviewer: { user_id: user.user_id, name: user.name },
        approved_quantity: aqty,
        out_record_id: recordId,
        approved_at: now,
        updated_at: now,
      }
    });

  if (updateRes.stats.updated === 0) {
    return { success: false, error: '单据已被审核' };
  }

  // 直接 db 操作 materials + material_records（不调 materialManager）
  await Promise.all([
    db.collection('materials').doc(material._id).update({
      data: { stock: _.inc(-aqty), updated_at: now }
    }),
    db.collection('material_records').add({
      data: {
        record_id: recordId,
        record_number: recordNumber,
        material_id: req.material_id,
        material_name: req.material_name,
        material_number: req.material_number || '',
        category: req.category || '',
        spec: req.spec || '',
        model: req.model || '',
        usage_area: material.usage_area || '',
        material_image: req.material_image || '',
        type: 'out',
        quantity: aqty,
        operator: { user_id: user.user_id, name: user.name },
        request_id: req.request_id,
        region: req.region,
        scene: req.scene,
        remark: req.remark || '',
        created_at: now,
      }
    })
  ]);

  notifyRequester(
    req.requester.user_id,
    'stock_out_approved',
    '出库申请已通过',
    `${req.material_name} × ${aqty} 已出库`,
    {
      request_id: req.request_id,
      request_number: req.request_number,
      material_name: req.material_name,
      approved_quantity: aqty,
      reviewer_name: user.name,
    }
  );

  return {
    success: true,
    record_id: recordId,
    record_number: recordNumber,
    message: '出库成功',
  };
}
```

- [ ] **Step 2: ROUTES 挂载 + 提交**

```js
  approveStockOutRequest,
```

```bash
git add cloudfunctions/stockOutManager/index.js
git commit -m "feat(stockOut): + approveStockOutRequest action（审核=出库，原子保护+扣库存）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: rejectStockOutRequest action

**Files:** Modify `cloudfunctions/stockOutManager/index.js`

```js
async function rejectStockOutRequest({ data, user }) {
  const { canApproveStockOut, db } = require('./helpers');
  if (!canApproveStockOut(user)) return { success: false, error: '无权限驳回' };

  const { request_id, reject_reason } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };
  if (!reject_reason || !reject_reason.trim()) return { success: false, error: '请填写驳回原因' };
  if (reject_reason.length > 200) return { success: false, error: '驳回原因不能超过 200 字' };

  const now = new Date();
  const updateRes = await db.collection('material_requests')
    .where({ request_id, status: 'Pending' })
    .update({
      data: {
        status: 'Rejected',
        reviewer: { user_id: user.user_id, name: user.name },
        reject_reason,
        rejected_at: now,
        updated_at: now,
      }
    });

  if (updateRes.stats.updated === 0) {
    return { success: false, error: '单据已被处理' };
  }

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (reqs.length) {
    notifyRequester(
      reqs[0].requester.user_id,
      'stock_out_rejected',
      '出库申请被驳回',
      `${reqs[0].material_name} - ${reject_reason}`,
      {
        request_id: reqs[0].request_id,
        request_number: reqs[0].request_number,
        material_name: reqs[0].material_name,
        reject_reason,
        reviewer_name: user.name,
      }
    );
  }

  return { success: true, message: '已驳回' };
}
```

- [ ] ROUTES 挂载 `rejectStockOutRequest`，commit 同 Task 3 风格。

---

## Task 5: cancelStockOutRequest action

```js
async function cancelStockOutRequest({ data, user }) {
  const { db } = require('./helpers');
  const { request_id } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];

  if (req.requester.user_id !== user.user_id) {
    return { success: false, error: '只能撤回自己提交的申请' };
  }
  if (req.status !== 'Pending') return { success: false, error: '仅待审核单据可撤回' };

  const now = new Date();
  const updateRes = await db.collection('material_requests')
    .where({ request_id, status: 'Pending' })
    .update({
      data: {
        status: 'Cancelled',
        cancelled_at: now,
        updated_at: now,
      }
    });

  if (updateRes.stats.updated === 0) {
    return { success: false, error: '单据已被处理' };
  }
  return { success: true, message: '已撤回' };
}
```

- [ ] ROUTES 挂载 + commit。

---

## Task 6: listStockOutRequests action

```js
async function listStockOutRequests({ data, user }) {
  const { canAccessStockOut, db, _ } = require('./helpers');
  if (!canAccessStockOut(user)) return { success: false, error: '无权限' };

  const {
    status, requester_user_id, material_id,
    region, scene, date_from, date_to, keyword,
    page = 1, pageSize = 20,
  } = data;

  const conditions = {};
  if (user.role_id === 4) {
    conditions['requester.user_id'] = user.user_id;
  } else if (requester_user_id) {
    conditions['requester.user_id'] = requester_user_id;
  }

  if (Array.isArray(status) && status.length) {
    conditions.status = _.in(status);
  } else if (typeof status === 'string' && status) {
    conditions.status = status;
  }
  if (material_id) conditions.material_id = material_id;
  if (region) conditions.region = region;
  if (scene) conditions.scene = scene;

  if (date_from && date_to) {
    conditions.created_at = _.and(_.gte(new Date(date_from)), _.lte(new Date(date_to)));
  } else if (date_from) {
    conditions.created_at = _.gte(new Date(date_from));
  } else if (date_to) {
    conditions.created_at = _.lte(new Date(date_to));
  }
  if (keyword) {
    conditions.material_name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  const query = db.collection('material_requests').where(conditions);
  const [countRes, listRes] = await Promise.all([
    query.count(),
    query.orderBy('created_at', 'desc').skip((page - 1) * pageSize).limit(pageSize).get(),
  ]);

  return {
    success: true,
    requests: listRes.data,
    total: countRes.total,
    page, pageSize,
  };
}
```

- [ ] ROUTES 挂载 + commit。

---

## Task 7: getStockOutRequest action

```js
async function getStockOutRequest({ data, user }) {
  const { canAccessStockOut, db } = require('./helpers');
  if (!canAccessStockOut(user)) return { success: false, error: '无权限' };

  const { request_id } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];

  if (user.role_id === 4 && req.requester.user_id !== user.user_id) {
    return { success: false, error: '无权限查看' };
  }

  return { success: true, request: req };
}
```

- [ ] ROUTES 挂载 + commit。

---

## Task 8: getMaterialById helper（在 stockOutManager 内）

stockOutManager 在审核时需要取最新库存。我们直接在 stockOutManager 内加一个 helper action（不调用 materialManager），保持云函数解耦。

```js
async function getMaterialById({ data, user }) {
  const { canAccessStockOut, db } = require('./helpers');
  if (!canAccessStockOut(user)) return { success: false, error: '无权限' };

  const { material_id } = data;
  if (!material_id) return { success: false, error: '缺少 material_id' };

  const { data: list } = await db.collection('materials').where({ material_id }).limit(1).get();
  if (list.length === 0) return { success: false, error: '配件不存在' };
  return { success: true, material: list[0] };
}

async function listMaterials({ data, user }) {
  // 用于物资 picker 搜索 — 复用 materials 集合，但因 stock-out 需要彻底解耦，自己读
  const { canAccessStockOut, db } = require('./helpers');
  if (!canAccessStockOut(user)) return { success: false, error: '无权限' };

  const { keyword, page = 1, pageSize = 50 } = data;
  const conditions = {};
  if (keyword) {
    conditions.name = db.RegExp({ regexp: keyword, options: 'i' });
  }
  const query = db.collection('materials').where(conditions);
  const [countRes, listRes] = await Promise.all([
    query.count(),
    query.orderBy('created_at', 'desc').skip((page - 1) * pageSize).limit(pageSize).get(),
  ]);

  return {
    success: true,
    materials: listRes.data,
    total: countRes.total,
    page, pageSize,
  };
}
```

- [ ] ROUTES 挂载两个 + commit。

---

## Task 9: dictionaryManager 收紧 stock_out_* 字典写权限

**Files:**
- Modify: `cloudfunctions/dictionaryManager/index.js`

**目标**：`stock_out_region` / `stock_out_scene` 仅 role_id=1 可 CRUD（不放给 canManageMaterial 例外）。**`material_category` / `material_location` 写权限不动**（保持 [1,2,4]）。

- [ ] **Step 1: 修改写权限校验**

定位 dictionaryManager/index.js 第 209-225 行附近的 `adminActions` 校验段。把 `MANAGE_MATERIAL_DICTS` 数组**保持不变**（仍是 ['material_category', 'material_location']），仅依赖现有 isAdminUser 分支自动覆盖 `stock_out_region/scene`。

实际上 v2 的 dictionaryManager 已经是回滚后状态（[1,2,4]），新字典不在 MANAGE_MATERIAL_DICTS 里就自动落到 isAdminUser 分支（仅 role 1）。所以**本 Task 实际无代码改动**——验证现状即可。

```bash
grep -A6 "MANAGE_MATERIAL_DICTS" cloudfunctions/dictionaryManager/index.js
# 预期输出包含：
#   const MANAGE_MATERIAL_DICTS = ['material_category', 'material_location'];
#   ...
#   const canManageMaterial = user && [1, 2, 4].includes(user.role_id) && user.active !== false;
```

- [ ] **Step 2: 如果验证通过则跳过本 Task；否则按 spec 5.5 修正**

如 grep 结果与预期不符（比如 MANAGE_MATERIAL_DICTS 含 stock_out_*），从数组里移除 stock_out_* 项，commit 修复。

---

## Task 10: constants.js 新增 ROLES.WAREHOUSE_KEEPER + STOCK_OUT_STATUS

**Files:**
- Modify: `miniprogram/utils/constants.js`

```js
const ROLES = {
  ADMIN: 1, PROPERTY_MANAGER: 2, MAINTENANCE_STAFF: 3, PROPERTY_STAFF: 4,
  WAREHOUSE_KEEPER: 5,
};
const ROLE_DISPLAY_NAMES = {
  ..., 5: '仓管员',
};

const STOCK_OUT_STATUS = {
  PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
};
const STOCK_OUT_STATUS_DISPLAY_NAMES = {
  Pending: '待审核', Approved: '已出库', Rejected: '已驳回', Cancelled: '已撤回',
};
const STOCK_OUT_STATUS_COLORS = {
  Pending: '#F59E0B', Approved: '#10B981', Rejected: '#DC2626', Cancelled: '#6B7280',
};
```

- [ ] 更新 module.exports，包含 STOCK_OUT_STATUS / STOCK_OUT_STATUS_DISPLAY_NAMES / STOCK_OUT_STATUS_COLORS。
- [ ] 验证 + commit。

---

## Task 11: stockOutService.js 新建

**Files:**
- Create: `miniprogram/services/stockOutService.js`

```js
/**
 * 出库管理服务
 * 封装 stockOutManager 云函数调用
 */

const { callCloud, callCloudSilent } = require('../utils/cloudCall');

const createStockOutRequest = async (params) => {
  return callCloud('stockOutManager', {
    action: 'createStockOutRequest',
    data: params,
  }, { loadingText: '提交中...' });
};

const approveStockOutRequest = async (request_id, approved_quantity) => {
  return callCloud('stockOutManager', {
    action: 'approveStockOutRequest',
    data: { request_id, approved_quantity },
  }, { loadingText: '审核中...' });
};

const rejectStockOutRequest = async (request_id, reject_reason) => {
  return callCloud('stockOutManager', {
    action: 'rejectStockOutRequest',
    data: { request_id, reject_reason },
  }, { loadingText: '提交中...' });
};

const cancelStockOutRequest = async (request_id) => {
  return callCloud('stockOutManager', {
    action: 'cancelStockOutRequest',
    data: { request_id },
  }, { loadingText: '撤回中...' });
};

const listStockOutRequests = async (params = {}) => {
  return callCloudSilent('stockOutManager', {
    action: 'listStockOutRequests',
    data: { page: 1, pageSize: 20, ...params },
  });
};

const getStockOutRequest = async (request_id) => {
  return callCloudSilent('stockOutManager', {
    action: 'getStockOutRequest',
    data: { request_id },
  });
};

const getMaterialById = async (material_id) => {
  return callCloudSilent('stockOutManager', {
    action: 'getMaterialById',
    data: { material_id }
  });
};

const listMaterials = async (keyword = '', page = 1, pageSize = 50) => {
  return callCloudSilent('stockOutManager', {
    action: 'listMaterials',
    data: { keyword, page, pageSize }
  });
};

module.exports = {
  createStockOutRequest, approveStockOutRequest, rejectStockOutRequest,
  cancelStockOutRequest, listStockOutRequests, getStockOutRequest,
  getMaterialById, listMaterials,
};
```

- [ ] 验证 + commit。

---

## Task 12: stock-out/index 主页骨架（双 Tab）

**Files:**
- Create: `miniprogram/pages/stock-out/index/{js,wxml,wxss,json}`
- Modify: `miniprogram/app.json`（+ 路径）

**目标**：主页含 Tab 切换（出库申请 / 出库记录）+ 角色视图区分 + FAB 跳转 form。

参考结构（沿用 v1 spec 中已设计的 sub-tabs 形态，但落地在独立的 stock-out/index 页面）：

- index.json 注册 `<van-icon>` 组件
- index.wxml 含 sub-tabs + swiper + 两个 scroll-view 子 Tab + FAB + filter drawer
- index.js 含 `_loadRequests / _loadOutRecords / onTabChange / onFabTap / 筛选抽屉` 等方法
- index.wxss 含 sub-tabs / status-chip / filter-chip / filter-drawer 样式

具体代码结构与 v1 旧 plan Task 17-19 中类似，但所有引用从 material/index 路径改为 stock-out/index 路径，云函数调用改为 stockOutService。

- [ ] 创建 4 个文件 + app.json 加路径 + 验证 + commit。

---

## Task 13: stock-out/index Tab1 出库申请列表 + FAB

**Files:** Modify `pages/stock-out/index/index.js`

接入 `stockOutService.listStockOutRequests` 按角色加载，FAB 跳 `/pages/stock-out/form/index`，列表项 tap 跳 `/pages/stock-out/detail/index?request_id=xx`。

- [ ] commit。

---

## Task 14: stock-out/index Tab2 出库记录 + 多条件筛选抽屉

**Files:** Modify `pages/stock-out/index/index.{js,wxml,wxss}`

筛选抽屉 wxml/wxss 与 chip 显示移除逻辑。状态多选用 `_.in([Approved, Rejected, Cancelled])`。

- [ ] commit。

---

## Task 15: stock-out/form 申请表单页（骨架 + 字典加载）

**Files:** Create `pages/stock-out/form/{js,wxml,wxss,json}`，Modify app.json

字典加载（`getOptionsWithLabel('stock_out_region/scene')`，首次自动 seed），表单字段（物资 / 数量 / 区域 / 场景 / 备注）+ 校验 + 提交按钮 stub。

- [ ] commit。

---

## Task 16: stock-out/form 物资选择 picker + 提交

**Files:** Modify `pages/stock-out/form/`

物资搜索抽屉调 `stockOutService.listMaterials`，选中带快照；提交调 `stockOutService.createStockOutRequest` → navigateBack。

- [ ] commit。

---

## Task 17: stock-out/detail 详情页骨架 + 状态时间线

**Files:** Create `pages/stock-out/detail/{js,wxml,wxss,json}`，Modify app.json

调 `stockOutService.getStockOutRequest`，渲染状态横幅、物资卡、申请信息、审核结果（如 Approved/Rejected）、时间线、操作按钮 stub。

- [ ] commit。

---

## Task 18: stock-out/detail 操作按钮（审核/驳回/撤回）

**Files:** Modify `pages/stock-out/detail/`

3 个按钮接入：
- 撤回：modal → cancelStockOutRequest
- 审核：getMaterialById 取库存 → 弹底部 dialog 数量调整 → approveStockOutRequest
- 驳回：弹底部 dialog 输入原因 → rejectStockOutRequest

成功后 `_load()` reload 详情。

- [ ] commit。

---

## Task 19: 入口接入 — home/index.js 出库管理跳转

**Files:** Modify `miniprogram/pages/home/index.js`

home/index.js 当前已有"出库管理"宫格 handler（指向 `/pages/material/index?tab=1`，是历史残留）。本 Task 把 URL 改为 `/pages/stock-out/index`：

```js
if (module === 'consumable' && label === '出库管理') {
  wx.navigateTo({
    url: '/pages/stock-out/index',
    fail: (err) => {
      console.error('navigateTo failed:', err)
      wx.reLaunch({ url: '/pages/stock-out/index' })
    }
  })
  return
}
```

⚠️ 注意：home/index.js 已在工作区有 modified 状态（含其他并行工作）。**只 add 本任务的 11 行 hunk**，避免污染他人工作。建议用 `git add -p`。

- [ ] commit。

---

## Task 20: 云端配置（手动）

**目标**：手动在云端做不能用代码自动化的初始化工作。**本 Task 没有代码改动，仅检查清单**。

- [ ] **Step 1: 数据库 → 集合 `roles` 新增**

```json
{ "role_id": 5, "name": "仓管员", "module_permissions": ["submit_work_orders", "view_analytics"], "active": true }
```

- [ ] **Step 2: 数据库 → 集合 `users` 至少 1 个 role_id=5 测试用户**

或把现有某个测试 openid 用户 role_id 改 5。

- [ ] **Step 3: 通知模板配置（如 sendNotification 需预注册）**

| key | 标题/示例 |
|---|---|
| `stock_out_pending` | 「{requester_name} 申请出库 {material_name} × {quantity}（{region}），待审核」|
| `stock_out_approved` | 「您的出库申请 {request_number}（{material_name}）已通过，实际出库 {approved_quantity}」|
| `stock_out_rejected` | 「您的出库申请 {request_number}（{material_name}）被驳回：{reject_reason}」|

如项目通知系统是直写 notifications 集合（无预注册），跳过此步。

- [ ] **Step 4: 字典 seed 验证**

不在云端预 seed，留给前端首次进 stock-out/form 自动 seed。仅确认 dictionaries 集合无遗留同名 key。

---

## Task 21: 全路径手动回归

**Files:** 无代码改动，纯手工回归。按 spec v2 §9 验证：

- [ ] §9.1 5 角色路径回归（办美/仓管员/管理员/经理/维修员）
- [ ] §9.2 数据正确性（提交/审核通过/驳回/撤回 4 个场景的 collections 变化）
- [ ] §9.3 边界场景（库存边界/并发审核/字典软删/物资被删/撤回竞态/维修员硬刷）
- [ ] §9.4 回归非 stock-out 模块（工单 / pages/material/ 不变 / materialManager 不变）

最后在 tasks/todo.md 加 Review 总结，commit。

---

## 总结

21 个 Task，分 8 个 Phase 完成。后端 8 + 前端 11 + 入口/配置/回归 2。

**关键风险点**：
- Task 1（stockOutManager 骨架）：第一次部署，验证 cloud.init 和 collection 访问
- Task 3（approveStockOutRequest）：原子条件更新 + 直接读写 materials 是核心，并发保护要测试
- Task 9（dictionaryManager）：实际可能无改动，验证现状即可
- Task 19（home/index.js）：工作区可能仍有他人 modified 状态，git add -p 小心

**部署顺序**：
1. Phase 1-3 后端完成 → 部署 stockOutManager + dictionaryManager（如有改动）
2. Task 20 云端配置（用户手动）
3. Phase 4-7 前端完成 → 整体上传体验版
4. Task 21 体验版回归
