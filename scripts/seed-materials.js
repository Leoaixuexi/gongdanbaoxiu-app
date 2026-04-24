/**
 * 物料测试数据种子脚本
 *
 * 使用方法：在微信开发者工具的「云开发」控制台中，
 * 打开「数据库」，选择 materials 集合，手动添加以下文档。
 *
 * 或者在小程序页面控制台中执行：
 *   getApp().seedMaterials()
 */

const testMaterials = [
  {
    material_id: 1001,
    material_number: 'PJ-2024-0156',
    name: '空气滤芯 AF-2035',
    category: '滤芯类',
    unit: '个',
    spec: '200×150×50mm',
    source: '采购',
    usage_area: '生产车间A',
    images: [],
    stock: 45,
    min_stock: 10,
    remark: '定期更换',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: { user_id: 1, name: '管理员' }
  },
  {
    material_id: 1002,
    material_number: 'PJ-2024-0089',
    name: '轴承 SKF-6205',
    category: '轴承类',
    unit: '个',
    spec: '25×52×15mm',
    source: '采购',
    usage_area: '维修车间B',
    images: [],
    stock: 8,
    min_stock: 10,
    remark: '高精度轴承',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: { user_id: 1, name: '管理员' }
  },
  {
    material_id: 1003,
    material_number: 'PJ-2024-0203',
    name: '液压油管 HY-150',
    category: '管路类',
    unit: '米',
    spec: 'Φ15×2000mm',
    source: '采购',
    usage_area: '维修车间B',
    images: [],
    stock: 0,
    min_stock: 5,
    remark: '',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: { user_id: 1, name: '管理员' }
  },
  {
    material_id: 1004,
    material_number: 'PJ-2024-0178',
    name: '密封圈 OR-88',
    category: '密封类',
    unit: '个',
    spec: 'Φ88×3.5mm',
    source: '采购',
    usage_area: '库存位置 B-01-07',
    images: [],
    stock: 0,
    min_stock: 20,
    remark: '',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: { user_id: 1, name: '管理员' }
  },
  {
    material_id: 1005,
    material_number: 'PJ-2024-0215',
    name: '电机碳刷 CB-40',
    category: '电气',
    unit: '套',
    spec: '40×25×12mm',
    source: '采购',
    usage_area: '生产车间A',
    images: [],
    stock: 30,
    min_stock: 5,
    remark: '适用于Y系列电机',
    created_at: new Date(),
    updated_at: new Date(),
    created_by: { user_id: 1, name: '管理员' }
  }
];

// 导出供 app.js 或控制台使用
module.exports = { testMaterials };
