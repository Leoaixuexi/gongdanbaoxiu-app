# Data Model: 工单报修管理系统

**Date**: 2025-11-12
**Feature**: Work Order Repair Management System
**Database**: MySQL 8.0 with Sequelize ORM

## Overview

This document defines the complete data model for the work order management system. All entities map to MySQL tables via Sequelize models. Foreign key relationships enforce referential integrity. Indexes optimize query performance for dashboard filters and work order searches.

---

## Entity Relationship Diagram

```
┌──────────────┐
│     User     │
└──────┬───────┘
       │ 1
       │
       │ created_by
       ↓ N
┌──────────────────┐         N ┌─────────────────┐
│   Work Order     │◄──────────│ StatusHistory   │
└───────┬──────────┘ belongs   └─────────────────┘
        │ to
        │ 1
        │
        │ N
        ↓
┌──────────────────┐
│   Notification   │
└──────────────────┘

┌──────────────┐         N ┌──────────────┐
│  FaultType   │◄──────────│ Work Order   │
└──────────────┘ references└──────────────┘

┌──────────────┐         N ┌──────────────┐
│   SLARule    │◄──────────│ Work Order   │
└──────────────┘ applies   └──────────────┘
                 based on
                 priority

┌──────────────┐
│     Role     │
└──────┬───────┘
       │ 1
       │ has
       ↓ N
┌──────────────┐
│     User     │
└──────────────┘

┌──────────────┐         N ┌──────────────┐
│     User     │◄──────────│  AuditLog    │
└──────────────┘ performed └──────────────┘
                 by
```

---

## Core Entities

### 1. User

**Purpose**: Represents all system users (property staff, maintenance workers, managers, administrators)

