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

exports.main = async (event, context) => {
  const { startDate, endDate } = event;

  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 1. 总工单数
    const totalResult = await db.collection('workorders')
      .where({
        created_at: _.gte(start).and(_.lte(end))
      })
      .count();

    // 2. 已完成工单数
    const completedResult = await db.collection('workorders')
      .where({
        status: 'Completed',
        created_at: _.gte(start).and(_.lte(end))
      })
      .count();

    // 3. 进行中工单数（维修中）
    const inProgressResult = await db.collection('workorders')
      .where({
        status: 'In Progress',
        created_at: _.gte(start).and(_.lte(end))
      })
      .count();

    // 4. 计算平均完成时长
    const completedOrders = await db.collection('workorders')
      .where({
        status: 'Completed',
        created_at: _.gte(start).and(_.lte(end)),
        completed_at: _.exists(true)
      })
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
