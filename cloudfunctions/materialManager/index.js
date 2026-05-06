/**
 * 物料管理云函数
 * 处理配件的增删改查、出入库、库存预警
 */

const {
  cloud,
  db,
  _,
  getEffectiveOpenId,
  getUserByOpenId,
  canAccessMaterial,
  canManageMaterial,
  getNextId,
} = require('./helpers');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) {
    return { success: false, error: '无法获取微信身份' };
  }

  console.log(`[MaterialManager] Action: ${action}, OpenID: ${openid}`);

  try {
    const user = await getUserByOpenId(openid);
    if (!user) {
      return { success: false, error: '用户不存在' };
    }

    // 统一权限校验：所有操作都需要物料访问权限
    if (!canAccessMaterial(user)) {
      return { success: false, error: '无权限访问物料管理' };
    }

    switch (action) {
      // ===== 按编号查询配件（扫码入库前置） =====
      case 'getMaterialByNumber': {
        const { material_number } = data;
        if (!material_number) {
          return { success: false, error: '缺少 material_number' };
        }

        const { data: list } = await db.collection('materials')
          .where({ material_number })
          .limit(1)
          .get();

        if (list.length === 0) {
          return { success: true, material: null };
        }

        return { success: true, material: list[0] };
      }

      // ===== 配件列表 =====
      case 'listMaterials': {
        const {
          keyword, page = 1, pageSize = 20,
          categories = [], usage_areas = [], storage_areas = [],
        } = data;
        const conditions = {};

        if (keyword) {
          conditions.name = db.RegExp({ regexp: keyword, options: 'i' });
        }
        const arrayFilters = [
          ['category', categories],
          ['usage_area', usage_areas],
          ['storage_area', storage_areas],
        ];
        arrayFilters.forEach(([field, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            conditions[field] = _.in(values);
          }
        });

        const query = db.collection('materials').where(conditions);
        const [countRes, listRes] = await Promise.all([
          query.count(),
          query.orderBy('created_at', 'desc')
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .get()
        ]);

        return {
          success: true,
          materials: listRes.data,
          total: countRes.total,
          page,
          pageSize,
        };
      }

      // ===== 使用区域 distinct 列表（筛选弹层用） =====
      case 'listMaterialAreas': {
        const { list } = await db.collection('materials')
          .aggregate()
          .group({ _id: '$usage_area' })
          .end();
        const usage_areas = (list || [])
          .map(item => item._id)
          .filter(v => typeof v === 'string' && v.trim() !== '');
        return { success: true, usage_areas };
      }

      // ===== 新增配件 =====
      case 'addMaterial': {
        if (!canManageMaterial(user)) {
          return { success: false, error: '无权限新增配件' };
        }

        const {
          material_number, name, category, unit,
          source = '', stock_in_time, quantity = 0,
          usage_area = '', storage_area = '', min_stock = 0, spec = '', model = '',
          images = [], remark = ''
        } = data;

        if (!name || !category || !unit) {
          return { success: false, error: '请填写完整的配件信息' };
        }

        let finalMaterialNumber = material_number;
        if (!finalMaterialNumber) {
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const { total: todayCount } = await db.collection('materials')
            .where({ material_number: db.RegExp({ regexp: `^M${dateStr}`, options: 'i' }) })
            .count();
          finalMaterialNumber = `M${dateStr}${String(todayCount + 1).padStart(4, '0')}`;
        } else {
          const { total: numExists } = await db.collection('materials')
            .where({ material_number: finalMaterialNumber })
            .count();
          if (numExists > 0) {
            return { success: false, error: '配件编号已存在' };
          }
        }

        const materialId = await getNextId('materials');
        const initQty = Number(quantity) || 0;
        const now = new Date();
        const parsedStockInTime = stock_in_time ? new Date(stock_in_time) : now;

        await db.collection('materials').add({
          data: {
            material_id: materialId,
            material_number: finalMaterialNumber,
            name,
            category,
            unit,
            source,
            stock_in_time: parsedStockInTime,
            usage_area,
            storage_area,
            spec,
            model,
            images: images.slice(0, 3),
            stock: initQty,
            min_stock: Number(min_stock) || 0,
            remark,
            created_at: now,
            updated_at: now,
            created_by: { user_id: user.user_id, name: user.name },
          }
        });

        if (initQty > 0) {
          const recordId = await getNextId('material_records');
          await db.collection('material_records').add({
            data: {
              record_id: recordId,
              material_id: materialId,
              material_name: name,
              type: 'in',
              quantity: initQty,
              operator: { user_id: user.user_id, name: user.name },
              remark: '新增配件初始入库',
              created_at: parsedStockInTime,
            }
          });
        }

        return {
          success: true,
          material_id: materialId,
          message: '配件添加成功',
        };
      }

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

      // ===== 配件出库 =====
      case 'stockOut': {
        const { material_id, quantity, remark = '' } = data;
        if (!material_id || !quantity || quantity <= 0) {
          return { success: false, error: '请填写正确的出库信息' };
        }

        const { data: materials } = await db.collection('materials')
          .where({ material_id })
          .get();
        if (materials.length === 0) {
          return { success: false, error: '配件不存在' };
        }

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
            record_id: recordId,
            material_id,
            material_name: material.name,
            material_number: material.material_number || '',
            category: material.category || '',
            spec: material.spec || '',
            model: material.model || '',
            usage_area: material.usage_area || '',
            material_image: (material.images && material.images[0]) || '',
            type: 'out',
            quantity: qty,
            operator: { user_id: user.user_id, name: user.name },
            remark,
            created_at: now,
          }
        });

        return {
          success: true,
          message: '出库成功',
        };
      }

      // ===== 更新配件 =====
      case 'updateMaterial': {
        if (!canManageMaterial(user)) {
          return { success: false, error: '无权限修改配件' };
        }
        const { material_id, ...fields } = data;
        const { data: mats } = await db.collection('materials')
          .where({ material_id })
          .get();
        if (!mats.length) {
          return { success: false, error: '配件不存在' };
        }
        const updateData = { updated_at: new Date() };
        const allowed = ['name', 'material_number', 'category', 'unit', 'spec', 'model', 'source', 'usage_area', 'storage_area', 'min_stock', 'images'];
        allowed.forEach(k => {
          if (fields[k] !== undefined) updateData[k] = fields[k];
        });
        if (updateData.min_stock !== undefined) {
          updateData.min_stock = Number(updateData.min_stock) || 0;
        }
        await db.collection('materials').doc(mats[0]._id).update({ data: updateData });
        return { success: true, message: '更新成功' };
      }

      // ===== 删除配件 =====
      case 'deleteMaterial': {
        if (!canManageMaterial(user)) {
          return { success: false, error: '无权限删除配件' };
        }
        const { material_id } = data;
        const { data: mats } = await db.collection('materials')
          .where({ material_id })
          .get();
        if (!mats.length) {
          return { success: false, error: '配件不存在' };
        }
        await db.collection('materials').doc(mats[0]._id).remove();
        return { success: true, message: '删除成功' };
      }

      // ===== 出入库记录 =====
      case 'listRecords': {
        const { type, material_id, page = 1, pageSize = 20 } = data;
        const conditions = {};

        if (type === 'in' || type === 'out') {
          conditions.type = type;
        }
        if (material_id) {
          conditions.material_id = material_id;
        }

        const rQuery = db.collection('material_records').where(conditions);
        const [countRes, listRes] = await Promise.all([
          rQuery.count(),
          rQuery.orderBy('created_at', 'desc')
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .get()
        ]);
        const total = countRes.total;
        const { data: records } = listRes;

        return {
          success: true,
          records,
          total,
          page,
          pageSize,
        };
      }

      // ===== 配件统计（累计入库/出库） =====
      case 'getMaterialStats': {
        const { material_id } = data;
        if (!material_id) {
          return { success: false, error: '缺少 material_id' };
        }
        const { data: records } = await db.collection('material_records')
          .where({ material_id })
          .limit(1000)
          .get();
        const total_in = records
          .filter(r => r.type === 'in')
          .reduce((sum, r) => sum + (r.quantity || 0), 0);
        const total_out = records
          .filter(r => r.type === 'out')
          .reduce((sum, r) => sum + (r.quantity || 0), 0);
        return { success: true, total_in, total_out };
      }

      // ===== 库存预警 =====
      case 'getWarnings': {
        // 云数据库不支持两字段比较，先按 min_stock>0 筛选，再在 JS 中过滤
        const { data: allWithMinStock } = await db.collection('materials')
          .where({ min_stock: _.gt(0) })
          .limit(1000)
          .get();

        const warningList = allWithMinStock.filter(m => m.stock <= m.min_stock);

        return {
          success: true,
          warnings: warningList,
          total: warningList.length,
        };
      }

      // ===== 插入测试数据（开发用） =====
      case 'seedTestData': {
        if (!canManageMaterial(user)) {
          return { success: false, error: '无权限' };
        }
        const now = new Date();
        const testItems = [
          { material_id: await getNextId('materials'), material_number: 'PJ-2024-0156', name: '空气滤芯', category: '滤芯类', unit: '个', spec: '200×150×50mm', model: 'AF-2035', source: '采购', usage_area: '生产车间A', images: [], stock: 45, min_stock: 10, remark: '定期更换', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
          { material_id: await getNextId('materials'), material_number: 'PJ-2024-0089', name: '深沟球轴承', category: '轴承类', unit: '个', spec: '25×52×15mm', model: 'SKF-6205', source: '采购', usage_area: '维修车间B', images: [], stock: 8, min_stock: 10, remark: '高精度轴承', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
          { material_id: await getNextId('materials'), material_number: 'PJ-2024-0203', name: '液压油管', category: '管路类', unit: '米', spec: 'Φ15×2000mm', model: 'HY-150', source: '采购', usage_area: '维修车间B', images: [], stock: 0, min_stock: 5, remark: '', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
          { material_id: await getNextId('materials'), material_number: 'PJ-2024-0178', name: '橡胶密封圈', category: '密封类', unit: '个', spec: 'Φ88×3.5mm', model: 'OR-88', source: '采购', usage_area: 'B-01-07', images: [], stock: 0, min_stock: 20, remark: '', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
          { material_id: await getNextId('materials'), material_number: 'PJ-2024-0215', name: '电机碳刷', category: '电气', unit: '套', spec: '40×25×12mm', model: 'CB-40', source: '采购', usage_area: '生产车间A', images: [], stock: 30, min_stock: 5, remark: '适用于Y系列电机', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
        ];
        for (const item of testItems) {
          await db.collection('materials').add({ data: item });
        }

        // 入库记录（3条）
        const inRecords = [
          { record_id: await getNextId('material_records'), material_id: testItems[0].material_id, material_name: '空气滤芯 AF-2035', material_number: 'PJ-2024-0156', spec: '200×150×50mm', source: '采购入库', type: 'in', quantity: 50, operator: { user_id: user.user_id, name: '张伟' }, remark: '本批次为常规采购补货，已核验入库。', created_at: new Date('2024-03-15T14:30:00') },
          { record_id: await getNextId('material_records'), material_id: testItems[1].material_id, material_name: '轴承 SKF-6205', material_number: 'PJ-2024-0089', spec: '25×52×15mm', source: '调拨入库', type: 'in', quantity: 100, operator: { user_id: user.user_id, name: '李明' }, remark: '', created_at: new Date('2024-03-14T10:15:00') },
          { record_id: await getNextId('material_records'), material_id: testItems[3].material_id, material_name: '密封圈 OR-88', material_number: 'PJ-2024-0178', spec: 'Φ88×3.5mm', source: '采购入库', type: 'in', quantity: 200, operator: { user_id: user.user_id, name: '王磊' }, remark: '', created_at: new Date('2024-03-13T08:45:00') },
        ];
        for (const r of inRecords) {
          await db.collection('material_records').add({ data: r });
        }

        // 出库记录（3条）
        const outRecords = [
          { record_id: await getNextId('material_records'), record_number: 'CK-2024-0067', material_id: testItems[1].material_id, material_name: '轴承 SKF-6205', material_number: 'PJ-2024-0089', spec: '25×52×15mm', category: '轴承类', usage_area: '维修车间B', type: 'out', quantity: 10, operator: { user_id: user.user_id, name: '李明' }, remark: '设备定期维护领用', created_at: new Date('2024-03-14T09:15:00') },
          { record_id: await getNextId('material_records'), record_number: 'CK-2024-0068', material_id: testItems[3].material_id, material_name: '密封圈 OR-88', material_number: 'PJ-2024-0178', spec: 'Φ88×3.5mm', category: '密封类', usage_area: '生产线岗位', type: 'out', quantity: 30, operator: { user_id: user.user_id, name: '王磊' }, remark: '', created_at: new Date('2024-03-13T16:42:00') },
          { record_id: await getNextId('material_records'), record_number: 'CK-2024-0069', material_id: testItems[2].material_id, material_name: '液压油管 HY-150', material_number: 'PJ-2024-0203', spec: 'Φ15×2000mm', category: '管路类', usage_area: '维修车间B', type: 'out', quantity: 5, operator: { user_id: user.user_id, name: '张伟' }, remark: '报废更换领用', created_at: new Date('2024-03-12T10:20:00') },
        ];
        for (const r of outRecords) {
          await db.collection('material_records').add({ data: r });
        }

        return { success: true, message: '已插入5条配件 + 3条入库记录 + 3条出库记录' };
      }

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

      default:
        return {
          success: false,
          error: `未知操作: ${action}`,
        };
    }

  } catch (error) {
    console.error('[MaterialManager] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