**Table**: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique user identifier |
| wechat_openid | VARCHAR(255) | UNIQUE, NOT NULL | WeChat OpenID from wx.login() |
| name | VARCHAR(100) | NOT NULL | User's display name |
| role_id | INT | FOREIGN KEY → roles.id, NOT NULL | User's role (determines permissions) |
| contact_phone | VARCHAR(20) | NULL | Contact phone number |
| department | VARCHAR(100) | NULL | Department name (e.g., "Property Management", "Maintenance Team A") |
| supervisor_id | INT | FOREIGN KEY → users.id, NULL | Supervisor for escalations (Maintenance Workers only) |
| active | BOOLEAN | DEFAULT TRUE, NOT NULL | Account status (inactive users can't login) |
| created_at | DATETIME | NOT NULL | Account creation timestamp |
| updated_at | DATETIME | NOT NULL | Last modification timestamp |
| last_login_at | DATETIME | NULL | Last successful login |

**Indexes**:
- `idx_users_openid` ON (wechat_openid) - Fast login lookup
- `idx_users_role` ON (role_id) - Filter users by role
- `idx_users_active` ON (active) - Query only active users
- `idx_users_supervisor` ON (supervisor_id) - Find workers by supervisor

**Relationships**:
- `role_id` → Role.id (Many-to-One)
- `supervisor_id` → User.id (Self-referencing Many-to-One)
- Created Work Orders → WorkOrder.submitter_id (One-to-Many)
- Assigned Work Orders → WorkOrder.assigned_technician_id (One-to-Many)

**Validation Rules** (from FR-002, FR-003):
- `wechat_openid`: Must be valid OpenID from WeChat auth
- `role_id`: Must reference existing role
- `supervisor_id`: Must reference existing user with manager role (if not NULL)
- `active`: Can only be set false by administrators (no self-deactivation)

**Notes**:
- No password field (WeChat OpenID authentication only)
- Supervisor assignment required for Maintenance Workers (enforced in application layer)
- Soft delete not implemented (use `active = false` instead)

---

### 2. Role

**Purpose**: Defines user roles and their module-level permissions

**Table**: `roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique role identifier |
| name | VARCHAR(50) | UNIQUE, NOT NULL | Role name (e.g., "Property Staff", "Maintenance Worker") |
| display_name | VARCHAR(100) | NOT NULL | Human-readable name (supports Chinese) |
| permissions_json | JSON | NOT NULL | Module permissions as JSON object |
| created_at | DATETIME | NOT NULL | Role creation timestamp |
| updated_at | DATETIME | NOT NULL | Last modification timestamp |

**Indexes**:
- `idx_roles_name` ON (name) - Fast role lookup by name

**Relationships**:
- Users → User.role_id (One-to-Many)

**Permissions JSON Schema**:
```json
{
  "modules": {
    "submit_work_orders": true,
    "review_work_orders": true,
    "view_analytics": false,
    "manage_users": false,
    "configure_system": false
  }
}
```

**Initial Seed Data** (from FR-003):
1. Super Admin - All permissions enabled
2. System Admin - All except Super Admin functions
3. Administrative Manager - View analytics, view all work orders
4. Property Staff - Submit work orders, review work orders
5. Maintenance Worker - View assigned orders, update status

**Notes**:
- Permissions checked on every API request (middleware)
- JSON column allows flexible permission expansion without schema migration

---

### 3. WorkOrder

**Purpose**: Represents a maintenance request from submission through closure

**Table**: `work_orders`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique work order identifier |
| order_number | VARCHAR(20) | UNIQUE, NOT NULL | Human-readable order ID (e.g., "WO-20251112-0001") |
| floor | VARCHAR(20) | NOT NULL | Floor identifier (e.g., "Floor 3", "B1") |
| location | VARCHAR(255) | NOT NULL | Room/area description (e.g., "Room 301", "Corridor West") |
| fault_type_id | INT | FOREIGN KEY → fault_types.id, NOT NULL | Category of issue |
| priority | ENUM('Low','Normal','High','Emergency') | NOT NULL | Urgency level (determines SLA) |
| description | TEXT | NOT NULL | Detailed issue description |
| photos_json | JSON | NULL | Array of photo URLs (Cloud Object Storage links) |
| status | ENUM('Pending Repair','In Progress','Repaired','Needs Rework','Completed') | NOT NULL | Current workflow state |
| submitter_id | INT | FOREIGN KEY → users.id, NOT NULL | Property staff who created order |
| assigned_technician_id | INT | FOREIGN KEY → users.id, NOT NULL | Maintenance worker assigned (round-robin) |
| created_at | DATETIME | NOT NULL | Work order submission time (SLA start) |
| assigned_at | DATETIME | NULL | Auto-assignment timestamp |
| started_at | DATETIME | NULL | When technician marked "In Progress" |
| repaired_at | DATETIME | NULL | When technician marked "Repaired" |
| reviewed_at | DATETIME | NULL | When property staff reviewed |
| completed_at | DATETIME | NULL | Final closure timestamp |
| sla_deadline | DATETIME | NOT NULL | Calculated from created_at + SLA rule |
| is_overdue | BOOLEAN | DEFAULT FALSE, NOT NULL | True if sla_deadline passed while not completed |
| rework_count | INT | DEFAULT 0, NOT NULL | Number of times marked "Needs Rework" |
| completion_notes | TEXT | NULL | Technician notes when marking "Repaired" |
| review_notes | TEXT | NULL | Property staff notes when approving/rejecting |
| updated_at | DATETIME | NOT NULL | Last modification timestamp |

**Indexes**:
- `idx_workorders_status` ON (status) - Filter by status (most common query)
- `idx_workorders_priority` ON (priority) - Filter by priority
- `idx_workorders_created` ON (created_at DESC) - Sort by recent first
- `idx_workorders_assigned` ON (assigned_technician_id) - Technician's work queue
- `idx_workorders_submitter` ON (submitter_id) - Property staff's submitted orders
- `idx_workorders_sla` ON (sla_deadline, is_overdue) - SLA monitoring queries
- `idx_workorders_floor` ON (floor) - Filter by location

**Relationships**:
- `fault_type_id` → FaultType.id (Many-to-One)
- `submitter_id` → User.id (Many-to-One)
- `assigned_technician_id` → User.id (Many-to-One)
- Status History → StatusHistory.work_order_id (One-to-Many)
- Notifications → Notification.work_order_id (One-to-Many)

**Validation Rules** (from FR-007 to FR-015):
- `order_number`: Auto-generated on creation (format: WO-YYYYMMDD-####)
- `photos_json`: Max 9 URLs, each URL validated as valid COS link
- `status`: Transitions must follow valid state machine (FR-010)
- `assigned_technician_id`: Must reference active Maintenance Worker
- `priority`: Maps to SLA rule for deadline calculation
- `rework_count`: Incremented when status changes to "Needs Rework"

**Status State Machine** (from FR-010):
```
Pending Repair → In Progress → Repaired → Completed
                                   ↓
                            Needs Rework ──→ Pending Repair (loop)
```

**Photos JSON Schema**:
```json
[
  "https://cos.example.com/photos/abc123.jpg",
  "https://cos.example.com/photos/def456.jpg"
]
```

**Notes**:
- Building field omitted (single building system per clarification)
- SLA deadline calculated on insert trigger (not application layer)
- Concurrent work order limit (5 per technician) enforced in application layer

---

### 4. StatusHistory

**Purpose**: Immutable audit trail of all work order state transitions

**Table**: `status_history`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique history record identifier |
| work_order_id | INT | FOREIGN KEY → work_orders.id, NOT NULL | Associated work order |
| previous_status | VARCHAR(50) | NULL | Status before transition (NULL for initial creation) |
| new_status | VARCHAR(50) | NOT NULL | Status after transition |
| actor_id | INT | FOREIGN KEY → users.id, NOT NULL | User who performed action |
| notes | TEXT | NULL | Comments added during transition |
| photos_json | JSON | NULL | Additional photos added (e.g., repair completion photos) |
| created_at | DATETIME | NOT NULL | Timestamp of status change |

**Indexes**:
- `idx_statushistory_workorder` ON (work_order_id, created_at DESC) - Timeline view
- `idx_statushistory_actor` ON (actor_id) - User activity tracking

**Relationships**:
- `work_order_id` → WorkOrder.id (Many-to-One)
- `actor_id` → User.id (Many-to-One)

**Validation Rules** (from FR-011):
- `created_at`: Must be >= work_order.created_at
- Append-only table (no UPDATE or DELETE operations allowed)

**Notes**:
- Every work order status change triggers INSERT into this table
- Provides complete timeline for work order detail view (FR-013)

---

### 5. FaultType

**Purpose**: Categorizes work order issues (configurable by administrators)

**Table**: `fault_types`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique fault type identifier |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Category name (e.g., "Electrical - Lighting") |
| parent_id | INT | FOREIGN KEY → fault_types.id, NULL | Parent category (supports hierarchy) |
| active | BOOLEAN | DEFAULT TRUE, NOT NULL | Whether selectable in new work orders |
| created_at | DATETIME | NOT NULL | Category creation timestamp |
| updated_at | DATETIME | NOT NULL | Last modification timestamp |

**Indexes**:
- `idx_faulttypes_active` ON (active) - Filter active categories
- `idx_faulttypes_parent` ON (parent_id) - Hierarchy navigation

**Relationships**:
- `parent_id` → FaultType.id (Self-referencing Many-to-One for hierarchy)
- Work Orders → WorkOrder.fault_type_id (One-to-Many)

**Initial Seed Data** (examples from spec):
- Electrical (parent)
  - Electrical - Lighting (child)
  - Electrical - Outlet (child)
- Plumbing (parent)
  - Plumbing - Leak (child)
  - Plumbing - Clog (child)
- HVAC (parent)
  - HVAC - Air Conditioning (child)
  - HVAC - Heating (child)

**Notes**:
- Hierarchy depth limited to 2 levels (parent → child)
- Soft delete via `active = false` (preserves historical work order references)

---

### 6. SLARule

**Purpose**: Defines service level agreement targets per priority level

**Table**: `sla_rules`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique SLA rule identifier |
| priority | ENUM('Low','Normal','High','Emergency') | UNIQUE, NOT NULL | Work order priority level |
| target_response_hours | INT | NOT NULL | Max hours until first technician action |
| target_resolution_hours | INT | NOT NULL | Max hours until completion |
| escalation_threshold_pct | INT | DEFAULT 80, NOT NULL | Percentage of deadline before warning (0-100) |
| active | BOOLEAN | DEFAULT TRUE, NOT NULL | Whether rule is currently enforced |
| created_at | DATETIME | NOT NULL | Rule creation timestamp |
| updated_at | DATETIME | NOT NULL | Last modification timestamp |

**Indexes**:
- `idx_slarules_priority` ON (priority) - Fast lookup by priority

**Relationships**:
- Work Orders → Applied via work_order.priority matching sla_rule.priority

**Initial Seed Data** (from FR-029):
| Priority | Response Hours | Resolution Hours | Escalation % |
|----------|----------------|------------------|--------------|
| Emergency | 1 | 2 | 80 |
| High | 2 | 4 | 80 |
| Normal | 4 | 24 | 80 |
| Low | 24 | 72 | 80 |

**Notes**:
- Only one active rule per priority level (enforced in application layer)
- Changes to SLA rules don't retroactively affect existing work orders

---

### 7. Notification

**Purpose**: Tracks all notification attempts and delivery status

**Table**: `notifications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique notification identifier |
| work_order_id | INT | FOREIGN KEY → work_orders.id, NOT NULL | Associated work order |
| recipient_id | INT | FOREIGN KEY → users.id, NOT NULL | User to receive notification |
| notification_type | ENUM('template_message','push') | NOT NULL | WeChat notification type |
| event_type | VARCHAR(50) | NOT NULL | Trigger event (e.g., "status_change", "sla_warning") |
| content | TEXT | NOT NULL | Notification message content |
| delivery_status | ENUM('pending','sent','failed','delivered') | DEFAULT 'pending', NOT NULL | Current status |
| sent_at | DATETIME | NULL | First send attempt timestamp |
| delivered_at | DATETIME | NULL | Successful delivery confirmation timestamp |
| retry_count | INT | DEFAULT 0, NOT NULL | Number of retry attempts (max 3) |
| error_message | TEXT | NULL | Error details if delivery failed |
| created_at | DATETIME | NOT NULL | Notification creation timestamp |
| updated_at | DATETIME | NOT NULL | Last modification timestamp |

**Indexes**:
- `idx_notifications_workorder` ON (work_order_id) - Notifications per work order
- `idx_notifications_recipient` ON (recipient_id) - User's notification history
- `idx_notifications_status` ON (delivery_status, created_at) - Retry queue

**Relationships**:
- `work_order_id` → WorkOrder.id (Many-to-One)
- `recipient_id` → User.id (Many-to-One)

**Validation Rules** (from FR-016 to FR-021):
- `delivery_status`: Transitions: pending → sent → delivered (success path)
- `delivery_status`: Transitions: pending → sent → failed (retry or permanent failure)
- `retry_count`: Max 3 retries with exponential backoff (10s, 30s, 90s)

**Notes**:
- Separate record for each recipient (one work order status change = multiple notifications)
- Cron job processes `delivery_status = 'failed'` AND `retry_count < 3` for retries

---

### 8. AuditLog

**Purpose**: Immutable record of all critical system operations

**Table**: `audit_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PRIMARY KEY, AUTO_INCREMENT | Unique log entry identifier |
| timestamp | DATETIME | NOT NULL, INDEX | Operation timestamp (high cardinality) |
| user_id | INT | FOREIGN KEY → users.id, NULL | User who performed action (NULL for system actions) |
| ip_address | VARCHAR(45) | NULL | Client IP address (supports IPv6) |
| action_type | VARCHAR(50) | NOT NULL | Operation category (e.g., "user_login", "work_order_created") |
| resource_type | VARCHAR(50) | NULL | Affected entity type (e.g., "WorkOrder", "User") |
| resource_id | INT | NULL | Affected entity ID |
| before_state | JSON | NULL | Entity state before operation |
| after_state | JSON | NULL | Entity state after operation |
| success | BOOLEAN | NOT NULL | Whether operation succeeded |
| error_message | TEXT | NULL | Error details if success = false |

**Indexes**:
- `idx_auditlogs_timestamp` ON (timestamp DESC) - Recent activity queries
- `idx_auditlogs_user` ON (user_id, timestamp DESC) - User activity history
- `idx_auditlogs_action` ON (action_type, timestamp DESC) - Filter by action type
- `idx_auditlogs_resource` ON (resource_type, resource_id) - Entity audit trail

**Partition Strategy**:
- Partition by YEAR(timestamp) to manage growth
- Archive partitions older than 2 years to cold storage

**Relationships**:
- `user_id` → User.id (Many-to-One, nullable for system actions)

**Validation Rules** (from FR-035 to FR-039):
- Append-only table (no UPDATE or DELETE operations)
- Retention: Minimum 2 years, partitions older than 2 years moved to archive storage
- `ip_address`: Extracted from request headers (X-Forwarded-For or direct connection)

**Logged Actions** (from FR-035):
- User login (`action_type = 'user_login'`)
- Permission changes (`action_type = 'permission_changed'`)
- Work order creation (`action_type = 'work_order_created'`)
- Status changes (`action_type = 'status_changed'`)
- Configuration updates (`action_type = 'config_updated'`)

**Notes**:
- High volume table (estimate: ~50k records/month)
- Partition pruning optimizes queries (only scan relevant year partitions)

---

## Database Schema Summary

**Total Tables**: 8
- `users` (Core)
- `roles` (Core)
- `work_orders` (Core)
- `status_history` (Audit)
- `fault_types` (Reference Data)
- `sla_rules` (Reference Data)
- `notifications` (Operational)
- `audit_logs` (Audit)

**Foreign Key Relationships**: 11
**Indexes**: 25+
**Enum Types**: 3 (priority, status, notification_type)

**Storage Estimates** (500 work orders/month, 50 users):
- `work_orders`: ~50KB/month
- `status_history`: ~100KB/month (avg 5 transitions per order)
- `notifications`: ~200KB/month (avg 10 notifications per order)
- `audit_logs`: ~1MB/month
- **Total Growth**: ~1.5MB/month (~20MB/year)

**Backup Strategy**:
- Daily full backups (retain 30 days)
- Transaction log backups every hour (retain 7 days)
- Test restore procedure monthly

---

## Next Steps

1. Create Sequelize migration files for all tables
2. Generate seed data scripts (roles, fault types, SLA rules, test users)
3. Define Sequelize models with associations
4. Create API contracts based on this data model
