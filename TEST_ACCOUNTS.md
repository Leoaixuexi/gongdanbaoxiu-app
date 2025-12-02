# Test Accounts - Work Order Management System

This document lists all test user accounts created by the database seeders. These accounts are for development and testing purposes only.

**WARNING:** These accounts should NEVER be used in production. Remove all test accounts before deploying to production.

---

## Test Accounts Overview

The system includes 5 test accounts, one for each user role:

| ID | Name | Role | OpenID | Phone |
|----|------|------|--------|-------|
| 1 | 测试超管 | Super Admin | test_openid_super_admin | 13800000001 |
| 2 | 测试管理 | System Admin | test_openid_sys_admin | 13800000002 |
| 3 | 测试经理 | Administrative Manager | test_openid_admin_manager | 13800000003 |
| 4 | 测试物业 | Property Staff | test_openid_property_staff | 13800000004 |
| 5 | 测试维修 | Maintenance Worker | test_openid_maintenance_worker | 13800000005 |

---

## Account Details

### 1. Super Admin Account

**User Information:**
- **ID:** 1
- **Name:** 测试超管
- **WeChat OpenID:** `test_openid_super_admin`
- **Role:** Super Admin (role_id: 1)
- **Department:** 管理部
- **Contact Phone:** 13800000001
- **Supervisor:** None (top-level administrator)
- **Status:** Active

**Permissions:**
```json
{
  "permissions": [
    "view_all_work_orders",
    "manage_all_work_orders",
    "submit_work_orders",
    "assign_work_orders",
    "review_work_orders",
    "manage_users",
    "manage_roles",
    "manage_fault_types",
    "manage_sla_rules",
    "view_analytics",
    "export_reports",
    "view_audit_logs",
    "manage_system_config"
  ]
}
```

**Use Cases:**
- Full system administration
- User and role management
- System configuration
- Viewing all audit logs
- Emergency access to all features

**Login (WeChat Test Mode):**
```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_super_admin"}'
```

---

### 2. System Admin Account

**User Information:**
- **ID:** 2
- **Name:** 测试管理
- **WeChat OpenID:** `test_openid_sys_admin`
- **Role:** System Admin (role_id: 2)
- **Department:** 管理部
- **Contact Phone:** 13800000002
- **Supervisor:** Super Admin (user_id: 1)
- **Status:** Active

**Permissions:**
```json
{
  "permissions": [
    "view_all_work_orders",
    "submit_work_orders",
    "assign_work_orders",
    "review_work_orders",
    "manage_users",
    "manage_fault_types",
    "view_analytics",
    "export_reports",
    "view_audit_logs"
  ]
}
```

**Use Cases:**
- User management (create, edit, deactivate users)
- View and manage all work orders
- Configure fault types
- View system analytics
- Export reports
- View audit logs

**Login (WeChat Test Mode):**
```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_sys_admin"}'
```

**Test Workflows:**
1. Create new user account
2. Assign roles to users
3. View all work orders across the system
4. Export work order reports
5. View duplicate work orders
6. Monitor system audit logs

---

### 3. Administrative Manager Account

**User Information:**
- **ID:** 3
- **Name:** 测试经理
- **WeChat OpenID:** `test_openid_admin_manager`
- **Role:** Administrative Manager (role_id: 3)
- **Department:** 行政部
- **Contact Phone:** 13800000003
- **Supervisor:** Super Admin (user_id: 1)
- **Status:** Active

**Permissions:**
```json
{
  "permissions": [
    "view_all_work_orders",
    "submit_work_orders",
    "assign_work_orders",
    "review_work_orders",
    "view_analytics",
    "export_reports"
  ]
}
```

**Use Cases:**
- View dashboard with system statistics
- Monitor all work orders
- Review work order analytics
- Assign work orders to technicians
- Submit work orders on behalf of property staff
- Export reports for management

**Login (WeChat Test Mode):**
```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_admin_manager"}'
```

