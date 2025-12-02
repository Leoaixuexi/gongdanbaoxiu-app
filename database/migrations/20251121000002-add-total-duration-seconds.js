'use strict';

/**
 * 添加工单总用时字段
 *
 * 新增字段：
 * - total_duration_seconds: INTEGER - 工单总用时（秒），工单完成时写入
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('work_orders', 'total_duration_seconds', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: '工单总用时（秒），工单完成时写入',
      validate: {
        min: 0
      }
    });

    console.log('Successfully added total_duration_seconds column');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('work_orders', 'total_duration_seconds');
    console.log('Successfully removed total_duration_seconds column');
  }
};
