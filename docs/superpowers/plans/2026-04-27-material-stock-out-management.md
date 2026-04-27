# 耗品出库管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `pages/material/index` Tab3 从"只读出库记录"升级为"出库管理"，内含出库申请/出库记录两个子页；新增 `stock-out-form` 申请表单页 + `stock-out-detail` 详情页；后端 `materialManager` 拆分 `handlers/` 并新增 6 个 action 实现完整三段式审批流（pending → approved/rejected/cancelled，审核与出库合并为一动作）；新增"仓管员"（role_id=5）角色，办美员工失去入库 + 分类管理权限。

**Architecture:** 微信小程序 + 微信云开发。前端按 spec §3 在 material/index Tab3 内嵌 sub-tabs + swiper；新增 2 个页面（stock-out-form / stock-out-detail）；后端 materialManager 按 workOrderManager 模式拆 handlers/，新增 handlers/request.js 含 6 个 action；dictionaryManager 给 stock_out_region/scene 字典严格仅 role_id=1 写权限；通知复用 sendNotification + 在云端新增 3 个模板 key（stock_out_pending / stock_out_approved / stock_out_rejected）。

**Tech Stack:** WXML/WXSS/JS（小程序原生），@vant/weapp 组件库，wx-server-sdk（云函数），CloudBase 数据库（dictionaries / materials / material_records / **新建 material_requests** 集合）。无自动化测试，**所有验证通过微信开发者工具的"模拟器 / 云函数测试 / 真机"完成**。

**Spec 引用:** `docs/superpowers/specs/2026-04-27-material-stock-out-management-design.md`

---

## 影响文件结构

```
新建（8 文件）：
  miniprogram/pages/material/stock-out-form/index.{js,wxml,wxss,json}      (4)
  miniprogram/pages/material/stock-out-detail/index.{js,wxml,wxss,json}    (4)
  cloudfunctions/materialManager/handlers/crud.js                          (拆出)
  cloudfunctions/materialManager/handlers/stock.js                         (拆出)
  cloudfunctions/materialManager/handlers/request.js                       (新)
  cloudfunctions/materialManager/handlers/seed.js                          (拆出)

改造（10 文件）：
  miniprogram/pages/material/index.{js,wxml,wxss,json}    (Tab3 改造)
  miniprogram/utils/constants.js                          (+ROLE 5 / +STATUS)
  miniprogram/services/materialService.js                 (+6 方法)
  miniprogram/app.json                                    (+2 路径)
  miniprogram/pages/home/index.{wxml,js}                  (+出库管理宫格)
  miniprogram/custom-tab-bar/index.js                     (+role 5 显隐)
  miniprogram/pages/admin/dict/...                        (+2 字典 key)
  cloudfunctions/materialManager/index.js                 (路由分发)
  cloudfunctions/materialManager/helpers.js               (权限函数调整+新增)
  cloudfunctions/dictionaryManager/index.js               (新字典权限例外)

云端配置（手动）：
  数据库 collection material_requests 新建（首次写入时自动创建，无需提前 createCollection）
  数据库 collection roles + 一条 role_id=5 仓管员
  通知模板 + 3 个 key
```

## 实现顺序与依赖

```
Phase 1 后端权限与拆分           → Task 1, 2
Phase 2 后端新增 6 个 action      → Task 3, 4, 5, 6, 7, 8
Phase 3 后端字典权限收紧 + 部署   → Task 9, 10
Phase 4 前端常量与服务            → Task 11, 12
Phase 5 stock-out-form 页面       → Task 13, 14
Phase 6 stock-out-detail 页面     → Task 15, 16
Phase 7 material/index Tab3 改造  → Task 17, 18, 19
Phase 8 入口接入                  → Task 20, 21
Phase 9 全路径回归                → Task 22
```

每个 Task 完成后单独提交。Phase 1-3 全部部署后再开始前端开发，确保后端可用。

---

## Task 1: helpers.js 权限重排 + 新增 2 个权限函数

**Files:**
- Modify: `cloudfunctions/materialManager/helpers.js:41-51`

**目标**：`canAccessMaterial` 加入 role_id=5（仓管员）；`canManageMaterial` 改为 [1,2,5]（办美失去）；新增 `canApproveStockOut`（[1,5]）、`canRequestStockOut`（[1,2,4,5]）。

- [ ] **Step 1: 修改 helpers.js 中两个既有函数**

把第 41-51 行整段替换为：

```js
/**
 * 权限校验：是否可以访问物料管理
 * 管理员(1)、行政经理(2)、办美员工(4)、仓管员(5) 可访问
 * 维修员(3)排除
 */
function canAccessMaterial(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以管理物料（新增配件、入库、分类管理）
 * 管理员(1)、行政经理(2)、仓管员(5) 可管理
 * 办美员工(4) 已被收回（仅可申请出库）
 */
function canManageMaterial(user) {
  return user && [1, 2, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以审核+执行出库
 * 仅管理员(1) 与 仓管员(5)
 */
function canApproveStockOut(user) {
  return user && [1, 5].includes(user.role_id) && user.active !== false;
}

/**
 * 权限校验：是否可以提交出库申请
 * 管理员(1)、行政经理(2)、办美员工(4)、仓管员(5)
 */
function canRequestStockOut(user) {
  return user && [1, 2, 4, 5].includes(user.role_id) && user.active !== false;
}
```

- [ ] **Step 2: 更新 module.exports**

定位文件最后的 `module.exports`，加入两个新函数：

```js
module.exports = {
  cloud,
  db,
  _,
  getEffectiveOpenId,
  getUserByOpenId,
  canAccessMaterial,
  canManageMaterial,
  canApproveStockOut,
  canRequestStockOut,
  getNextId,
};
```

- [ ] **Step 3: 部署云函数**

微信开发者工具 → 右键 `cloudfunctions/materialManager` → "上传并部署：云端安装依赖"。等完成。

- [ ] **Step 4: 验证（云函数测试）**

云开发 → 云函数 → materialManager → 测试：
- 用 role_id=4（办美）的 openid 调 `addMaterial` action（缺参也行），预期 `{success:false, error:'无权限新增配件'}` （之前是允许的）
- 用 role_id=5（如果数据库还没这个用户先跳过）调 `listMaterials`，预期通过

⚠️ role_id=5 的用户暂时还没有，验证可以放到 Task 21 之后再做完整回归。本 Task 先确认 4 被拒、1/2 通过。

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/materialManager/helpers.js
git commit -m "$(cat <<'EOF'
feat(material): 权限重排 - 办美失去 manage / 新增审核+申请权限函数

canAccessMaterial 加入 role_id=5；canManageMaterial 改为 [1,2,5]
（办美失去入库+分类）；新增 canApproveStockOut [1,5] 与
canRequestStockOut [1,2,4,5] 供后续出库申请流程使用。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: materialManager handlers 目录拆分

**Files:**
- Create: `cloudfunctions/materialManager/handlers/crud.js`
- Create: `cloudfunctions/materialManager/handlers/stock.js`
- Create: `cloudfunctions/materialManager/handlers/seed.js`
- Modify: `cloudfunctions/materialManager/index.js`（变路由分发）

**目标**：把 800+ 行 `index.js` 按 workOrderManager 模式拆成 handlers/。本 Task 不引入新逻辑，仅文件重组，保证既有 action 调用契约不变。

> **拆分原则**：crud.js（list / getByNumber / add / update / delete）、stock.js（stockIn / stockOut / getStats / getWarnings）、seed.js（seedTestData），index.js 改为 import + switch 路由。**handlers/request.js 在 Task 3 才创建。**

- [ ] **Step 1: 创建 handlers/crud.js**

新建 `cloudfunctions/materialManager/handlers/crud.js`：

```js
/**
 * 配件 CRUD handlers
 */
const { db, _, getNextId, canManageMaterial } = require('../helpers');

async function getMaterialByNumber({ data }) {
  const { material_number } = data;
  if (!material_number) return { success: false, error: '缺少 material_number' };

  const { data: list } = await db.collection('materials')
    .where({ material_number }).limit(1).get();

  if (list.length === 0) return { success: true, material: null };
  return { success: true, material: list[0] };
}

async function getMaterialById({ data }) {
  const { material_id } = data;
  if (!material_id) return { success: false, error: '缺少 material_id' };

  const { data: list } = await db.collection('materials')
    .where({ material_id }).limit(1).get();

  if (list.length === 0) return { success: false, error: '配件不存在' };
  return { success: true, material: list[0] };
}

async function listMaterials({ data }) {
  const { keyword, page = 1, pageSize = 20 } = data;
  const conditions = {};
  if (keyword) {
    conditions.name = db.RegExp({ regexp: keyword, options: 'i' });
  }

  const query = db.collection('materials').where(conditions);
  const [countRes, listRes] = await Promise.all([
    query.count(),
    query.orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize).limit(pageSize).get()
  ]);

  return {
    success: true,
    materials: listRes.data,
    total: countRes.total,
    page, pageSize,
  };
}

async function addMaterial({ data, user }) {
  if (!canManageMaterial(user)) return { success: false, error: '无权限新增配件' };

  const {
    material_number, name, category, unit,
    source = '', stock_in_time, quantity = 0,
    usage_area = '', min_stock = 0, spec = '', model = '',
    images = [], remark = ''
  } = data;

  if (!name || !category || !unit) {
    return { success: false, error: '请填写完整的配件信息' };
  }

  let finalMaterialNumber = material_number;
  if (!finalMaterialNumber) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { total: todayCount } = await db.collection('materials')
      .where({ material_number: db.RegExp({ regexp: `^M${dateStr}`, options: 'i' }) }).count();
    finalMaterialNumber = `M${dateStr}${String(todayCount + 1).padStart(4, '0')}`;
  } else {
    const { total: numExists } = await db.collection('materials')
      .where({ material_number: finalMaterialNumber }).count();
    if (numExists > 0) return { success: false, error: '配件编号已存在' };
  }

  const materialId = await getNextId('materials');
  const initQty = Number(quantity) || 0;
  const now = new Date();
  const parsedStockInTime = stock_in_time ? new Date(stock_in_time) : now;

  await db.collection('materials').add({
    data: {
      material_id: materialId, material_number: finalMaterialNumber,
      name, category, unit, source, stock_in_time: parsedStockInTime,
      usage_area, spec, model, images: images.slice(0, 3),
      stock: initQty, min_stock: Number(min_stock) || 0,
      remark, created_at: now, updated_at: now,
      created_by: { user_id: user.user_id, name: user.name },
    }
  });

  if (initQty > 0) {
    const recordId = await getNextId('material_records');
    await db.collection('material_records').add({
      data: {
        record_id: recordId, material_id: materialId, material_name: name,
        type: 'in', quantity: initQty,
        operator: { user_id: user.user_id, name: user.name },
        remark: '新增配件初始入库',
        created_at: parsedStockInTime,
      }
    });
  }

  return { success: true, material_id: materialId, message: '配件添加成功' };
}

async function updateMaterial({ data, user }) {
  if (!canManageMaterial(user)) return { success: false, error: '无权限修改配件' };
  const { material_id, ...fields } = data;
  const { data: mats } = await db.collection('materials').where({ material_id }).get();
  if (!mats.length) return { success: false, error: '配件不存在' };

  const updateData = { updated_at: new Date() };
  const allowed = ['name', 'material_number', 'category', 'unit', 'spec', 'model', 'source', 'usage_area', 'min_stock', 'images'];
  allowed.forEach(k => { if (fields[k] !== undefined) updateData[k] = fields[k]; });
  if (updateData.min_stock !== undefined) updateData.min_stock = Number(updateData.min_stock) || 0;

  await db.collection('materials').doc(mats[0]._id).update({ data: updateData });
  return { success: true, message: '更新成功' };
}

async function deleteMaterial({ data, user }) {
  if (!canManageMaterial(user)) return { success: false, error: '无权限删除配件' };
  const { material_id } = data;
  const { data: mats } = await db.collection('materials').where({ material_id }).get();
  if (!mats.length) return { success: false, error: '配件不存在' };
  await db.collection('materials').doc(mats[0]._id).remove();
  return { success: true, message: '删除成功' };
}

async function listRecords({ data }) {
  const { type, material_id, page = 1, pageSize = 20 } = data;
  const conditions = {};
  if (type === 'in' || type === 'out') conditions.type = type;
  if (material_id) conditions.material_id = material_id;

  const rQuery = db.collection('material_records').where(conditions);
  const [countRes, listRes] = await Promise.all([
    rQuery.count(),
    rQuery.orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize).limit(pageSize).get()
  ]);

  return { success: true, records: listRes.data, total: countRes.total, page, pageSize };
}

async function getMaterialStats({ data }) {
  const { material_id } = data;
  if (!material_id) return { success: false, error: '缺少 material_id' };
  const { data: records } = await db.collection('material_records')
    .where({ material_id }).limit(1000).get();
  const total_in = records.filter(r => r.type === 'in').reduce((s, r) => s + (r.quantity || 0), 0);
  const total_out = records.filter(r => r.type === 'out').reduce((s, r) => s + (r.quantity || 0), 0);
  return { success: true, total_in, total_out };
}

module.exports = {
  getMaterialByNumber, getMaterialById, listMaterials, addMaterial, updateMaterial,
  deleteMaterial, listRecords, getMaterialStats,
};
```

- [ ] **Step 2: 创建 handlers/stock.js**

新建 `cloudfunctions/materialManager/handlers/stock.js`：

