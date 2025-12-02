'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('roles', [
      {
        name: 'System Admin',
        display_name: '系统管理员',
        permissions_json: JSON.stringify({
          modules: {
            submit_work_orders: true,
            review_work_orders: true,
            view_analytics: true,
            manage_users: true,
            configure_system: true,
          },
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Property Manager',
        display_name: '物业经理',
        permissions_json: JSON.stringify({
          modules: {
            submit_work_orders: true,
            review_work_orders: true,
            view_analytics: true,
            manage_users: false,
            configure_system: false,
          },
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Maintenance Worker',
        display_name: '维修员',
        permissions_json: JSON.stringify({
          modules: {
            submit_work_orders: false,
            review_work_orders: false,
            view_analytics: false,
            manage_users: false,
            configure_system: false,
          },
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: 'Property Staff',
        display_name: '物业员工',
        permissions_json: JSON.stringify({
          modules: {
            submit_work_orders: true,
            review_work_orders: true,
            view_analytics: false,
            manage_users: false,
            configure_system: false,
          },
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  },
};
