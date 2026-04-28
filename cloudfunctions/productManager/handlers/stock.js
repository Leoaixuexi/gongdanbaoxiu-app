/**
 * 入出库 handlers（直写库存）
 */
const { db, _, getNextId, canManageProduct } = require('../helpers');

async function stockIn({ data, user }) {
  if (!canManageProduct(user)) {
    return { success: false, error: '无权限执行入库操作' };
  }

  const { product_id, quantity, remark = '', location = '' } = data;
  if (!product_id || !quantity || quantity <= 0) {
    return { success: false, error: '请填写正确的入库信息' };
  }

  const { data: list } = await db.collection('products')
    .where({ product_id })
    .get();
  if (list.length === 0) {
    return { success: false, error: '商品不存在' };
  }

  const product = list[0];
  const now = new Date();
  const qty = Number(quantity);

  const [recordId] = await Promise.all([
    getNextId('product_records'),
    db.collection('products').doc(product._id).update({
      data: { stock: _.inc(qty), updated_at: now }
    })
  ]);

  await db.collection('product_records').add({
    data: {
      record_id: recordId,
      product_id,
      product_name: product.name,
      product_code: product.product_code || '',
      category: product.category || '',
      spec: product.spec || '',
      model: product.model || '',
      usage_area: location || product.usage_area || '',
      product_image: (product.images && product.images[0]) || '',
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
  const { product_id, quantity, remark = '' } = data;
  if (!product_id || !quantity || quantity <= 0) {
    return { success: false, error: '请填写正确的出库信息' };
  }

  const { data: list } = await db.collection('products')
    .where({ product_id })
    .get();
  if (list.length === 0) {
    return { success: false, error: '商品不存在' };
  }

  const product = list[0];
  const qty = Number(quantity);
  if (product.stock < qty) {
    return { success: false, error: `库存不足，当前库存: ${product.stock}` };
  }

  const now = new Date();

  const [recordId] = await Promise.all([
    getNextId('product_records'),
    db.collection('products').doc(product._id).update({
      data: { stock: _.inc(-qty), updated_at: now }
    })
  ]);

  await db.collection('product_records').add({
    data: {
      record_id: recordId,
      product_id,
      product_name: product.name,
      product_code: product.product_code || '',
      category: product.category || '',
      spec: product.spec || '',
      model: product.model || '',
      usage_area: product.usage_area || '',
      product_image: (product.images && product.images[0]) || '',
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
  const { data: allWithMinStock } = await db.collection('products')
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