```js
/**
 * 入出库 handlers（直写库存的旧路径，保留供工单完成扣库存等使用）
 */
const { db, _, getNextId, canManageMaterial } = require('../helpers');

async function stockIn({ data, user }) {
  if (!canManageMaterial(user)) return { success: false, error: '无权限执行入库操作' };

  const { material_id, quantity, remark = '' } = data;
  if (!material_id || !quantity || quantity <= 0) {
    return { success: false, error: '请填写正确的入库信息' };
  }

  const { data: materials } = await db.collection('materials').where({ material_id }).get();
  if (materials.length === 0) return { success: false, error: '配件不存在' };

  const material = materials[0];
  const now = new Date();
  const qty = Number(quantity);

  const [recordId] = await Promise.all([
    getNextId('material_records'),
    db.collection('materials').doc(material._id).update({
      data: { stock: _.inc(qty), updated_at: now }
    })
  ]);

  await db.collection('material_records').add({
    data: {
      record_id: recordId, material_id,
      material_name: material.name,
      material_number: material.material_number || '',
      category: material.category || '', spec: material.spec || '',
      model: material.model || '', usage_area: material.usage_area || '',
      material_image: (material.images && material.images[0]) || '',
      type: 'in', quantity: qty,
      operator: { user_id: user.user_id, name: user.name },
      remark, created_at: now,
    }
  });

  return { success: true, message: '入库成功' };
}

async function stockOut({ data, user }) {
  // 注意：此 action 是直写出库的旧路径（工单完成扣库存使用）
  // 出库申请审批流走 handlers/request.js 的 approveStockOutRequest
  const { material_id, quantity, remark = '' } = data;
  if (!material_id || !quantity || quantity <= 0) {
    return { success: false, error: '请填写正确的出库信息' };
  }

  const { data: materials } = await db.collection('materials').where({ material_id }).get();
  if (materials.length === 0) return { success: false, error: '配件不存在' };

  const material = materials[0];
  const qty = Number(quantity);
  if (material.stock < qty) {
    return { success: false, error: `库存不足，当前库存: ${material.stock}` };
  }

  const now = new Date();
  const [recordId] = await Promise.all([
    getNextId('material_records'),
    db.collection('materials').doc(material._id).update({
      data: { stock: _.inc(-qty), updated_at: now }
    })
  ]);

  await db.collection('material_records').add({
    data: {
      record_id: recordId, material_id,
      material_name: material.name,
      material_number: material.material_number || '',
      category: material.category || '', spec: material.spec || '',
      model: material.model || '', usage_area: material.usage_area || '',
      material_image: (material.images && material.images[0]) || '',
      type: 'out', quantity: qty,
      operator: { user_id: user.user_id, name: user.name },
      remark, created_at: now,
      // request_id 留 null/undefined，标识非申请单出库
    }
  });

  return { success: true, message: '出库成功' };
}

async function getWarnings() {
  const { data: allWithMinStock } = await db.collection('materials')
    .where({ min_stock: _.gt(0) }).limit(1000).get();
  const warningList = allWithMinStock.filter(m => m.stock <= m.min_stock);
  return { success: true, warnings: warningList, total: warningList.length };
}

module.exports = { stockIn, stockOut, getWarnings };
```

- [ ] **Step 3: 创建 handlers/seed.js**

新建 `cloudfunctions/materialManager/handlers/seed.js`，把 `index.js` 既有 `seedTestData` case 整段复制过来，外层包 `async function seedTestData({ user })`。**为节省篇幅，保持既有 5 配件 + 3 入库 + 3 出库的 mock 数据完全不变**：

```js
/**
 * 测试数据种子（开发用）
 */
const { db, getNextId, canManageMaterial } = require('../helpers');

async function seedTestData({ user }) {
  if (!canManageMaterial(user)) return { success: false, error: '无权限' };

  const now = new Date();
  // 以下 5 配件 + 3 入库记录 + 3 出库记录 与既有 index.js seedTestData 完全一致，
  // 仅把 user.user_id / user.name 引用从外层闭包改为参数 user。
  // ... (从 cloudfunctions/materialManager/index.js 既有 seedTestData case 完整粘贴到此)

  return { success: true, message: '已插入5条配件 + 3条入库记录 + 3条出库记录' };
}

module.exports = { seedTestData };
```

> ⚠️ 实操时把既有 `index.js:389-426` 的 mock 数据数组与 `for` 循环完整粘贴进函数体（不删 1 条），保持种子数据契约不变。

- [ ] **Step 4: 重写 index.js 为路由分发**

把 `cloudfunctions/materialManager/index.js` 整个文件替换为：

```js
/**
 * 物料管理云函数（路由分发）
 */
const {
  cloud, getEffectiveOpenId, getUserByOpenId, canAccessMaterial,
} = require('./helpers');
const crud = require('./handlers/crud');
const stock = require('./handlers/stock');
const seed = require('./handlers/seed');
// const request = require('./handlers/request');  // Task 3 之后启用

const ROUTES = {
  // CRUD
  getMaterialByNumber: crud.getMaterialByNumber,
  getMaterialById: crud.getMaterialById,
  listMaterials: crud.listMaterials,
  addMaterial: crud.addMaterial,
  updateMaterial: crud.updateMaterial,
  deleteMaterial: crud.deleteMaterial,
  listRecords: crud.listRecords,
  getMaterialStats: crud.getMaterialStats,
  // Stock
  stockIn: stock.stockIn,
  stockOut: stock.stockOut,
  getWarnings: stock.getWarnings,
  // Seed
  seedTestData: seed.seedTestData,
  // Request actions（Task 3+ 启用，此处先列空位）
  // createStockOutRequest: ...
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) return { success: false, error: '无法获取微信身份' };

  console.log(`[MaterialManager] Action: ${action}, OpenID: ${openid}`);

  try {
    const user = await getUserByOpenId(openid);
    if (!user) return { success: false, error: '用户不存在' };

    if (!canAccessMaterial(user)) {
      return { success: false, error: '无权限访问物料管理' };
    }

    const handler = ROUTES[action];
    if (!handler) return { success: false, error: `未知操作: ${action}` };

    return await handler({ data, user, openid, event });
  } catch (error) {
    console.error('[MaterialManager] Error:', error);
    return { success: false, error: error.message };
  }
};
```

- [ ] **Step 5: 部署 + 回归既有功能**

部署云函数。在小程序里跑一遍既有功能（用管理员账号）：
- material/index Tab1 列表加载 ✓
- material/add 新增配件 ✓
- 配件详情扫码入库 ✓
- 库存预警过滤 ✓
- 工单完成时扣库存 ✓（找一条工单走完成流程）

任何一项失败 → 检查 ROUTES 映射或 handler 参数解构。

- [ ] **Step 6: 提交**

```bash
git add cloudfunctions/materialManager/handlers/ cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
refactor(materialManager): 拆分 handlers 模块（CRUD/Stock/Seed）

按 workOrderManager 模式把 800+ 行 index.js 拆为 handlers/，
index.js 改为路由分发表。逻辑零变更，为后续新增 6 个出库申请
action 让出空间。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: createStockOutRequest action

**Files:**
- Create: `cloudfunctions/materialManager/handlers/request.js`
- Modify: `cloudfunctions/materialManager/index.js`（ROUTES 表加映射）

**目标**：申请人提交出库申请单 → 写 material_requests(status=Pending) → 通知 1+5 角色用户。

- [ ] **Step 1: 创建 handlers/request.js（含 createStockOutRequest）**

新建文件：

```js
/**
 * 出库申请单 handlers
 */
const cloud = require('wx-server-sdk');
const {
  db, _, getNextId,
  canApproveStockOut, canRequestStockOut, canAccessMaterial,
} = require('../helpers');

/**
 * 生成 'CKSQ-YYYYMMDD-XXXX' 申请单业务编号
 */
async function generateRequestNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CKSQ-${dateStr}-`;
  const { total } = await db.collection('material_requests')
    .where({ request_number: db.RegExp({ regexp: `^${prefix}` }) })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

/**
 * 给所有 role_id IN [1,5] 且 active 的用户发通知（异步，主流程不等待）
 */
async function notifyApprovers(payload) {
  try {
    const { data: approvers } = await db.collection('users')
      .where({ role_id: _.in([1, 5]), active: true })
      .limit(100)
      .get();
    if (!approvers.length) {
      console.warn('[StockOutRequest] no approvers active, skip notify');
      return;
    }
    const receivers = approvers.map(u => u.user_id);
    await cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'send',
        receivers,
        template: 'stock_out_pending',
        data: payload,
      }
    });
  } catch (err) {
    console.error('[StockOutRequest] notify approvers fail', err);
  }
}

/**
 * 通知申请人审核结果
 */
async function notifyRequester(requesterUserId, template, payload) {
  try {
    await cloud.callFunction({
      name: 'sendNotification',
      data: {
        action: 'send',
        receivers: [requesterUserId],
        template,
        data: payload,
      }
    });
  } catch (err) {
    console.error('[StockOutRequest] notify requester fail', err);
  }
}

async function createStockOutRequest({ data, user }) {
  if (!canRequestStockOut(user)) return { success: false, error: '无权限提交出库申请' };

  const { material_id, requested_quantity, region, scene, remark = '' } = data;

  // 字段校验
  if (!material_id) return { success: false, error: '请选择物资' };
  const qty = Number(requested_quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 999999) {
    return { success: false, error: '申请数量需为 1-999999 的整数' };
  }
  if (!region || !scene) return { success: false, error: '区域和场景必填' };
  if (remark && remark.length > 200) return { success: false, error: '备注不能超过 200 字' };

  // 查物资
  const { data: mats } = await db.collection('materials').where({ material_id }).get();
  if (!mats.length) return { success: false, error: '配件不存在' };
  const material = mats[0];

  // 不在此处校验库存（pending 不扣库存，库存校验在 approve 时）
  // 但作前置友好提示：如果连申请数量都超库存，前端应已拦截；这里不重复

  const requestId = await getNextId('material_requests');
  const requestNumber = await generateRequestNumber();
  const now = new Date();

  await db.collection('material_requests').add({
    data: {
      request_id: requestId,
      request_number: requestNumber,
      // 物资快照
      material_id, material_name: material.name,
      material_number: material.material_number || '',
      material_image: (material.images && material.images[0]) || '',
      category: material.category || '',
      spec: material.spec || '',
      model: material.model || '',
      unit: material.unit || '',
      // 申请信息
      requester: { user_id: user.user_id, name: user.name, role_id: user.role_id },
      requested_quantity: qty,
      region, scene, remark,
      // 状态
      status: 'Pending',
      // 审核字段先 null
      reviewer: null, approved_quantity: null, out_record_id: null,
      reject_reason: null,
      // 时间字段
      created_at: now, updated_at: now,
      approved_at: null, rejected_at: null, cancelled_at: null,
    }
  });

  // 通知（不阻塞主流程）
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

module.exports = {
  createStockOutRequest,
  // 其他 action 在后续 Task 加入
};
```

- [ ] **Step 2: 在 index.js ROUTES 表挂载 + 启用 require**

定位 `cloudfunctions/materialManager/index.js`，把：

```js
// const request = require('./handlers/request');  // Task 3 之后启用
```

改为：

```js
const request = require('./handlers/request');
```

并在 ROUTES 对象内加：

```js
  // Request
  createStockOutRequest: request.createStockOutRequest,
```

放在 `seedTestData` 行之前。

- [ ] **Step 3: 部署 + 云端验证**

部署 materialManager。云开发 → 数据库 → 检查 `material_requests` 集合不存在也没关系（首次写入会自动创建）。

云开发 → 云函数 → materialManager → 测试 action `createStockOutRequest`，传：

```json
{
  "action": "createStockOutRequest",
  "data": {
    "material_id": <你环境里一个真实存在的 material_id>,
    "requested_quantity": 3,
    "region": "办公区",
    "scene": "日常办公",
    "remark": "test"
  }
}
```

预期返回 `{success:true, request_id:1, request_number:'CKSQ-20260427-0001', ...}`。
数据库 → material_requests 集合应自动创建并见到一条 status=Pending 的记录。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/handlers/request.js cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(material): + createStockOutRequest action（出库申请提交）

新建 handlers/request.js；写 material_requests(status=Pending)
+ 异步通知 1/5 角色审核人。物资快照 / 字段校验 / 编号生成
'CKSQ-YYYYMMDD-XXXX' 全套就位。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: approveStockOutRequest action（审核 = 出库，最复杂）

**Files:**
- Modify: `cloudfunctions/materialManager/handlers/request.js`（追加 action）
- Modify: `cloudfunctions/materialManager/index.js`（ROUTES 加映射）

**目标**：仓管员/管理员点"审核通过" → 校验状态=Pending、approved_quantity ≤ 申请且 ≤ 当前库存 → 原子条件更新 申请单 + 扣库存 + 写 material_records → 通知申请人。

- [ ] **Step 1: 在 handlers/request.js 追加函数**

在 `module.exports` 之前追加：

```js
/**
 * 生成 'CK-YYYYMMDD-XXXX' 出库流水编号
 */
async function generateOutRecordNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CK-${dateStr}-`;
  const { total } = await db.collection('material_records')
    .where({ record_number: db.RegExp({ regexp: `^${prefix}` }), type: 'out' })
    .count();
  return `${prefix}${String(total + 1).padStart(4, '0')}`;
}

