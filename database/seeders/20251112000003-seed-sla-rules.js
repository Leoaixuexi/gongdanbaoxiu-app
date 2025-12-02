'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('sla_rules', [
      {
        priority: 'Emergency',
        target_response_hours: 1,
        target_resolution_hours: 2,
        escalation_threshold_pct: 80,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        priority: 'High',
        target_response_hours: 2,
        target_resolution_hours: 4,
        escalation_threshold_pct: 80,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        priority: 'Normal',
        target_response_hours: 4,
        target_resolution_hours: 24,
        escalation_threshold_pct: 80,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        priority: 'Low',
        target_response_hours: 24,
        target_resolution_hours: 72,
        escalation_threshold_pct: 80,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('sla_rules', null, {});
  },
};
