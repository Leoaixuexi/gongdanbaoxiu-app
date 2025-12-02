const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SLARule = sequelize.define('SLARule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    priority: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Emergency'),
      allowNull: false,
      unique: true,
    },
    target_response_hours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    target_resolution_hours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    escalation_threshold_pct: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 80,
      validate: {
        min: 0,
        max: 100,
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'sla_rules',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_slarules_priority',
        fields: ['priority'],
      },
    ],
  });

  return SLARule;
};
