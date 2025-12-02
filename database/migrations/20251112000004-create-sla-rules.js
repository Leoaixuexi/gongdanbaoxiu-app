'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sla_rules', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      priority: {
        type: Sequelize.ENUM('Low', 'Normal', 'High', 'Emergency'),
        allowNull: false,
        unique: true,
      },
      target_response_hours: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      target_resolution_hours: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      escalation_threshold_pct: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 80,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes
    await queryInterface.addIndex('sla_rules', ['priority'], {
      name: 'idx_slarules_priority',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sla_rules');
  },
};
