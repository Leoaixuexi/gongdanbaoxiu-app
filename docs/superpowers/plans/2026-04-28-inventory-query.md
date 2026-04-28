# 库存查询模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `cloudfunctions/materialManager/index.js` 加 3 个新 case（`getInventoryList` / `getInventoryDetail` / `adjustStock`）+ 扩展 `stockIn` 接收 `unit_price`；新建 2 个全新前端页面 `pages/material/inventory/` 与 `pages/material/inventory-detail/`（含底部库存调整抽屉）；接通首页耗品管理 Tab 下「库存查询」按钮跳转。视觉严格复刻 Pencil 节点 `AkohR`，列表 4 状态用 pill 按钮 + 数字 badge。

**Architecture:** 微信小程序 + 微信云开发。沿用项目现有"单文件路由 switch-case"风格（不重新拆分 handlers/）。前端 2 个独立页面，详情页内嵌底部抽屉（不增加路由），趋势图复用现有 `components/ec-canvas`（ECharts）。权限沿用 `helpers.js` 已有的 `canAccessMaterial` / `canManageMaterial`，**不引入新权限函数**。

**Tech Stack:** WXML/WXSS/JS（小程序原生），@vant/weapp 组件库（van-icon、van-popup、van-stepper），wx-server-sdk（云函数），CloudBase 数据库（materials / material_records 集合，新增 4 个可选字段：`materials.last_purchase_price`、`material_records.adjust_type` / `.adjust_reason` / `.unit_price`，**不需历史数据迁移**），ECharts 微信小程序版（已集成）。无自动化测试，**所有验证通过微信开发者工具的"云函数测试 / 模拟器 / 真机"完成**。

**Spec 引用:** `docs/superpowers/specs/2026-04-28-inventory-query-design.md`（commit `0080d69`）

---

## 影响文件结构

```
新建（8 文件）：
  miniprogram/pages/material/inventory/index.{js,wxml,wxss,json}            (4)
  miniprogram/pages/material/inventory-detail/index.{js,wxml,wxss,json}     (4)

改造（4 文件）：
  miniprogram/app.json                              +2 路径
  miniprogram/services/materialService.js           +3 方法（getInventoryList / getInventoryDetail / adjustStock）
  miniprogram/pages/home/index.js                   onWorkOrderFunctionTap 加"库存查询"分支
  cloudfunctions/materialManager/index.js           +3 case（最末尾）+ 扩展 stockIn 接收 unit_price

数据库（自动写入新字段，不需迁移）：
  materials.last_purchase_price       Number?         首次入库带 unit_price 时填充
  material_records.adjust_type        String?         'gain'|'loss'|'scrap'|'lost'
  material_records.adjust_reason      String?         自由文本
  material_records.unit_price         Number?         入库单价
  material_records.type               String          扩展取值 'in'|'out'|'adjust'
```

## 实现顺序与依赖

```
Phase 1 后端云函数（依赖：无）           → Task 1, 2, 3, 4
Phase 2 前端服务层                       → Task 5
Phase 3 列表页                           → Task 6, 7, 8, 9
Phase 4 详情页基础                       → Task 10, 11, 12, 13
Phase 5 详情页趋势图                     → Task 14
Phase 6 详情页调整抽屉                   → Task 15, 16
Phase 7 入口接通                         → Task 17
Phase 8 全路径手动回归                   → Task 18
```

每个 Task 完成后单独 commit。Phase 1 的 4 个 case 改完后**一并部署一次**云函数，再开始前端。

---

## Task 1: 加 `getInventoryList` case（库存列表 + 4 状态计数）

**Files:**
- Modify: `cloudfunctions/materialManager/index.js`（在 `case 'seedTestData'` 之后、`default` 之前插入）

**目标**：实现库存列表查询，按 `status` 过滤、支持搜索/分页，并返回 4 个状态的总数（用于按钮 badge）。每条 material 附带最近一次入/出库时间。

- [ ] **Step 1: 在 `case 'seedTestData'` 之后、`default:` 之前插入新 case**

参考 `cloudfunctions/materialManager/index.js:425` 行 `'已插入5条配件 + 3条入库记录 + 3条出库记录' }` 之后插入：

```js
      // ===== 库存查询列表 =====
      case 'getInventoryList': {
        const { status = 'all', keyword = '', category = '', page = 1, pageSize = 20 } = data;

        // 注意：CloudBase 不支持字段间比较（stock <= min_stock），所以全量拉
        // 后在 JS 中分组计数与过滤。耗品总量有限，可接受。
        const baseConditions = {};
        if (keyword) {
          baseConditions.name = db.RegExp({ regexp: keyword, options: 'i' });
        }
        if (category) {
          baseConditions.category = category;
        }

        // 全量拉（CloudBase 单次最多 100 条；这里项目耗品总量有限，取 1000 上限保守）
        const MAX_FETCH = 1000;
        const { data: allMaterials } = await db.collection('materials')
          .where(baseConditions)
          .orderBy('updated_at', 'desc')
          .limit(MAX_FETCH)
          .get();

        // 内存分组（缺货 / 预警 / 正常）
        const groupOf = (m) => {
          const stock = Number(m.stock) || 0;
          const min = Number(m.min_stock) || 0;
          if (stock === 0) return 'empty';
          if (stock <= min) return 'warning';
          return 'normal';
        };
        const groups = { empty: [], warning: [], normal: [] };
        allMaterials.forEach(m => groups[groupOf(m)].push(m));
        const statusCounts = {
          all: allMaterials.length,
          warning: groups.warning.length,
          empty: groups.empty.length,
          normal: groups.normal.length,
        };

        // 按 status 取目标列表
        let filtered;
        if (status === 'warning') filtered = groups.warning;
        else if (status === 'empty') filtered = groups.empty;
        else if (status === 'normal') filtered = groups.normal;
        else filtered = allMaterials;

        // 分页
        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        // 关联最近一次入/出库时间（每条 2 次 limit(1) 查询，并行）
        const enriched = await Promise.all(pageItems.map(async (m) => {
          const [{ data: lastIn }, { data: lastOut }] = await Promise.all([
            db.collection('material_records')
              .where({ material_id: m.material_id, type: 'in' })
              .orderBy('created_at', 'desc').limit(1).get(),
            db.collection('material_records')
              .where({ material_id: m.material_id, type: _.in(['out', 'adjust']) })
              .orderBy('created_at', 'desc').limit(1).get(),
          ]);
          return {
            ...m,
            last_in_date: lastIn[0] ? lastIn[0].created_at : null,
            last_out_date: lastOut[0] ? lastOut[0].created_at : null,
          };
        }));

        return {
          success: true,
          materials: enriched,
          statusCounts,
          total,
          page,
          pageSize,
        };
      }
```

- [ ] **Step 2: 部署云函数**

微信开发者工具 → 右键 `cloudfunctions/materialManager` → "上传并部署：云端安装依赖"。等待"上传成功"提示。

- [ ] **Step 3: 验证**

微信开发者工具 → 云开发 → 云函数 → `materialManager` → 测试。输入：

```json
{
  "action": "getInventoryList",
  "data": { "status": "all", "page": 1, "pageSize": 20 }
}
```

预期返回 `{ success: true, materials: [...], statusCounts: { all, warning, empty, normal }, total, page, pageSize }`，其中每条 material 有 `last_in_date` / `last_out_date` 字段（可能为 null）。

再测 `status: 'warning'` 与 `status: 'empty'`，确认筛选生效。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(materialManager): + getInventoryList action（库存查询列表 + 4 状态计数）

内存分组实现 stock <= min_stock 比较（CloudBase 不支持字段间比较）；每条
material 关联最近一次入/出库时间（pageSize=20 内 N+1 可接受）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 加 `getInventoryDetail` case（详情页全量数据）

**Files:**
- Modify: `cloudfunctions/materialManager/index.js`（在 Task 1 新增的 case 之后插入）

**目标**：一次返回详情页所需的全部数据：商品信息、3 指标（当前库存/预警值/30日消耗）、6 月趋势、消耗最多区域、月均消耗、最近 3 条流转记录。

- [ ] **Step 1: 插入新 case**

