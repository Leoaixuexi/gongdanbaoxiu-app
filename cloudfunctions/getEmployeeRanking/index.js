/**
 * 获取员工已完成工单排名
 * 物业经理数据分析 - Tab1 数据统计
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { startDate, endDate } = event;

  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 查询物业员工（role_id=4）的用户
    const usersResult = await db.collection('users')
      .where({
        role_id: 4  // 物业员工
      })
      .get();

    const employees = usersResult.data;

    // 统计每个员工的工单数据
    const rankings = await Promise.all(employees.map(async (employee) => {
      // 统计该员工提交的总工单数
      const totalResult = await db.collection('workorders')
        .where({
          submitter_id: employee._openid,
          created_at: _.gte(start).and(_.lte(end))
        })
        .count();

      // 统计该员工提交且已完成的工单数
      const completedResult = await db.collection('workorders')
        .where({
          submitter_id: employee._openid,
          status: 'Completed',
          created_at: _.gte(start).and(_.lte(end))
        })
        .count();

      return {
        employeeName: employee.name || employee.username || '未知',
        employeeId: employee._openid,
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
