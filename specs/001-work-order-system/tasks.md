# Tasks: 工单报修管理系统 (Work Order Repair Management System)

**Input**: Design documents from `/specs/001-work-order-system/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested in specification. Testing tasks excluded per specification guidance.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **WeChat Mini-Program**: `miniprogram/`
- **Backend API**: `backend/src/`
- **Database**: `database/`

## Terminology

- **"Maintenance Worker"** and **"technician"** are used interchangeably throughout tasks - both refer to the same user role responsible for executing repairs
- **"Property Staff"** refers to users who submit and review work orders
- **"Work Order"** may be abbreviated as "order" in context

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project root structure with miniprogram/, backend/, database/, docs/, .github/ directories
- [X] T002 Initialize backend Node.js project with package.json in backend/ directory
- [X] T003 [P] Install backend dependencies: express, sequelize, mysql2, jsonwebtoken, bcryptjs, node-cron, ioredis, axios, helmet, cors, morgan, dotenv
- [X] T004 [P] Install backend dev dependencies: jest, supertest, eslint, nodemon, sequelize-cli
- [X] T005 [P] Configure ESLint for backend in backend/.eslintrc.js with Node.js + ES2020 rules
- [X] T006 [P] Create backend .gitignore file excluding node_modules/, .env, logs/, coverage/
- [X] T007 Initialize WeChat mini-program project in miniprogram/ directory with project.config.json
- [X] T008 [P] Configure mini-program project settings: es6 compilation, URL check disabled for dev
- [X] T009 [P] Create mini-program package.json for component dependencies
- [X] T010 [P] Create environment configuration template backend/.env.example with all required variables
- [X] T011 [P] Create backend/src/ directory structure: models/, controllers/, services/, middleware/, routes/, jobs/, utils/, config/
- [X] T012 [P] Create miniprogram/ directory structure: pages/, components/, services/, utils/
- [X] T013 [P] Create database/ directory structure: migrations/, seeders/, scripts/
- [X] T014 [P] Set up Sequelize CLI configuration in backend/.sequelizerc pointing to correct paths
- [X] T015 [P] Create backend startup scripts in package.json: dev (nodemon), start (node), test (jest)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Foundation

- [ ] T016 Create Sequelize database config in backend/src/config/database.js with MySQL connection settings
- [ ] T017 Create migration for users table in database/migrations/create-users.js
- [ ] T018 Create migration for roles table in database/migrations/create-roles.js
- [ ] T019 Create migration for work_orders table in database/migrations/create-work-orders.js
- [ ] T020 Create migration for status_history table in database/migrations/create-status-history.js
- [ ] T021 Create migration for fault_types table in database/migrations/create-fault-types.js
- [ ] T022 Create migration for sla_rules table in database/migrations/create-sla-rules.js
- [ ] T023 Create migration for notifications table in database/migrations/create-notifications.js
- [ ] T024 Create migration for audit_logs table in database/migrations/create-audit-logs.js
- [ ] T025 Create seeder for roles in database/seeders/seed-roles.js with 5 roles (Super Admin, System Admin, Administrative Manager, Property Staff, Maintenance Worker)
- [ ] T026 Create seeder for fault types in database/seeders/seed-fault-types.js with categories (Electrical, Plumbing, HVAC)
- [ ] T027 Create seeder for SLA rules in database/seeders/seed-sla-rules.js with 4 priority levels
- [ ] T028 Create seeder for test users in database/seeders/seed-test-users.js with one user per role
- [ ] T029 Run all migrations to create database schema

### Backend Core Models

- [ ] T030 [P] Create User model in backend/src/models/User.js with Sequelize schema
- [ ] T031 [P] Create Role model in backend/src/models/Role.js with permissions JSON field
- [ ] T032 [P] Create WorkOrder model in backend/src/models/WorkOrder.js with all fields from data-model.md
- [ ] T033 [P] Create StatusHistory model in backend/src/models/StatusHistory.js
- [ ] T034 [P] Create FaultType model in backend/src/models/FaultType.js with hierarchy support
- [ ] T035 [P] Create SLARule model in backend/src/models/SLARule.js
- [ ] T036 [P] Create Notification model in backend/src/models/Notification.js
- [ ] T037 [P] Create AuditLog model in backend/src/models/AuditLog.js
- [ ] T038 Define model associations in backend/src/models/index.js (User-Role, WorkOrder-User, etc.)

### Authentication & Authorization Framework

- [ ] T039 Create JWT utility functions in backend/src/utils/jwt.js for sign/verify tokens
- [ ] T040 Create password hashing utilities in backend/src/utils/password.js using bcryptjs
- [ ] T041 Create authentication middleware in backend/src/middleware/auth.js for JWT verification
- [ ] T042 Create RBAC middleware in backend/src/middleware/rbac.js for permission checking
- [ ] T043 Create validation middleware in backend/src/middleware/validation.js using express-validator
- [ ] T044 Create global error handler in backend/src/middleware/errorHandler.js

### API Infrastructure

- [ ] T045 Create Express app configuration in backend/src/config/app.js with middleware setup
- [ ] T046 Create WeChat API configuration in backend/src/config/wechat.js with AppID/Secret
- [ ] T047 Create Redis client setup in backend/src/config/redis.js
- [ ] T048 Create logger utility in backend/src/utils/logger.js using Winston
- [ ] T049 Create constants file in backend/src/utils/constants.js with statuses, priorities, roles
- [ ] T050 Create main app entry point in backend/src/app.js with route mounting and error handling

### Frontend Core Services

- [ ] T051 [P] Create API client wrapper in miniprogram/services/api.js with base URL and request interceptor
- [ ] T052 [P] Create auth service in miniprogram/services/auth.js for wx.login() integration
- [ ] T053 [P] Create storage wrapper in miniprogram/services/storage.js for wx.setStorage
- [ ] T054 [P] Create constants file in miniprogram/utils/constants.js mirroring backend constants
- [ ] T055 [P] Create date/time formatter in miniprogram/utils/formatter.js
- [ ] T056 [P] Create mini-program global app.js with onLaunch, onShow handlers

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Work Order Submission and Assignment (Priority: P1) 🎯 MVP

**Goal**: Property staff can create work orders with photos that auto-assign to maintenance workers and send notifications

**Independent Test**: Property staff creates work order → auto-assigned to technician → both see it in their dashboards → notification sent within 10 seconds

### Backend Implementation for US1

- [ ] T057 [P] [US1] Create assignment service in backend/src/services/assignmentService.js with round-robin algorithm
- [ ] T058 [P] [US1] Create notification service in backend/src/services/notificationService.js with WeChat template message integration
- [ ] T059 [P] [US1] Create photo upload utility in backend/src/utils/photoUpload.js for COS pre-signed URLs
- [ ] T060 [US1] Create work order controller in backend/src/controllers/workOrderController.js with create method
- [ ] T061 [US1] Implement auto-assignment logic in workOrderController.create() calling assignmentService
- [ ] T062 [US1] Implement notification sending in workOrderController.create() calling notificationService
- [ ] T063 [US1] Create work order routes in backend/src/routes/workOrders.js with POST /workorders endpoint
- [ ] T064 [US1] Add work order list endpoint GET /workorders with filtering by role (property staff sees own, maintenance sees assigned)
- [ ] T065 [US1] Add work order detail endpoint GET /workorders/:id
- [ ] T066 [US1] Implement validation for work order creation (floor, location, fault_type_id, priority, description required)
- [ ] T067 [US1] Add audit logging to work order creation in controller

### Frontend Implementation for US1

- [ ] T068 [P] [US1] Create work-order-card component in miniprogram/components/work-order-card/ with WXML, WXSS, JS
- [ ] T069 [P] [US1] Create status-badge component in miniprogram/components/status-badge/ for visual status indicators
- [ ] T070 [P] [US1] Create image-uploader component in miniprogram/components/image-uploader/ using wx.chooseImage
- [ ] T071 [US1] Create submit work order page in miniprogram/pages/property/submit/ with form UI
- [ ] T072 [US1] Implement form validation in submit page (floor, location, fault type, priority required)
- [ ] T073 [US1] Implement photo upload flow in submit page: wx.chooseImage → backend pre-signed URL → COS upload
- [ ] T074 [US1] Implement submit handler calling POST /workorders API
- [ ] T075 [US1] Create submitted orders list page in miniprogram/pages/property/submitted/ displaying work-order-cards
- [ ] T076 [US1] Create pending repairs list page in miniprogram/pages/maintenance/pending/ for maintenance workers
- [ ] T077 [US1] Create work order detail page shared by all roles showing timeline and full details
- [ ] T078 [US1] Implement pull-to-refresh on list pages
- [ ] T079 [US1] Create landing page in miniprogram/pages/index/ with role-based navigation

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - property staff can submit work orders that auto-assign to technicians

---

## Phase 4: User Story 2 - Repair Execution and Status Updates (Priority: P1)

**Goal**: Maintenance workers update work order status (In Progress, Repaired, Needs Rework) with notifications to property staff

**Independent Test**: Maintenance worker marks order "In Progress" → updates to "Repaired" with notes → property staff receives notifications for each change

### Backend Implementation for US2

- [ ] T080 [US2] Add PATCH /workorders/:id/start endpoint in backend/src/controllers/workOrderController.js
- [ ] T081 [US2] Add PATCH /workorders/:id/repair endpoint with status (Repaired/Needs Rework), completion_notes, photos
- [ ] T082 [US2] Implement status transition validation ensuring valid state machine (Pending → In Progress → Repaired)
- [ ] T083 [US2] Create status history record on every status change in StatusHistory table
- [ ] T084 [US2] Trigger notifications on status change to submitter and supervisor (if Needs Rework)
- [ ] T085 [US2] Update work order timestamps (started_at, repaired_at) based on status change
- [ ] T086 [US2] Add audit logging for all status changes
- [ ] T087 [US2] Implement concurrent work order limit check (max 5 "In Progress" per technician)

### Frontend Implementation for US2

- [ ] T088 [P] [US2] Create in-progress work orders page in miniprogram/pages/maintenance/inprogress/
- [ ] T089 [P] [US2] Create history page in miniprogram/pages/maintenance/history/ for completed/rework orders
- [ ] T090 [US2] Add "Start Repair" button to work order detail page (visible to assigned technician only)
- [ ] T091 [US2] Create repair completion form in work order detail with status dropdown, notes textarea, photo upload
- [ ] T092 [US2] Implement status update handler calling PATCH /workorders/:id/repair
- [ ] T093 [US2] Show success/error feedback using wx.showToast after status update
- [ ] T094 [US2] Refresh work order lists after status change
- [ ] T095 [US2] Add notification badge to maintenance worker tab bar when new orders assigned

**Checkpoint**: At this point, User Stories 1 AND 2 work independently - complete work order lifecycle from creation to repair status updates

---

## Phase 5: User Story 3 - Work Order Review and Closure (Priority: P1)

**Goal**: Property staff review repaired work orders and approve (Completed) or reject (Needs Rework)

**Independent Test**: Property staff receives review notification → views repaired order → approves or rejects → work order updates accordingly

### Backend Implementation for US3

- [ ] T096 [US3] Add PATCH /workorders/:id/review endpoint in backend/src/controllers/workOrderController.js
- [ ] T097 [US3] Implement review status transition validation (Repaired → Completed or Needs Rework)
- [ ] T098 [US3] Update work order timestamps (reviewed_at, completed_at) based on review outcome
- [ ] T099 [US3] If marked "Needs Rework", reset status to "Pending Repair" and increment rework_count
- [ ] T100 [US3] Trigger notification to maintenance worker if rejected for rework
- [ ] T101 [US3] Create status history record for review action
- [ ] T102 [US3] Add audit logging for review actions
- [ ] T103 [US3] Add GET /workorders endpoint filter for "pending review" status

### Frontend Implementation for US3

- [ ] T104 [P] [US3] Create timeline component in miniprogram/components/timeline/ showing status history with timestamps and actors
- [ ] T105 [US3] Create review page in miniprogram/pages/property/review/ listing work orders pending review
- [ ] T106 [US3] Add review action buttons in work order detail (Approve/Reject) visible to property staff only
- [ ] T107 [US3] Create review feedback form with status dropdown (Completed/Needs Rework) and notes textarea
- [ ] T108 [US3] Implement review submission handler calling PATCH /workorders/:id/review
- [ ] T109 [US3] Display full timeline in work order detail page using timeline component
- [ ] T110 [US3] Show rework count badge if work order has been reworked multiple times (>1)
- [ ] T111 [US3] Add notification badge to property staff tab bar for pending reviews

**Checkpoint**: All P1 user stories (US1, US2, US3) now complete - full work order lifecycle from submission to closure functional

---

## Phase 6: User Story 4 - Real-Time Monitoring and Analytics Dashboard (Priority: P2)

**Goal**: Administrative managers view KPIs, filter work orders, visualize trends, export reports

**Independent Test**: Admin logs in → sees dashboard with all work orders → views analytics panel with KPIs → filters by category → exports Excel report

### Backend Implementation for US4

- [ ] T112 [P] [US4] Create analytics service in backend/src/services/analyticsService.js with KPI calculation methods
- [ ] T113 [P] [US4] Implement calculateAverageResponseTime() in analyticsService querying time between created_at and started_at
- [ ] T114 [P] [US4] Implement calculateAverageResolutionTime() querying time between created_at and completed_at
- [ ] T115 [P] [US4] Implement calculateFirstTimeFixRate() counting orders completed without rework
- [ ] T116 [P] [US4] Implement calculateOverdueRate() counting orders where is_overdue = true
- [ ] T117 [US4] Create analytics controller in backend/src/controllers/analyticsController.js
- [ ] T118 [US4] Add GET /analytics/overview endpoint returning all KPIs with optional date range filter
- [ ] T119 [US4] Add GET /analytics/trends endpoint returning time-series data (daily/weekly/monthly work order volume)
- [ ] T120 [US4] Add GET /analytics/by-category endpoint grouping work orders by fault_type_id
- [ ] T121 [US4] Add GET /analytics/by-priority endpoint grouping by priority
- [ ] T122 [US4] Add GET /analytics/technician-performance endpoint with per-technician metrics
- [ ] T123 [US4] Implement Redis caching for analytics endpoints with 5-minute TTL
- [ ] T124 [US4] Add POST /analytics/export endpoint generating Excel/PDF/CSV reports using exceljs or pdfkit
- [ ] T125 [US4] Create analytics routes in backend/src/routes/analytics.js

### Frontend Implementation for US4

- [ ] T126 [P] [US4] Install echarts-for-weixin in miniprogram/ for data visualization
- [ ] T127 [P] [US4] Create dashboard page in miniprogram/pages/admin-manager/dashboard/ with work order card grid
- [ ] T128 [P] [US4] Create analytics page in miniprogram/pages/admin-manager/analytics/ with chart canvases
- [ ] T129 [US4] Implement KPI cards in dashboard showing total active, avg response time, avg resolution time, overdue rate
- [ ] T130 [US4] Add filter controls in dashboard (status, priority, fault type, date range dropdowns)
- [ ] T131 [US4] Implement filter handler updating work order list when filter changes
- [ ] T132 [US4] Create bar chart in analytics page for work orders by category using ECharts
- [ ] T133 [US4] Create pie chart for work orders by priority
- [ ] T134 [US4] Create line chart for trend over time (daily volume)
- [ ] T135 [US4] Create technician performance table with sortable columns
- [ ] T136 [US4] Add export button triggering POST /analytics/export and downloading file
- [ ] T137 [US4] Implement auto-refresh for dashboard every 5 minutes using setInterval

**Checkpoint**: User Story 4 complete - administrative managers have full visibility and analytics capabilities

---

## Phase 7: User Story 5 - User and Permission Management (Priority: P2)

**Goal**: System administrators create users, assign roles, configure permissions, view audit logs

**Independent Test**: Admin creates new maintenance worker account → assigns role → configures permissions → new user logs in with correct access → admin views creation in audit log

### Backend Implementation for US5

- [ ] T138 [P] [US5] Create user controller in backend/src/controllers/userController.js
- [ ] T139 [US5] Add POST /users endpoint for creating new users (admin only, verified by RBAC middleware)
- [ ] T140 [US5] Implement WeChat OpenID validation in user creation
- [ ] T141 [US5] Add PATCH /users/:id endpoint for updating user details (name, role, supervisor, active status)
- [ ] T142 [US5] Add GET /users endpoint with filtering by role_id and active status
- [ ] T143 [US5] Add GET /users/:id endpoint for user detail view
- [ ] T144 [US5] Add GET /roles endpoint returning all roles with permissions
- [ ] T145 [US5] Add PATCH /roles/:id/permissions endpoint for updating role permissions (super admin only)
- [ ] T146 [US5] Add GET /audit-logs endpoint with filtering by user_id, action_type, date range
- [ ] T147 [US5] Implement pagination for audit logs (default 50 per page)
- [ ] T148 [US5] Create user routes in backend/src/routes/users.js
- [ ] T149 [US5] Add audit logging for user creation, updates, role changes
- [ ] T149a [P] [US5] Create duplicate detection service in backend/src/services/duplicateDetectionService.js using fuzzy matching algorithm (location + fault_type + 24h time window) to identify potential duplicate work orders (addresses FR-046)
- [ ] T149b [US5] Add GET /workorders/duplicates endpoint in backend/src/controllers/workOrderController.js returning potential duplicate groups with similarity scores

### Frontend Implementation for US5

- [ ] T150 [P] [US5] Create users list page in miniprogram/pages/admin/users/ with user cards
- [ ] T151 [P] [US5] Create roles config page in miniprogram/pages/admin/roles/ with permission checkboxes
- [ ] T152 [P] [US5] Create system config page in miniprogram/pages/admin/config/ for SLA rules and fault types
- [ ] T153 [US5] Create add user form in miniprogram/pages/admin/users/add/ with WeChat OpenID input, role selector, department input
- [ ] T154 [US5] Implement user creation handler calling POST /users
- [ ] T155 [US5] Create edit user page with role change, supervisor assignment, activate/deactivate toggle
- [ ] T156 [US5] Implement user update handler calling PATCH /users/:id
- [ ] T157 [US5] Create role permissions editor showing module checkboxes (Submit Orders, Review, Analytics, Manage Users, Config)
- [ ] T158 [US5] Implement permissions update handler calling PATCH /roles/:id/permissions
- [ ] T159 [US5] Create audit log viewer page with search filters and pagination
- [ ] T160 [US5] Display audit log entries in timeline format with color-coded action types
- [ ] T160a [P] [US5] Create duplicate work orders detection page in miniprogram/pages/admin/duplicates/ showing potential duplicate groups with similarity indicators
- [ ] T160b [US5] Implement merge functionality allowing admin to link duplicate work orders or mark as non-duplicates

**Checkpoint**: User Story 5 complete - full user and permission management capabilities operational

---

## Phase 8: User Story 6 - Automated Alerts and SLA Management (Priority: P3)

**Goal**: System monitors SLAs, sends warnings at 80% threshold, escalates overdue orders to supervisors

**Independent Test**: Create emergency work order → wait for SLA threshold → verify warning notification sent → wait for deadline → verify escalation to supervisor and overdue flag

### Backend Implementation for US6

- [ ] T161 [P] [US6] Create SLA service in backend/src/services/slaService.js with deadline calculation methods
- [ ] T162 [P] [US6] Implement calculateSLADeadline() using work order created_at + SLA rule target hours
- [ ] T163 [P] [US6] Create SLA monitor job in backend/src/jobs/slaMonitor.js running every minute
- [ ] T164 [US6] Implement SLA warning check: query work orders where (sla_deadline - NOW()) < (total_duration * 0.2)
- [ ] T165 [US6] Send warning notification to assigned technician and supervisor when warning threshold reached
- [ ] T166 [US6] Implement SLA violation check: query work orders where sla_deadline < NOW() AND status != 'Completed'
- [ ] T167 [US6] Update is_overdue = true for violated work orders
- [ ] T168 [US6] Send escalation notification to supervisor when work order becomes overdue
- [ ] T169 [US6] Add audit log entries for SLA warnings and escalations
- [ ] T170 [US6] Register SLA monitor job in backend/src/app.js using node-cron
- [ ] T171 [US6] Add SLA deadline display to GET /workorders response
- [ ] T172 [US6] Add overdue filter to GET /workorders endpoint

### Frontend Implementation for US6

- [ ] T173 [P] [US6] Add SLA timer display to work-order-card component showing time remaining/overdue
- [ ] T174 [P] [US6] Add visual indicator (red badge) for overdue work orders
- [ ] T175 [US6] Implement SLA deadline countdown timer in work order detail page
- [ ] T176 [US6] Show warning state when approaching deadline (yellow badge at 80% threshold)
- [ ] T177 [US6] Add overdue filter option to work order list pages
- [ ] T178 [US6] Display overdue count in admin dashboard KPI cards
- [ ] T179 [US6] Add SLA violation tracking to analytics trends chart

**Checkpoint**: All 6 user stories complete - full system functionality operational

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Security & Error Handling

- [ ] T180 [P] Implement rate limiting middleware in backend/src/middleware/rateLimit.js (100 requests per 15 min per IP)
- [ ] T181 [P] Add input sanitization to all form inputs preventing XSS attacks
- [ ] T182 [P] Implement SQL injection prevention via Sequelize parameterized queries (verify all raw queries)
- [ ] T183 [P] Add helmet middleware for security headers in backend/src/app.js
- [ ] T184 [P] Implement CORS configuration restricting origins to WeChat mini-program domain
- [ ] T185 [P] Add error boundary components in mini-program pages for graceful error handling
- [ ] T186 [P] Implement retry logic for failed WeChat API calls in notificationService with exponential backoff
- [ ] T187 [P] Add validation for photo file size (< 5MB) and MIME type (image/jpeg, image/png, image/webp)

### Performance Optimization

- [ ] T188 [P] Add database indexes per data-model.md (idx_workorders_status, idx_workorders_created, etc.)
- [ ] T189 [P] Implement pagination for GET /workorders endpoint (default 20 per page, max 100)
- [ ] T190 [P] Add Redis caching for frequently accessed data (fault types, SLA rules, roles)
- [ ] T191 [P] Optimize photo loading using WeChat image lazy loading (loading="lazy" attribute)
- [ ] T192 [P] Implement mini-program sub-package loading to reduce main package size under 2MB
- [ ] T193 [P] Add CDN caching headers for photo URLs (Cache-Control: max-age=86400)

### Logging & Monitoring

- [ ] T194 [P] Configure Winston logger with daily rotating file transport in backend/src/utils/logger.js
- [ ] T195 [P] Add request logging middleware using Morgan in backend/src/app.js
- [ ] T196 [P] Implement structured logging for all API requests (user_id, endpoint, duration, status_code)
- [ ] T197 [P] Add health check endpoint GET /health returning database and Redis connection status
- [ ] T198 [P] Create notification retry job in backend/src/jobs/notificationRetry.js processing failed notifications

### DevOps & CI/CD

- [ ] T199 [P] Create Dockerfile for backend in backend/Dockerfile with Node.js 18 base image
- [ ] T200 [P] Create docker-compose.yml for local development (backend, MySQL, Redis containers)
- [ ] T201 [P] Create GitHub Actions workflow in .github/workflows/backend-ci.yml for linting and testing
- [ ] T202 [P] Add npm audit check to CI pipeline failing on high/critical vulnerabilities
- [ ] T203 [P] Create deployment guide in docs/deployment/README.md with cloud deployment steps
- [ ] T204 [P] Create database backup script in database/scripts/backup.sh running daily
- [ ] T205 [P] Configure Cloud Object Storage (COS) lifecycle policy to automatically move photos older than 3 years to cold storage tier for cost optimization (addresses FR-049a capacity planning)

### Performance & Load Testing

- [ ] T206 [P] Perform load testing with 100 concurrent users using Artillery or k6 to validate FR-050 performance requirement
- [ ] T207 [P] Validate mini-program initial load time <2 seconds on 3G network using WeChat DevTools network throttling to verify FR-051
- [ ] T208 [P] Create audit log archival job in database/scripts/archive-logs.sh to archive audit_logs older than 2 years to separate archive table (addresses FR-038)

### Documentation & Validation

- [ ] T209 [P] Validate all tasks reference correct file paths from plan.md project structure
- [ ] T210 [P] Verify mini-program package size is under 2MB limit using WeChat DevTools
- [ ] T211 [P] Run quickstart.md validation: ensure setup instructions work from scratch
- [ ] T212 [P] Generate API documentation from contracts/*.yaml using Swagger UI
- [ ] T213 [P] Create README.md in repository root with project overview and quickstart link

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on US1 completion (needs work order creation to exist)
- **User Story 3 (Phase 5)**: Depends on US2 completion (needs repair status to review)
- **User Story 4 (Phase 6)**: Depends on US1, US2, US3 (needs work order data to analyze)
- **User Story 5 (Phase 7)**: Can start after Foundational (independent of work order user stories)
- **User Story 6 (Phase 8)**: Depends on US1, US2 (needs work orders and status changes to monitor SLAs)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

**Critical Path (MVP)**:
```
Setup → Foundational → US1 → US2 → US3
```

**Independent Path**:
```
Setup → Foundational → US5 (User Management - can develop in parallel)
```

**Dependent Paths**:
```
US1 + US2 + US3 → US4 (Analytics - needs work order data)
US1 + US2 → US6 (SLA Management - needs work orders to monitor)
```

### Within Each User Story

**General Pattern**:
1. Backend models (if new entities needed)
2. Backend services (business logic)
3. Backend controllers (request handlers)
4. Backend routes (API endpoints)
5. Frontend components (reusable UI)
6. Frontend pages (user interfaces)
7. Integration & validation

**Parallel Opportunities**:
- Backend and frontend can be developed in parallel once APIs are defined
- Multiple backend files marked [P] can be created simultaneously
- Multiple frontend components marked [P] can be developed simultaneously

### Parallel Example: User Story 1

```bash
# Backend tasks that can run in parallel (T057-T059):
T057 [P] [US1] assignmentService.js
T058 [P] [US1] notificationService.js
T059 [P] [US1] photoUpload.js