async function approveStockOutRequest({ data, user }) {
  if (!canApproveStockOut(user)) return { success: false, error: '无权限审核出库' };

  const { request_id, approved_quantity } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };
  const aqty = Number(approved_quantity);
  if (!Number.isInteger(aqty) || aqty < 1) {
    return { success: false, error: '实际出库数量需为 ≥1 的整数' };
  }

  // 取单
  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];
  if (req.status !== 'Pending') return { success: false, error: '单据已被处理' };

  if (aqty > req.requested_quantity) {
    return { success: false, error: `实际出库数量不能超过申请数量 ${req.requested_quantity}` };
  }

  // 取最新库存
  const { data: mats } = await db.collection('materials').where({ material_id: req.material_id }).get();
  if (!mats.length) return { success: false, error: '配件已被删除' };
  const material = mats[0];
  if (material.stock < aqty) {
    return { success: false, error: `库存不足，当前库存: ${material.stock}` };
  }

  const now = new Date();
  const recordId = await getNextId('material_records');
  const recordNumber = await generateOutRecordNumber();

  // 原子条件更新申请单：where(request_id, status=Pending) 防并发
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

  // 扣库存 + 写流水（并行）
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
        request_id: req.request_id,           // 关联申请单
        region: req.region,
        scene: req.scene,
        remark: req.remark || '',
        created_at: now,
      }
    })
  ]);

  // 通知申请人
  notifyRequester(req.requester.user_id, 'stock_out_approved', {
    request_number: req.request_number,
    material_name: req.material_name,
    approved_quantity: aqty,
    reviewer_name: user.name,
  });

  return {
    success: true,
    record_id: recordId,
    record_number: recordNumber,
    message: '出库成功',
  };
}
```

- [ ] **Step 2: 更新 module.exports**

```js
module.exports = {
  createStockOutRequest,
  approveStockOutRequest,
};
```

- [ ] **Step 3: index.js ROUTES 加映射**

在 ROUTES 表 `createStockOutRequest` 之后加：

```js
  approveStockOutRequest: request.approveStockOutRequest,
```

- [ ] **Step 4: 部署 + 验证（云函数测试）**

部署 materialManager。

云开发 → 云函数测试 → 用 role_id=1 的 openid（管理员）调：

```json
{
  "action": "approveStockOutRequest",
  "data": {
    "request_id": <Task 3 创建的那个>,
    "approved_quantity": 2
  }
}
```

预期：
- 返回 `{success:true, record_id, record_number:'CK-20260427-0001'}`
- 数据库：material_requests 该单 status=Approved；materials 该件 stock 减少 2；material_records 新增一条 type=out，含 request_id 和 region/scene。

并发保护测试：紧接着再调一次同样参数，预期 `{success:false, error:'单据已被处理'}`（前一步 status 已变 Approved，先校验拦下）。

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/materialManager/handlers/request.js cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(material): + approveStockOutRequest action（审核=出库）

原子条件更新 (status=Pending → Approved) 防并发；扣库存 + 写
material_records type=out（含 request_id/region/scene）+ 通知申请人。
record_number 'CK-YYYYMMDD-XXXX'。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: rejectStockOutRequest action

**Files:**
- Modify: `cloudfunctions/materialManager/handlers/request.js`（追加）
- Modify: `cloudfunctions/materialManager/index.js`

- [ ] **Step 1: 在 request.js 追加 reject**

```js
async function rejectStockOutRequest({ data, user }) {
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

  // 取单仅为通知用
  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (reqs.length) {
    notifyRequester(reqs[0].requester.user_id, 'stock_out_rejected', {
      request_number: reqs[0].request_number,
      material_name: reqs[0].material_name,
      reject_reason,
      reviewer_name: user.name,
    });
  }

  return { success: true, message: '已驳回' };
}
```

更新 `module.exports` 加入 `rejectStockOutRequest`。

- [ ] **Step 2: index.js ROUTES 加映射**

```js
  rejectStockOutRequest: request.rejectStockOutRequest,
