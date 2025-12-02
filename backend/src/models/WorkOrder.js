const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WorkOrder = sequelize.define('WorkOrder', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    order_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    floor: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    order_category: {
      type: DataTypes.ENUM('电梯维修', '水电维修', '消防维修', '空调维修', '其他'),
      allowNull: false,
      comment: '工单类别',
    },
    responsible_party: {
      type: DataTypes.ENUM('物业公司', '业主', '第三方'),
      allowNull: false,
      comment: '责任方',
    },
    priority: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Emergency'),
      allowNull: false,
    },
    report_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '报修时间（故障发生时间）',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [10, 80],
      },
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
            if (value.length > 3) {
              throw new Error('Maximum 3 photos allowed');
            }
            if (value.length < 1) {
              throw new Error('At least 1 photo required');
            }
          }
        },
      },
    },
    remark: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment: '备注',
    },
    total_duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '工单总用时（秒），工单完成时写入',
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM('已提报', '待维修', '维修中', '已修复', '需重修', '待复核', '已完成'),
      allowNull: false,
    },
    submitter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '提交者用户ID',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    assigned_technician_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '分配的维修员用户ID',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    repaired_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sla_deadline: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_overdue: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    rework_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
  }, {
    tableName: 'work_orders',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_workorders_status',
        fields: ['status'],
      },
      {
        name: 'idx_workorders_priority',
        fields: ['priority'],
      },
      {
        name: 'idx_workorders_created',
        fields: [{ name: 'created_at', order: 'DESC' }],
      },
      {
        name: 'idx_workorders_assigned',
        fields: ['assigned_technician_id'],
      },
      {
        name: 'idx_workorders_submitter',
        fields: ['submitter_id'],
      },
      {
        name: 'idx_workorders_sla',
        fields: ['sla_deadline', 'is_overdue'],
      },
      {
        name: 'idx_workorders_floor',
        fields: ['floor'],
      },
    ],
  });

  return WorkOrder;
};