```js
      // ===== 库存查询详情 =====
      case 'getInventoryDetail': {
        const { material_id } = data;
        if (!material_id) {
          return { success: false, error: '缺少 material_id' };
        }

        const { data: mats } = await db.collection('materials')
          .where({ material_id }).limit(1).get();
        if (!mats.length) {
          return { success: false, error: '配件不存在' };
        }
        const material = mats[0];

        const now = new Date();
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const d6mStart = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 含当月共 6 个月

        // 拉近 6 个月所有该 material 的 records（量可控）
        const { data: records6m } = await db.collection('material_records')
          .where({
            material_id,
            created_at: _.gte(d6mStart),
          })
          .orderBy('created_at', 'desc')
          .limit(1000)
          .get();

        // 30 日消耗：type='out' 或 (type='adjust' 且 adjust_type ∈ {loss/scrap/lost})
        const isOutLike = (r) =>
          r.type === 'out' ||
          (r.type === 'adjust' && ['loss', 'scrap', 'lost'].includes(r.adjust_type));
        const last30dConsume = records6m
          .filter(r => new Date(r.created_at) >= d30 && isOutLike(r))
          .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

        // 6 月趋势（按月分组 in / out）
        const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const trendMap = {};
        for (let i = 5; i >= 0; i--) {
          const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          trendMap[monthKey(mDate)] = { month: monthKey(mDate), in: 0, out: 0 };
        }
        records6m.forEach(r => {
          const k = monthKey(new Date(r.created_at));
          if (!trendMap[k]) return;
          const qty = Number(r.quantity) || 0;
          if (r.type === 'in') trendMap[k].in += qty;
          else if (isOutLike(r)) trendMap[k].out += qty;
        });
        const trend = Object.values(trendMap);

        // 消耗最多区域：按 usage_area 在出库类记录中计数
        const areaCount = {};
        records6m.filter(isOutLike).forEach(r => {
          const a = r.usage_area || '';
          if (!a) return;
          areaCount[a] = (areaCount[a] || 0) + 1;
        });
        const topArea = Object.entries(areaCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        // 月均消耗：6 月出库总量 / 6
        const totalOut6m = trend.reduce((sum, t) => sum + t.out, 0);
        const monthlyAvg = Math.floor(totalOut6m / 6);

        // 最近 3 条流转记录（任何类型）
        const { data: recentRecords } = await db.collection('material_records')
          .where({ material_id })
          .orderBy('created_at', 'desc')
          .limit(3)
          .get();

        return {
          success: true,
          material,
          currentStock: Number(material.stock) || 0,
          minStock: Number(material.min_stock) || 0,
          last30dConsume,
          trend,
          topArea,
          topScene: null,
          monthlyAvg,
          recentRecords: recentRecords.map(r => ({
            type: r.type,
            adjust_type: r.adjust_type || null,
            quantity: Number(r.quantity) || 0,
            created_at: r.created_at,
            remark: r.remark || '',
          })),
        };
      }
```

- [ ] **Step 2: 部署云函数**

右键 materialManager → 上传并部署。

- [ ] **Step 3: 验证**

云函数测试输入（用 Task 1 测试时返回的某条 material 的 `material_id`）：

```json
{
  "action": "getInventoryDetail",
  "data": { "material_id": <填一个真实的 ID> }
}
```

预期返回字段齐全：`material`、`currentStock`、`minStock`、`last30dConsume`（数字）、`trend`（6 个对象）、`topArea`（字符串或空）、`topScene: null`、`monthlyAvg`（数字）、`recentRecords`（数组 ≤3）。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(materialManager): + getInventoryDetail action（详情聚合：3 指标 + 6 月趋势 + 区域 Top1 + 流转记录）

云函数内 JS 分组聚合，避免 N 次数据库查询；topScene 当前返回 null
（material_records 暂无 scene 字段）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 加 `adjustStock` case（库存调整 + 乐观锁）

**Files:**
- Modify: `cloudfunctions/materialManager/index.js`（在 Task 2 新增的 case 之后插入）

**目标**：实现库存调整（盘盈/盘亏/报废/丢失），权限按 `canManageMaterial`，写 `material_records` 同时增量更新 `materials.stock`，使用乐观锁防止并发冲突。

- [ ] **Step 1: 插入新 case**

```js
      // ===== 库存调整（盘盈 / 盘亏 / 报废 / 丢失） =====
      case 'adjustStock': {
        if (!canManageMaterial(user)) {
          return { success: false, error: '无权限调整库存' };
        }

        const { material_id, adjust_type, quantity, reason } = data;
        const VALID_TYPES = ['gain', 'loss', 'scrap', 'lost'];
        const qty = Number(quantity);

        if (!material_id || !VALID_TYPES.includes(adjust_type) || !qty || qty <= 0) {
          return { success: false, error: '请填写正确的调整信息' };
        }
        if (!reason || String(reason).trim().length < 2) {
          return { success: false, error: '请填写调整原因（至少 2 个字符）' };
        }

        const tryAdjust = async () => {
          const { data: mats } = await db.collection('materials')
            .where({ material_id }).limit(1).get();
          if (!mats.length) {
            return { success: false, error: '配件不存在' };
          }
          const material = mats[0];
          const currentStock = Number(material.stock) || 0;
          const isOut = adjust_type !== 'gain';

          if (isOut && qty > currentStock) {
            return { success: false, error: `库存不足，当前库存: ${currentStock}` };
          }
          const newStock = isOut ? currentStock - qty : currentStock + qty;
          const now = new Date();

          // 乐观锁：仅当 stock 未变时更新
          const updRes = await db.collection('materials')
            .where({ _id: material._id, stock: _.eq(currentStock) })
            .update({
              data: { stock: newStock, updated_at: now }
            });

          if (!updRes.stats || updRes.stats.updated === 0) {
            return { __conflict: true };
          }

          const recordId = await getNextId('material_records');
          await db.collection('material_records').add({
            data: {
              record_id: recordId,
              material_id,
              material_name: material.name,
              material_number: material.material_number || '',
              category: material.category || '',
              spec: material.spec || '',
              model: material.model || '',
              usage_area: material.usage_area || '',
              material_image: (material.images && material.images[0]) || '',
              type: 'adjust',
              adjust_type,
              adjust_reason: String(reason).trim(),
              quantity: qty,
              operator: { user_id: user.user_id, name: user.name },
              created_at: now,
            }
          });

          return { success: true, message: '调整成功' };
        };

        // 乐观锁失败重试 1 次
        let result = await tryAdjust();
        if (result.__conflict) {
          result = await tryAdjust();
          if (result.__conflict) {
            return { success: false, error: '数据已更新，请刷新重试' };
          }
        }
        return result;
      }
```

- [ ] **Step 2: 部署云函数**

右键 materialManager → 上传并部署。

- [ ] **Step 3: 验证**

云函数测试（用某个真实 material_id，且当前 stock > 0）：

```json
{
  "action": "adjustStock",
  "data": { "material_id": <ID>, "adjust_type": "gain", "quantity": 5, "reason": "盘点多出" }
}
```

预期 `{ success: true, message: '调整成功' }`。然后查询 materials 表确认 stock +5，material_records 多出一条 type='adjust' 的记录。

再测错误用例：
- `quantity: -1` 或 `0` → 错误
- `reason: ""` → 错误
- `adjust_type: "scrap", quantity: 9999` 当 stock < 9999 → 错误"库存不足"

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(materialManager): + adjustStock action（库存调整 + 乐观锁）

权限沿用 canManageMaterial（角色 1/2/5）；盘盈正向、盘亏/报废/丢失反向；
乐观锁失败自动重试 1 次。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 扩展 `stockIn` case 接收 `unit_price`

**Files:**
- Modify: `cloudfunctions/materialManager/index.js`（替换 `case 'stockIn'` 整段，原始代码约第 173-225 行）

**目标**：入库时若传入 `unit_price`，同步写到 `materials.last_purchase_price` 与 `material_records.unit_price`。前端入库表单**不必同步改**——保持兼容。

- [ ] **Step 1: 用下面的完整代码块替换现有 `case 'stockIn'` 整段**

定位：`cloudfunctions/materialManager/index.js` 中 `case 'stockIn': {` 这一行到对应的 `}` 块结束（含 `return { success: true, message: '入库成功' };` 与下一行 `}`）。整段替换为：

```js
      // ===== 配件入库 =====
      case 'stockIn': {
        if (!canManageMaterial(user)) {
          return { success: false, error: '无权限执行入库操作' };
        }

        const { material_id, quantity, remark = '', location = '', unit_price } = data;
        if (!material_id || !quantity || quantity <= 0) {
          return { success: false, error: '请填写正确的入库信息' };
        }

        const { data: materials } = await db.collection('materials')
          .where({ material_id })
          .get();
        if (materials.length === 0) {
          return { success: false, error: '配件不存在' };
        }

        const material = materials[0];
        const now = new Date();
        const qty = Number(quantity);
        const hasPrice = unit_price !== undefined && unit_price !== null && Number(unit_price) > 0;
        const priceVal = hasPrice ? Number(unit_price) : null;

        const matUpdate = { stock: _.inc(qty), updated_at: now };
        if (hasPrice) {
          matUpdate.last_purchase_price = priceVal;
        }

        const [recordId] = await Promise.all([
          getNextId('material_records'),
          db.collection('materials').doc(material._id).update({ data: matUpdate })
        ]);

        await db.collection('material_records').add({
          data: {
            record_id: recordId,
            material_id,
            material_name: material.name,
            material_number: material.material_number || '',
            category: material.category || '',
            spec: material.spec || '',
            model: material.model || '',
            usage_area: location || material.usage_area || '',
            material_image: (material.images && material.images[0]) || '',
            type: 'in',
            quantity: qty,
            unit_price: priceVal,
            operator: { user_id: user.user_id, name: user.name },
            remark,
            created_at: now,
          }
        });

        return {
          success: true,
          message: '入库成功',
        };
      }
```