**Test Workflows:**
1. View dashboard statistics
2. View all work orders (from all submitters)
3. Filter work orders by status, priority, floor
4. View overdue work orders
5. Manually assign work order to specific technician
6. View analytics and charts
7. Export work order reports

---

### 4. Property Staff Account

**User Information:**
- **ID:** 4
- **Name:** 测试物业
- **WeChat OpenID:** `test_openid_property_staff`
- **Role:** Property Staff (role_id: 4)
- **Department:** 物业部
- **Contact Phone:** 13800000004
- **Supervisor:** Administrative Manager (user_id: 3)
- **Status:** Active

**Permissions:**
```json
{
  "permissions": [
    "submit_work_orders",
    "view_own_work_orders",
    "review_work_orders"
  ]
}
```

**Use Cases:**
- Submit new work orders for repairs
- View only their own submitted work orders
- Review completed repairs (accept or reject)
- Upload photos of issues
- Track work order status

**Login (WeChat Test Mode):**
```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_property_staff"}'
```

**Test Workflows:**

**US1: Submit Work Order**
1. Navigate to "Submit Order" page
2. Fill in location: "8F Room 805"
3. Select fault type: "水电故障 > 漏水"
4. Set priority: "High"
5. Enter description: "Bathroom ceiling leaking water. Urgent repair needed."
6. Upload 2 photos
7. Submit order
8. Verify success message and order number

**US5: View Submitted Orders**
1. Navigate to "Submitted Orders"
2. View list of all submitted orders
3. Filter by status: "Completed"
4. Click on order to view details
5. View status timeline

**US6: Review Completed Work**
1. Find order with status "Repaired"
2. Click to view repair details
3. Review repair photos and notes
4. Accept repair (mark as "Completed")
   - OR reject repair (mark as "Needs Rework" with notes)
5. Verify status change and notification sent

---

### 5. Maintenance Worker Account

**User Information:**
- **ID:** 5
- **Name:** 测试维修
- **WeChat OpenID:** `test_openid_maintenance_worker`
- **Role:** Maintenance Worker (role_id: 5)
- **Department:** 维修组
- **Contact Phone:** 13800000005
- **Supervisor:** Administrative Manager (user_id: 3)
- **Status:** Active

**Permissions:**
```json
{
  "permissions": [
    "view_assigned_work_orders",
    "update_work_order_status",
    "upload_repair_photos"
  ]
}
```

**Constraints:**
- Maximum 5 concurrent "In Progress" work orders
- Can only view and update assigned work orders
- Cannot submit or review work orders

**Use Cases:**
- View assigned work orders
- Start repair work
- Update repair status
- Upload repair completion photos
- Mark work as completed or needing rework

**Login (WeChat Test Mode):**
```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_maintenance_worker"}'
```

**Test Workflows:**

**US2: View Assigned Orders**
1. Navigate to "Pending Repairs"
2. View list of assigned work orders
3. Filter by priority: "High"
4. Click on order to view details
5. Verify only assigned orders are visible

**US3: Start Repair**
1. Select work order with status "Pending Repair"
2. Click "Start Repair" button
3. Confirm action
4. Verify status changes to "In Progress"
5. Verify started_at timestamp recorded

**US4: Update Repair Status**

**Scenario A: Mark as Repaired**
1. Navigate to "In Progress" tab
2. Select active work order
3. Upload 2 repair completion photos
4. Enter completion notes: "Replaced leaking pipe joint. Tested for 10 minutes. No more leaks."
5. Click "Mark as Repaired"
6. Verify status changes to "Repaired"
7. Verify notification sent to submitter

**Scenario B: Mark as Needs Rework**
1. Select different work order
2. Enter notes: "Unable to complete. Special parts needed. Ordered parts, will complete in 2 days."
3. Click "Needs Rework"
4. Verify status changes
5. Verify rework_count incremented
6. Verify notification sent to submitter and supervisor

**Test Concurrent Order Limit:**
1. Start 5 work orders
2. Attempt to start 6th work order
3. Verify error: "Maximum concurrent orders reached (5)"
4. Complete one order
5. Verify can now start another order

---

## Quick Login Examples

### Using curl

