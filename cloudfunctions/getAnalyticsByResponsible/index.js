/**
 * 云函数：getAnalyticsByResponsible
 * 功能：获取责任方分布数据（饼图）
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

async function getCurrentUserAndPermissions(openid) {
  const users = db.collection('users');
  const roles = db.collection('roles');

  const { data: userData } = await users.where({ wechat_openid: openid }).get();
  const user = userData && userData.length > 0 ? userData[0] : null;
  if (!user) throw new Error('用户不存在');
  if (user.active === false) throw new Error('账号已被停用');

  const { data: roleData } = await roles.where({ role_id: user.role_id }).get();
  const role = roleData && roleData.length > 0 ? roleData[0] : null;
  const permissions = role?.permissions || {};

  return { user, permissions };
}

function hasModulePermission(permissions, moduleKey) {
  const modules = permissions?.modules;
  if (!modules) return false;
  if (Array.isArray(modules)) return modules.includes(moduleKey);
  if (typeof modules === 'object') return modules[moduleKey] === true;
  return false;
}

exports.main = async (event, context) => {
  try {
    const { startDate, endDate } = event;

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取微信身份，请在小程序内操作', data: [] };
    }

    const { user, permissions } = await getCurrentUserAndPermissions(openid);
    if (!(user.role_id === 1 || hasModulePermission(permissions, 'view_analytics'))) {
      return { success: false, error: '无权限查看数据分析', data: [] };
    }

    // 处理日期参数 - 为空时查询所有数据
    let matchCondition = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchCondition = { created_at: _.gte(start).and(_.lte(end)) };
    }

    // 聚合查询：按责任方分组统计
    const { list } = await db.collection('work_orders')
      .aggregate()
      .match(matchCondition)
      .group({
        _id: '$responsible_party',
        count: $.sum(1)
      })
      .sort({
        count: -1
      })
      .end();

    // 计算总数和百分比
    const total = list.reduce((sum, item) => sum + item.count, 0);

    const data = list.map(item => ({
      name: item._id || '未分配',
      value: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));

    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('getAnalyticsByResponsible error:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};