> 关键变化（diff 概览）：
> - 解构入参增加 `unit_price`
> - 新增 `hasPrice` / `priceVal` 中间变量
> - `materials.update` 的 data 改为先构造 `matUpdate` 对象，按需追加 `last_purchase_price`
> - `material_records.add` 的 data 增加 `unit_price: priceVal` 字段
> - 其余逻辑（getNextId / Promise.all / 各默认值）与原版一致

- [ ] **Step 2: 部署云函数**

右键 materialManager → 上传并部署。

- [ ] **Step 3: 验证**

云函数测试（带 unit_price）：

```json
{
  "action": "stockIn",
  "data": { "material_id": <ID>, "quantity": 10, "unit_price": 18.5, "remark": "测试单价写入" }
}
```

预期 `{ success: true, message: '入库成功' }`。查 materials 确认 `last_purchase_price` 字段存在且值 18.5；查 material_records 最新一条 `unit_price` 为 18.5。

不传 unit_price 测试（保持兼容性）：

```json
{
  "action": "stockIn",
  "data": { "material_id": <ID>, "quantity": 5 }
}
```

预期成功，且新写入的 record `unit_price` 为 null。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/materialManager/index.js
git commit -m "$(cat <<'EOF'
feat(materialManager): stockIn case 增加 unit_price 入参

可选；传入时同步写 materials.last_purchase_price + material_records.unit_price。
前端入库表单暂不改。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 在 materialService.js 增加 3 个调用方法

**Files:**
- Modify: `miniprogram/services/materialService.js`

**目标**：前端服务层封装新的 3 个 action 调用，与现有方法风格一致。

- [ ] **Step 1: 在 module.exports 之前增加 3 个方法**

在 `getWarnings` 定义之后、`module.exports` 之前插入：

```js
/**
 * 库存查询列表
 * @param {object} params { status: 'all'|'warning'|'empty'|'normal', keyword, category, page, pageSize }
 */
const getInventoryList = async (params = {}) => {
  return callCloudSilent('materialManager', {
    action: 'getInventoryList',
    data: { status: 'all', page: 1, pageSize: 20, ...params }
  });
};

/**
 * 库存详情（单个 material 的全量数据）
 */
const getInventoryDetail = async (material_id) => {
  return callCloudSilent('materialManager', {
    action: 'getInventoryDetail',
    data: { material_id }
  });
};

/**
 * 库存调整
 * @param {object} params { material_id, adjust_type, quantity, reason }
 */
const adjustStock = async (params) => {
  return callCloud('materialManager', {
    action: 'adjustStock',
    data: params
  }, { loadingText: '提交中...' });
};
```

- [ ] **Step 2: 在 module.exports 增加这 3 个方法**

把 `module.exports = {` 块改为（在 `getMaterialRecords,` 之后追加 3 行）：

```js
module.exports = {
  listMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  stockIn,
  stockOut,
  getMaterialByNumber,
  listRecords,
  getWarnings,
  getMaterialStats,
  getMaterialRecords,
  getInventoryList,
  getInventoryDetail,
  adjustStock,
};
```

- [ ] **Step 3: 验证**

无需启动小程序，仅做 lint/语法验证：在微信开发者工具中切换到 `materialService.js`，确认无红色错误下划线。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/services/materialService.js
git commit -m "$(cat <<'EOF'
feat(materialService): + 3 个库存查询方法（getInventoryList / getInventoryDetail / adjustStock）

封装 materialManager 新 action 调用。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 新建 inventory 列表页 4 文件 + app.json 注册

**Files:**
- Create: `miniprogram/pages/material/inventory/index.json`
- Create: `miniprogram/pages/material/inventory/index.js`（空骨架）
- Create: `miniprogram/pages/material/inventory/index.wxml`（占位）
- Create: `miniprogram/pages/material/inventory/index.wxss`（空）
- Modify: `miniprogram/app.json`（pages 数组追加 1 条）

**目标**：先把页面注册起来，后续 Task 7-9 逐步填充。

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "库存查询",
  "navigationBarBackgroundColor": "#FFFFFF",
  "navigationBarTextStyle": "black",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index",
    "van-search": "@vant/weapp/search/index"
  }
}
```

- [ ] **Step 2: 创建 index.js（空骨架）**

```js
Page({
  data: {
    activeStatus: 'all',
    keyword: '',
    statusCounts: { all: 0, warning: 0, empty: 0, normal: 0 },
    materials: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: true,
    loadingMore: false,
  },

  onLoad() {},
  onShow() {},
  onPullDownRefresh() {},
  onReachBottom() {},
});
```

- [ ] **Step 3: 创建 index.wxml（占位）**

```xml
<view class="page">
  <view class="placeholder">库存查询页（占位）</view>
