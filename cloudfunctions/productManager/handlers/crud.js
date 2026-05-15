/**
 * 商品 CRUD handlers
 */
const { db, getNextId, canManageProduct } = require('../helpers');

async function getProductByCode({ data }) {
  const { product_code } = data;
  if (!product_code) {
    return { success: false, error: '缺少 product_code' };
  }

  const { data: list } = await db.collection('products')
    .where({ product_code })
    .limit(1)
    .get();

  if (list.length === 0) {
    return { success: true, product: null };
  }

  return { success: true, product: list[0] };
}

async function getProductById({ data }) {
  const { product_id } = data;
  if (!product_id) return { success: false, error: '缺少 product_id' };

  const { data: list } = await db.collection('products')
    .where({ product_id }).limit(1).get();

  if (list.length === 0) return { success: false, error: '商品不存在' };
  return { success: true, product: list[0] };
}

async function listProducts({ data }) {
  const { keyword, page = 1, pageSize = 20 } = data;
  const conditions = {};

  if (keyword) {
    conditions.name = db.RegExp({
      regexp: keyword,
      options: 'i'
    });
  }

  const query = db.collection('products').where(conditions);
  const [countRes, listRes] = await Promise.all([
    query.count(),
    query.orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
  ]);

  return {
    success: true,
    products: listRes.data,
    total: countRes.total,
    page,
    pageSize,
  };
}

async function addProduct({ data, user }) {
  if (!canManageProduct(user)) {
    return { success: false, error: '无权限新增商品' };
  }

  const {
    product_code, name, category, unit,
    source = '', min_stock = 0, spec = '', model = '',
    purchase_price = 0,
    images = [], remark = ''
  } = data;

  if (!name || !category || !unit) {
    return { success: false, error: '请填写完整的商品信息' };
  }

  let finalProductCode = product_code;
  if (!finalProductCode) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { total: todayCount } = await db.collection('products')
      .where({ product_code: db.RegExp({ regexp: `^P${dateStr}`, options: 'i' }) })
      .count();
    finalProductCode = `P${dateStr}${String(todayCount + 1).padStart(4, '0')}`;
  } else {
    const { total: numExists } = await db.collection('products')
      .where({ product_code: finalProductCode })
      .count();
    if (numExists > 0) {
      return { success: false, error: '商品编号已存在' };
    }
  }

  const productId = await getNextId('products');
  const now = new Date();

  await db.collection('products').add({
    data: {
      product_id: productId,
      product_code: finalProductCode,
      name,
      category,
      unit,
      source,
      spec,
      model,
      images: images.slice(0, 3),
      stock: 0,
      min_stock: Math.max(0, Number(min_stock) || 0),
      purchase_price: Math.max(0, Number(purchase_price) || 0),
      remark,
      created_at: now,
      updated_at: now,
      created_by: { user_id: user.user_id, name: user.name },
    }
  });

  return {
    success: true,
    product_id: productId,
    message: '商品添加成功',
  };
}

async function updateProduct({ data, user }) {
  if (!canManageProduct(user)) {
    return { success: false, error: '无权限修改商品' };
  }
  const { product_id, ...fields } = data;
  const { data: list } = await db.collection('products')
    .where({ product_id })
    .get();
  if (!list.length) {
    return { success: false, error: '商品不存在' };
  }
  const updateData = { updated_at: new Date() };
  const allowed = ['name', 'product_code', 'category', 'unit', 'spec', 'model', 'source', 'usage_area', 'min_stock', 'purchase_price', 'images'];
  allowed.forEach(k => {
    if (fields[k] !== undefined) updateData[k] = fields[k];
  });
  if (updateData.min_stock !== undefined) {
    updateData.min_stock = Math.max(0, Number(updateData.min_stock) || 0);
  }
  if (updateData.purchase_price !== undefined) {
    updateData.purchase_price = Math.max(0, Number(updateData.purchase_price) || 0);
  }
  await db.collection('products').doc(list[0]._id).update({ data: updateData });
  return { success: true, message: '更新成功' };
}

async function deleteProduct({ data, user }) {
  if (!canManageProduct(user)) {
    return { success: false, error: '无权限删除商品' };
  }
  const { product_id } = data;
  const { data: list } = await db.collection('products')
    .where({ product_id })
    .get();
  if (!list.length) {
    return { success: false, error: '商品不存在' };
  }
  await db.collection('products').doc(list[0]._id).remove();
  return { success: true, message: '删除成功' };
}

async function listRecords({ data }) {
  const { type, product_id, page = 1, pageSize = 20 } = data;
  const conditions = {};

  if (type === 'in' || type === 'out') {
    conditions.type = type;
  }
  if (product_id) {
    conditions.product_id = product_id;
  }

  const rQuery = db.collection('product_records').where(conditions);
  const [countRes, listRes] = await Promise.all([
    rQuery.count(),
    rQuery.orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
  ]);

  return {
    success: true,
    records: listRes.data,
    total: countRes.total,
    page,
    pageSize,
  };
}

async function getProductStats({ data }) {
  const { product_id } = data;
  if (!product_id) {
    return { success: false, error: '缺少 product_id' };
  }
  const { data: records } = await db.collection('product_records')
    .where({ product_id })
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
  getProductByCode,
  getProductById,
  listProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  listRecords,
  getProductStats,
};
