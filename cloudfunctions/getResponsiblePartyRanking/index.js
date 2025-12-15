/**
 * 获取责任方已修复工单排名
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

    // 聚合统计各责任方已完成工单数量
    const result = await db.collection('workorders')
      .aggregate()
      .match({
        status: 'Completed',
        created_at: _.gte(start).and(_.lte(end))
      })
      .group({
        _id: '$responsible_party',
        count: _.sum(1)
      })
      .sort({
        count: -1  // 按数量降序
      })
      .end();

    // 计算总数用于百分比
    const total = result.list.reduce((sum, item) => sum + item.count, 0);

    // 转换为排名格式
    const rankings = result.list.map(item => ({
      responsibleParty: item._id || '未知',
      completedCount: item.count,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
    }));

    return {
      success: true,
      data: rankings
    };

  } catch (error) {
    console.error('getResponsiblePartyRanking error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