**Login as Property Staff:**
```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code_property_staff"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 4,
      "name": "测试物业",
      "wechat_openid": "test_openid_property_staff",
      "role_id": 4,
      "contact_phone": "13800000004",
      "department": "物业部",
      "role": {
        "id": 4,
        "role_name": "Property Staff",
        "permissions": [...]
      }
    }
  }
}
```

**Save token for subsequent requests:**
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Use token in API requests:**
```bash
curl -X GET http://localhost:3000/api/workorders \
  -H "Authorization: Bearer $TOKEN"
```

---

## WeChat Test Code Mapping

For WeChat test mode authentication, the backend maps test codes to OpenIDs:

| Test Code | OpenID | User |
|-----------|--------|------|
| `test_code_super_admin` | `test_openid_super_admin` | Super Admin |
| `test_code_sys_admin` | `test_openid_sys_admin` | System Admin |
| `test_code_admin_manager` | `test_openid_admin_manager` | Administrative Manager |
| `test_code_property_staff` | `test_openid_property_staff` | Property Staff |
| `test_code_maintenance_worker` | `test_openid_maintenance_worker` | Maintenance Worker |

**Implementation:**
See `backend/src/controllers/authController.js` - `wechatLogin()` function

---

## Database Queries

### View All Test Users

```sql
SELECT
  u.id,
  u.name,
  u.wechat_openid,
  r.role_name,
  u.department,
  u.contact_phone,
  u.active
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.wechat_openid LIKE 'test_openid_%'
ORDER BY u.id;
```

### View User with Permissions

```sql
SELECT
  u.id,
  u.name,
  r.role_name,
  r.permissions
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.id = 4;
```

### Check User's Submitted Work Orders

```sql
SELECT
  wo.id,
  wo.order_number,
  wo.status,
  wo.priority,
  wo.created_at
FROM work_orders wo
WHERE wo.submitter_id = 4
ORDER BY wo.created_at DESC;
```

### Check User's Assigned Work Orders

```sql
SELECT
  wo.id,
  wo.order_number,
  wo.status,
  wo.priority,
  wo.created_at
FROM work_orders wo
WHERE wo.assigned_technician_id = 5 AND wo.status IN ('Pending Repair', 'In Progress')
ORDER BY wo.priority DESC, wo.created_at ASC;
```

---

## Removing Test Accounts

### For Production Deployment

**IMPORTANT:** Remove all test accounts before deploying to production!

```bash
# DO NOT run seeders in production
# Test users should not exist in production database
```

**To remove test accounts:**

```sql
-- Delete all test users
DELETE FROM users WHERE wechat_openid LIKE 'test_openid_%';

-- Verify deletion
SELECT COUNT(*) FROM users WHERE wechat_openid LIKE 'test_openid_%';
-- Should return 0
```

**Undo seeders:**
```bash
cd backend
npm run db:seed:undo
```

---

## Creating Production Users

In production, create users through:

1. **Admin Interface:**
   - Log in as Super Admin
   - Navigate to "User Management"
   - Click "Add User"
   - Fill in user details
   - Assign role
   - Save

2. **Direct Database Insert:**
   ```sql
   INSERT INTO users (
     wechat_openid,
     name,
     role_id,
     contact_phone,
     department,
     supervisor_id,
     active,
     created_at,
     updated_at
   ) VALUES (
     'actual_wechat_openid_from_oauth',
     'Real User Name',
     4,  -- Role ID
     '13912345678',
     '物业部',
     3,  -- Supervisor ID
     true,
     NOW(),
     NOW()
   );
   ```

---

## Security Notes

1. **Test OpenIDs are predictable** - Never use in production
2. **No authentication bypass** - Test codes only work in development mode
3. **Real WeChat OAuth required** - Production must use actual WeChat authentication
4. **Change JWT_SECRET** - Use strong, random secret in production
5. **Remove test data** - Clean database before production deployment

---

## Additional Resources

- [Testing Guide](./TESTING_GUIDE.md) - Comprehensive testing instructions
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Production deployment steps
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
