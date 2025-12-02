const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StatusHistory = sequelize.define('StatusHistory', {
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
    previous_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    new_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photos_json: {
      type: DataTypes.JSON,
      allowNull: true,
      validate: {
        isValidPhotos(value) {
          if (value !== null && value !== undefined) {
            if (!Array.isArray(value)) {
              throw new Error('Photos must be an array');
            }
          }
        },
      },
    },
  }, {
    tableName: 'status_history',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        name: 'idx_statushistory_workorder',
        fields: ['work_order_id', { name: 'created_at', order: 'DESC' }],
      },
      {
        name: 'idx_statushistory_actor',
        fields: ['actor_id'],
      },
    ],
  });

  return StatusHistory;
};
