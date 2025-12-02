# Testing Guide - Work Order Management System

This comprehensive testing guide covers all aspects of testing the Work Order Management System, including prerequisites, setup, API testing, WeChat MiniProgram testing, and integration scenarios.

## Table of Contents
- [Prerequisites Check](#prerequisites-check)
- [Database Setup](#database-setup)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [Integration Testing Scenarios](#integration-testing-scenarios)
- [Performance Testing](#performance-testing)

---

## Prerequisites Check

Before starting, ensure all required software and tools are installed:

### 1. Node.js (>= 18.0.0)

Check your Node.js version:

```bash
node --version
```

**Expected output:** `v18.0.0` or higher

**If not installed:** Download from [https://nodejs.org/](https://nodejs.org/)

### 2. MySQL (>= 8.0)

Check your MySQL version:

```bash
mysql --version
```

**Expected output:** `mysql  Ver 8.0.x` or higher

**If not installed:** Download from [https://dev.mysql.com/downloads/mysql/](https://dev.mysql.com/downloads/mysql/)

Test MySQL connection:

```bash
mysql -u root -p
```

### 3. Redis (>= 6.0)

Check your Redis version:

```bash
redis-cli --version
```

**Expected output:** `redis-cli 6.0.x` or higher

Test Redis connection:

```bash
redis-cli ping
```

**Expected output:** `PONG`

### 4. WeChat Developer Tools

Download and install WeChat Developer Tools:
- Official site: [https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- Version required: Latest stable version

### 5. Required Environment Variables

Create a `.env` file in the `backend` directory based on `.env.example`:

```bash
cd C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend
cp .env.example .env
```

**Required variables:**
- `PORT` - Server port (default: 3000)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database credentials
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `JWT_SECRET` - Secret key for JWT tokens
- `WECHAT_APPID`, `WECHAT_SECRET` - WeChat MiniProgram credentials

---

## Database Setup

### Step 1: Create Database

Connect to MySQL and create the database:

```bash
mysql -u root -p
```

```sql
CREATE DATABASE workorder_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
```

**Expected output:** You should see `workorder_dev` in the list.

Exit MySQL:
```sql
EXIT;
```

### Step 2: Configure Database Connection

Edit `backend/.env` file with your database credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=workorder_dev
DB_USER=root
DB_PASSWORD=your_mysql_password
```

### Step 3: Run Database Migrations

Migrations create all required tables and schema:

```bash
cd C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend
npm run db:migrate
```

**Expected output:**
```
Sequelize CLI [Node: 18.x.x, CLI: 6.6.2, ORM: 6.35.0]

Loaded configuration file "src/config/database.js".
Using environment "development".
== 20251112000001-create-roles: migrating =======
== 20251112000001-create-roles: migrated (0.123s)
== 20251112000002-create-users: migrating =======
== 20251112000002-create-users: migrated (0.145s)
...
```

### Step 4: Verify Database Schema

Connect to MySQL and verify tables were created:

```bash
mysql -u root -p workorder_dev
```

```sql
SHOW TABLES;
```

**Expected output:**
```
+---------------------------+
| Tables_in_workorder_dev   |
+---------------------------+
| SequelizeMeta             |
| audit_logs                |
| fault_types               |
| notifications             |
| roles                     |
| sla_rules                 |
| status_history            |
| users                     |
| work_orders               |
+---------------------------+
```

Check the structure of a table:
```sql
DESCRIBE work_orders;
EXIT;
```

### Step 5: Run Database Seeders

Seeders populate the database with test data:

```bash
npm run db:seed
```

**Expected output:**
```
== 20251112000001-seed-roles: migrating =======
== 20251112000001-seed-roles: migrated (0.089s)
== 20251112000002-seed-fault-types: migrating =======
== 20251112000002-seed-fault-types: migrated (0.067s)
== 20251112000003-seed-sla-rules: migrating =======
== 20251112000003-seed-sla-rules: migrated (0.056s)
== 20251112000004-seed-test-users: migrating =======
== 20251112000004-seed-test-users: migrated (0.078s)
```

### Step 6: Verify Seeded Data

Verify that test data was inserted:

```bash
mysql -u root -p workorder_dev
```

**Verification queries:**

```sql
-- Check roles
SELECT id, role_name FROM roles;

-- Expected output:
-- +----+-------------------------+
-- | id | role_name               |
-- +----+-------------------------+
-- |  1 | Super Admin             |
-- |  2 | System Admin            |
-- |  3 | Administrative Manager  |
-- |  4 | Property Staff          |
-- |  5 | Maintenance Worker      |
-- +----+-------------------------+

-- Check users
SELECT id, name, wechat_openid FROM users;

-- Expected output:
-- +----+----------+--------------------------------+
-- | id | name     | wechat_openid                  |
-- +----+----------+--------------------------------+
-- |  1 | 测试超管 | test_openid_super_admin        |
-- |  2 | 测试管理 | test_openid_sys_admin          |
-- |  3 | 测试经理 | test_openid_admin_manager      |
-- |  4 | 测试物业 | test_openid_property_staff     |
-- |  5 | 测试维修 | test_openid_maintenance_worker |
-- +----+----------+--------------------------------+

-- Check fault types
SELECT id, type_name, category FROM fault_types;

-- Check SLA rules
SELECT fault_type_id, priority, response_time_hours, resolution_time_hours FROM sla_rules;

EXIT;
```

---

## Backend Testing

### Step 1: Install Dependencies

```bash
cd C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend
npm install
```

**Expected output:** Dependencies installed without errors.

### Step 2: Start Redis Server

**On Windows (if using WSL or native Redis):**
```bash
redis-server
```

**Expected output:**
```
[xxxxx] 13 Nov XX:XX:XX.XXX * Server initialized
[xxxxx] 13 Nov XX:XX:XX.XXX * Ready to accept connections
```

Keep this terminal open.

### Step 3: Start Backend Server

Open a new terminal:

```bash
cd C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend
npm run dev
```

**Expected output:**
```
[2025-11-13 XX:XX:XX] info: Starting Work Order Management System API...
[2025-11-13 XX:XX:XX] info: Connecting to database...
[2025-11-13 XX:XX:XX] info: Database connection established successfully
[2025-11-13 XX:XX:XX] info: Testing Redis connection...
[2025-11-13 XX:XX:XX] info: Redis connection successful
[2025-11-13 XX:XX:XX] info: Mounting API routes...
[2025-11-13 XX:XX:XX] info: API routes mounted successfully
[2025-11-13 XX:XX:XX] info: Error handlers configured
[2025-11-13 XX:XX:XX] info: Server started successfully
[2025-11-13 XX:XX:XX] info: Available endpoints:
    health: http://localhost:3000/api/health
    api: http://localhost:3000/api
[2025-11-13 XX:XX:XX] info: Initializing scheduled jobs...
[2025-11-13 XX:XX:XX] info: SLA monitor job started (runs every 1 minute)
[2025-11-13 XX:XX:XX] info: All scheduled jobs initialized successfully
```

### Step 4: Test API Endpoints

#### Health Check

```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-13T10:30:00.000Z",
  "uptime": 45.123
}
```

#### API Root

```bash
curl http://localhost:3000/api
```

**Expected response:**
```json
{
  "success": true,
  "message": "Work Order Management System API",
  "version": "1.0.0",
  "timestamp": "2025-11-13T10:30:00.000Z",
  "endpoints": {
    "auth": "/api/auth",
    "workorders": "/api/workorders",
    "analytics": "/api/analytics",
    "users": "/api/users"
  }
}
```

#### WeChat Login (Test Mode)

```bash
curl -X POST http://localhost:3000/api/auth/wechat \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"test_code_property_staff\"}"
```

**Expected response:**
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

**Save the token** for subsequent API calls.

#### Create Work Order (Authenticated)

```bash
curl -X POST http://localhost:3000/api/workorders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "floor": "5F",
    "location": "Room 501",
    "fault_type_id": 1,
    "priority": "High",
    "description": "Water leaking from ceiling in bathroom. Urgent repair needed.",
    "photos_json": []
  }'
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "order_number": "WO20251113001",
    "floor": "5F",
    "location": "Room 501",
    "fault_type_id": 1,
    "priority": "High",
    "status": "Pending Assignment",
    "submitter_id": 4,
    "assigned_technician_id": 5,
    "sla_deadline": "2025-11-13T18:00:00.000Z",
    "created_at": "2025-11-13T10:35:00.000Z"
  }
}
```

#### Get Work Orders List

```bash
curl -X GET "http://localhost:3000/api/workorders?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "workOrders": [
      {
        "id": 1,
        "order_number": "WO20251113001",
        "status": "Pending Assignment",
        ...
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

### Step 5: Verify SLA Monitor Job

Check server logs for SLA monitor activity:

**Expected log output (every 1 minute):**
```
[2025-11-13 XX:XX:XX] info: Running SLA monitor check...
[2025-11-13 XX:XX:XX] info: SLA check completed
```

### Step 6: Verify Redis Cache

Connect to Redis and check cached data:

```bash
redis-cli
```

```redis
KEYS *
GET user:session:YOUR_TOKEN
```

### Step 7: Check Log Files

Logs are stored in `backend/logs/` directory:

```bash
# View combined logs
cat backend/logs/combined.log

# View error logs only
cat backend/logs/error.log
```

**Log file locations:**
- `C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend\logs\combined.log`
- `C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend\logs\error.log`

---

## Frontend Testing

### Step 1: Import Project to WeChat DevTools

1. Open WeChat Developer Tools
2. Click "Import Project"
3. Select project directory: `C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\miniprogram`
4. Enter AppID (use test AppID or "Test Account" option)
5. Click "Import"

### Step 2: Configure API Base URL

Edit `miniprogram/config/api.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

For local testing, you may need to:
1. Enable "不校验合法域名" (Don't verify legal domains) in DevTools settings
2. Ensure backend is running on same network

### Step 3: Test Login Flow

1. In WeChat DevTools simulator, the app should auto-navigate to login
2. Click login button
3. Observe console logs for WeChat login code
4. Backend should receive code and return JWT token
5. App should store token and navigate to home page

**Expected behavior:**
- User is logged in with test account
- Home page displays based on user role
- Navigation bar shows appropriate tabs

### Step 4: Test Each User Role Workflow

#### Property Staff Role (Role ID: 4)

Login with Property Staff test account:
- OpenID: `test_openid_property_staff`

**Test workflow:**
1. **Submit Work Order** (US1):
   - Navigate to "Submit Order" page
   - Fill in location: "6F Room 603"
   - Select fault type: "水电故障 > 漏水"
   - Set priority: "High"
   - Enter description (min 10 chars)
   - Upload photos (optional)
   - Submit

   **Expected result:**
   - Success message displayed
   - Order appears in "My Submitted Orders"
   - Technician auto-assigned
   - SLA deadline calculated

2. **View Submitted Orders** (US5):
   - Navigate to "Submitted Orders"
   - View list of submitted orders
   - Click on order to view details
   - Verify status timeline

3. **Review Completed Work** (US6):
   - Find order with status "Repaired"
   - Click to view details
   - Review repair photos and notes
   - Accept or reject repair
   - If reject: provide rejection notes
   - Submit review

   **Expected result:**
   - Status changes to "Completed" or "Needs Rework"
   - Notification sent to technician

#### Maintenance Worker Role (Role ID: 5)

Login with Maintenance Worker test account:
- OpenID: `test_openid_maintenance_worker`

**Test workflow:**
1. **View Assigned Orders** (US2):
   - Navigate to "Pending Repairs"
   - View list of assigned orders
   - Filter by priority
   - Click on order to view details

2. **Start Repair** (US3):
   - Select order with status "Pending Repair"
   - Click "Start Repair"
   - Confirm action

   **Expected result:**
   - Status changes to "In Progress"
   - started_at timestamp recorded
   - Cannot start more than 5 concurrent orders

3. **Update Repair Status** (US4):
   - Navigate to "In Progress"
   - Select active repair order
   - Upload repair photos
   - Enter completion notes
   - Mark as "Repaired"

   **Expected result:**
   - Status changes to "Repaired"
   - Notification sent to submitter
   - Order moves to history

#### Administrative Manager Role (Role ID: 3)

Login with Administrative Manager test account:
- OpenID: `test_openid_admin_manager`

**Test workflow:**
1. **View Dashboard**:
   - Navigate to "Dashboard"
   - View statistics cards
   - View charts and graphs
   - Filter by date range

2. **View All Work Orders**:
   - See work orders from all staff
   - Filter by status, priority, floor
   - View overdue orders

3. **View Analytics**:
   - Navigate to "Analytics"
   - View completion rate
   - View average resolution time
   - Export reports

#### System Admin Role (Role ID: 2)

Login with System Admin test account:
- OpenID: `test_openid_sys_admin`

**Test workflow:**
1. **User Management**:
   - Navigate to "Users"
   - View all users
   - Add new user
   - Edit user details
   - Deactivate user

2. **View Audit Logs**:
   - Navigate to "Audit Logs"
   - Filter by user, action, date
   - View detailed log entries

3. **Duplicate Detection**:
   - Navigate to "Duplicates"
   - Select date range
   - View duplicate work orders
   - Review similarity scores

---

## Integration Testing Scenarios

### US1: Submit Work Order (Property Staff)

**Prerequisites:**
- Logged in as Property Staff (role_id: 4)
- Backend server running
- Database seeded with fault types and SLA rules

**Test Steps:**

1. Navigate to "Submit Order" page
2. Fill in form:
   - Floor: "8F"
   - Location: "Room 805 - Kitchen"
   - Fault Type: Select "设施故障 > 门窗损坏"
   - Priority: "Normal"
   - Description: "Kitchen window won't close properly. Wind is coming through the gap."
   - Photos: Upload 2 photos

3. Click "Submit"

**Expected Results:**
- Success message: "Work order submitted successfully"
- Order number generated (e.g., "WO20251113002")
- Technician auto-assigned (least busy technician)
- SLA deadline calculated based on priority and fault type
- Status: "Pending Assignment" → "Pending Repair"
- Database records:
  - `work_orders` table: New record created
  - `status_history` table: Status change recorded
  - `notifications` table: Notification sent to assigned technician
  - `audit_logs` table: Action logged

**Verification Queries:**
```sql
SELECT id, order_number, status, assigned_technician_id, sla_deadline
FROM work_orders
WHERE order_number = 'WO20251113002';

SELECT * FROM status_history WHERE work_order_id = 2;
SELECT * FROM notifications WHERE work_order_id = 2;
```

**Common Issues:**
- Error: "Fault type not found" → Ensure database seeded
- Error: "No available technician" → Create maintenance worker account
- Photos not uploading → Check COS configuration in .env

---

### US2: View Assigned Orders (Maintenance Worker)

**Prerequisites:**
- Logged in as Maintenance Worker (role_id: 5)
- At least one work order assigned to this worker

**Test Steps:**

1. Navigate to "Pending Repairs" page
2. Observe list of assigned orders
3. Apply filter: Priority = "High"
4. Click on a work order to view details

**Expected Results:**
- Only orders assigned to logged-in technician are shown
- Orders sorted by priority (High → Normal → Low)
- Each order card shows:
  - Order number
  - Location
  - Fault type
  - Priority badge
  - SLA deadline (highlighted if overdue)
- Detail page shows:
  - Full description
  - Photos submitted
  - Status timeline
  - SLA countdown

**Verification:**
```sql
SELECT id, order_number, priority, assigned_technician_id
FROM work_orders
WHERE assigned_technician_id = 5 AND status = 'Pending Repair';
```

---

### US3: Start Repair (Maintenance Worker)

**Prerequisites:**
- Logged in as Maintenance Worker
- Work order with status "Pending Repair" assigned

**Test Steps:**

1. Select work order from "Pending Repairs"
2. Click "Start Repair" button
3. Confirm action

**Expected Results:**
- Status changes from "Pending Repair" → "In Progress"
- `started_at` timestamp recorded
- Order moves from "Pending" to "In Progress" tab
- Status history updated
- Cannot start if already have 5 orders "In Progress"

**Concurrent Order Limit Test:**
- Start 5 work orders
- Attempt to start 6th order
- **Expected error:** "Maximum concurrent orders reached (5)"

**Verification:**
```sql
SELECT id, order_number, status, started_at
FROM work_orders
WHERE id = 1;

SELECT COUNT(*) as in_progress_count
FROM work_orders
WHERE assigned_technician_id = 5 AND status = 'In Progress';
```

---

### US4: Update Repair Status (Maintenance Worker)

**Prerequisites:**
- Work order with status "In Progress"

**Test Steps:**

**Scenario A: Mark as Repaired**
1. Navigate to "In Progress" tab
2. Select work order
3. Upload 2 repair completion photos
4. Enter completion notes: "Replaced window latch. Window now closes securely. Tested multiple times."
5. Click "Mark as Repaired"

**Expected Results:**
- Status changes to "Repaired"
- `repaired_at` timestamp recorded
- Completion notes and photos saved
- Notification sent to submitter (Property Staff)
- Order moves to "History" tab

**Scenario B: Mark as Needs Rework**
1. Select different work order
2. Enter notes: "Unable to complete repair. Need special parts. Ordering parts, will complete in 2 days."
3. Click "Needs Rework"

**Expected Results:**
- Status changes to "Needs Rework"
- `rework_count` incremented
- Notification sent to submitter AND supervisor
- Order status reverts based on business rules

**Verification:**
```sql
SELECT id, order_number, status, repaired_at, completion_notes
FROM work_orders
WHERE id = 1;

SELECT * FROM status_history WHERE work_order_id = 1 ORDER BY created_at DESC LIMIT 1;
SELECT * FROM notifications WHERE work_order_id = 1 AND type = 'Repaired';
```

---

### US5: View Submitted Orders (Property Staff)

**Prerequisites:**
- Logged in as Property Staff
- Previously submitted work orders exist

**Test Steps:**

1. Navigate to "Submitted Orders" page
2. View list of all submitted orders
3. Filter by status: "Completed"
4. Click on completed order to view details

**Expected Results:**
- Only orders submitted by logged-in user shown
- Orders sorted by creation date (newest first)
- Status badge color-coded:
  - Pending: Blue
  - In Progress: Orange
  - Repaired: Purple
  - Completed: Green
  - Needs Rework: Red
- Detail page shows complete timeline:
  - Submitted at
  - Assigned at
  - Started at
  - Repaired at
  - Reviewed at
  - Completed at

**Verification:**
```sql
SELECT id, order_number, status, created_at
FROM work_orders
WHERE submitter_id = 4
ORDER BY created_at DESC;
```

---

### US6: Review Work Order (Property Staff)

**Prerequisites:**
- Work order with status "Repaired"
- Logged in as original submitter

**Test Steps:**

**Scenario A: Accept Repair**
1. Navigate to order with status "Repaired"
2. Review repair photos and notes
3. Enter review notes: "Repair looks good. Window closes properly now. Thank you!"
4. Click "Accept"

**Expected Results:**
- Status changes to "Completed"
- `completed_at` and `reviewed_at` timestamps recorded
- Notification sent to technician (positive feedback)
- Order marked as successfully completed

**Scenario B: Reject Repair**
1. Navigate to different "Repaired" order
2. Review repair
3. Enter detailed rejection notes: "The issue is not fully resolved. Water still dripping from pipe joint. Please check connection tightness."
4. Click "Needs Rework"

**Expected Results:**
- Status changes to "Needs Rework"
- `reviewed_at` timestamp recorded
- `rework_count` incremented
- Notification sent to technician AND supervisor
- Order reassigned to same technician

**Verification:**
```sql
SELECT id, order_number, status, completed_at, reviewed_at, review_notes
FROM work_orders
WHERE id = 1;

SELECT new_status, notes FROM status_history WHERE work_order_id = 1 ORDER BY created_at DESC LIMIT 1;
```

---

## Performance Testing

### Load Testing Approach

Use tools like Apache JMeter, Artillery, or k6 for load testing.

### Concurrent Users Simulation

**Test Scenario:** Simulate 50 concurrent users submitting work orders

**Using Artillery (npm package):**

1. Install Artillery:
```bash
npm install -g artillery
```

2. Create test script `artillery-test.yml`:
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "Submit Work Orders"
    flow:
      - post:
          url: "/api/auth/wechat"
          json:
            code: "test_code_property_staff"
          capture:
            - json: "$.data.token"
              as: "authToken"
      - post:
          url: "/api/workorders"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            floor: "{{ $randomNumber(1, 10) }}F"
            location: "Room {{ $randomNumber(100, 999) }}"
            fault_type_id: "{{ $randomNumber(1, 5) }}"
            priority: "{{ $randomString('High', 'Normal', 'Low') }}"
            description: "Test work order description for load testing"
            photos_json: []
```

3. Run test:
```bash
artillery run artillery-test.yml
```

### Response Time Benchmarks

**Acceptable response times:**
- Health check: < 50ms
- Login (WeChat auth): < 500ms
- Create work order: < 300ms
- List work orders: < 500ms
- Get work order details: < 200ms
- Update status: < 300ms

**Database query optimization verification:**

Check slow query log:
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- View slow queries
SHOW VARIABLES LIKE 'slow_query_log%';
```

**Index verification:**
```sql
-- Check indexes on work_orders table
SHOW INDEX FROM work_orders;

-- Expected indexes:
-- - PRIMARY (id)
-- - idx_order_number (order_number)
-- - idx_status (status)
-- - idx_submitter (submitter_id)
-- - idx_assigned_technician (assigned_technician_id)
-- - idx_sla_deadline (sla_deadline)
-- - idx_created_at (created_at)
```

**Redis cache hit rate:**
```bash
redis-cli INFO stats | grep keyspace
```

---

## Running Automated Tests

### Unit Tests

```bash
cd C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\backend
npm run test:unit
```

**Expected output:**
- All unit tests pass
- Code coverage report generated

### Integration Tests

```bash
npm run test:integration
```

**Expected output:**
- All integration tests pass
- API endpoints tested
- Database operations verified

### Full Test Suite with Coverage

```bash
npm test
```

**Expected coverage:**
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

Coverage report location: `backend/coverage/lcov-report/index.html`

---

## Troubleshooting

For common issues and solutions, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

For test account credentials, see [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md)

---

## Next Steps

After completing testing:
1. Review [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for production deployment
2. Set up monitoring and alerting
3. Configure production environment variables
4. Plan backup and disaster recovery strategy
