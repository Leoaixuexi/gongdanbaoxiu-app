/**
 * 测试数据种子 handler（开发用）
 * 仅在 products 集合为空时插入，避免重复 seed
 */
const { db, getNextId, canManageProduct } = require('../helpers');

async function seedTestData({ user }) {
  if (!canManageProduct(user)) {
    return { success: false, error: '无权限' };
  }

  const { total } = await db.collection('products').count();
  if (total > 0) {
    return { success: false, error: `products 已有 ${total} 条数据，跳过 seed（避免重复）` };
  }

  const now = new Date();
  const testItems = [
    { product_id: await getNextId('products'), product_code: 'P-2024-0001', name: 'A4 复印纸', category: '办公耗品', unit: '包', spec: '500张/包 80g', model: 'A4', source: '采购', usage_area: '行政办公室', images: [], stock: 50, min_stock: 10, purchase_price: 28.00, remark: '常规办公用纸', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
    { product_id: await getNextId('products'), product_code: 'P-2024-0002', name: '矿泉水 550ml', category: '食品饮料', unit: '箱', spec: '24瓶/箱', model: '', source: '采购', usage_area: '前台接待区', images: [], stock: 30, min_stock: 5, purchase_price: 42.50, remark: '会议接待用', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
    { product_id: await getNextId('products'), product_code: 'P-2024-0003', name: '多功能清洁剂', category: '清洁用品', unit: '瓶', spec: '1L', model: '', source: '采购', usage_area: '保洁仓', images: [], stock: 8, min_stock: 10, purchase_price: 18.80, remark: '低于预警值', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
    { product_id: await getNextId('products'), product_code: 'P-2024-0004', name: '中性笔 0.5mm', category: '办公耗品', unit: '盒', spec: '12支/盒', model: '黑色', source: '采购', usage_area: '行政办公室', images: [], stock: 0, min_stock: 5, purchase_price: 15.00, remark: '已缺货，待补货', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
    { product_id: await getNextId('products'), product_code: 'P-2024-0005', name: '抽纸（200抽）', category: '日用百货', unit: '包', spec: '200抽/包', model: '', source: '采购', usage_area: '办公耗材区', images: [], stock: 100, min_stock: 20, purchase_price: 8.50, remark: '', created_at: now, updated_at: now, created_by: { user_id: user.user_id, name: user.name } },
  ];

  for (const item of testItems) {
    await db.collection('products').add({ data: item });
  }

  const inRecords = [
    { record_id: await getNextId('product_records'), product_id: testItems[0].product_id, product_name: testItems[0].name, product_code: testItems[0].product_code, category: testItems[0].category, spec: testItems[0].spec, usage_area: '主仓库', source: '采购入库', type: 'in', quantity: 50, operator: { user_id: user.user_id, name: user.name }, remark: '本批次 50 包，已核验入库', created_at: new Date(now.getTime() - 86400000) },
    { record_id: await getNextId('product_records'), product_id: testItems[1].product_id, product_name: testItems[1].name, product_code: testItems[1].product_code, category: testItems[1].category, spec: testItems[1].spec, usage_area: '主仓库', source: '采购入库', type: 'in', quantity: 30, operator: { user_id: user.user_id, name: user.name }, remark: '会议物资', created_at: new Date(now.getTime() - 172800000) },
    { record_id: await getNextId('product_records'), product_id: testItems[4].product_id, product_name: testItems[4].name, product_code: testItems[4].product_code, category: testItems[4].category, spec: testItems[4].spec, usage_area: '办公耗材区', source: '采购入库', type: 'in', quantity: 100, operator: { user_id: user.user_id, name: user.name }, remark: '', created_at: new Date(now.getTime() - 259200000) },
  ];

  for (const r of inRecords) {
    await db.collection('product_records').add({ data: r });
  }

  return { success: true, message: `已插入 ${testItems.length} 条商品 + ${inRecords.length} 条入库记录` };
}

module.exports = { seedTestData };