```

- [ ] **Step 3: 部署 + 验证**

云函数测试：用 role_id=1 调 reject 一条 Pending 单。预期 status → Rejected，reject_reason 写入。再调一次同单，预期"单据已被处理"。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/handlers/request.js cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(material): + rejectStockOutRequest action

原子条件更新 status=Rejected + 通知申请人；reject_reason 必填 ≤200 字。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: cancelStockOutRequest action

**Files:** 同 Task 5

- [ ] **Step 1: 追加 cancel**

```js
async function cancelStockOutRequest({ data, user }) {
  // 不查权限函数；只允许申请人本人撤回
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

更新 `module.exports`。

- [ ] **Step 2: index.js ROUTES**

```js
  cancelStockOutRequest: request.cancelStockOutRequest,
```

- [ ] **Step 3: 部署 + 验证**

测试：用申请人 openid 撤回自己的 Pending 单 ✓；用别人的 openid 撤回，预期"只能撤回自己提交的申请"。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/handlers/request.js cloudfunctions/materialManager/index.js
git commit -m "feat(material): + cancelStockOutRequest action（仅申请人本人，仅 Pending）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: listStockOutRequests action

**Files:** 同 Task 5

- [ ] **Step 1: 追加 list**

```js
async function listStockOutRequests({ data, user }) {
  if (!canAccessMaterial(user)) return { success: false, error: '无权限' };

  const {
    status, requester_user_id, material_id,
    region, scene, date_from, date_to, keyword,
    page = 1, pageSize = 20,
  } = data;

  const conditions = {};

  // 角色过滤：办美只能看自己的
  if (user.role_id === 4) {
    conditions['requester.user_id'] = user.user_id;
  } else if (requester_user_id) {
    conditions['requester.user_id'] = requester_user_id;
  }

  // 状态：单值或数组
  if (Array.isArray(status) && status.length) {
    conditions.status = _.in(status);
  } else if (typeof status === 'string' && status) {
    conditions.status = status;
  }

  if (material_id) conditions.material_id = material_id;
  if (region) conditions.region = region;
  if (scene) conditions.scene = scene;

  if (date_from || date_to) {
    const range = {};
    if (date_from) range.$gte = new Date(date_from);
    if (date_to) range.$lte = new Date(date_to);
    conditions.created_at = _.and(
      date_from ? _.gte(new Date(date_from)) : _.exists(true),
      date_to ? _.lte(new Date(date_to)) : _.exists(true),
    );
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

更新 `module.exports`。

- [ ] **Step 2: index.js ROUTES**

```js
  listStockOutRequests: request.listStockOutRequests,
```

- [ ] **Step 3: 部署 + 验证**

云函数测试：用 role_id=4（办美）调 listStockOutRequests，不传 status，预期只返回该用户提交的单子。
用 role_id=1（管理员）调，预期返回全部。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/handlers/request.js cloudfunctions/materialManager/index.js
git commit -m "feat(material): + listStockOutRequests action（按角色+多条件筛选）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: getStockOutRequest action

**Files:** 同 Task 5

- [ ] **Step 1: 追加 get**

```js
async function getStockOutRequest({ data, user }) {
  if (!canAccessMaterial(user)) return { success: false, error: '无权限' };

  const { request_id } = data;
  if (!request_id) return { success: false, error: '缺少 request_id' };

  const { data: reqs } = await db.collection('material_requests').where({ request_id }).get();
  if (!reqs.length) return { success: false, error: '申请单不存在' };
  const req = reqs[0];

  // 办美只能看自己的
  if (user.role_id === 4 && req.requester.user_id !== user.user_id) {
    return { success: false, error: '无权限查看' };
  }

  return { success: true, request: req };
}
```

更新 `module.exports`：

```js
module.exports = {
  createStockOutRequest,
  approveStockOutRequest,
  rejectStockOutRequest,
  cancelStockOutRequest,
  listStockOutRequests,
  getStockOutRequest,
};
```

- [ ] **Step 2: index.js ROUTES**

```js
  getStockOutRequest: request.getStockOutRequest,
```

- [ ] **Step 3: 部署 + 验证**

云函数测试：办美 openid 取自己的单 ✓；取别人的单，预期"无权限查看"。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/handlers/request.js cloudfunctions/materialManager/index.js
git commit -m "feat(material): + getStockOutRequest action（详情，含权限过滤）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: dictionaryManager 收紧 stock_out_* 写权限到 role_id=1

**Files:**
- Modify: `cloudfunctions/dictionaryManager/index.js`

**目标**：`stock_out_region` / `stock_out_scene` 的 create/update/delete 严格仅放给管理员（role_id=1），区别于 `material_category` 字典的 canManageMaterial 例外。

- [ ] **Step 1: 检查现有 dictionaryManager 权限分支**

读 `cloudfunctions/dictionaryManager/index.js`，定位 admin 写操作（create/update/delete）的权限检查。spec §6.2 说"在该云函数内复制一份 role_id 判断"。

按既有 material_category 例外的写法，在写权限校验位置加分支：

```js
// 伪代码，按真实代码结构调整
const STOCK_OUT_DICT_KEYS = ['stock_out_region', 'stock_out_scene'];

// 在写操作权限校验处：
if (STOCK_OUT_DICT_KEYS.includes(dict_key)) {
  // 仅管理员可写
  if (!user || user.role_id !== 1 || user.active === false) {
    return { success: false, error: '区域/场景字典仅管理员可配置' };
  }
} else if (dict_key === 'material_category') {
  // 既有 material_category 例外：canManageMaterial 通过即可
  if (!user || ![1, 2, 5].includes(user.role_id) || user.active === false) {
    return { success: false, error: '无权限管理分类' };
  }
} else {
  // 其他字典：默认管理员/经理（既有 admin 校验逻辑保留）
}
```

> **实操提示**：先 `Read` 一遍 `cloudfunctions/dictionaryManager/index.js` 当前的写权限分支结构（既有 material_category 例外应该已经在那），照样式新增 stock_out_* 例外即可。**注意 material_category 的 canManageMaterial 角色集合也从 [1,2,4] 改为 [1,2,5]**，与 Task 1 同步。

- [ ] **Step 2: 部署 dictionaryManager**

部署云函数。

- [ ] **Step 3: 验证**

云函数测试：用 role_id=2（经理）调 dictionaryManager 的 create action，dict_key='stock_out_region'，预期"仅管理员可配置"。
用 role_id=1（管理员）调，预期成功。
用 role_id=2 调 dict_key='material_category' 的 update，预期成功（既有逻辑，确认未误伤）。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/dictionaryManager/index.js
git commit -m "$(cat <<'EOF'
feat(dictionary): stock_out_region/scene 字典严格仅放给管理员

material_category 的写权限同步从 [1,2,4] 调到 [1,2,5]
（与 canManageMaterial 改动对齐）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 云端配置 — 新增 roles 集合 role_id=5 + 通知模板 + 字典 seed

**目标**：手动在云端做不能用代码自动化的初始化工作。**本 Task 没有代码改动，仅检查清单**。

> ⚠️ 这一步必须有云开发后台权限的人完成。如果当前 agent 没有云后台访问能力，可由用户手动完成后再继续。

- [ ] **Step 1: 数据库 → 集合 `roles` 新增一条**

```json
{
  "role_id": 5,
  "name": "仓管员",
  "module_permissions": ["submit_work_orders", "view_analytics"],
  "active": true
}
```

> module_permissions 按你公司实际需要勾选；本 spec 不强制。最少先放 submit_work_orders（参考办美权限），后续 admin 角色管理页可调整。

- [ ] **Step 2: 数据库 → 集合 `users` 至少创建 1 个 role_id=5 的测试用户**

或者把现有某个测试 openid 用户的 role_id 改为 5，便于后续端到端验证。

- [ ] **Step 3: 通知模板配置（如项目 sendNotification 需要预注册模板）**

如 `sendNotification` 实现里有 templates 字典或 `templates` 集合，新增 3 项：

| template key | 标题/示例 |
|---|---|
| `stock_out_pending` | 「{requester_name} 申请出库 {material_name} × {quantity}（{region}），待审核」|
| `stock_out_approved` | 「您的出库申请 {request_number}（{material_name}）已通过，实际出库 {approved_quantity}」|
| `stock_out_rejected` | 「您的出库申请 {request_number}（{material_name}）被驳回：{reject_reason}」|

如 sendNotification 是模板透传（无预注册），跳过此步。

- [ ] **Step 4: 字典 seed 验证（可选）**

不在云端预 seed `stock_out_region` / `stock_out_scene`，留给前端首次进 stock-out-form 自动 seed（与 material_category 处理一致）。这一步只是确认云端 dictionaries 集合无遗留同名 key 即可。

- [ ] **Step 5: commit 一份配置说明（如有 ops 文档）**

> 本 Task 无代码改动，无需 commit。可以在 tasks/todo.md 或 ops 笔记里登记本步操作时间，便于追踪。

---

## Task 11: 前端 constants.js 新增 ROLES.WAREHOUSE_KEEPER + 出库状态常量

**Files:**
- Modify: `miniprogram/utils/constants.js:22-71`

- [ ] **Step 1: 修改 ROLES + ROLE_DISPLAY_NAMES**

定位 `const ROLES = {...}`，加一行：

```js
const ROLES = {
  ADMIN: 1,
  PROPERTY_MANAGER: 2,
  MAINTENANCE_STAFF: 3,
  PROPERTY_STAFF: 4,
  WAREHOUSE_KEEPER: 5,         // 新增：仓管员
};
```

定位 `const ROLE_DISPLAY_NAMES = {...}`，加 `5: '仓管员',`：

```js
const ROLE_DISPLAY_NAMES = {
  1: '系统管理员',
  2: '行政经理',
  3: '维修员',
  4: '办美员工',
  5: '仓管员',
};
```

- [ ] **Step 2: 新增出库状态常量**

在文件其他常量定义附近（如 STATUS_DISPLAY_NAMES 之后）新增：

```js
// Stock-Out Request Status
const STOCK_OUT_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const STOCK_OUT_STATUS_DISPLAY_NAMES = {
  Pending: '待审核',
  Approved: '已出库',
  Rejected: '已驳回',
  Cancelled: '已撤回',
};

const STOCK_OUT_STATUS_COLORS = {
  Pending: '#F59E0B',     // amber
  Approved: '#10B981',    // emerald
  Rejected: '#DC2626',    // red
  Cancelled: '#6B7280',   // gray
};
```

- [ ] **Step 3: 更新 module.exports**

定位文件底部 `module.exports = { ... ROLES, ... }`，加入新 3 个常量：

```js
module.exports = {
  // ...既有...
  ROLES,
  ROLE_DISPLAY_NAMES,
  STOCK_OUT_STATUS,
  STOCK_OUT_STATUS_DISPLAY_NAMES,
  STOCK_OUT_STATUS_COLORS,
  // ...
};
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/utils/constants.js
git commit -m "feat(constants): + ROLES.WAREHOUSE_KEEPER (5) + STOCK_OUT_STATUS

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: materialService.js 新增 6 个出库申请方法

**Files:**
- Modify: `miniprogram/services/materialService.js`

- [ ] **Step 1: 在文件 module.exports 之前追加 6 个方法**

```js
/**
 * 按 material_id 查找配件（出库审核取最新库存）
 */
const getMaterialById = async (material_id) => {
  return callCloudSilent('materialManager', {
    action: 'getMaterialById',
    data: { material_id }
  });
};

/**
 * 提交出库申请
 */
const createStockOutRequest = async (params) => {
  return callCloud('materialManager', {
    action: 'createStockOutRequest',
    data: params,
  }, { loadingText: '提交中...' });
};

/**
 * 审核通过出库（=执行出库）
 */
const approveStockOutRequest = async (request_id, approved_quantity) => {
  return callCloud('materialManager', {
    action: 'approveStockOutRequest',
    data: { request_id, approved_quantity },
  }, { loadingText: '审核中...' });
};

/**
 * 驳回出库申请
 */
const rejectStockOutRequest = async (request_id, reject_reason) => {
  return callCloud('materialManager', {
    action: 'rejectStockOutRequest',
    data: { request_id, reject_reason },
  }, { loadingText: '提交中...' });
};

/**
 * 撤回自己的出库申请
 */
const cancelStockOutRequest = async (request_id) => {
  return callCloud('materialManager', {
    action: 'cancelStockOutRequest',
    data: { request_id },
  }, { loadingText: '撤回中...' });
};

/**
 * 出库申请列表（多条件 + 分页）
 */
const listStockOutRequests = async (params = {}) => {
  return callCloudSilent('materialManager', {
    action: 'listStockOutRequests',
    data: { page: 1, pageSize: 20, ...params },
  });
};

/**
 * 出库申请详情
 */
const getStockOutRequest = async (request_id) => {
  return callCloudSilent('materialManager', {
    action: 'getStockOutRequest',
    data: { request_id },
  });
};
```

- [ ] **Step 2: 更新 module.exports**

```js
module.exports = {
  // 既有...
  listMaterials, addMaterial, updateMaterial, deleteMaterial,
  stockIn, stockOut, getMaterialByNumber,
  listRecords, getWarnings, getMaterialStats, getMaterialRecords,
  // 新增
  getMaterialById,
  createStockOutRequest,
  approveStockOutRequest,
  rejectStockOutRequest,
  cancelStockOutRequest,
  listStockOutRequests,
  getStockOutRequest,
};
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/services/materialService.js
git commit -m "feat(materialService): + 6 个出库申请方法（create/approve/reject/cancel/list/get）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: stock-out-form 页面骨架 + app.json 注册

**Files:**
- Create: `miniprogram/pages/material/stock-out-form/index.js`
- Create: `miniprogram/pages/material/stock-out-form/index.wxml`
- Create: `miniprogram/pages/material/stock-out-form/index.wxss`
- Create: `miniprogram/pages/material/stock-out-form/index.json`
- Modify: `miniprogram/app.json`

**目标**：可打开的空表单页骨架 + 区域/场景字典加载（含首次自动 seed）。物资选择和提交逻辑放 Task 14。

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "出库申请",
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index"
  }
}
```

- [ ] **Step 2: 创建 index.wxml（骨架）**

```xml
<view class="form-page">
  <view class="form-section">
    <!-- 物资选择 -->
    <view class="form-row {{form.material_id ? '' : 'form-row-empty'}}" bindtap="onPickMaterial">
      <text class="form-label">物资 <text class="required">*</text></text>
      <view class="form-value form-value-pick">
        <text wx:if="{{form.material_id}}">{{form.material_name}}</text>
        <text wx:else class="form-placeholder">请选择物资</text>
        <van-icon name="arrow" size="14px" color="#a3a3a3" />
      </view>
    </view>

    <view wx:if="{{form.material_id}}" class="material-snapshot">
      <text class="snap-meta">编号 {{form.material_number || '-'}}</text>
      <text class="snap-meta">规格 {{form.spec || '-'}}</text>
      <text class="snap-meta">单位 {{form.unit || '-'}}</text>
      <text class="snap-meta">当前库存 {{form.current_stock}}</text>
    </view>

    <!-- 申请数量 -->
    <view class="form-row">
      <text class="form-label">申请数量 <text class="required">*</text></text>
      <input
        class="form-input"
        type="digit"
        placeholder="请输入数量"
        value="{{form.requested_quantity}}"
        bindinput="onQuantityInput"
      />
    </view>

    <!-- 区域 -->
    <picker mode="selector" range="{{regionOptions}}" range-key="label" bindchange="onRegionChange">
      <view class="form-row">
        <text class="form-label">使用区域 <text class="required">*</text></text>
        <view class="form-value">
          <text wx:if="{{form.region}}">{{form.region}}</text>
          <text wx:else class="form-placeholder">请选择区域</text>
          <van-icon name="arrow" size="14px" color="#a3a3a3" />
        </view>
      </view>
    </picker>

    <!-- 场景 -->
    <picker mode="selector" range="{{sceneOptions}}" range-key="label" bindchange="onSceneChange">
      <view class="form-row">
        <text class="form-label">使用场景 <text class="required">*</text></text>
        <view class="form-value">
          <text wx:if="{{form.scene}}">{{form.scene}}</text>
          <text wx:else class="form-placeholder">请选择场景</text>
          <van-icon name="arrow" size="14px" color="#a3a3a3" />
        </view>
      </view>
    </picker>

    <!-- 备注 -->
    <view class="form-row form-row-textarea">
      <text class="form-label">备注</text>
      <textarea
        class="form-textarea"
        placeholder="选填，≤200 字"
        maxlength="200"
        value="{{form.remark}}"
        bindinput="onRemarkInput"
      />
    </view>
  </view>

  <view class="form-actions">
    <button class="btn-submit" disabled="{{!canSubmit}}" loading="{{submitting}}" bindtap="onSubmit">
      提交申请
    </button>
  </view>
</view>
```

- [ ] **Step 3: 创建 index.wxss（基础样式）**

```css
.form-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding-bottom: 200rpx;
}
.form-section {
  margin: 24rpx 24rpx 0;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.form-row {
  display: flex;
  align-items: center;
  padding: 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  min-height: 100rpx;
}
.form-row:last-child { border-bottom: none; }
.form-row-textarea {
  align-items: flex-start;
  flex-direction: column;
}
.form-row-textarea .form-label { margin-bottom: 16rpx; }
.form-label {
  font-size: 28rpx;
  color: #1d1d1f;
  width: 200rpx;
  flex-shrink: 0;
}
.required { color: #DC2626; }
.form-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 28rpx;
  color: #1d1d1f;
}
.form-value-pick { cursor: pointer; }
.form-placeholder { color: #a3a3a3; font-size: 28rpx; }
.form-input {
  flex: 1;
  font-size: 28rpx;
  color: #1d1d1f;
}
.form-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #1d1d1f;
  line-height: 1.5;
}
.material-snapshot {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 16rpx 24rpx 24rpx;
  background: #fafafc;
  border-bottom: 1rpx solid #f0f0f0;
}
.snap-meta {
  font-size: 24rpx;
  color: #7a7a7a;
}
.form-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx;
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
}
.btn-submit {
  width: 100%;
  height: 88rpx;
  background: #0066cc;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
}
.btn-submit[disabled] {
  background: #d2d2d7;
  color: #fff;
}
```

- [ ] **Step 4: 创建 index.js（含字典加载与 seed）**

```js
const dictionary = require('../../../services/dictionary');
const dictionaryAdmin = require('../../../services/dictionaryAdmin');
const materialService = require('../../../services/materialService');

const DEFAULT_REGIONS = [
  '办公区', '会议室', '接待区', '茶水间', '卫生间',
  '餐厅', '前台', '电梯间', '楼梯间', '储物间',
  '室外公共区', '通用',
];
const DEFAULT_SCENES = [
  '日常办公', '会议接待', '客户接待', '卫生清洁',
  '设备维护', '活动布置', '突发事件', '其他',
];

Page({
  data: {
    form: {
      material_id: 0,
      material_name: '',
      material_number: '',
      spec: '',
      unit: '',
      current_stock: 0,
      requested_quantity: '',
      region: '',
      scene: '',
      remark: '',
    },
    regionOptions: [],
    sceneOptions: [],
    submitting: false,
    canSubmit: false,
  },

  onLoad() {
    this._ensureDicts();
  },

  async _ensureDicts() {
    try {
      const [regionRes, sceneRes] = await Promise.all([
        dictionary.getOptions('stock_out_region'),
        dictionary.getOptions('stock_out_scene'),
      ]);
      let regionOptions = (regionRes.options || []).filter(o => o.enabled !== false);
      let sceneOptions = (sceneRes.options || []).filter(o => o.enabled !== false);

      if (!regionOptions.length) {
        await this._seedDict('stock_out_region', '使用区域', DEFAULT_REGIONS);
        regionOptions = DEFAULT_REGIONS.map((label, i) => ({ value: label, label, sort: i, enabled: true }));
      }
      if (!sceneOptions.length) {
        await this._seedDict('stock_out_scene', '使用场景', DEFAULT_SCENES);
        sceneOptions = DEFAULT_SCENES.map((label, i) => ({ value: label, label, sort: i, enabled: true }));
      }

      this.setData({ regionOptions, sceneOptions });
    } catch (err) {
      console.error('[stock-out-form] dict load fail', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  async _seedDict(dict_key, dict_name, labels) {
    const items = labels.map((label, i) => ({ value: label, label, sort: i, enabled: true }));
    const res = await dictionaryAdmin.create({ dict_key, dict_name, items });
    if (!res.success) throw new Error(res.error || 'seed dict fail');
    await dictionary.refreshCache(dict_key);
    wx.showToast({ title: '已创建默认选项', icon: 'success' });
  },

  onPickMaterial() {
    // Task 14 实现
    wx.showToast({ title: '物资选择待实现', icon: 'none' });
  },

  onQuantityInput(e) {
    this.setData({ 'form.requested_quantity': e.detail.value }, this._refreshSubmit);
  },

  onRegionChange(e) {
    const opt = this.data.regionOptions[e.detail.value];
    if (opt) this.setData({ 'form.region': opt.label }, this._refreshSubmit);
  },

  onSceneChange(e) {
    const opt = this.data.sceneOptions[e.detail.value];
    if (opt) this.setData({ 'form.scene': opt.label }, this._refreshSubmit);
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value });
  },

  _refreshSubmit() {
    const { form } = this.data;
    const qty = Number(form.requested_quantity);
    const ok = !!form.material_id
      && Number.isInteger(qty) && qty >= 1 && qty <= 999999
      && qty <= form.current_stock
      && !!form.region && !!form.scene;
    this.setData({ canSubmit: ok });
  },

  onSubmit() {
    // Task 14 实现
    wx.showToast({ title: '提交逻辑待实现', icon: 'none' });
  },
});
```

- [ ] **Step 5: app.json 加路径**

打开 `miniprogram/app.json`，在 `pages` 数组里添加：

```json
"pages/material/stock-out-form/index"
```

放在 `pages/material/stock-in-form/index` 附近以保持模块就近。

- [ ] **Step 6: 验证骨架**

微信开发者工具 → 编译运行 → 控制台执行 `wx.navigateTo({url:'/pages/material/stock-out-form/index'})`：
- 页面能打开
- 区域/场景下拉点击能弹出 12/8 项
- 物资选择 tap 弹"待实现"
- 提交按钮始终 disabled

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/stock-out-form/ miniprogram/app.json
git commit -m "feat(material): stock-out-form 骨架 + 区域/场景字典自动 seed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: stock-out-form 物资选择 + 表单提交逻辑

**Files:**
- Modify: `miniprogram/pages/material/stock-out-form/index.js`
- Modify: `miniprogram/pages/material/stock-out-form/index.wxml`（弹窗）
- Modify: `miniprogram/pages/material/stock-out-form/index.wxss`（弹窗样式）

**目标**：物资搜索 + 分类筛选 picker（底部抽屉），选中后带入快照；提交逻辑接通云函数。

- [ ] **Step 1: index.wxml 追加底部物资选择抽屉**

在 `</view>`（form-page 闭合）之前添加：

```xml
  <!-- 物资选择抽屉 -->
  <view wx:if="{{showPicker}}" class="picker-mask" bindtap="onClosePicker"></view>
  <view class="picker-sheet {{showPicker ? 'picker-sheet-open' : ''}}">
    <view class="picker-header">
      <text class="picker-title">选择物资</text>
      <view class="picker-close" bindtap="onClosePicker">×</view>
    </view>
    <view class="picker-search">
      <input
        class="picker-search-input"
        placeholder="搜索名称或编号"
        value="{{pickerKeyword}}"
        bindinput="onPickerSearchInput"
        confirm-type="search"
        bindconfirm="onPickerSearch"
      />
    </view>
    <scroll-view scroll-y class="picker-list">
      <view
        wx:for="{{pickerList}}"
        wx:key="material_id"
        class="picker-item {{item.stock <= 0 ? 'picker-item-disabled' : ''}}"
        data-mat="{{item}}"
        bindtap="onSelectMaterial"
      >
        <image class="picker-img" src="{{item.images[0] || '/images/placeholder.png'}}" mode="aspectFill" />
        <view class="picker-info">
          <text class="picker-name">{{item.name}} {{item.material_number || ''}}</text>
          <text class="picker-meta">{{item.category || '-'}} · {{item.spec || '-'}}</text>
        </view>
        <view class="picker-stock {{item.stock <= 0 ? 'stock-out' : ''}}">
          库存 {{item.stock}}
        </view>
      </view>
      <view wx:if="{{!pickerList.length && !pickerLoading}}" class="picker-empty">未找到匹配物资</view>
      <view wx:if="{{pickerLoading}}" class="picker-empty">加载中...</view>
    </scroll-view>
  </view>
```

- [ ] **Step 2: index.wxss 追加抽屉样式**

```css
.picker-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 100;
}
.picker-sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  z-index: 101;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;
}
.picker-sheet-open { transform: translateY(0); }
.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.picker-title { font-size: 32rpx; font-weight: 600; color: #1d1d1f; }
.picker-close { font-size: 48rpx; color: #7a7a7a; line-height: 1; padding: 0 16rpx; }
.picker-search {
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.picker-search-input {
  height: 72rpx;
  background: #f5f5f7;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1d1d1f;
}
.picker-list { flex: 1; }
.picker-item {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  gap: 16rpx;
}
.picker-item-disabled { opacity: 0.5; }
.picker-img {
  width: 96rpx; height: 96rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
}
.picker-info { flex: 1; min-width: 0; }
.picker-name {
  display: block;
  font-size: 28rpx;
  color: #1d1d1f;
  margin-bottom: 8rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.picker-meta {
  font-size: 24rpx;
  color: #7a7a7a;
}
.picker-stock {
  font-size: 28rpx;
  color: #10B981;
  font-weight: 600;
}
.stock-out { color: #DC2626; }
.picker-empty {
  text-align: center;
  padding: 80rpx 0;
  color: #a3a3a3;
  font-size: 28rpx;
}
```

- [ ] **Step 3: index.js 实现物资选择 + 提交**

把既有 `onPickMaterial / onSubmit` 替换为完整实现，并补 picker 相关 data 与方法：

在 `data` 中新增：

```js
    showPicker: false,
    pickerKeyword: '',
    pickerList: [],
    pickerLoading: false,
```

替换 `onPickMaterial` 和 `onSubmit`：

```js
  onPickMaterial() {
    this.setData({ showPicker: true, pickerKeyword: '' });
    this._loadPickerList('');
  },

  onClosePicker() {
    this.setData({ showPicker: false });
  },

  onPickerSearchInput(e) {
    this.setData({ pickerKeyword: e.detail.value });
  },

  async onPickerSearch() {
    await this._loadPickerList(this.data.pickerKeyword);
  },

  async _loadPickerList(keyword) {
    this.setData({ pickerLoading: true });
    const res = await materialService.listMaterials(keyword || '', 1, 50);
    this.setData({
      pickerList: (res && res.success) ? res.materials : [],
      pickerLoading: false,
    });
  },

  onSelectMaterial(e) {
    const m = e.currentTarget.dataset.mat;
    if (!m || m.stock <= 0) {
      wx.showToast({ title: '库存为 0，无法申请', icon: 'none' });
      return;
    }
    this.setData({
      'form.material_id': m.material_id,
      'form.material_name': m.name,
      'form.material_number': m.material_number || '',
      'form.spec': m.spec || '',
      'form.unit': m.unit || '',
      'form.current_stock': m.stock,
      showPicker: false,
    }, this._refreshSubmit);
  },

  async onSubmit() {
    if (!this.data.canSubmit || this.data.submitting) return;

    const { form } = this.data;
    const qty = Number(form.requested_quantity);

    // 二次校验
    if (qty > form.current_stock) {
      wx.showToast({ title: `库存仅 ${form.current_stock}，请减少申请量`, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const res = await materialService.createStockOutRequest({
      material_id: form.material_id,
      requested_quantity: qty,
      region: form.region,
      scene: form.scene,
      remark: form.remark || '',
    });
    this.setData({ submitting: false });

    if (res && res.success) {
      wx.showToast({ title: '已提交', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    }
  },
```

- [ ] **Step 4: 验证**

模拟器：
- 进 stock-out-form → 点物资行 → 抽屉弹出 → 搜索关键词 → 列表过滤
- 选库存 0 的物资 → toast 提示
- 选有库存的 → 带入快照 + 库存数显示
- 改数量、选区域、选场景 → 提交按钮亮起
- 数量超库存 → 按钮 disabled / 提交时拦截
- 提交成功 → toast → 返回；material_requests 集合多一条 Pending 单

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/stock-out-form/
git commit -m "feat(material): stock-out-form 物资选择抽屉 + 提交逻辑接通

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: stock-out-detail 页面骨架 + 详情渲染 + 状态时间线

**Files:**
- Create: `miniprogram/pages/material/stock-out-detail/index.{js,wxml,wxss,json}`
- Modify: `miniprogram/app.json`

**目标**：可打开的详情页，展示申请单全字段 + 状态时间线（提交/审核/驳回/撤回时间）。操作按钮在 Task 16 实现。

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "出库申请详情",
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index"
  }
}
```

- [ ] **Step 2: 创建 index.wxml**

```xml
<view class="detail-page">
  <view wx:if="{{loading}}" class="loading">加载中...</view>

  <block wx:elif="{{request}}">
    <!-- 状态横幅 -->
    <view class="status-banner status-{{request.status}}">
      <text class="status-text">{{statusText}}</text>
      <text class="status-num">单号 {{request.request_number}}</text>
    </view>

    <!-- 物资 -->
    <view class="card">
      <view class="card-row">
        <image class="card-img" src="{{request.material_image || '/images/placeholder.png'}}" mode="aspectFill" />
        <view class="card-info">
          <text class="card-title">{{request.material_name}}</text>
          <text class="card-meta">编号 {{request.material_number || '-'}}</text>
          <text class="card-meta">规格 {{request.spec || '-'}} · 单位 {{request.unit || '-'}}</text>
        </view>
      </view>
    </view>

    <!-- 申请信息 -->
    <view class="card">
      <view class="row"><text class="row-key">申请数量</text><text class="row-val">{{request.requested_quantity}}</text></view>
      <view wx:if="{{request.approved_quantity}}" class="row"><text class="row-key">实际出库</text><text class="row-val highlight">{{request.approved_quantity}}</text></view>
      <view class="row"><text class="row-key">使用区域</text><text class="row-val">{{request.region}}</text></view>
      <view class="row"><text class="row-key">使用场景</text><text class="row-val">{{request.scene}}</text></view>
      <view class="row"><text class="row-key">申请人</text><text class="row-val">{{request.requester.name}}</text></view>
      <view wx:if="{{request.remark}}" class="row row-multi"><text class="row-key">备注</text><text class="row-val">{{request.remark}}</text></view>
    </view>

    <!-- 审核结果 -->
    <view wx:if="{{request.status === 'Approved' || request.status === 'Rejected'}}" class="card">
      <view class="row"><text class="row-key">审核人</text><text class="row-val">{{request.reviewer.name}}</text></view>
      <view wx:if="{{request.status === 'Rejected'}}" class="row row-multi"><text class="row-key">驳回原因</text><text class="row-val danger">{{request.reject_reason}}</text></view>
    </view>

    <!-- 状态时间线 -->
    <view class="card">
      <view class="timeline">
        <view class="tl-item tl-done">
          <view class="tl-dot"></view>
          <view class="tl-body">
            <text class="tl-title">提交申请</text>
            <text class="tl-time">{{createdText}}</text>
          </view>
        </view>
        <view wx:if="{{request.status === 'Approved'}}" class="tl-item tl-done">
          <view class="tl-dot"></view>
          <view class="tl-body">
            <text class="tl-title">审核通过 · 已出库</text>
            <text class="tl-time">{{approvedText}}</text>
          </view>
        </view>
        <view wx:elif="{{request.status === 'Rejected'}}" class="tl-item tl-rejected">
          <view class="tl-dot"></view>
          <view class="tl-body">
            <text class="tl-title">已驳回</text>
            <text class="tl-time">{{rejectedText}}</text>
          </view>
        </view>
        <view wx:elif="{{request.status === 'Cancelled'}}" class="tl-item tl-cancelled">
          <view class="tl-dot"></view>
          <view class="tl-body">
            <text class="tl-title">已撤回</text>
            <text class="tl-time">{{cancelledText}}</text>
          </view>
        </view>
        <view wx:else class="tl-item tl-pending">
          <view class="tl-dot"></view>
          <view class="tl-body">
            <text class="tl-title">等待审核</text>
          </view>
        </view>
      </view>
    </view>
  </block>

  <view wx:elif="{{!loading && !request}}" class="empty">
    <text>申请单不存在或无权限查看</text>
    <button class="btn-back" bindtap="onBack">返回</button>
  </view>

  <!-- 操作按钮（Task 16 接入） -->
  <view wx:if="{{showActions}}" class="actions-bar">
    <button wx:if="{{canCancel}}" class="action-btn action-btn-secondary" bindtap="onCancel">撤回</button>
    <button wx:if="{{canApprove}}" class="action-btn action-btn-danger" bindtap="onReject">驳回</button>
    <button wx:if="{{canApprove}}" class="action-btn action-btn-primary" bindtap="onApprove">审核通过</button>
  </view>