</view>
```

- [ ] **Step 4: 创建 index.wxss（空）**

```css
.page { min-height: 100vh; background: #F5F6F8; }
.placeholder { padding: 80rpx; text-align: center; color: #999; }
```

- [ ] **Step 5: 修改 app.json**

在 `pages` 数组中、`"pages/material/stock-out-detail/index"` 之后插入 1 行：

```json
"pages/material/inventory/index",
```

（保持逗号格式正确）

- [ ] **Step 6: 验证**

微信开发者工具 → 重新编译。确认编译无报错。手动在工具的"页面"下拉框选择 `pages/material/inventory/index`，确认能跳到占位页。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/inventory/ miniprogram/app.json
git commit -m "$(cat <<'EOF'
feat(material): + inventory 列表页骨架（占位）

新建 pages/material/inventory/{js,wxml,wxss,json} + app.json 注册路由。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 列表页 wxml 完整结构（搜索 / 4 状态按钮 / 商品卡片）

**Files:**
- Modify: `miniprogram/pages/material/inventory/index.wxml`

**目标**：完整的视觉结构，按 wireframe-v2 + Pencil 风格。卡片数据用 `wx:for` 遍历 `materials`，但 Task 9 才接通真实数据，本步先用 mock 渲染。

- [ ] **Step 1: 替换 wxml**

```xml
<view class="page">

  <!-- 搜索栏 -->
  <view class="search-bar">
    <van-search
      value="{{ keyword }}"
      placeholder="搜索商品名称"
      shape="round"
      background="#FFFFFF"
      bind:change="onKeywordChange"
      bind:search="onKeywordConfirm"
      bind:clear="onKeywordClear"
    />
  </view>

  <!-- 4 状态按钮 -->
  <scroll-view class="status-tabs" scroll-x="{{ true }}" enable-flex>
    <view
      class="status-pill {{ activeStatus === 'all' ? 'active' : '' }}"
      data-status="all"
      bind:tap="onStatusTap">
      <text class="pill-label">全部</text>
      <text class="pill-badge badge-default">{{ statusCounts.all }}</text>
    </view>
    <view
      class="status-pill warning {{ activeStatus === 'warning' ? 'active' : '' }}"
      data-status="warning"
      bind:tap="onStatusTap">
      <text class="pill-label">预警</text>
      <text class="pill-badge badge-warning">{{ statusCounts.warning }}</text>
    </view>
    <view
      class="status-pill empty {{ activeStatus === 'empty' ? 'active' : '' }}"
      data-status="empty"
      bind:tap="onStatusTap">
      <text class="pill-label">缺货</text>
      <text class="pill-badge badge-empty">{{ statusCounts.empty }}</text>
    </view>
    <view
      class="status-pill normal {{ activeStatus === 'normal' ? 'active' : '' }}"
      data-status="normal"
      bind:tap="onStatusTap">
      <text class="pill-label">正常</text>
      <text class="pill-badge badge-normal">{{ statusCounts.normal }}</text>
    </view>
  </scroll-view>

  <!-- 商品卡片列表 -->
  <view class="cards-wrap">
    <view
      class="m-card status-{{ item._status }}"
      wx:for="{{ materials }}"
      wx:key="material_id"
      data-id="{{ item.material_id }}"
      bind:tap="onCardTap">
      <view class="m-side"></view>
      <view class="m-body">
        <view class="m-row m-row-top">
          <text class="m-name">{{ item.name }}</text>
          <text class="m-tag tag-{{ item._status }}">{{ item._statusText }}</text>
        </view>
        <view class="m-sub">{{ item.category }} · {{ item.unit }}{{ item.material_number ? ' · ' + item.material_number : '' }}</view>
        <view class="m-row m-row-bot">
          <view class="m-stock">
            库存
            <text class="m-stock-num stock-{{ item._status }}">{{ item.stock }}</text>
            <text class="m-stock-min"> / 预警 {{ item.min_stock || 0 }}</text>
          </view>
          <text class="m-time">{{ item._latestLabel }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" wx:if="{{ !loading && materials.length === 0 }}">
      <text class="empty-text">暂无数据</text>
    </view>

    <!-- 加载更多 -->
    <view class="loading-more" wx:if="{{ loadingMore }}">加载中...</view>
    <view class="loading-end" wx:if="{{ !loadingMore && materials.length > 0 && materials.length >= total }}">— 没有更多了 —</view>
  </view>

</view>
```

- [ ] **Step 2: 验证**

微信开发者工具重新编译。确认页面渲染：搜索栏 + 4 个 pill（数字都为 0）+ 空状态文案"暂无数据"。无 console 报错。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/material/inventory/index.wxml
git commit -m "$(cat <<'EOF'
feat(material/inventory): 列表页 wxml 结构（搜索 + 4 状态 pill + 商品卡片）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 列表页 wxss 完整样式（按 Pencil 风格）

**Files:**
- Modify: `miniprogram/pages/material/inventory/index.wxss`

**目标**：实现 wireframe-v2 左屏的视觉：白底卡 + 浅阴影 + 14px 圆角 + 4 状态 pill。

- [ ] **Step 1: 替换 wxss**

```css
.page {
  min-height: 100vh;
  background: #F5F6F8;
  padding-bottom: 24rpx;
}

/* 搜索栏 */
.search-bar {
  background: #FFFFFF;
  padding: 8rpx 0;
}

/* 4 状态 pill */
.status-tabs {
  background: #FFFFFF;
  padding: 16rpx 24rpx 24rpx;
  white-space: nowrap;
  border-bottom: 1rpx solid #F0F0F0;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 28rpx;
  border-radius: 32rpx;
  background: #F5F6F8;
  border: 1rpx solid transparent;
  margin-right: 16rpx;
  font-size: 26rpx;
  color: #666;
}
.status-pill.warning { background: #FFF7E6; color: #FF9500; border-color: #FFE0A8; }
.status-pill.empty   { background: #FFEEEE; color: #FF4D4F; border-color: #FFD0D0; }
.status-pill.normal  { background: #F0F9F2; color: #00B578; border-color: #C8EBD5; }
.status-pill.active  { background: #1677FF; color: #FFFFFF; border-color: #1677FF; }
.status-pill.active.warning,
.status-pill.active.empty,
.status-pill.active.normal { background: #1677FF; color: #FFFFFF; border-color: #1677FF; }

.pill-label { line-height: 1; }
.pill-badge {
  padding: 2rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}
.badge-default { background: rgba(255,255,255,0.25); color: #FFFFFF; }
.status-pill:not(.active) .badge-default { background: #FFFFFF; color: #1A1A1A; border: 1rpx solid #E5E6E8; }
.badge-warning { background: #FF9500; color: #FFFFFF; }
.badge-empty   { background: #FF4D4F; color: #FFFFFF; }
.badge-normal  { background: #00B578; color: #FFFFFF; }
.status-pill.active .pill-badge { background: rgba(255,255,255,0.25); color: #FFFFFF; }

/* 商品卡片 */
.cards-wrap {
  padding: 24rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.m-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  display: flex;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.m-side {
  width: 8rpx;
  background: #1677FF;
}
.m-card.status-warning .m-side { background: #FF9500; }
.m-card.status-empty   .m-side { background: #FF4D4F; }
.m-card.status-normal  .m-side { background: #1677FF; }

.m-body {
  flex: 1;
  padding: 24rpx 28rpx;
}
.m-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.m-row-top { margin-bottom: 8rpx; }
.m-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1A1A1A;
}
.m-tag {
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  line-height: 1;
}
.tag-warning { background: #FFF7E6; color: #FF9500; }
.tag-empty   { background: #FFEEEE; color: #FF4D4F; }
.tag-normal  { background: #F0F4FF; color: #1677FF; }

.m-sub {
  font-size: 24rpx;
  color: #999;
  margin: 4rpx 0 12rpx;
}
.m-row-bot { font-size: 24rpx; color: #5E5E5E; }
.m-stock-num {
  font-size: 28rpx;
  font-weight: 600;
  margin: 0 4rpx;
}
.stock-warning { color: #FF9500; }
.stock-empty   { color: #FF4D4F; }
.stock-normal  { color: #1A1A1A; }
.m-stock-min   { color: #999; }
.m-time { color: #999; font-size: 22rpx; }

/* 空 / 加载 */
.empty-state {
  padding: 120rpx 0;
  text-align: center;
}
.empty-text { color: #999; font-size: 26rpx; }
.loading-more,
.loading-end {
  text-align: center;
  color: #999;
  padding: 24rpx 0;
  font-size: 24rpx;
}
```

- [ ] **Step 2: 验证**

微信开发者工具重新编译，模拟器查看。确认 4 状态按钮配色正确（默认/预警橙/缺货红/正常绿/选中蓝）；空状态居中显示。点击不同 pill 暂时无效果（Task 9 接通），但视觉应正确。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/material/inventory/index.wxss
git commit -m "$(cat <<'EOF'
feat(material/inventory): 列表页 wxss 样式（Pencil 风格 + 4 状态 pill）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 列表页 js 接通数据（getInventoryList + 状态切换 + 搜索 + 分页）

**Files:**
- Modify: `miniprogram/pages/material/inventory/index.js`

**目标**：接通后端，实现完整的 4 状态筛选、搜索、上拉加载更多、下拉刷新、点卡片跳详情。

- [ ] **Step 1: 替换 index.js**

```js
const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, ROLES } = require('../../../utils/constants');

const STATUS_TEXT = { warning: '预警', empty: '缺货', normal: '正常' };

function statusOf(m) {
  const stock = Number(m.stock) || 0;
  const min = Number(m.min_stock) || 0;
  if (stock === 0) return 'empty';
  if (stock <= min) return 'warning';
  return 'normal';
}

function fmtMD(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
}

function latestLabel(m) {
  const inDate = m.last_in_date ? new Date(m.last_in_date).getTime() : 0;
  const outDate = m.last_out_date ? new Date(m.last_out_date).getTime() : 0;
  if (!inDate && !outDate) return '';
  if (outDate > inDate) return `出库 ${fmtMD(m.last_out_date)}`;
  return `入库 ${fmtMD(m.last_in_date)}`;
}

function decorate(materials) {
  return materials.map(m => {
    const s = statusOf(m);
    return {
      ...m,
      _status: s,
      _statusText: STATUS_TEXT[s] || '',
      _latestLabel: latestLabel(m),
    };
  });
}

Page({
  data: {
    activeStatus: 'all',
    keyword: '',
    statusCounts: { all: 0, warning: 0, empty: 0, normal: 0 },
    materials: [],
    page: 1,
    pageSize: 20,
    total: 0,
    loading: true,
    loadingMore: false,
  },

  onLoad() {
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    const canAccess = userInfo && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, ROLES.PROPERTY_STAFF, 5].includes(userInfo.role_id);
    if (!canAccess) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.loadList(true);
  },

  onShow() {
    if (this._needsReload) {
      this._needsReload = false;
      this.loadList(true);
    }
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.materials.length < this.data.total && !this.data.loadingMore) {
      this.loadMore();
    }
  },

  async loadList(reset = false) {
    if (reset) {
      this.setData({ loading: true, page: 1, materials: [] });
    }
    const res = await materialService.getInventoryList({
      status: this.data.activeStatus,
      keyword: this.data.keyword,
      page: this.data.page,
      pageSize: this.data.pageSize,
    });
    if (res && res.success) {
      this.setData({
        materials: decorate(res.materials || []),
        statusCounts: res.statusCounts || { all: 0, warning: 0, empty: 0, normal: 0 },
        total: res.total || 0,
        loading: false,
      });
    } else {
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    this.setData({ loadingMore: true, page: this.data.page + 1 });
    const res = await materialService.getInventoryList({
      status: this.data.activeStatus,
      keyword: this.data.keyword,
      page: this.data.page,
      pageSize: this.data.pageSize,
    });
    if (res && res.success) {
      this.setData({
        materials: this.data.materials.concat(decorate(res.materials || [])),
        loadingMore: false,
      });
    } else {
      this.setData({ loadingMore: false });
    }
  },

  onStatusTap(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.activeStatus) return;
    this.setData({ activeStatus: status });
    this.loadList(true);
  },

  onKeywordChange(e) {
    this.setData({ keyword: e.detail || '' });
  },
  onKeywordConfirm() {
    this.loadList(true);
  },
  onKeywordClear() {
    this.setData({ keyword: '' });
    this.loadList(true);
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    this._needsReload = true;
    wx.navigateTo({ url: `/pages/material/inventory-detail/index?id=${id}` });
  },
});
```

- [ ] **Step 2: 验证**

微信开发者工具 → 模拟器 → 通过页面下拉框打开 `pages/material/inventory/index`。预期：
- 页面加载完毕显示完整列表
- 4 状态按钮显示真实数字
- 切换"预警"/"缺货"/"正常"按钮列表正确过滤
- 搜索"打印"等关键字能模糊匹配
- 滚动到底部加载更多（如总数 > 20）
- 下拉刷新成功
- 点击卡片跳转（会因 inventory-detail 还未建好而报错，这是正常的，Task 10 会建）

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/material/inventory/index.js
git commit -m "$(cat <<'EOF'
feat(material/inventory): 列表页接通 getInventoryList（4 状态筛选 / 搜索 / 分页）

点击卡片跳详情；onShow 时 _needsReload 触发列表刷新（调整库存返回后用）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 新建 inventory-detail 页 4 文件 + app.json 注册

**Files:**
- Create: `miniprogram/pages/material/inventory-detail/index.json`
- Create: `miniprogram/pages/material/inventory-detail/index.js`（空骨架）
- Create: `miniprogram/pages/material/inventory-detail/index.wxml`（占位）
- Create: `miniprogram/pages/material/inventory-detail/index.wxss`（空）
- Modify: `miniprogram/app.json`

**目标**：注册详情页路由，让 Task 9 的卡片跳转跑通。

- [ ] **Step 1: 创建 index.json**

```json
{
  "navigationBarTitleText": "库存详情",
  "navigationBarBackgroundColor": "#FFFFFF",
  "navigationBarTextStyle": "black",
  "usingComponents": {
    "van-icon": "@vant/weapp/icon/index",
    "van-popup": "@vant/weapp/popup/index",
    "van-stepper": "@vant/weapp/stepper/index",
    "van-field": "@vant/weapp/field/index",
    "van-button": "@vant/weapp/button/index",
    "ec-canvas": "../../../components/ec-canvas/ec-canvas"
  }
}
```

- [ ] **Step 2: 创建 index.js（空骨架）**

```js
Page({
  data: {
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
  },
  onLoad(options) {
    const id = Number(options.id) || 0;
    this.setData({ materialId: id });
  },
  onShow() {},
});
```

- [ ] **Step 3: 创建 index.wxml（占位）**

```xml
<view class="page">
  <view class="placeholder">详情页占位 id={{ materialId }}</view>
</view>
```

- [ ] **Step 4: 创建 index.wxss（空）**

```css
.page { min-height: 100vh; background: #F5F6F8; }
.placeholder { padding: 80rpx; text-align: center; color: #999; }
```

- [ ] **Step 5: 修改 app.json**

在 `pages` 数组中、Task 6 已注册的 `"pages/material/inventory/index"` 之后插入：

```json
"pages/material/inventory-detail/index",
```

- [ ] **Step 6: 验证**

微信开发者工具重新编译。从 inventory 页点击商品卡片，能跳转到详情页占位页面，URL 带 ?id=xxx。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/ miniprogram/app.json
git commit -m "$(cat <<'EOF'
feat(material): + inventory-detail 页骨架（占位）

新建 pages/material/inventory-detail/{js,wxml,wxss,json} + app.json 注册路由。
ec-canvas / van-popup 等组件已在 json 中预声明。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 详情页 wxml 完整结构（不含趋势图、不含抽屉）

**Files:**
- Modify: `miniprogram/pages/material/inventory-detail/index.wxml`

**目标**：完整布局：商品卡 + 3 指标 + 趋势卡占位（容器 + Tab）+ 消耗分析 2×2 + 流转记录 + 底部固定栏。趋势图 ec-canvas 容器先放好但不初始化（Task 14 接通），抽屉 Task 15 加。

- [ ] **Step 1: 替换 wxml**

```xml
<view class="page" wx:if="{{ detail }}">

  <view class="content">

    <!-- 商品卡片 -->
    <view class="prod-card">
      <view class="prod-side {{ isWarn ? 'warn' : '' }}"></view>
      <view class="prod-info">
        <view class="prod-name">{{ detail.material.name }}</view>
        <view class="prod-meta">
          <text wx:if="{{ detail.material.spec }}">{{ detail.material.spec }}</text>
          <text wx:if="{{ detail.material.spec }}" class="dot">·</text>
          <text>{{ detail.material.category || '' }}</text>
          <text class="dot">·</text>
          <text>{{ detail.material.unit || '' }}</text>
        </view>
        <view class="prod-code" wx:if="{{ detail.material.material_number }}">
          <van-icon name="orders-o" size="13px" color="#999" />
          <text>{{ detail.material.material_number }}</text>
        </view>
      </view>
    </view>

    <!-- 3 指标 -->
    <view class="metrics">
      <view class="metric-card">
        <view class="metric-label">📦 当前库存</view>
        <view class="metric-value {{ isWarn ? 'warn' : 'primary' }}">{{ detail.currentStock }}</view>
        <view class="metric-unit">{{ detail.material.unit || '' }}</view>
      </view>
      <view class="metric-card">
        <view class="metric-label">⚠️ 预警值</view>
        <view class="metric-value">{{ detail.minStock }}</view>
        <view class="metric-unit">{{ detail.material.unit || '' }}</view>
      </view>
      <view class="metric-card">
        <view class="metric-label">📅 30 日消耗</view>
        <view class="metric-value">{{ detail.last30dConsume }}</view>
        <view class="metric-unit">{{ detail.material.unit || '' }}</view>
      </view>
    </view>

    <!-- 库存趋势 -->
    <view class="card chart-card">
      <view class="card-head">
        <view class="card-title">📊 库存趋势</view>
        <view class="chart-tabs">
          <text class="chart-tab {{ trendType === 'in' ? 'active' : '' }}" data-type="in" bind:tap="onTrendTypeTap">入库</text>
          <text class="chart-tab {{ trendType === 'out' ? 'active' : '' }}" data-type="out" bind:tap="onTrendTypeTap">出库</text>
        </view>
      </view>
      <view class="chart-area" wx:if="{{ hasTrendData }}">
        <ec-canvas id="trendChart" canvas-id="trendChart" ec="{{ ecTrend }}" class="chart-canvas"></ec-canvas>
      </view>
      <view class="chart-empty" wx:else>暂无数据</view>
    </view>

    <!-- 消耗分析 2x2 -->
    <view class="card analysis-card">
      <view class="card-title">📈 消耗分析</view>
      <view class="analysis-grid">
        <view class="analysis-cell">
          <view class="cell-label">消耗最多区域</view>
          <view class="cell-value">{{ detail.topArea || '—' }}</view>
        </view>
        <view class="analysis-cell">
          <view class="cell-label">消耗最多场景</view>
          <view class="cell-value muted">暂无数据</view>
        </view>
        <view class="analysis-cell">
          <view class="cell-label">最近采购单价</view>
          <view class="cell-value">{{ detail.material.last_purchase_price ? '¥' + detail.material.last_purchase_price : '—' }}</view>
        </view>
        <view class="analysis-cell">
          <view class="cell-label">月均消耗</view>
          <view class="cell-value">{{ detail.monthlyAvg }} {{ detail.material.unit || '' }}/月</view>
        </view>
      </view>
    </view>

    <!-- 最近流转记录 -->
    <view class="rec-section" wx:if="{{ detail.recentRecords.length > 0 }}">
      <view class="rec-title">🕒 最近流转记录</view>
      <view
        class="rec-card"
        wx:for="{{ detail.recentRecords }}"
        wx:key="created_at">
        <view class="rec-side rec-side-{{ item._tone }}"></view>
        <view class="rec-body">
          <view class="rec-left">
            <text class="rec-tag rec-tag-{{ item._tone }}">{{ item._typeLabel }}</text>
            <text class="rec-date">{{ item._dateLabel }}</text>
          </view>
          <text class="rec-qty rec-qty-{{ item._tone }}">{{ item._qtyText }}</text>
        </view>
      </view>
    </view>

  </view>

  <!-- 底部固定栏（仅 canAdjust） -->
  <view class="bottom-bar" wx:if="{{ canAdjust }}">
    <button class="primary-btn" bind:tap="openAdjust">📝 修改库存</button>
  </view>

</view>

<view class="loading-page" wx:elif="{{ loading }}">加载中...</view>
<view class="empty-page" wx:else>未找到该配件</view>
```

- [ ] **Step 2: 验证**

跳转过去由于 detail 仍为 null，应该看到"加载中..."。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/index.wxml
git commit -m "$(cat <<'EOF'
feat(material/inventory-detail): 详情页 wxml 结构

商品卡 + 3 指标 + 趋势卡（占位）+ 2x2 消耗分析 + 流转记录 + 底部固定栏。
按 Pencil AkohR 节点复刻。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 详情页 wxss 完整样式

**Files:**
- Modify: `miniprogram/pages/material/inventory-detail/index.wxss`

**目标**：实现 wireframe-v2 右屏视觉。

- [ ] **Step 1: 替换 wxss**

```css
.page {
  min-height: 100vh;
  background: #F5F6F8;
  padding-bottom: 140rpx;
}
.content {
  padding: 24rpx 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* 商品卡 */
.prod-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  display: flex;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.prod-side {
  width: 8rpx;
  background: #1677FF;
}
.prod-side.warn { background: #FF9500; }
.prod-info { flex: 1; padding: 28rpx 32rpx; }
.prod-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #1A1A1A;
}
.prod-meta {
  font-size: 24rpx;
  color: #5E5E5E;
  margin-top: 12rpx;
}
.prod-meta .dot { margin: 0 12rpx; color: #CCC; }
.prod-code {
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}

/* 3 指标 */
.metrics {
  display: flex;
  gap: 20rpx;
}
.metric-card {
  flex: 1;
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.metric-label {
  font-size: 22rpx;
  color: #5E5E5E;
}
.metric-value {
  font-size: 44rpx;
  font-weight: 600;
  color: #1A1A1A;
  letter-spacing: -1rpx;
  margin-top: 4rpx;
  line-height: 1.1;
}
.metric-value.primary { color: #1677FF; }
.metric-value.warn    { color: #FF9500; }
.metric-unit {
  font-size: 20rpx;
  color: #999;
  margin-top: 2rpx;
}

/* 通用卡 */
.card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
}

/* 趋势图 */
.chart-tabs {
  display: flex;
  background: #F5F6F8;
  border: 1rpx solid #F0F0F0;
  border-radius: 16rpx;
  padding: 4rpx;
}
.chart-tab {
  font-size: 22rpx;
  padding: 8rpx 24rpx;
  color: #999;
  border-radius: 12rpx;
  line-height: 1;
}
.chart-tab.active {
  background: #FFFFFF;
  color: #1A1A1A;
  font-weight: 600;
  box-shadow: 0 2rpx 4rpx rgba(0,0,0,0.04);
}
.chart-area {
  height: 240rpx;
  background: #F5F6F8;
  border-radius: 20rpx;
}
.chart-canvas {
  width: 100%;
  height: 100%;
}
.chart-empty {
  height: 240rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 24rpx;
  background: #F5F6F8;
  border-radius: 20rpx;
}

/* 2x2 消耗分析 */
.analysis-card .card-title { margin-bottom: 24rpx; }
.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}
.analysis-cell {
  background: #F5F6F8;
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
}
.cell-label {
  font-size: 22rpx;
  color: #999;
}
.cell-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-top: 8rpx;
}
.cell-value.muted { color: #999; font-weight: normal; }

/* 流转记录 */
.rec-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.rec-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #5E5E5E;
  letter-spacing: 1rpx;
  margin-top: 8rpx;
}
.rec-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  display: flex;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.04);
}
.rec-side { width: 6rpx; }
.rec-side-in     { background: #1677FF; }
.rec-side-out    { background: #FF4D4F; }
.rec-side-adjust { background: #FF9500; }
.rec-body {
  flex: 1;
  padding: 20rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rec-left { display: flex; align-items: center; gap: 16rpx; }
.rec-tag {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  line-height: 1;
}
.rec-tag-in     { background: #F0F4FF; color: #1677FF; }
.rec-tag-out    { background: #FFEEEE; color: #FF4D4F; }
.rec-tag-adjust { background: #FFF7E6; color: #FF9500; }
.rec-date { color: #999; font-size: 24rpx; }
.rec-qty {
  font-weight: 600;
  font-size: 26rpx;
}
.rec-qty-in     { color: #1677FF; }
.rec-qty-out    { color: #FF4D4F; }
.rec-qty-adjust { color: #FF9500; }

/* 底部固定栏 */
.bottom-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: #FFFFFF;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #F0F0F0;
  box-shadow: 0 -2rpx 8rpx rgba(0,0,0,0.04);
  z-index: 50;
}
.primary-btn {
  background: #1677FF;
  color: #FFFFFF;
  border: none;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.primary-btn::after { border: none; }

/* 加载 / 空 */
.loading-page,
.empty-page {
  text-align: center;
  padding: 200rpx 0;
  color: #999;
  font-size: 26rpx;
}
```

- [ ] **Step 2: 验证**

模拟器打开详情页（仍为 loading 态），样式编译无错误。

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/index.wxss
git commit -m "$(cat <<'EOF'
feat(material/inventory-detail): 详情页 wxss 样式（Pencil AkohR 风格）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: 详情页 js 接通 getInventoryDetail（不含趋势图初始化）

**Files:**
- Modify: `miniprogram/pages/material/inventory-detail/index.js`

**目标**：拉取详情数据，给流转记录加 `_typeLabel` / `_tone` / `_qtyText` / `_dateLabel`，按权限计算 `canAdjust`，预警态 `isWarn`。趋势图 Task 14 接。

- [ ] **Step 1: 替换 index.js**

```js
const materialService = require('../../../services/materialService');
const { STORAGE_KEYS, ROLES } = require('../../../utils/constants');

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const ADJ_LABEL = { gain: '盘盈', loss: '盘亏', scrap: '报废', lost: '丢失' };

function decorateRecord(r) {
  let tone, label, qtyText;
  if (r.type === 'in') {
    tone = 'in';
    label = '入库';
    qtyText = `+${r.quantity}`;
  } else if (r.type === 'adjust') {
    tone = 'adjust';
    label = ADJ_LABEL[r.adjust_type] || '调整';
    qtyText = (r.adjust_type === 'gain' ? '+' : '-') + r.quantity;
  } else {
    tone = 'out';
    label = '出库';
    qtyText = `-${r.quantity}`;
  }
  return {
    ...r,
    _tone: tone,
    _typeLabel: label,
    _qtyText: qtyText,
    _dateLabel: fmtDate(r.created_at),
  };
}

function canManage(user) {
  return user && [ROLES.ADMIN, ROLES.PROPERTY_MANAGER, 5].includes(user.role_id) && user.active !== false;
}

Page({
  data: {
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
    isWarn: false,
    hasTrendData: false,
    trendType: 'in',
    ecTrend: null,
    // 调整抽屉 Task 15 加
  },

  onLoad(options) {
    const id = Number(options.id) || 0;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
      return;
    }
    const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
    this.setData({
      materialId: id,
      canAdjust: canManage(userInfo),
    });
    this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    const res = await materialService.getInventoryDetail(this.data.materialId);
    if (res && res.success) {
      const detail = res;
      const isWarn = detail.currentStock <= detail.minStock;
      const hasTrendData = (detail.trend || []).some(t => t.in > 0 || t.out > 0);
      detail.recentRecords = (detail.recentRecords || []).map(decorateRecord);
      this.setData({
        detail,
        loading: false,
        isWarn,
        hasTrendData,
      });
    } else {
      this.setData({ loading: false });
    }
  },

  onTrendTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.trendType) return;
    this.setData({ trendType: type });
    // 趋势图重渲染由 Task 14 接通
  },

  openAdjust() {
    // Task 15 接通
  },
});
```

- [ ] **Step 2: 验证**

模拟器从列表点击商品卡片跳详情。预期：
- 商品卡 / 3 指标 / 消耗分析 / 流转记录全部显示真实数据
- 趋势卡显示"暂无数据"或卡片但未画图（正常，Task 14 接）
- 库存预警的商品（stock <= min_stock 且 stock > 0），「当前库存」数字应是橙色，商品卡左色条也是橙色
- 管理员/经理/仓管员账号能看到底部"修改库存"按钮；办美员工不显示
- 维修员（role 3）应在 onLoad 阶段被拒（实际上其 role 在首页就进不来，可不深测）

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/index.js
git commit -m "$(cat <<'EOF'
feat(material/inventory-detail): 接通 getInventoryDetail（不含趋势图）

流转记录装饰 _tone / _typeLabel / _qtyText / _dateLabel；
预警态 isWarn 同步指标卡 + 商品卡侧边色条；
canAdjust 控制底部修改按钮。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: 趋势图接入 ec-canvas（双柱 in/out + Tab 切换）

**Files:**
- Modify: `miniprogram/pages/material/inventory-detail/index.js`（顶部 import 与 Page 内方法）

**目标**：用 ECharts 画双柱状图，两个 series 一直在，Tab 切换通过修改 series 颜色（active 用 `#1677FF`，非 active 用 `#1677FF25`）触发 setOption。

- [ ] **Step 1: 在 index.js 顶部加 echarts 引入**

文件最顶部（紧挨 require constants 之上）追加：

```js
import * as echarts from '../../../components/ec-canvas/echarts';
```

- [ ] **Step 2: 在 Page 上方加 buildTrendOption + initTrendChart**

把 `Page({` 之前加：

```js
function monthLabel(monthKey) {
  // monthKey: '2025-11'
  const m = Number(monthKey.split('-')[1]);
  return `${m}月`;
}

function buildTrendOption(trend, activeType) {
  const categories = trend.map(t => monthLabel(t.month));
  const inData = trend.map(t => t.in);
  const outData = trend.map(t => t.out);
  const ACTIVE = '#1677FF';
  const FADED = '#1677FF25';

  return {
    grid: { top: 20, left: 30, right: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#F0F0F0' } },
      axisTick: { show: false },
      axisLabel: { fontSize: 9, color: '#999' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F0F0F0' } },
      axisLabel: { fontSize: 9, color: '#999' },
    },
    series: [
      {
        name: '入库',
        type: 'bar',
        data: inData,
        itemStyle: {
          color: activeType === 'in' ? ACTIVE : FADED,
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: 10,
      },
      {
        name: '出库',
        type: 'bar',
        data: outData,
        itemStyle: {
          color: activeType === 'out' ? ACTIVE : FADED,
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: 10,
      }
    ]
  };
}
```

- [ ] **Step 3: 在 Page 上修改 data.ecTrend 与 onLoad 之后绑定**

把 `data` 中 `ecTrend: null,` 改为：

```js
    ecTrend: { lazyLoad: true },
    _trendChart: null,
```

注意 `_trendChart` 不能写在 `data` 里（小程序 data 不能存非序列化对象），改为放在 Page 实例属性。把 `data` 改为：

```js
    ecTrend: { lazyLoad: true },
```

并在 Page 顶层（与 onLoad 平级）增加 `_trendChart: null,`：

```js
Page({
  _trendChart: null,

  data: { ... },
```

- [ ] **Step 4: 在 loadDetail 成功分支中初始化趋势图**

把 `loadDetail` 中 `setData({ detail, loading: false, isWarn, hasTrendData })` 之后追加：

```js
      if (hasTrendData) {
        // 等 setData 完成后再初始化（确保 wx:if 内的 ec-canvas 已渲染）
        wx.nextTick(() => this.initTrendChart());
      }
```

- [ ] **Step 5: 在 Page 中追加 initTrendChart 与 onTrendTypeTap 重绘逻辑**

把 `onTrendTypeTap` 替换为：

```js
  onTrendTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.trendType) return;
    this.setData({ trendType: type });
    if (this._trendChart) {
      this._trendChart.setOption(buildTrendOption(this.data.detail.trend, type), true);
    }
  },

  initTrendChart() {
    const comp = this.selectComponent('#trendChart');
    if (!comp) return;
    comp.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
      canvas.setChart(chart);
      chart.setOption(buildTrendOption(this.data.detail.trend, this.data.trendType));
      this._trendChart = chart;
      return chart;
    });
  },
```

- [ ] **Step 6: 验证**

模拟器打开详情页。预期：
- 趋势卡显示双柱状图，6 个月份 X 轴
- 默认"入库"Tab 高亮，"入库"柱蓝色实，"出库"柱蓝色 25% 透明
- 点击"出库"Tab，颜色翻转
- 切换不闪烁

测试趋势数据为空的 material（如新建无任何 records 的）：应显示"暂无数据"占位，不报错。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/index.js
git commit -m "$(cat <<'EOF'
feat(material/inventory-detail): 趋势图接入 ec-canvas（双柱 + Tab 切换）

两个 series 一直在，Tab 切换通过 setOption 改 series 颜色高亮，无重绘闪烁。
空数据时容器换为占位文案。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: 详情页底部抽屉 wxml + wxss（库存调整）

**Files:**
- Modify: `miniprogram/pages/material/inventory-detail/index.wxml`（在 `</view>` 页面闭合之前追加）
- Modify: `miniprogram/pages/material/inventory-detail/index.wxss`（追加抽屉相关样式）

**目标**：在详情页底部嵌入 van-popup 调整表单，纯 UI 暂不接通提交（Task 16 接）。

- [ ] **Step 1: wxml 在 `</view> <!-- bottom-bar -->` 之后、`</view> <!-- page -->` 之前增加抽屉**

在 `<view class="bottom-bar"...>...</view>` 这个块之后、`</view>` 页面闭合之前插入：

```xml
  <!-- 调整抽屉 -->
  <van-popup
    show="{{ showAdjust }}"
    position="bottom"
    round
    closeable
    bind:close="closeAdjust">
    <view class="adj-wrap">
      <view class="adj-title">调整库存</view>
      <view class="adj-meta">{{ detail.material.name }} · 当前库存 <text class="adj-cur {{ isWarn ? 'warn' : 'primary' }}">{{ detail.currentStock }}</text> {{ detail.material.unit || '' }}</view>

      <view class="adj-label">调整类型</view>
      <view class="adj-types">
        <view
          class="adj-type-pill {{ adjForm.type === 'gain' ? 'active gain' : '' }}"
          data-type="gain"
          bind:tap="onAdjTypeTap">+ 盘盈</view>
        <view
          class="adj-type-pill {{ adjForm.type === 'loss' ? 'active loss' : '' }}"
          data-type="loss"
          bind:tap="onAdjTypeTap">- 盘亏</view>
        <view
          class="adj-type-pill {{ adjForm.type === 'scrap' ? 'active loss' : '' }}"
          data-type="scrap"
          bind:tap="onAdjTypeTap">- 报废</view>
        <view
          class="adj-type-pill {{ adjForm.type === 'lost' ? 'active loss' : '' }}"
          data-type="lost"
          bind:tap="onAdjTypeTap">- 丢失</view>
      </view>

      <view class="adj-label">调整数量</view>
      <van-stepper
        value="{{ adjForm.quantity }}"
        min="1"
        integer
        bind:change="onAdjQtyChange"
      />

      <view class="adj-label">调整原因</view>
      <van-field
        type="textarea"
        autosize
        placeholder="如：盘点差异 / 损坏报废 / 物品丢失"
        value="{{ adjForm.reason }}"
        bind:change="onAdjReasonChange"
      />

      <view class="adj-preview {{ adjPreview.tone }}">
        ⚠️ 调整后库存：{{ detail.currentStock }} {{ adjPreview.opSymbol }} {{ adjForm.quantity }} = <text class="adj-preview-val">{{ adjPreview.newStock }}</text>
      </view>

      <button
        class="adj-submit"
        loading="{{ adjSubmitting }}"
        bind:tap="submitAdjust">确认提交</button>
    </view>
  </van-popup>
```

- [ ] **Step 2: wxss 文件末尾追加**

```css
/* 调整抽屉 */
.adj-wrap {
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}
.adj-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 12rpx;
}
.adj-meta {
  font-size: 26rpx;
  color: #5E5E5E;
  margin-bottom: 24rpx;
}
.adj-cur {
  font-weight: 600;
  margin: 0 4rpx;
}
.adj-cur.primary { color: #1677FF; }
.adj-cur.warn    { color: #FF9500; }

.adj-label {
  font-size: 24rpx;
  color: #999;
  margin: 24rpx 0 12rpx;
}
.adj-types {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}
.adj-type-pill {
  padding: 12rpx 24rpx;
  border-radius: 28rpx;
  border: 1rpx solid #E5E6E8;
  background: #FFFFFF;
  color: #666;
  font-size: 26rpx;
}
.adj-type-pill.active.gain {
  background: #E8F5EE;
  color: #00B578;
  border-color: #00B578;
}
.adj-type-pill.active.loss {
  background: #FFF7E6;
  color: #FF9500;
  border-color: #FF9500;
}

.adj-preview {
  margin-top: 24rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
}
.adj-preview.gain { background: #F0F9F2; color: #00734F; }
.adj-preview.loss { background: #FFF7E6; color: #8A6A53; }
.adj-preview-val {
  font-weight: 600;
  margin-left: 4rpx;
}

.adj-submit {
  margin-top: 32rpx;
  background: #1677FF;
  color: #FFFFFF;
  border: none;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.adj-submit::after { border: none; }
```

- [ ] **Step 3: 验证**

模拟器打开详情页，先点底部"修改库存"——抽屉不会弹，因为 Task 13 的 `openAdjust` 是空的。这一步只验证 wxml/wxss 编译通过、若手动 setData `showAdjust: true` 抽屉视觉正确。可以临时改 onLoad 末尾加 `this.setData({ showAdjust: true, adjForm: { type: 'gain', quantity: 1, reason: '' }, adjPreview: { tone: 'gain', opSymbol: '+', newStock: 0 } })` 临时验证视觉，验证完撤回。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/index.wxml miniprogram/pages/material/inventory-detail/index.wxss
git commit -m "$(cat <<'EOF'
feat(material/inventory-detail): + 调整抽屉 wxml/wxss（4 类型 pill + 数量 + 原因 + 预览）

van-popup position=bottom；4 调整类型用 pill 单选；提交按钮主色蓝。
交互在下个 task 接通。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: 调整抽屉 js 接通（表单 / 预校验 / 提交 / 刷新）

**Files:**
- Modify: `miniprogram/pages/material/inventory-detail/index.js`

**目标**：完整接通调整抽屉表单与提交逻辑。

- [ ] **Step 1: 在 data 中追加抽屉状态**

把 `data: { ... }` 中 `_trendChart` 之前补充以下字段：

```js
    showAdjust: false,
    adjForm: { type: '', quantity: 1, reason: '' },
    adjSubmitting: false,
    adjPreview: { tone: 'gain', opSymbol: '+', newStock: 0 },
```

最终 data 应为：

```js
  data: {
    materialId: 0,
    detail: null,
    loading: true,
    canAdjust: false,
    isWarn: false,
    hasTrendData: false,
    trendType: 'in',
    ecTrend: { lazyLoad: true },
    showAdjust: false,
    adjForm: { type: '', quantity: 1, reason: '' },
    adjSubmitting: false,
    adjPreview: { tone: 'gain', opSymbol: '+', newStock: 0 },
  },
```

- [ ] **Step 2: 替换 `openAdjust` 实现**

把 Task 13 的空 `openAdjust() {}` 改为：

```js
  openAdjust() {
    this.setData({
      showAdjust: true,
      adjForm: { type: 'gain', quantity: 1, reason: '' },
    });
    this.refreshPreview();
  },

  closeAdjust() {
    if (this.data.adjSubmitting) return;
    this.setData({ showAdjust: false });
  },
```

- [ ] **Step 3: 增加表单事件 + 预览刷新 + 提交**

在 Page 内追加：

```js
  onAdjTypeTap(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ ['adjForm.type']: type });
    this.refreshPreview();
  },

  onAdjQtyChange(e) {
    const q = Number(e.detail) || 1;
    this.setData({ ['adjForm.quantity']: q });
    this.refreshPreview();
  },

  onAdjReasonChange(e) {
    this.setData({ ['adjForm.reason']: e.detail || '' });
  },

  refreshPreview() {
    const f = this.data.adjForm;
    const cur = this.data.detail ? this.data.detail.currentStock : 0;
    const op = f.type === 'gain' ? '+' : '-';
    const tone = f.type === 'gain' ? 'gain' : 'loss';
    const newStock = f.type === 'gain' ? cur + f.quantity : cur - f.quantity;
    this.setData({
      adjPreview: { tone, opSymbol: op, newStock },
    });
  },

  async submitAdjust() {
    const f = this.data.adjForm;
    if (!f.type) {
      wx.showToast({ title: '请选择调整类型', icon: 'none' });
      return;
    }
    if (!f.quantity || f.quantity <= 0) {
      wx.showToast({ title: '请输入调整数量', icon: 'none' });
      return;
    }
    if (!f.reason || f.reason.trim().length < 2) {
      wx.showToast({ title: '请填写调整原因', icon: 'none' });
      return;
    }
    if (f.type !== 'gain' && f.quantity > this.data.detail.currentStock) {
      wx.showToast({ title: `库存不足，当前 ${this.data.detail.currentStock}`, icon: 'none' });
      return;
    }

    this.setData({ adjSubmitting: true });
    const res = await materialService.adjustStock({
      material_id: this.data.materialId,
      adjust_type: f.type,
      quantity: f.quantity,
      reason: f.reason.trim(),
    });
    this.setData({ adjSubmitting: false });

    if (res && res.success) {
      wx.showToast({ title: '调整成功', icon: 'success' });
      this.setData({ showAdjust: false });
      // 刷新详情
      this.loadDetail();
    }
    // 失败时 cloudCall.js 会自动 toast 错误信息，抽屉保持打开
  },
```

- [ ] **Step 4: 验证**

模拟器以管理员身份打开任一 stock>0 的商品详情：
- 点底部"修改库存" → 抽屉弹出
- 选"盘盈"，数量 5，原因"测试盘盈"→ 预览显示绿色"调整后库存：X + 5 = X+5"
- 点"确认提交"→ 成功 toast → 抽屉关闭 → 详情页 currentStock 已更新 +5；流转记录新增一条"盘盈 +5"

错误用例：
- 不选类型 / 不填原因 → toast 提示
- 选"盘亏"数量 > 当前库存 → 前端 toast 阻止
- 同时多次快速点提交 → adjSubmitting 防重

返回上一页（列表页），下拉刷新或自动 onShow 刷新（之前 Task 9 用了 `_needsReload`），列表中该商品库存 / 状态 / 最近时间应同步。

注：当前 Task 9 中 `_needsReload` 是从 `onCardTap` 设置的；详情页调整后回到列表时已会刷新，保持一致。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/material/inventory-detail/index.js
git commit -m "$(cat <<'EOF'
feat(material/inventory-detail): 调整抽屉接通（表单 / 预校验 / 提交 / 刷新详情）

预览同步显示调整后库存与方向色（盘盈绿 / 其余橙）；
提交成功后关抽屉 + 重新拉详情；
失败由 cloudCall.js 统一 toast，抽屉保持输入。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: 接通首页"库存查询"按钮跳转

**Files:**
- Modify: `miniprogram/pages/home/index.js`

**目标**：首页耗品管理 Tab → "库存查询"按钮 → 跳到新建的 inventory 列表页。

- [ ] **Step 1: 找到现有的"出库管理"分支**

`pages/home/index.js:305-315` 已有：

```js
    // 耗品管理 - 出库管理（material/index Tab2）
    if (module === 'consumable' && label === '出库管理') {
      wx.navigateTo({
        url: '/pages/material/index?tab=1',
        ...
      });
      return;
    }
```

- [ ] **Step 2: 在"出库管理"分支之后、最末"showToast"之前插入**

```js
    // 耗品管理 - 库存查询（独立页）
    if (module === 'consumable' && label === '库存查询') {
      wx.navigateTo({
        url: '/pages/material/inventory/index',
        fail: (err) => {
          console.error('navigateTo failed:', err);
          wx.reLaunch({ url: '/pages/material/inventory/index' });
        }
      });
      return;
    }
```

- [ ] **Step 3: 验证**

微信开发者工具 → 模拟器 → 首页 → 切到"耗品管理"Tab → 点击"库存查询"按钮 → 应跳到 inventory 列表页。

不同角色端到端测试：
- 管理员（role 1）：能进入；详情页底部"修改库存"按钮**显示**
- 行政经理（role 2）：能进入；底部按钮**显示**（spec §6 矩阵）
- 办美员工（role 4）：能进入；底部按钮**不显示**
- 仓管员（role 5）：能进入；底部按钮**显示**
- 维修员（role 3）：耗品管理 Tab 本身就进不来（home/index 已收紧）

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/home/index.js
git commit -m "$(cat <<'EOF'
feat(home): 接通"库存查询"按钮跳转 → /pages/material/inventory/index

之前点击仅 toast 占位，本次接通到新建的库存查询页。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: 全路径手动回归 + 自检清单

**Files:**
- 仅作验证，无文件改动

**目标**：按 spec §11 自检清单走完整链路，确认所有边界场景都能正确处理。

- [ ] **Step 1: 准备 4 类用户**

在 CloudBase 控制台 `users` 集合，至少有 4 个不同 `role_id` 的活跃用户：1（管理员）、2（行政经理）、4（办美员工）、5（仓管员）。

- [ ] **Step 2: 数据准备（可选）**

确认 materials 集合中至少包含：
- 1 条 `stock = 0` 的（缺货）
- 1 条 `0 < stock <= min_stock` 的（预警）
- 数条 `stock > min_stock` 的（正常）

如不足，可在管理员账号下进入耗品管理 → 入库管理，新建几条不同状态的物资。

- [ ] **Step 3: 角色场景验证**

**管理员（role 1）：**
- [ ] 首页 → 耗品 → 库存查询 → 列表加载完成
- [ ] 4 状态按钮的数字 = 实际数量；点"预警"过滤生效；点"缺货"过滤生效
- [ ] 搜索关键字过滤生效
- [ ] 上拉加载更多（如总数 > 20）
- [ ] 点缺货商品卡 → 详情页显示橙色"当前库存 0"，左色条红
- [ ] 点预警商品卡 → 详情页显示橙色当前库存
- [ ] 趋势图显示 6 个月柱状，Tab 切换"入库/出库"颜色翻转
- [ ] 消耗分析"消耗最多场景"显示"暂无数据"占位
- [ ] 流转记录显示最近 3 条
- [ ] 底部"修改库存"按钮显示
- [ ] 调整 → 盘盈 5 包 → 成功 → currentStock +5 → 流转记录顶部多一条 +5
- [ ] 调整 → 盘亏 9999 包（超库存）→ 前端 toast 阻止
- [ ] 调整 → 不填原因 → toast 阻止
- [ ] 返回列表 → 该商品 stock 已更新

**行政经理（role 2）：**
- [ ] 列表能进；详情页底部按钮**显示**
- [ ] 调整能成功

**办美员工（role 4）：**
- [ ] 列表能进；详情页底部按钮**不显示**

**仓管员（role 5）：**
- [ ] 列表能进；详情页底部按钮**显示**
- [ ] 调整能成功

**维修员（role 3）：**
- [ ] 首页耗品 Tab 已被前端隐藏（之前任务做的），无需测试库存查询入口

- [ ] **Step 4: 边界场景**

- [ ] 空 materials 表（清空后再测）：列表显示"暂无数据"
- [ ] 趋势图无数据的商品（新建无 records 的）：趋势卡显示"暂无数据"占位，不抛错
- [ ] 流转记录为空：不渲染流转记录区域（wx:if 已守护）
- [ ] 网络断开（开发者工具勾选离线）：调用云函数失败 → cloudCall.js 统一 toast，详情页保持 loading 或回退
- [ ] 并发模拟（如有条件）：同一商品两个用户同时调整 → 第 2 个返回"数据已更新，请刷新重试"

- [ ] **Step 5: 提交回归记录（仅当存在改动时）**

如发现 bug 修复，单独提交。如全通过，无需新提交，直接结束。可选写一份回归报告：

```bash
# 不必提交。如要记录可写到 docs/superpowers/plans/ 或团队内部 wiki。
```

---

## 完成

至此，库存查询模块全部 18 个任务完成。

**总计变更：**
- 后端 1 个云函数文件，新增 3 case + 1 case 扩展（约 +200 行）
- 前端 8 个新文件（2 个新页面）+ 4 个改造文件
- 数据库 4 个可选新字段（自动写入，无须迁移）
- 视觉严格复刻 Pencil `AkohR` 详情页，列表 4 状态用 pill + badge

**部署清单：**
- [ ] cloudfunctions/materialManager 上传并部署（任务 1-4 部署一次即可）
- [ ] 微信开发者工具重新编译前端
- [ ] 真机打开模拟测试

**潜在后续：**
- 列表"消耗最多场景"等出库申请功能回归后接通真实 scene 字段
- 列表 N+1 查询若未来性能瓶颈，再在 materials 上冗余 last_in_date / last_out_date
- 库存调整审核流程（spec §1 不在范围中标注）
