/**
 * 商品（耗品）管理云函数（路由分发）
 */
const {
  cloud, getEffectiveOpenId, getUserByOpenId, canAccessProduct,
} = require('./helpers');
const crud = require('./handlers/crud');
const stock = require('./handlers/stock');
const seed = require('./handlers/seed');

const ROUTES = {
  // CRUD
  getProductByCode: crud.getProductByCode,
  getProductById: crud.getProductById,
  listProducts: crud.listProducts,
  addProduct: crud.addProduct,
  updateProduct: crud.updateProduct,
  deleteProduct: crud.deleteProduct,
  listRecords: crud.listRecords,
  getProductStats: crud.getProductStats,
  // Stock
  stockIn: stock.stockIn,
  stockOut: stock.stockOut,
  getWarnings: stock.getWarnings,
  // Seed (dev only)
  seedTestData: seed.seedTestData,
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) return { success: false, error: '无法获取微信身份' };

  console.log(`[ProductManager] Action: ${action}, OpenID: ${openid}`);

  try {
    const user = await getUserByOpenId(openid);
    if (!user) return { success: false, error: '用户不存在' };

    if (!canAccessProduct(user)) {
      return { success: false, error: '无权限访问商品管理' };
    }

    const handler = ROUTES[action];
    if (!handler) return { success: false, error: `未知操作: ${action}` };

    return await handler({ data, user, openid, event });
  } catch (error) {
    console.error('[ProductManager] Error:', error);
    return { success: false, error: error.message };
  }
};
