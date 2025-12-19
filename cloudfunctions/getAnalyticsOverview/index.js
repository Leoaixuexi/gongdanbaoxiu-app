/**
 * 获取全局分析概览数据（KPI指标）
 * 物业经理数据分析 - Tab1 数据统计
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

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
  const { startDate, endDate } = event;

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: '无法获取微信身份，请在小程序内操作' };
    }

    const { user, permissions } = await getCurrentUserAndPermissions(openid);
    if (!(user.role_id === 1 || hasModulePermission(permissions, 'view_analytics'))) {
      return { success: false, error: '无权限查看数据分析' };
    }

    const workOrders = db.collection('work_orders');

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. 总工单数
    const totalResult = await workOrders
      .where({
        created_at: _.gte(start).and(_.lte(end))
      })
      .count();

    // 2. 已完成工单数
    const completedResult = await workOrders
      .where({
        status: _.in(['Completed', '已完成']),
        created_at: _.gte(start).and(_.lte(end))
      })
      .count();

    // 3. 进行中工单数（维修中）
    const inProgressResult = await workOrders
      .where({
        status: _.in(['In Progress', '维修中']),
        created_at: _.gte(start).and(_.lte(end))
      })
      .count();

    // 4. 计算平均完成时长
    const completedOrders = await workOrders
      .where({
        status: _.in(['Completed', '已完成']),
        created_at: _.gte(start).and(_.lte(end)),
        completed_at: _.exists(true)
      })
      .limit(1000)
      .get();

    let avgCompletionTime = 0;
    if (completedOrders.data.length > 0) {
      const totalHours = completedOrders.data.reduce((sum, order) => {
        const reportTime = new Date(order.created_at);
        const completeTime = new Date(order.completed_at);
        const hours = (completeTime - reportTime) / (1000 * 60 * 60); // 转换为小时
        return sum + hours;
      }, 0);
      avgCompletionTime = (totalHours / completedOrders.data.length).toFixed(1);
    }

    // 5. 计算完成率
    const completionRate = totalResult.total > 0
      ? ((completedResult.total / totalResult.total) * 100).toFixed(1)
      : '0.0';

    return {
      success: true,
      data: {
        totalOrders: totalResult.total,
        completedOrders: completedResult.total,
        inProgressOrders: inProgressResult.total,
        avgCompletionTime: parseFloat(avgCompletionTime),
        completionRate: parseFloat(completionRate)
      }
    };

  } catch (error) {
    console.error('getAnalyticsOverview error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
