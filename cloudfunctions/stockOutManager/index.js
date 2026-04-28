/**
 * 出库管理云函数（路由分发）
 */
const {
  cloud, getEffectiveOpenId, getUserByOpenId, canAccessStockOut,
} = require('./helpers');

const ROUTES = {
  ping: async () => ({ success: true, message: 'stockOutManager pong' }),
  // Task 2-8 加入：
  // createStockOutRequest, approveStockOutRequest, rejectStockOutRequest,
  // cancelStockOutRequest, listStockOutRequests, getStockOutRequest,
  // getMaterialById, listMaterials
};

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data = {} } = event;

  const openid = getEffectiveOpenId(wxContext, event);
  if (!openid) return { success: false, error: '无法获取微信身份' };

  console.log(`[StockOutManager] Action: ${action}, OpenID: ${openid}`);

  try {
    const user = await getUserByOpenId(openid);
    if (!user) return { success: false, error: '用户不存在' };

    if (!canAccessStockOut(user)) {
      return { success: false, error: '无权限访问出库管理' };
    }

    const handler = ROUTES[action];
    if (!handler) return { success: false, error: `未知操作: ${action}` };

    return await handler({ data, user, openid, event });
  } catch (error) {
    console.error('[StockOutManager] Error:', error);
    return { success: false, error: error.message };
  }
};
