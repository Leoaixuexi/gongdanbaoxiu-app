'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('status_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      work_order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'work_orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      previous_status: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      new_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      actor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      photos_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('status_history', ['work_order_id', 'created_at'], {
      name: 'idx_statushistory_workorder',
    });
    await queryInterface.addIndex('status_history', ['actor_id'], {
      name: 'idx_statushistory_actor',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('status_history');
  },
};
