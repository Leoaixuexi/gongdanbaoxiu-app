'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT,
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      action_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      resource_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      resource_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      before_state: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      after_state: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      success: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
    });

    // Add indexes
    await queryInterface.addIndex('audit_logs', ['timestamp'], {
      name: 'idx_auditlogs_timestamp',
    });
    await queryInterface.addIndex('audit_logs', ['user_id', 'timestamp'], {
      name: 'idx_auditlogs_user',
    });
    await queryInterface.addIndex('audit_logs', ['action_type', 'timestamp'], {
      name: 'idx_auditlogs_action',
    });
    await queryInterface.addIndex('audit_logs', ['resource_type', 'resource_id'], {
      name: 'idx_auditlogs_resource',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('audit_logs');
  },
};
