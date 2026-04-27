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