</view>
```

- [ ] **Step 3: 创建 index.wxss**

```css
.detail-page { min-height: 100vh; background: #f5f5f7; padding-bottom: 200rpx; }
.loading, .empty {
  padding: 200rpx 24rpx;
  text-align: center;
  color: #7a7a7a;
}
.status-banner {
  margin: 24rpx 24rpx 0;
  padding: 32rpx 24rpx;
  border-radius: 16rpx;
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.status-Pending { background: #F59E0B; }
.status-Approved { background: #10B981; }
.status-Rejected { background: #DC2626; }
.status-Cancelled { background: #6B7280; }
.status-text { font-size: 36rpx; font-weight: 600; }
.status-num { font-size: 24rpx; opacity: 0.9; }
.card {
  margin: 24rpx 24rpx 0;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx 24rpx;
}
.card-row {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 0;
}
.card-img { width: 160rpx; height: 160rpx; border-radius: 12rpx; }
.card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.card-title { font-size: 32rpx; font-weight: 600; color: #1d1d1f; }
.card-meta { font-size: 26rpx; color: #7a7a7a; }
.row {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
.row:last-child { border-bottom: none; }
.row-multi { flex-direction: column; gap: 12rpx; }
.row-key { font-size: 28rpx; color: #7a7a7a; }
.row-val { font-size: 28rpx; color: #1d1d1f; }
.row-val.highlight { color: #10B981; font-weight: 600; }
.row-val.danger { color: #DC2626; }
.timeline { padding: 24rpx 0; }
.tl-item { display: flex; gap: 24rpx; padding: 16rpx 0; align-items: flex-start; }
.tl-dot {
  width: 16rpx; height: 16rpx;
  border-radius: 50%;
  margin-top: 12rpx;
}
.tl-done .tl-dot { background: #10B981; }
.tl-rejected .tl-dot { background: #DC2626; }
.tl-cancelled .tl-dot { background: #6B7280; }
.tl-pending .tl-dot { background: #F59E0B; }
.tl-body { display: flex; flex-direction: column; gap: 4rpx; }
.tl-title { font-size: 28rpx; color: #1d1d1f; }
.tl-time { font-size: 24rpx; color: #7a7a7a; }
.actions-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
}
.action-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
}
.action-btn-primary { background: #0066cc; color: #fff; }
.action-btn-secondary { background: #f5f5f7; color: #1d1d1f; }
.action-btn-danger { background: #fff; color: #DC2626; border: 1rpx solid #DC2626; }
.btn-back { margin-top: 32rpx; background: #0066cc; color: #fff; }
```

- [ ] **Step 4: 创建 index.js（详情加载 + 状态文案 + 时间格式化）**

```js
const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, STOCK_OUT_STATUS_DISPLAY_NAMES } = require('../../../utils/constants');

function fmt(d) {
  if (!d) return '';
  const x = new Date(d);
  const Y = x.getFullYear();
  const M = String(x.getMonth() + 1).padStart(2, '0');
  const D = String(x.getDate()).padStart(2, '0');
  const h = String(x.getHours()).padStart(2, '0');
  const m = String(x.getMinutes()).padStart(2, '0');
  return `${Y}/${M}/${D} ${h}:${m}`;
}

Page({
  data: {
    requestId: 0,
    request: null,
    loading: true,
    statusText: '',
    createdText: '',
    approvedText: '',
    rejectedText: '',
    cancelledText: '',
    showActions: false,
    canCancel: false,
    canApprove: false,
  },

  onLoad(query) {
    const id = parseInt(query.request_id, 10);
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    this.setData({ requestId: id });
    this._load();
  },

  onShow() {
    if (this.data.requestId) this._load();
  },

  async _load() {
    this.setData({ loading: true });
    const res = await materialService.getStockOutRequest(this.data.requestId);
    if (!res || !res.success) {
      this.setData({ loading: false, request: null });
      return;
    }
    const request = res.request;
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const isMine = request.requester && request.requester.user_id === userInfo.user_id;
    const canApproveRole = userInfo && [1, 5].includes(userInfo.role_id);

    this.setData({
      request,
      loading: false,
      statusText: STOCK_OUT_STATUS_DISPLAY_NAMES[request.status] || request.status,
      createdText: fmt(request.created_at),
      approvedText: fmt(request.approved_at),
      rejectedText: fmt(request.rejected_at),
      cancelledText: fmt(request.cancelled_at),
      canCancel: isMine && request.status === 'Pending',
      canApprove: canApproveRole && request.status === 'Pending',
      showActions: (isMine && request.status === 'Pending')
                || (canApproveRole && request.status === 'Pending'),
    });
  },

  onBack() {
    wx.navigateBack();
  },

  // Task 16 接入
  onCancel() {},
  onApprove() {},
  onReject() {},
});
```

- [ ] **Step 5: app.json 加路径**

```json
"pages/material/stock-out-detail/index"
```

- [ ] **Step 6: 验证**

模拟器：手动跳 `/pages/material/stock-out-detail/index?request_id=<之前测试创建的 id>`：
- 详情字段显示正确
- 状态横幅颜色对应
- 时间线渲染对应状态
- 申请人本人 + Pending 看到"撤回"按钮
- 仓管员/管理员 + Pending 看到"审核通过"+"驳回"
- 经理打开 → 没有任何按钮
- 缺 query 时提示参数错误

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/stock-out-detail/ miniprogram/app.json
git commit -m "feat(material): stock-out-detail 详情页 + 状态时间线

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: stock-out-detail 操作按钮（审核/驳回/撤回）

**Files:**
- Modify: `miniprogram/pages/material/stock-out-detail/index.js`
- Modify: `miniprogram/pages/material/stock-out-detail/index.wxml`（追加确认弹窗）
- Modify: `miniprogram/pages/material/stock-out-detail/index.wxss`（弹窗样式）

**目标**：3 个操作按钮接通云函数，含数量调整确认与驳回原因输入。

- [ ] **Step 1: index.wxml 追加 2 个底部弹窗**

在 `</view>`（detail-page 闭合）之前：

```xml
  <!-- 审核通过确认弹窗 -->
  <view wx:if="{{showApproveDialog}}" class="dlg-mask" bindtap="onCloseApprove"></view>
  <view wx:if="{{showApproveDialog}}" class="dlg-sheet">
    <view class="dlg-title">审核通过 · 出库</view>
    <view class="dlg-row">
      <text class="dlg-label">申请数量</text>
      <text class="dlg-val">{{request.requested_quantity}}</text>
    </view>
    <view class="dlg-row">
      <text class="dlg-label">当前库存</text>
      <text class="dlg-val">{{currentStock}}</text>
    </view>
    <view class="dlg-row">
      <text class="dlg-label">实际出库 *</text>
      <input class="dlg-input" type="digit" value="{{approveQty}}" bindinput="onApproveQtyInput" />
    </view>
    <view class="dlg-actions">
      <button class="dlg-btn dlg-btn-cancel" bindtap="onCloseApprove">取消</button>
      <button class="dlg-btn dlg-btn-confirm" loading="{{approving}}" disabled="{{!approveQtyValid}}" bindtap="onConfirmApprove">确认出库</button>
    </view>
  </view>

  <!-- 驳回原因弹窗 -->
  <view wx:if="{{showRejectDialog}}" class="dlg-mask" bindtap="onCloseReject"></view>
  <view wx:if="{{showRejectDialog}}" class="dlg-sheet">
    <view class="dlg-title">驳回</view>
    <view class="dlg-row dlg-row-textarea">
      <text class="dlg-label">驳回原因 *</text>
      <textarea class="dlg-textarea" placeholder="必填，≤200 字" maxlength="200" value="{{rejectReason}}" bindinput="onRejectReasonInput" />
    </view>
    <view class="dlg-actions">
      <button class="dlg-btn dlg-btn-cancel" bindtap="onCloseReject">取消</button>
      <button class="dlg-btn dlg-btn-danger" loading="{{rejecting}}" disabled="{{!rejectReasonValid}}" bindtap="onConfirmReject">确认驳回</button>
    </view>
  </view>
```

- [ ] **Step 2: index.wxss 追加弹窗样式**

```css
.dlg-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 200;
}
.dlg-sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 24rpx 48rpx;
  z-index: 201;
}
.dlg-title { font-size: 32rpx; font-weight: 600; color: #1d1d1f; margin-bottom: 24rpx; text-align: center; }
.dlg-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}
.dlg-row-textarea { flex-direction: column; align-items: flex-start; gap: 12rpx; }
.dlg-label { font-size: 28rpx; color: #7a7a7a; }
.dlg-val { font-size: 28rpx; color: #1d1d1f; }
.dlg-input {
  width: 200rpx;
  text-align: right;
  font-size: 28rpx;
  color: #1d1d1f;
}
.dlg-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #1d1d1f;
  line-height: 1.5;
}
.dlg-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 32rpx;
}
.dlg-btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
}
.dlg-btn-cancel { background: #f5f5f7; color: #1d1d1f; }
.dlg-btn-confirm { background: #0066cc; color: #fff; }
.dlg-btn-danger { background: #DC2626; color: #fff; }
```

- [ ] **Step 3: index.js 替换 3 个操作方法**

在 data 中新增：

```js
    showApproveDialog: false,
    approveQty: '',
    currentStock: 0,
    approveQtyValid: false,
    approving: false,

    showRejectDialog: false,
    rejectReason: '',
    rejectReasonValid: false,
    rejecting: false,
```

替换 `onCancel / onApprove / onReject`：

```js
  onCancel() {
    const that = this;
    wx.showModal({
      title: '撤回申请',
      content: '撤回后无法恢复，确定继续？',
      confirmText: '撤回',
      confirmColor: '#DC2626',
      success: async (r) => {
        if (!r.confirm) return;
        const res = await materialService.cancelStockOutRequest(that.data.requestId);
        if (res && res.success) {
          wx.showToast({ title: '已撤回', icon: 'success' });
          that._load();
        }
      }
    });
  },

  async onApprove() {
    // 取最新库存（Task 2 新增的 getMaterialById action）
    const stockRes = await materialService.getMaterialById(this.data.request.material_id);
    const stock = (stockRes && stockRes.success && stockRes.material) ? stockRes.material.stock : 0;

    this.setData({
      showApproveDialog: true,
      approveQty: String(Math.min(this.data.request.requested_quantity, stock)),
      currentStock: stock,
    }, this._refreshApproveValid);
  },

  onApproveQtyInput(e) {
    this.setData({ approveQty: e.detail.value }, this._refreshApproveValid);
  },

  _refreshApproveValid() {
    const q = Number(this.data.approveQty);
    const ok = Number.isInteger(q) && q >= 1
      && q <= this.data.request.requested_quantity
      && q <= this.data.currentStock;
    this.setData({ approveQtyValid: ok });
  },

  onCloseApprove() {
    this.setData({ showApproveDialog: false });
  },

  async onConfirmApprove() {
    if (!this.data.approveQtyValid || this.data.approving) return;
    this.setData({ approving: true });
    const res = await materialService.approveStockOutRequest(
      this.data.requestId,
      Number(this.data.approveQty)
    );
    this.setData({ approving: false });
    if (res && res.success) {
      wx.showToast({ title: '出库成功', icon: 'success' });
      this.setData({ showApproveDialog: false });
      this._load();
    }
  },

  onReject() {
    this.setData({ showRejectDialog: true, rejectReason: '', rejectReasonValid: false });
  },

  onRejectReasonInput(e) {
    const v = e.detail.value || '';
    this.setData({
      rejectReason: v,
      rejectReasonValid: v.trim().length > 0 && v.length <= 200,
    });
  },

  onCloseReject() {
    this.setData({ showRejectDialog: false });
  },

  async onConfirmReject() {
    if (!this.data.rejectReasonValid || this.data.rejecting) return;
    this.setData({ rejecting: true });
    const res = await materialService.rejectStockOutRequest(
      this.data.requestId,
      this.data.rejectReason
    );
    this.setData({ rejecting: false });
    if (res && res.success) {
      wx.showToast({ title: '已驳回', icon: 'success' });
      this.setData({ showRejectDialog: false });
      this._load();
    }
  },
```

> `materialService.getMaterialById` 在 Task 2 (handlers/crud.js) 已加 + Task 12 service 已暴露，此处直接消费。

- [ ] **Step 4: 验证**

模拟器：
- 申请人 + Pending 单 → 撤回 → modal 确认 → 状态变 Cancelled
- 仓管员 + Pending 单 → 点审核通过 → 弹窗显示当前库存 + 默认数量 → 改成更小值 → 确认 → 状态变 Approved，material_records 多一条 type=out
- 仓管员 + Pending 单 → 点驳回 → 输入原因 → 确认 → 状态变 Rejected
- 已 Approved 单：所有按钮消失
- 并发：两个开发者工具实例同时点审核通过，第二个收到"单据已被处理"

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/stock-out-detail/
git commit -m "feat(material): stock-out-detail 操作按钮接通（审核/驳回/撤回）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: material/index Tab3 改造 — WXML/WXSS（含移除残留 popup）

**Files:**
- Modify: `miniprogram/pages/material/index.wxml`（Tab3 swiper-item）
- Modify: `miniprogram/pages/material/index.wxss`（sub-tabs 复用）
- Modify: `miniprogram/pages/material/index.js`（tabs 文案 + 删 showStockOut data）

**目标**：UI 层把 Tab3 从单一只读列表改造为 sub-tabs（出库申请 / 出库记录）+ FAB；移除既有 `<van-popup show="{{showStockOut}}">`。

- [ ] **Step 1: index.js 顶部 tabs 文案与 data 调整**

定位 `data: { activeTab: 0, tabs: [...] }`，把 tabs 文案改为：

```js
    tabs: ['配件列表', '入库管理', '出库管理'],
```

新增出库管理 sub-tabs 与申请列表 state，加在既有 outRecords/outLoading/outPage 之前：

```js
    // Tab3 出库管理
    outActiveSubTab: 0,                // 0 出库申请 / 1 出库记录
    outSubTabs: ['出库申请', '出库记录'],

    // 出库申请列表（sub[0]）
    requests: [],
    requestsLoading: true,
    requestsLoadingMore: false,
    requestsPage: 1,
    requestsTotal: 0,

    // 出库记录筛选条件（sub[1]）
    outFilter: {
      status: [],          // 多选
      region: '',
      scene: '',
      keyword: '',
      date_from: '',
      date_to: '',
    },
    outFilterChips: [],    // 已应用 chip 数组（用于 UI 显示）
```

**删掉**这一段（既有出库 popup 残留）：

```js
    // 出库弹窗
    showStockOut: false,
    stockOutForm: {
      material_id: 0, material_name: '', current_stock: 0, unit: '',
      quantity: '', remark: ''
    },
```

- [ ] **Step 2: 删除 wxml 中残留的 `<van-popup show="{{showStockOut}}">`**

在 `miniprogram/pages/material/index.wxml` 找到 `<!-- 出库弹窗 -->` 起到 `</van-popup>` 的整段（约 333-374 行），整块删除。

- [ ] **Step 3: 替换 Tab3 swiper-item 为 sub-tabs 结构**

在 `miniprogram/pages/material/index.wxml` 找到 `<!-- Tab 3: 出库记录 -->` 那个 `<swiper-item>`（约 252-315 行），把整个 swiper-item 替换为：

```xml
    <!-- Tab 3: 出库管理 -->
    <swiper-item>
      <view class="tab2-container">
        <!-- Sub-Tabs -->
        <view class="sub-tabs">
          <view
            wx:for="{{outSubTabs}}"
            wx:key="index"
            class="sub-tab-item {{outActiveSubTab === index ? 'sub-tab-active' : ''}}"
            data-sub="{{index}}"
            bindtap="onOutSubTabChange"
          >
            <text class="sub-tab-text">{{item}}</text>
          </view>
        </view>

        <!-- sub[0] 出库申请 -->
        <scroll-view
          wx:if="{{outActiveSubTab === 0}}"
          scroll-y
          class="sub-tab-content"
          bindscrolltolower="onLoadMoreRequests"
        >
          <view wx:if="{{requestsLoading}}" class="loading-state">
            <text>加载中...</text>
          </view>
          <view wx:elif="{{requests.length === 0}}" class="empty-state">
            <van-icon name="orders-o" size="48px" color="#d4d4d4" />
            <text class="empty-text">暂无申请单</text>
          </view>
          <view wx:else class="card-list">
            <view
              wx:for="{{requests}}"
              wx:key="request_id"
              class="m-card"
              bindtap="goToRequestDetail"
              data-id="{{item.request_id}}"
            >
              <image class="m-card-img" src="{{item.material_image || '/images/placeholder.png'}}" mode="aspectFill" />
              <view class="m-card-body">
                <view class="m-card-title">{{item.material_name}}</view>
                <view class="m-card-meta">
                  <view class="meta-item">
                    <van-icon name="manager-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.requester.name}}</text>
                  </view>
                  <view class="meta-item">
                    <van-icon name="location-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.region || '-'}}</text>
                  </view>
                </view>
                <view class="m-card-meta">
                  <view class="meta-item">
                    <van-icon name="clock-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.timeText}}</text>
                  </view>
                  <view class="meta-item">
                    <text class="status-chip status-chip-{{item.status}}">{{item.statusText}}</text>
                  </view>
                </view>
              </view>
              <view class="m-card-qty {{item.status === 'Approved' ? 'qty-out' : ''}}">
                {{item.status === 'Approved' ? '-' : ''}}{{item.approved_quantity || item.requested_quantity}}
              </view>
            </view>
          </view>
          <view wx:if="{{requestsLoadingMore}}" class="loading-more"><text>加载更多...</text></view>
        </scroll-view>

        <!-- sub[1] 出库记录 -->
        <scroll-view
          wx:if="{{outActiveSubTab === 1}}"
          scroll-y
          class="sub-tab-content"
          bindscrolltolower="onLoadMoreRecords"
        >
          <view class="search-row">
            <view class="search-bar search-bar-flex">
              <van-icon name="search" size="14px" color="#a3a3a3" custom-class="search-icon" />
              <input class="search-input" placeholder="搜索物资" placeholder-class="search-placeholder"
                value="{{outFilter.keyword}}" bindinput="onOutKeywordInput" bindconfirm="onOutKeywordSearch" />
            </view>
            <view class="filter-btn" bindtap="onOutFilterTap">
              <van-icon name="filter-o" size="18px" color="#737373" />
            </view>
          </view>

          <view wx:if="{{outFilterChips.length}}" class="filter-chip-row">
            <view wx:for="{{outFilterChips}}" wx:key="key" class="filter-chip" data-key="{{item.key}}" bindtap="onRemoveFilterChip">
              <text>{{item.label}}</text>
              <text class="chip-x">×</text>
            </view>
          </view>

          <view wx:if="{{outLoading}}" class="loading-state"><text>加载中...</text></view>
          <view wx:elif="{{outRecords.length === 0}}" class="empty-state">
            <van-icon name="orders-o" size="48px" color="#d4d4d4" />
            <text class="empty-text">暂无出库记录</text>
          </view>
          <view wx:else class="card-list">
            <view
              wx:for="{{outRecords}}"
              wx:key="request_id"
              class="m-card"
              bindtap="goToRequestDetail"
              data-id="{{item.request_id}}"
            >
              <image class="m-card-img" src="{{item.material_image || '/images/placeholder.png'}}" mode="aspectFill" />
              <view class="m-card-body">
                <view class="m-card-title">{{item.material_name}}</view>
                <view class="m-card-meta">
                  <view class="meta-item">
                    <van-icon name="apps-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.region || '-'}}</text>
                  </view>
                  <view class="meta-item">
                    <van-icon name="location-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.scene || '-'}}</text>
                  </view>
                </view>
                <view class="m-card-meta">
                  <view class="meta-item">
                    <van-icon name="clock-o" size="11px" color="#a3a3a3" />
                    <text class="meta-text">{{item.timeText}}</text>
                  </view>
                  <view class="meta-item">
                    <text class="status-chip status-chip-{{item.status}}">{{item.statusText}}</text>
                  </view>
                </view>
              </view>
              <view class="m-card-qty qty-out">-{{item.approved_quantity || item.requested_quantity}}</view>
            </view>
          </view>
          <view wx:if="{{outLoadingMore}}" class="loading-more"><text>加载更多...</text></view>
        </scroll-view>
      </view>
    </swiper-item>
```

- [ ] **Step 4: 修改 FAB 显隐条件**

定位 `<view wx:if="{{canManage && (activeTab === 0 || (activeTab === 1 && activeSubTab === 0))}}" class="fab-button"`，把条件改成：

```xml
  <view
    wx:if="{{canFab}}"
    class="fab-button"
    bindtap="onFabTap"
  >
    <van-icon name="plus" size="24px" color="#FFFFFF" />
  </view>
```

`canFab` 由 js 在切换 tab/subtab 时计算（Task 18 实现）。

- [ ] **Step 5: index.wxss 追加 status-chip + filter-chip 样式**

在文件末尾追加：

```css
.status-chip {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.status-chip-Pending { background: #FEF3C7; color: #B45309; }
.status-chip-Approved { background: #D1FAE5; color: #065F46; }
.status-chip-Rejected { background: #FEE2E2; color: #991B1B; }
.status-chip-Cancelled { background: #F3F4F6; color: #4B5563; }

.filter-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 24rpx 16rpx;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  background: #E0F2FE;
  color: #0066cc;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 24rpx;
}
.chip-x { font-size: 28rpx; line-height: 1; }
```

- [ ] **Step 6: 验证 UI**

模拟器：
- Tab 顶部文案变 "配件列表 / 入库管理 / 出库管理"
- Tab3 内有 sub-tabs（出库申请 / 出库记录）
- 切 sub-tabs 列表区域切换
- 既有 showStockOut popup 不再弹（即使老入口残留也不会弹）
- 数据为空显示 empty-state

> 注意此时列表数据可能还没有加载逻辑，会停在 loading 或 empty。Task 18 接通数据。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/index.wxml miniprogram/pages/material/index.wxss miniprogram/pages/material/index.js
git commit -m "$(cat <<'EOF'
refactor(material): Tab3 升级为出库管理 sub-tabs UI 骨架

WXML/WXSS 改造：tabs 文案改 / Tab3 swiper-item 内嵌 sub-tabs
（出库申请/出库记录）+ status-chip + filter-chip 样式；移除
既有 showStockOut popup 残留代码。js data 同步调整。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: material/index Tab3 出库申请列表（sub[0]）+ FAB 跳转

**Files:**
- Modify: `miniprogram/pages/material/index.js`

**目标**：sub[0] 出库申请按角色加载默认列表 + 下拉/上拉分页 + FAB 跳 stock-out-form + 状态时间格式化。

- [ ] **Step 1: index.js 顶部 require 并加 STATUS 引用**

```js
const { ROLES, STORAGE_KEYS, STOCK_OUT_STATUS_DISPLAY_NAMES } = require('../../utils/constants');
```

- [ ] **Step 2: 在 onLoad 内加 canFab 计算（删原有 canFab 旧逻辑如有）**

在 onLoad 完成 setData canManage 之后，加：

```js
    this._refreshFab();
```

并在 `data` 中加 `canFab: false`。

- [ ] **Step 3: 在 Page 内新增 _refreshFab 方法**

```js
  _refreshFab() {
    const { activeTab, activeSubTab, outActiveSubTab, canManage } = this.data;
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const canRequest = userInfo && [1, 2, 4, 5].includes(userInfo.role_id);

    let canFab = false;
    if (activeTab === 0) {
      canFab = canManage;                              // 配件列表 → 新增配件
    } else if (activeTab === 1 && activeSubTab === 0) {
      canFab = canManage;                              // 入库管理 sub[0] → 入库 ActionSheet
    } else if (activeTab === 2 && outActiveSubTab === 0) {
      canFab = canRequest;                             // 出库管理 sub[0] → 跳 stock-out-form
    }
    this.setData({ canFab });
  },
```

- [ ] **Step 4: onTabChange + onSwiperChange 末尾调用 _refreshFab**

定位既有 `onTabChange`，在 `setData({ activeTab: ... })` 之后加 `this._refreshFab();`。同样 `onSwiperChange`。

- [ ] **Step 5: 新增 onOutSubTabChange + 加载出库申请列表逻辑**

在 Page 对象内新增：

```js
  onOutSubTabChange(e) {
    const sub = parseInt(e.currentTarget.dataset.sub, 10);
    this.setData({ outActiveSubTab: sub }, () => {
      this._refreshFab();
      if (sub === 0) this._loadRequests(true);
      else if (sub === 1) this._loadOutRecords(true);
    });
  },

  _formatTimeForCard(d) {
    // 复用既有 formatTime
    return formatTime(d);
  },

  _decorateRequest(req) {
    return {
      ...req,
      timeText: this._formatTimeForCard(req.created_at),
      statusText: STOCK_OUT_STATUS_DISPLAY_NAMES[req.status] || req.status,
    };
  },

  /**
   * 出库申请列表 — 按角色 + sub-tab 默认筛选
   */
  async _loadRequests(reset = false) {
    if (reset) {
      this.setData({ requestsPage: 1, requests: [], requestsLoading: true });
    } else {
      this.setData({ requestsLoadingMore: true });
    }

    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO) || {};
    const params = { page: this.data.requestsPage, pageSize: 20 };

    // sub[0] 默认筛选：
    // 办美：自己的全状态
    // 仓管员/管理员：仅 Pending（待审核工作台）
    // 经理：仅 Pending（只读视角）
    if (userInfo.role_id === 4) {
      // requester_user_id 由后端按 role 自动加，此处不传
    } else {
      params.status = 'Pending';
    }

    const materialService = require('../../services/materialService');
    const res = await materialService.listStockOutRequests(params);
    if (!res || !res.success) {
      this.setData({ requestsLoading: false, requestsLoadingMore: false });
      return;
    }
    const decorated = (res.requests || []).map(r => this._decorateRequest(r));
    this.setData({
      requests: reset ? decorated : this.data.requests.concat(decorated),
      requestsTotal: res.total,
      requestsLoading: false,
      requestsLoadingMore: false,
    });
  },

  onLoadMoreRequests() {
    if (this.data.requestsLoadingMore) return;
    if (this.data.requests.length >= this.data.requestsTotal) return;
    this.setData({ requestsPage: this.data.requestsPage + 1 });
    this._loadRequests(false);
  },

  goToRequestDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/material/stock-out-detail/index?request_id=${id}` });
  },
```

> `formatTime` 已在文件顶部既有定义，无需重复。

- [ ] **Step 6: 修改 onFabTap 加入 Tab3 sub[0] 分支**

定位现有 `onFabTap` 方法，在 switch/if 分支末尾加入：

```js
    if (this.data.activeTab === 2 && this.data.outActiveSubTab === 0) {
      wx.navigateTo({ url: '/pages/material/stock-out-form/index' });
      return;
    }
```

放在原有"Tab1 → 跳 add"和"Tab2 sub[0] → ActionSheet"分支之后。

- [ ] **Step 7: onShow 内或 onSwiperChange 内加自动加载**

在切换到 Tab3 时调 _loadRequests。定位 `onSwiperChange`，在 setData 之后加：

```js
    if (this.data.activeTab === 2) {
      if (this.data.outActiveSubTab === 0) this._loadRequests(true);
      else this._loadOutRecords(true);
    }
```

`_loadOutRecords` 在 Task 19 实现，先留空函数避免报错：

```js
  _loadOutRecords(reset = false) {
    // Task 19 接入
  },
```

- [ ] **Step 8: onLoad 内 deeplink 同步处理 tab=2**

定位 `onLoad(query)`，在既有 deeplink 处理段（`if (!isNaN(tab) && tab >= 0 && tab <= 2)` 内）后加：

```js
      if (tab === 2) {
        const sub = parseInt(query.sub, 10);
        if (!isNaN(sub) && sub >= 0 && sub <= 1) {
          this.setData({ outActiveSubTab: sub });
        }
      }
```

并在 onLoad 末尾调 `this._refreshFab();`。

- [ ] **Step 9: 验证**

模拟器（用不同角色登录测试）：
- 办美登录 → 进 Tab3 sub[0] 默认显示自己全状态申请单；FAB 可见
- 仓管员/管理员登录 → 进 Tab3 sub[0] 显示所有 Pending；FAB 可见
- 经理登录 → 进 Tab3 sub[0] 显示所有 Pending；FAB 可见（提交申请权限）
- 维修员登录 → onLoad 拦下退回（既有 canAccess 校验保护）
- tap 一条申请单 → 跳 stock-out-detail 详情页
- tap FAB → 跳 stock-out-form
- 下拉/上拉分页正常

- [ ] **Step 10: 提交**

```bash
git add miniprogram/pages/material/index.js
git commit -m "feat(material): Tab3 sub[0] 出库申请列表 + FAB 跳 stock-out-form

按角色定义默认筛选：办美自己的全状态 / 1/2/5 默认 Pending。
分页 + 跳详情 + canFab 在 tab/sub 切换时同步刷新。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: material/index Tab3 sub[1] 出库记录 + 多条件筛选抽屉

**Files:**
- Modify: `miniprogram/pages/material/index.js`
- Modify: `miniprogram/pages/material/index.wxml`（追加筛选抽屉）
- Modify: `miniprogram/pages/material/index.wxss`（抽屉样式）

**目标**：sub[1] 加载历史完结申请单（Approved/Rejected/Cancelled）+ 多条件筛选抽屉（时间/物资/区域/场景/状态）。

- [ ] **Step 1: index.js 实现 _loadOutRecords + 筛选**

替换 Task 18 留的空 `_loadOutRecords`：

```js
  async _loadOutRecords(reset = false) {
    if (reset) {
      this.setData({ outPage: 1, outRecords: [], outLoading: true });
    } else {
      this.setData({ outLoadingMore: true });
    }
    const f = this.data.outFilter;
    const params = { page: this.data.outPage, pageSize: 20 };

    // 默认状态筛选（sub[1] 历史完结单）
    const status = f.status && f.status.length
      ? f.status
      : ['Approved', 'Rejected', 'Cancelled'];
    params.status = status;

    if (f.region) params.region = f.region;
    if (f.scene) params.scene = f.scene;
    if (f.keyword) params.keyword = f.keyword;
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;

    const materialService = require('../../services/materialService');
    const res = await materialService.listStockOutRequests(params);
    if (!res || !res.success) {
      this.setData({ outLoading: false, outLoadingMore: false });
      return;
    }
    const decorated = (res.requests || []).map(r => this._decorateRequest(r));
    this.setData({
      outRecords: reset ? decorated : this.data.outRecords.concat(decorated),
      outTotal: res.total,
      outLoading: false,
      outLoadingMore: false,
    });
  },

  onOutKeywordInput(e) {
    this.setData({ 'outFilter.keyword': e.detail.value });
  },

  onOutKeywordSearch() {
    this._refreshFilterChips();
    this._loadOutRecords(true);
  },

  onOutFilterTap() {
    this.setData({ showOutFilterDrawer: true });
  },

  onCloseOutFilterDrawer() {
    this.setData({ showOutFilterDrawer: false });
  },

  // 抽屉内筛选项绑定（status 多选 / region / scene / 时间范围）
  onFilterStatusToggle(e) {
    const s = e.currentTarget.dataset.s;
    const cur = this.data.outFilter.status || [];
    const next = cur.includes(s) ? cur.filter(x => x !== s) : cur.concat(s);
    this.setData({ 'outFilter.status': next });
  },

  onFilterRegionPicker(e) {
    // 直接复用 stock-out-form 的字典：简化为输入框，或者用 picker；这里用 input
    this.setData({ 'outFilter.region': e.detail.value });
  },

  onFilterSceneInput(e) {
    this.setData({ 'outFilter.scene': e.detail.value });
  },

  onFilterDateFromChange(e) {
    this.setData({ 'outFilter.date_from': e.detail.value });
  },

  onFilterDateToChange(e) {
    this.setData({ 'outFilter.date_to': e.detail.value });
  },

  onApplyOutFilter() {
    this.setData({ showOutFilterDrawer: false });
    this._refreshFilterChips();
    this._loadOutRecords(true);
  },

  onResetOutFilter() {
    this.setData({
      outFilter: { status: [], region: '', scene: '', keyword: '', date_from: '', date_to: '' },
      outFilterChips: [],
    });
    this._loadOutRecords(true);
  },

  _refreshFilterChips() {
    const f = this.data.outFilter;
    const chips = [];
    if (f.keyword) chips.push({ key: 'keyword', label: `关键词:${f.keyword}` });
    if (f.region) chips.push({ key: 'region', label: `区域:${f.region}` });
    if (f.scene) chips.push({ key: 'scene', label: `场景:${f.scene}` });
    if (f.status && f.status.length) {
      chips.push({ key: 'status', label: `状态:${f.status.map(s => STOCK_OUT_STATUS_DISPLAY_NAMES[s]).join(',')}` });
    }
    if (f.date_from) chips.push({ key: 'date_from', label: `从 ${f.date_from}` });
    if (f.date_to) chips.push({ key: 'date_to', label: `到 ${f.date_to}` });
    this.setData({ outFilterChips: chips });
  },

  onRemoveFilterChip(e) {
    const key = e.currentTarget.dataset.key;
    const f = { ...this.data.outFilter };
    if (key === 'status') f.status = [];
    else f[key] = '';
    this.setData({ outFilter: f });
    this._refreshFilterChips();
    this._loadOutRecords(true);
  },

  onLoadMoreRecords() {
    // 既有方法已存在，但只处理 inRecords/outRecords 旧出库记录。这里改为基于 activeTab 分发：
    if (this.data.activeTab === 2 && this.data.outActiveSubTab === 1) {
      if (this.data.outLoadingMore) return;
      if (this.data.outRecords.length >= this.data.outTotal) return;
      this.setData({ outPage: this.data.outPage + 1 });
      this._loadOutRecords(false);
    } else if (this.data.activeTab === 1 && this.data.activeSubTab === 0) {
      // 既有入库记录加载（保留原逻辑，未变）
      // ...
    }
  },
```

> ⚠️ 既有 `onLoadMoreRecords` 方法是旧代码，处理 inRecords。改造时**保留入库记录逻辑**，仅在末尾分支加入 Tab3 sub[1] 分发即可。具体合并请阅读现有代码。

- [ ] **Step 2: index.js data 加抽屉 state**

```js
    showOutFilterDrawer: false,
```

- [ ] **Step 3: index.wxml 追加筛选抽屉**

在 `</view>`（material-page 闭合）之前追加：

```xml
  <!-- 出库记录筛选抽屉 -->
  <view wx:if="{{showOutFilterDrawer}}" class="filter-mask" bindtap="onCloseOutFilterDrawer"></view>
  <view class="filter-drawer {{showOutFilterDrawer ? 'filter-drawer-open' : ''}}">
    <view class="filter-header">
      <text class="filter-title">筛选</text>
      <view class="filter-close" bindtap="onCloseOutFilterDrawer">×</view>
    </view>

    <view class="filter-section">
      <text class="filter-label">状态</text>
      <view class="status-pick-row">
        <view
          class="status-pick {{outFilter.status.includes('Approved') ? 'status-pick-on' : ''}}"
          data-s="Approved" bindtap="onFilterStatusToggle">已出库</view>
        <view
          class="status-pick {{outFilter.status.includes('Rejected') ? 'status-pick-on' : ''}}"
          data-s="Rejected" bindtap="onFilterStatusToggle">已驳回</view>
        <view
          class="status-pick {{outFilter.status.includes('Cancelled') ? 'status-pick-on' : ''}}"
          data-s="Cancelled" bindtap="onFilterStatusToggle">已撤回</view>
      </view>
    </view>

    <view class="filter-section">
      <text class="filter-label">使用区域</text>
      <input class="filter-input" placeholder="如 办公区" value="{{outFilter.region}}" bindinput="onFilterRegionPicker" />
    </view>
    <view class="filter-section">
      <text class="filter-label">使用场景</text>
      <input class="filter-input" placeholder="如 日常办公" value="{{outFilter.scene}}" bindinput="onFilterSceneInput" />
    </view>

    <view class="filter-section">
      <text class="filter-label">起始日期</text>
      <picker mode="date" value="{{outFilter.date_from}}" bindchange="onFilterDateFromChange">
        <view class="filter-input">{{outFilter.date_from || '选择起始日期'}}</view>
      </picker>
    </view>
    <view class="filter-section">
      <text class="filter-label">结束日期</text>
      <picker mode="date" value="{{outFilter.date_to}}" bindchange="onFilterDateToChange">
        <view class="filter-input">{{outFilter.date_to || '选择结束日期'}}</view>
      </picker>
    </view>

    <view class="filter-actions">
      <button class="filter-btn-reset" bindtap="onResetOutFilter">重置</button>
      <button class="filter-btn-apply" bindtap="onApplyOutFilter">应用</button>
    </view>
  </view>
```

- [ ] **Step 4: index.wxss 追加抽屉样式**

```css
.filter-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; }
.filter-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 80vw; max-width: 600rpx;
  background: #fff;
  z-index: 201;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  display: flex;
  flex-direction: column;
}
.filter-drawer-open { transform: translateX(0); }
.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.filter-title { font-size: 32rpx; font-weight: 600; color: #1d1d1f; }
.filter-close { font-size: 48rpx; color: #7a7a7a; line-height: 1; padding: 0 16rpx; }
.filter-section {
  padding: 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.filter-label { font-size: 26rpx; color: #7a7a7a; }
.filter-input {
  height: 72rpx;
  background: #f5f5f7;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  color: #1d1d1f;
  display: flex;
  align-items: center;
}
.status-pick-row { display: flex; gap: 16rpx; }
.status-pick {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  background: #f5f5f7;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #1d1d1f;
}
.status-pick-on { background: #0066cc; color: #fff; }
.filter-actions {
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
  margin-top: auto;
}
.filter-btn-reset {
  flex: 1;
  height: 80rpx;
  background: #f5f5f7;
  color: #1d1d1f;
  border-radius: 40rpx;
  font-size: 28rpx;
}
.filter-btn-apply {
  flex: 1;
  height: 80rpx;
  background: #0066cc;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
}
```

- [ ] **Step 5: 验证**

模拟器（管理员账号）：
- Tab3 sub[1] 默认列出所有完结申请单
- 顶部筛选按钮 → 抽屉弹出
- 选状态"已驳回" → 应用 → 列表只剩 Rejected
- chip 显示"状态:已驳回"，点 × 移除 chip → 列表恢复
- 起始日期/结束日期 picker 选择 → 应用 → 列表过滤
- 关键词搜索 → 列表过滤
- 重置 → 全部 chip 清空，列表恢复

- [ ] **Step 6: 提交**

```bash
git add miniprogram/pages/material/index.{js,wxml,wxss}
git commit -m "feat(material): Tab3 sub[1] 出库记录 + 多条件筛选抽屉

支持时间范围/区域/场景/状态/关键词筛选；已应用条件 chip 显示
+ 单独移除。复用 listStockOutRequests action。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: 入口接入 — 首页耗品宫格 + custom-tab-bar role 5 显隐

**Files:**
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/home/index.wxml`（如需要）
- Modify: `miniprogram/custom-tab-bar/index.js`

**目标**：首页耗品 Tab 宫格新增"出库管理"格子；custom-tab-bar 加入 role_id=5 的可见性逻辑。

- [ ] **Step 1: home/index.js 耗品宫格新增一项**

定位首页的 `consumableFuncRows`（或类似命名）数组定义，新增一个：

```js
{ icon: 'orders-o', label: '出库管理', action: 'goStockOut', visibleRoles: [1, 2, 4, 5] },
```

`visibleRoles` 字段约定见同文件其他宫格写法。维修员（3）不在内。

并在 handler 分发处加：

```js
    if (action === 'goStockOut') {
      wx.navigateTo({ url: '/pages/material/index?tab=2' });
      return;
    }
```

- [ ] **Step 2: home/index.wxml 视情况调整**

如果 wxml 是按宫格数组循环渲染，无需改动；如果是硬编码格子，按既有格子样式追加一格"出库管理"。

- [ ] **Step 3: custom-tab-bar/index.js 加入 role_id=5 的显隐**

定位既有按角色显隐 tab 的逻辑（grep `role_id` 或 `ROLES` 找到判断）。把 role_id=5 当作"和办美/经理类似的普通员工"对待（能看到首页 + 消息 + 我的 3 个 tab），不要漏。

- [ ] **Step 4: 验证**

模拟器：
- 办美/经理/管理员/仓管员登录 → 首页耗品 Tab 宫格能看到"出库管理"
- 维修员登录 → 看不到"出库管理"宫格
- 仓管员登录 → custom-tab-bar 3 个 tab 正常显示

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/home/ miniprogram/custom-tab-bar/
git commit -m "feat(home): 耗品宫格 + 出库管理；tabBar 接入 role_id=5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: admin 数据字典页 — 加入 stock_out_region / stock_out_scene

**Files:**
- Modify: `miniprogram/pages/admin/dict/index.js`（如硬编码 dict_key 列表）

**目标**：管理员能在 admin 字典管理页 CRUD 两个新字典 key。

- [ ] **Step 1: 检查 admin/dict 页面 dict 列表实现方式**

```bash
grep -rn "material_category\|dict_key" miniprogram/pages/admin/dict/ | head -20
```

如果是硬编码 `const DICT_KEYS = [...]`，加两项：

```js
const DICT_KEYS = [
  { key: 'material_category', name: '物料分类' },
  { key: 'stock_out_region', name: '使用区域（出库）' },
  { key: 'stock_out_scene', name: '使用场景（出库）' },
  // 既有其他 key...
];
```

如果是从云端动态拉 dictionaries 集合所有 key，则**无需改动**（新 key 会在前端 seed 后自动出现）。

- [ ] **Step 2: 验证**

管理员账号 → 进 admin → 数据字典 → 看到两个新字典 → 进入能编辑/新增/软删项。

经理账号（role_id=2）→ 尝试新增项 → 后端拦下"区域/场景字典仅管理员可配置"toast。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/admin/dict/
git commit -m "feat(admin): 数据字典页加入 stock_out_region/scene

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: 全路径手动回归（按 spec §9 验证清单）

**Files:** 无代码改动，纯手工回归。

**目标**：覆盖 5 个角色 × 各核心路径，确认 spec §9.1/9.2/9.3/9.4 全部通过。

- [ ] **Step 1: 准备 5 个角色测试账号**

云数据库 → users 集合，确认有：
- role_id=1（管理员）
- role_id=2（经理）
- role_id=3（维修员）
- role_id=4（办美员工）
- role_id=5（仓管员，Task 10 已 seed）

每个角色的 `wechat_openid` 在小程序里能切到。

- [ ] **Step 2: 按 spec §9.1 各角色路径回归**

打开 spec 文件 `docs/superpowers/specs/2026-04-27-material-stock-out-management-design.md` 第 9.1 节。逐条勾选：
- 申请人（办美） 11 项
- 仓管员 9 项
- 管理员 2 项
- 经理 5 项
- 维修员 3 项

每项失败 → 在 tasks/todo.md 记录 → 修复 → 重测。

- [ ] **Step 3: spec §9.2 数据正确性回归**

- 提交申请后：material_requests 字段齐全 / materials.stock 不变 / material_records 不变 ✓
- 审核通过后：3 个表全部正确变更 ✓
- 驳回后：仅 material_requests 变化 ✓
- 撤回后：仅 material_requests 变化 ✓

- [ ] **Step 4: spec §9.3 边界场景回归**

7 项边界（库存夹紧 / 并发审核 / 数量 0 / 字典软删 / 物资被删 / 撤回竞态 / 维修员硬刷）。每项至少跑 1 次。

- [ ] **Step 5: spec §9.4 回归非耗品模块**

- 工单提报 / 编辑 / 详情 不受影响 ✓
- 工单完成扣库存仍正常（material_records.request_id=null 区分） ✓
- admin 用户管理新增 role_id=5 用户 ✓
- admin 数据字典页 3 个 key 都在 ✓
- 入库管理 Tab2 不变；办美进入被 canManageMaterial 拦下 ✓
- 既有 'CK-2024-XXXX' 历史出库记录仍可见 ✓

- [ ] **Step 6: 创建一个最终回归 commit + 在 tasks/todo.md 写 review 总结**

如有发现需要小修的 bug，分别 commit。最后在 `tasks/todo.md` 加一段 Review 总结：

```markdown
## 耗品出库管理 Review (2026-04-27)

### 完成项
- 三段式审批流（申请 → 审核 = 出库 / 驳回 / 撤回）
- 新增仓管员（role_id=5）；办美失去入库 + 分类管理
- 新增 material_requests 集合 + 6 个 action
- material/index Tab3 升级为出库管理
- 区域/场景字典严格仅管理员配置
- 通知 3 节点接入

### 验证结果
- spec §9.1 路径回归 全部通过
- spec §9.2 数据正确性 通过
- spec §9.3 边界场景 通过
- spec §9.4 回归非耗品模块 通过

### 已知局限
（按 spec §10 列出）
```

```bash
git add tasks/todo.md
git commit -m "docs(material/stock-out): 全路径回归通过，落地完成

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 总结

22 个 Task，分 9 个 Phase 完成。后端 11 + 前端 11 比例均衡。每个 Task 单独提交，可单独 revert。

**关键风险点**：
- Task 2（handlers 拆分）：影响所有既有 action，部署后必须跑 full smoke test
- Task 4（approveStockOutRequest）：扣库存 + 写记录 + 改单 三个写操作，确认并发原子保护工作
- Task 17-19（material/index 改造）：800+ 行单文件再扩展，提交时分多个小 commit

**部署顺序**（在微信开发者工具）：
1. 完成 Phase 1-3 后部署 materialManager + dictionaryManager
2. Task 10 云端配置必须有人手动做
3. Phase 4-8 前端工作完成后小程序整体上传体验版
4. Task 22 在体验版上回归
