const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FaultType = sequelize.define('FaultType', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'fault_types',
        key: 'id',
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'fault_types',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_faulttypes_active',
        fields: ['active'],
      },
      {
        name: 'idx_faulttypes_parent',
        fields: ['parent_id'],
      },
    ],
  });

  return FaultType;
};
