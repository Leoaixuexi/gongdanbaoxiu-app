'use strict';

/**
 * 工单字段重构
 *
 * 变更内容：
 * 1. 删除 repair_photos_json 字段
 * 2. 修改 status 字段为中文值
 * 3. 删除 completion_notes 字段
 * 4. 删除 review_notes 字段
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('开始重构工单字段...');

      // 1. 删除 repair_photos_json 字段
      await queryInterface.removeColumn('work_orders', 'repair_photos_json', { transaction });
      console.log('✓ 删除 repair_photos_json 字段');

      // 2. 修改 status 字段
      // 首先更新所有现有数据的状态值为中文
      await queryInterface.sequelize.query(
        `UPDATE work_orders SET status = CASE
          WHEN status = 'Pending Repair' THEN '待维修'
          WHEN status = 'In Progress' THEN '维修中'
          WHEN status = 'Repaired' THEN '已修复'
          WHEN status = 'Needs Rework' THEN '需重修'
          WHEN status = 'Completed' THEN '已完成'
          ELSE '已提报'
        END`,
        { transaction }
      );
      console.log('✓ 更新现有工单状态值为中文');

      // 删除旧的 status 列
      await queryInterface.removeColumn('work_orders', 'status', { transaction });

      // 创建新的 status 列（使用中文枚举值）
      await queryInterface.addColumn('work_orders', 'status', {
        type: Sequelize.ENUM('已提报', '待维修', '维修中', '已修复', '需重修', '待复核', '已完成'),
        allowNull: false,
        defaultValue: '已提报'
      }, { transaction });
      console.log('✓ 重建 status 字段为中文枚举值');

      // 3. 删除 completion_notes 字段
      await queryInterface.removeColumn('work_orders', 'completion_notes', { transaction });
      console.log('✓ 删除 completion_notes 字段');

      // 4. 删除 review_notes 字段
      await queryInterface.removeColumn('work_orders', 'review_notes', { transaction });
      console.log('✓ 删除 review_notes 字段');

      await transaction.commit();
      console.log('✅ 工单字段重构完成');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ 迁移失败，已回滚:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('开始回滚工单字段重构...');

      // 1. 恢复 repair_photos_json 字段
      await queryInterface.addColumn('work_orders', 'repair_photos_json', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '维修后照片'
      }, { transaction });
      console.log('✓ 恢复 repair_photos_json 字段');

      // 2. 恢复 status 字段
      // 删除中文 status 列
      await queryInterface.removeColumn('work_orders', 'status', { transaction });

      // 创建英文 status 列
      await queryInterface.addColumn('work_orders', 'status', {
        type: Sequelize.ENUM('Pending Repair', 'In Progress', 'Repaired', 'Needs Rework', 'Completed'),
        allowNull: false,
        defaultValue: 'Pending Repair'
      }, { transaction });

      // 将中文状态值转回英文
      await queryInterface.sequelize.query(
        `UPDATE work_orders SET status = CASE
          WHEN status = '待维修' THEN 'Pending Repair'
          WHEN status = '维修中' THEN 'In Progress'
          WHEN status = '已修复' THEN 'Repaired'
          WHEN status = '需重修' THEN 'Needs Rework'
          WHEN status = '已完成' THEN 'Completed'
          ELSE 'Pending Repair'
        END`,
        { transaction }
      );
      console.log('✓ 恢复 status 字段为英文枚举值');

      // 3. 恢复 completion_notes 字段
      await queryInterface.addColumn('work_orders', 'completion_notes', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });
      console.log('✓ 恢复 completion_notes 字段');

      // 4. 恢复 review_notes 字段
      await queryInterface.addColumn('work_orders', 'review_notes', {
        type: Sequelize.TEXT,
        allowNull: true
      }, { transaction });
      console.log('✓ 恢复 review_notes 字段');

      await transaction.commit();
      console.log('✅ 工单字段重构回滚完成');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ 回滚失败:', error);
      throw error;
    }
  }
};
