'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('work_orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      order_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      floor: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      fault_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'fault_types',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      priority: {
        type: Sequelize.ENUM('Low', 'Normal', 'High', 'Emergency'),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      photos_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('Pending Repair', 'In Progress', 'Repaired', 'Needs Rework', 'Completed'),
        allowNull: false,
        defaultValue: 'Pending Repair',
      },
      submitter_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      assigned_technician_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      repaired_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sla_deadline: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      is_overdue: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      rework_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      completion_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('work_orders', ['status'], {
      name: 'idx_workorders_status',
    });
    await queryInterface.addIndex('work_orders', ['priority'], {
      name: 'idx_workorders_priority',
    });
    await queryInterface.addIndex('work_orders', ['created_at'], {
      name: 'idx_workorders_created',
    });
    await queryInterface.addIndex('work_orders', ['assigned_technician_id'], {
      name: 'idx_workorders_assigned',
    });
    await queryInterface.addIndex('work_orders', ['submitter_id'], {
      name: 'idx_workorders_submitter',
    });
    await queryInterface.addIndex('work_orders', ['sla_deadline', 'is_overdue'], {
      name: 'idx_workorders_sla',
    });
    await queryInterface.addIndex('work_orders', ['floor'], {
      name: 'idx_workorders_floor',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('work_orders');
  },
};