# After backend APIs exist, frontend components can be built in parallel (T068-T070):
T068 [P] [US1] work-order-card component
T069 [P] [US1] status-badge component
T070 [P] [US1] image-uploader component
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Minimal Viable Product Path**:
1. Complete Phase 1: Setup (T001-T015)
2. Complete Phase 2: Foundational (T016-T056)
3. Complete Phase 3: User Story 1 (T057-T079)
4. **STOP and VALIDATE**: Test US1 independently
5. Deploy MVP and gather feedback

**MVP Delivers**: Property staff can submit work orders that auto-assign to maintenance workers with notifications

### Incremental Delivery (Recommended)

**Iteration 1: Core Workflow (MVP+)**
- Setup + Foundational → US1 → US2 → US3
- **Result**: Complete work order lifecycle from submission to closure
- **Demo**: End-to-end workflow with property staff and maintenance workers

**Iteration 2: Management Capabilities**
- Add US5 (User Management) for onboarding real users
- Add US4 (Analytics Dashboard) for management oversight
- **Result**: Production-ready system with admin controls

**Iteration 3: Quality Enhancements**
- Add US6 (SLA Management) for automatic escalations
- Complete Phase 9 (Polish) for performance and security
- **Result**: Fully-featured enterprise system

### Parallel Team Strategy

