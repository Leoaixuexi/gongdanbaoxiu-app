'use strict';

/**
 * 工单表字段重构迁移
 *
 * 变更说明：
 * 1. 移除 fault_type_id 字段（使用 order_category 替代）
 * 2. 新增 order_category 字段（工单类别）
 * 3. 新增 responsible_party 字段（责任方）
 * 4. 新增 report_time 字段（报修时间）
 * 5. 新增 remark 字段（备注）
 * 6. 新增 repair_photos_json 字段（维修后照片）
 * 7. 更新 photos_json 字段验证（最多3张）
 * 8. 更新 description 字段长度限制（10-80字符）
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. 新增字段
      await queryInterface.addColumn('work_orders', 'order_category', {
        type: Sequelize.ENUM('电梯维修', '水电维修', '消防维修', '空调维修', '其他'),
        allowNull: true, // 先设为可空，稍后更新数据后改为不可空
        comment: '工单类别',
      }, { transaction });

      await queryInterface.addColumn('work_orders', 'responsible_party', {
        type: Sequelize.ENUM('物业公司', '业主', '第三方'),
        allowNull: true, // 先设为可空
        comment: '责任方',
      }, { transaction });

      await queryInterface.addColumn('work_orders', 'report_time', {
        type: Sequelize.DATE,
        allowNull: true, // 先设为可空
        comment: '报修时间（故障发生时间）',
      }, { transaction });

      await queryInterface.addColumn('work_orders', 'remark', {
        type: Sequelize.STRING(30),
        allowNull: true,
        comment: '备注',
      }, { transaction });

      await queryInterface.addColumn('work_orders', 'repair_photos_json', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '维修后照片',
      }, { transaction });

      // 2. 数据迁移 - 将现有数据的 fault_type 映射到 order_category
      // 从 fault_types 表读取映射关系，将故障类型转换为工单类别
      await queryInterface.sequelize.query(`
        UPDATE work_orders
        SET
          order_category = CASE
            WHEN fault_type_id IN (SELECT id FROM fault_types WHERE name LIKE '%电梯%') THEN '电梯维修'
            WHEN fault_type_id IN (SELECT id FROM fault_types WHERE name LIKE '%水%' OR name LIKE '%电%') THEN '水电维修'
            WHEN fault_type_id IN (SELECT id FROM fault_types WHERE name LIKE '%消防%') THEN '消防维修'
            WHEN fault_type_id IN (SELECT id FROM fault_types WHERE name LIKE '%空调%') THEN '空调维修'
            ELSE '其他'
          END,
          responsible_party = '物业公司',
          report_time = created_at
        WHERE order_category IS NULL
      `, { transaction });

      // 3. 将新字段改为不可空（已有数据都已填充默认值）
      await queryInterface.changeColumn('work_orders', 'order_category', {
        type: Sequelize.ENUM('电梯维修', '水电维修', '消防维修', '空调维修', '其他'),
        allowNull: false,
        comment: '工单类别',
      }, { transaction });

      await queryInterface.changeColumn('work_orders', 'responsible_party', {
        type: Sequelize.ENUM('物业公司', '业主', '第三方'),
        allowNull: false,
        comment: '责任方',
      }, { transaction });

      await queryInterface.changeColumn('work_orders', 'report_time', {
        type: Sequelize.DATE,
        allowNull: false,
        comment: '报修时间（故障发生时间）',
      }, { transaction });

      // 4. 移除 fault_type_id 外键约束和字段
      // 注意：根据数据库类型可能需要调整外键名称
      try {
        await queryInterface.removeConstraint('work_orders', 'work_orders_fault_type_id_fkey', { transaction });
      } catch (error) {
        console.log('外键约束不存在或已删除:', error.message);
      }

      await queryInterface.removeColumn('work_orders', 'fault_type_id', { transaction });

      await transaction.commit();
      console.log('工单表字段重构完成');
    } catch (error) {
      await transaction.rollback();
      console.error('迁移失败，已回滚:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. 恢复 fault_type_id 字段
      await queryInterface.addColumn('work_orders', 'fault_type_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'fault_types',
          key: 'id',
        },
      }, { transaction });

      // 2. 数据迁移 - 将 order_category 映射回 fault_type_id
      // 这里简化处理，映射到默认的故障类型
      await queryInterface.sequelize.query(`
        UPDATE work_orders
        SET fault_type_id = (
          SELECT id FROM fault_types WHERE name LIKE CONCAT('%', order_category, '%') LIMIT 1
        )
        WHERE fault_type_id IS NULL
      `, { transaction });

      await queryInterface.changeColumn('work_orders', 'fault_type_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'fault_types',
          key: 'id',
        },
      }, { transaction });

      // 3. 移除新增的字段
      await queryInterface.removeColumn('work_orders', 'order_category', { transaction });
      await queryInterface.removeColumn('work_orders', 'responsible_party', { transaction });
      await queryInterface.removeColumn('work_orders', 'report_time', { transaction });
      await queryInterface.removeColumn('work_orders', 'remark', { transaction });
      await queryInterface.removeColumn('work_orders', 'repair_photos_json', { transaction });

      await transaction.commit();
      console.log('迁移回滚完成');
    } catch (error) {
      await transaction.rollback();
      console.error('回滚失败:', error);
      throw error;
    }
  }
};
