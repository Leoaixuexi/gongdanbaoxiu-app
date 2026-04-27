/**
 * 配件 CRUD handlers
 */
const { db, _, getNextId, canManageMaterial } = require('../helpers');

async function getMaterialByNumber({ data }) {
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

// 新增：按 material_id 取配件（出库审核取最新库存用）
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
    conditions.name = db.RegExp({
      regexp: keyword,
      options: 'i'
    });
  }

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

async function addMaterial({ data, user }) {
  if (!canManageMaterial(user)) {
    return { success: false, error: '无权限新增配件' };
  }

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

async function updateMaterial({ data, user }) {
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
  const allowed = ['name', 'material_number', 'category', 'unit', 'spec', 'model', 'source', 'usage_area', 'min_stock', 'images'];
  allowed.forEach(k => {
    if (fields[k] !== undefined) updateData[k] = fields[k];
  });
  if (updateData.min_stock !== undefined) {
    updateData.min_stock = Number(updateData.min_stock) || 0;
  }
  await db.collection('materials').doc(mats[0]._id).update({ data: updateData });
  return { success: true, message: '更新成功' };
}

async function deleteMaterial({ data, user }) {
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

async function listRecords({ data }) {
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

async function getMaterialStats({ data }) {
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

module.exports = {
  getMaterialByNumber,
  getMaterialById,
  listMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  listRecords,
  getMaterialStats,
};