**With 3 Developers**:

**Week 1-2** (Foundation):
- All developers: Setup + Foundational together

**Week 3-4** (Core Features):
- Developer A: User Story 1 (Work Order Submission)
- Developer B: User Story 2 (Repair Execution)
- Developer C: User Story 5 (User Management - independent path)

**Week 5-6** (Integration & Polish):
- Developer A: User Story 3 (Review & Closure)
- Developer B: User Story 4 (Analytics Dashboard)
- Developer C: User Story 6 (SLA Management)

**Week 7** (Final Polish):
- All developers: Phase 9 tasks, testing, documentation

---

## Task Statistics

**Total Tasks**: 217

**By Phase**:
- Phase 1 (Setup): 15 tasks
- Phase 2 (Foundational): 41 tasks
- Phase 3 (US1): 23 tasks
- Phase 4 (US2): 16 tasks
- Phase 5 (US3): 16 tasks
- Phase 6 (US4): 26 tasks
- Phase 7 (US5): 27 tasks (+4 for duplicate detection)
- Phase 8 (US6): 19 tasks
- Phase 9 (Polish): 34 tasks (+3 for performance testing)

**By User Story**:
- US1 (Work Order Submission): 23 tasks
- US2 (Repair Execution): 16 tasks
- US3 (Review & Closure): 16 tasks
- US4 (Analytics Dashboard): 26 tasks
- US5 (User Management): 27 tasks (+4 for duplicate detection)
- US6 (SLA Management): 19 tasks

**Parallel Opportunities**: 82 tasks marked [P] can run in parallel (+3)

**MVP Scope** (Phases 1-3): 79 tasks

**Full System** (All phases): 217 tasks

---

## Notes

- All tasks follow strict checklist format: `- [ ] [ID] [P?] [Story?] Description with file path`
- [P] tasks operate on different files with no dependencies
- Each user story is independently testable per specification requirements
- File paths match project structure defined in plan.md
- Tasks ordered by execution dependency within each phase
- No test tasks included (not requested in specification)
- Commit suggested after completing each logical group or phase
- Stop at any user story checkpoint to validate independent functionality
