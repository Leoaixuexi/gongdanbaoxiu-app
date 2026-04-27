/**
 * 测试数据种子 handler（开发用）
 */
const { db, getNextId, canManageMaterial } = require('../helpers');

async function seedTestData({ user }) {
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

module.exports = { seedTestData };
