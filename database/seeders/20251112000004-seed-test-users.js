'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Test users with username/password authentication
    // These match the test accounts shown on the login page
    await queryInterface.bulkInsert('users', [
      {
        wechat_openid: null,
        username: 'admin',
        password: 'admin123', // Will be encrypted by cloud function
        name: '系统管理员',
        role_id: 1, // System Admin
        contact_phone: '13800000001',
        department: '行政部',
        supervisor_id: null,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: null,
      },
      {
        wechat_openid: null,
        username: 'manager',
        password: 'manager123',
        name: '物业经理',
        role_id: 2, // Property Manager
        contact_phone: '13800000002',
        department: '信泰物业',
        supervisor_id: 1, // Reports to System Admin
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: null,
      },
      {
        wechat_openid: null,
        username: 'technician',
        password: 'tech123',
        name: '维修员',
        role_id: 3, // Maintenance Worker
        contact_phone: '13800000003',
        department: '工程总包',
        supervisor_id: 2, // Reports to Property Manager
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: null,
      },
      {
        wechat_openid: null,
        username: 'staff',
        password: 'staff123',
        name: '物业员工',
        role_id: 4, // Property Staff
        contact_phone: '13800000004',
        department: '信泰物业',
        supervisor_id: 2, // Reports to Property Manager
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: null,
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', {
      username: {
        [Sequelize.Op.in]: ['admin', 'manager', 'technician', 'staff']
      }
    }, {});
  },
};
