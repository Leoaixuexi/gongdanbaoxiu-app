const { Sequelize } = require('sequelize');
const config = require('../config/database.js');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Initialize Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    define: dbConfig.define,
  }
);

// Import models
const Role = require('./Role')(sequelize);
const User = require('./User')(sequelize);
const FaultType = require('./FaultType')(sequelize);
const SLARule = require('./SLARule')(sequelize);
const WorkOrder = require('./WorkOrder')(sequelize);
const StatusHistory = require('./StatusHistory')(sequelize);
const Notification = require('./Notification')(sequelize);
const AuditLog = require('./AuditLog')(sequelize);

// Define associations

// User - Role association (Many-to-One)
User.belongsTo(Role, {
  foreignKey: 'role_id',
  as: 'role',
});
Role.hasMany(User, {
  foreignKey: 'role_id',
  as: 'users',
});

// User - User (Supervisor) association (Self-referencing Many-to-One)
User.belongsTo(User, {
  foreignKey: 'supervisor_id',
  as: 'supervisor',
});
User.hasMany(User, {
  foreignKey: 'supervisor_id',
  as: 'subordinates',
});

// WorkOrder - User (Submitter) association (Many-to-One)
WorkOrder.belongsTo(User, {
  foreignKey: 'submitter_id',
  as: 'submitter',
});
User.hasMany(WorkOrder, {
  foreignKey: 'submitter_id',
  as: 'submitted_orders',
});

// WorkOrder - User (Assigned Technician) association (Many-to-One)
WorkOrder.belongsTo(User, {
  foreignKey: 'assigned_technician_id',
  as: 'assigned_technician',
});
User.hasMany(WorkOrder, {
  foreignKey: 'assigned_technician_id',
  as: 'assigned_orders',
});

// WorkOrder - FaultType association (Many-to-One)
WorkOrder.belongsTo(FaultType, {
  foreignKey: 'fault_type_id',
  as: 'fault_type',
});
FaultType.hasMany(WorkOrder, {
  foreignKey: 'fault_type_id',
  as: 'work_orders',
});

// FaultType - FaultType (Parent) association (Self-referencing Many-to-One)
FaultType.belongsTo(FaultType, {
  foreignKey: 'parent_id',
  as: 'parent',
});
FaultType.hasMany(FaultType, {
  foreignKey: 'parent_id',
  as: 'children',
});

// WorkOrder - StatusHistory association (One-to-Many)
WorkOrder.hasMany(StatusHistory, {
  foreignKey: 'work_order_id',
  as: 'status_history',
});
StatusHistory.belongsTo(WorkOrder, {
  foreignKey: 'work_order_id',
  as: 'work_order',
});

// StatusHistory - User (Actor) association (Many-to-One)
StatusHistory.belongsTo(User, {
  foreignKey: 'actor_id',
  as: 'actor',
});
User.hasMany(StatusHistory, {
  foreignKey: 'actor_id',
  as: 'status_history_actions',
});

// WorkOrder - Notification association (One-to-Many)
WorkOrder.hasMany(Notification, {
  foreignKey: 'work_order_id',
  as: 'notifications',
});
Notification.belongsTo(WorkOrder, {
  foreignKey: 'work_order_id',
  as: 'work_order',
});

// Notification - User (Recipient) association (Many-to-One)
Notification.belongsTo(User, {
  foreignKey: 'recipient_id',
  as: 'recipient',
});
User.hasMany(Notification, {
  foreignKey: 'recipient_id',
  as: 'notifications',
});

// AuditLog - User association (Many-to-One)
AuditLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});
User.hasMany(AuditLog, {
  foreignKey: 'user_id',
  as: 'audit_logs',
});

// Export db object
const db = {
  sequelize,
  Sequelize,
  Role,
  User,
  FaultType,
  SLARule,
  WorkOrder,
  StatusHistory,
  Notification,
  AuditLog,
};

module.exports = db;
