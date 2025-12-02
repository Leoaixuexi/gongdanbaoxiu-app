'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert parent categories first
    await queryInterface.bulkInsert('fault_types', [
      {
        id: 1,
        name: '电气',
        parent_id: null,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        name: '管道',
        parent_id: null,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        name: '暖通空调',
        parent_id: null,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});

    // Insert child categories
    await queryInterface.bulkInsert('fault_types', [
      {
        name: '电气 - 照明',
        parent_id: 1,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '电气 - 插座',
        parent_id: 1,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '管道 - 漏水',
        parent_id: 2,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '管道 - 堵塞',
        parent_id: 2,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '暖通空调 - 空调',
        parent_id: 3,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '暖通空调 - 供暖',
        parent_id: 3,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        name: '其他',
        parent_id: null,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('fault_types', null, {});
  },
};
