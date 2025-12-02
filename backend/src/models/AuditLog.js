const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    action_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    before_state: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    after_state: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'audit_logs',
    timestamps: false,
    underscored: true,
    indexes: [
      {
        name: 'idx_auditlogs_timestamp',
        fields: [{ name: 'timestamp', order: 'DESC' }],
      },
      {
        name: 'idx_auditlogs_user',
        fields: ['user_id', { name: 'timestamp', order: 'DESC' }],
      },
      {
        name: 'idx_auditlogs_action',
        fields: ['action_type', { name: 'timestamp', order: 'DESC' }],
      },
      {
        name: 'idx_auditlogs_resource',
        fields: ['resource_type', 'resource_id'],
      },
    ],
  });

  return AuditLog;
};
