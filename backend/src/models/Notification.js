const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    work_order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'work_orders',
        key: 'id',
      },
    },
    recipient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    notification_type: {
      type: DataTypes.ENUM('template_message', 'push'),
      allowNull: false,
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    delivery_status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'delivered'),
      allowNull: false,
      defaultValue: 'pending',
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 3,
      },
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_notifications_workorder',
        fields: ['work_order_id'],
      },
      {
        name: 'idx_notifications_recipient',
        fields: ['recipient_id'],
      },
      {
        name: 'idx_notifications_status',
        fields: ['delivery_status', 'created_at'],
      },
    ],
  });

  return Notification;
};
