/**
 * 获取员工已完成工单排名
 * 行政经理数据分析 - Tab1 数据统计
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
      return { success: false, error: '无法获取微信身份，请在小程序内操作', data: [] };
    }

    // 权限检查：行政经理、办美员工或拥有view_analytics权限的用户可以查看
    const { user, permissions } = await getCurrentUserAndPermissions(openid);
    if (!(user.role_id === 1 || user.role_id === 4 || hasModulePermission(permissions, 'view_analytics'))) {
      return { success: false, error: '无权限查看数据分析', data: [] };
    }

    // 处理日期参数 - 为空时查询所有数据
    let dateCondition = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateCondition = { created_at: _.gte(start).and(_.lte(end)) };
    }

    // 查询办美员工（role_id=4）和行政经理（role_id=2）的用户
    const usersResult = await db.collection('users')
      .where({
        role_id: _.in([2, 4])  // 行政经理(2) + 办美员工(4)
      })
      .get();

    const employees = usersResult.data;

    // 统计每个员工的工单数据
    const rankings = await Promise.all(employees.map(async (employee) => {
      const submitterUserId = employee.user_id;

      if (!submitterUserId) {
        return {
          employeeName: employee.name || employee.username || '未知',
          employeeId: employee.user_id || employee._openid || 'unknown',
          avatar: employee.avatar || '',
          totalSubmitted: 0,
          totalCompleted: 0
        };
      }

      // 统计该员工提交的总工单数
      const totalResult = await db.collection('work_orders')
        .where({
          'submitter.user_id': submitterUserId,
          ...dateCondition
        })
        .count();

      // 统计该员工提交且已完成的工单数
      const completedResult = await db.collection('work_orders')
        .where({
          'submitter.user_id': submitterUserId,
          status: _.in(['Completed', '已完成']),
          ...dateCondition
        })
        .count();

      return {
        employeeName: employee.name || employee.username || '未知',
        employeeId: employee.user_id,
        avatar: employee.avatar || '',
        totalSubmitted: totalResult.total,
        totalCompleted: completedResult.total
      };
    }));

    // 按已完成数量降序排序
    rankings.sort((a, b) => b.totalCompleted - a.totalCompleted);

    return {
      success: true,
      data: rankings
    };

  } catch (error) {
    console.error('getEmployeeRanking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
