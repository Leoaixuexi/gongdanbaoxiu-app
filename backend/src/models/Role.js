const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    display_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    permissions_json: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        isValidPermissions(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('Permissions must be a valid JSON object');
          }
          if (!value.modules || typeof value.modules !== 'object') {
            throw new Error('Permissions JSON must contain a modules object');
          }
        },
      },
    },
  }, {
    tableName: 'roles',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_roles_name',
        fields: ['name'],
      },
    ],
  });

  return Role;
};
