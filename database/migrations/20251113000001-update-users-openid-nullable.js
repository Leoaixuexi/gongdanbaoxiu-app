'use strict';

/**
 * Migration: Make wechat_openid nullable and add password_hash field
 *
 * Purpose: Support hybrid authentication architecture
 * - Cloud-based login uses wechat_openid
 * - Password-based login uses password_hash
 *
 * Changes:
 * 1. Make wechat_openid nullable to support password-based auth
 * 2. Add password_hash field for password-based auth
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make wechat_openid nullable
    await queryInterface.changeColumn('users', 'wechat_openid', {
      type: Sequelize.STRING(255),
      allowNull: true,  // Changed from false to true
      unique: true,
    });

    // Add password_hash field for password-based authentication
    await queryInterface.addColumn('users', 'password_hash', {
      type: Sequelize.STRING(255),
      allowNull: true,  // Nullable since cloud-based auth doesn't use passwords
      comment: 'Hashed password for password-based authentication',
    });

    // Add index on password_hash for faster lookups
    await queryInterface.addIndex('users', ['password_hash'], {
      name: 'idx_users_password_hash',
    });

    // Add index on contact_phone for username login
    await queryInterface.addIndex('users', ['contact_phone'], {
      name: 'idx_users_contact_phone',
      unique: true,
      where: {
        contact_phone: { [Sequelize.Op.ne]: null },
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove password_hash column
    await queryInterface.removeColumn('users', 'password_hash');

    // Remove indexes
    await queryInterface.removeIndex('users', 'idx_users_password_hash');
    await queryInterface.removeIndex('users', 'idx_users_contact_phone');

    // Revert wechat_openid to NOT NULL
    // WARNING: This will fail if there are users without wechat_openid
    await queryInterface.changeColumn('users', 'wechat_openid', {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true,
    });
  },
};
