/**
 * 入出库 handlers（直写库存的旧路径，保留供工单完成扣库存等使用）
 */
const { db, _, getNextId, canManageMaterial } = require('../helpers');

async function stockIn({ data, user }) {
  if (!canManageMaterial(user)) {
    return { success: false, error: '无权限执行入库操作' };
  }

  const { material_id, quantity, remark = '', location = '' } = data;
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

  const [recordId] = await Promise.all([
    getNextId('material_records'),
    db.collection('materials').doc(material._id).update({
      data: { stock: _.inc(qty), updated_at: now }
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
      usage_area: location || material.usage_area || '',
      material_image: (material.images && material.images[0]) || '',
      type: 'in',
      quantity: qty,
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

async function stockOut({ data, user }) {
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

async function getWarnings() {
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

module.exports = { stockIn, stockOut, getWarnings };
