# Implementation Plan: 工单报修管理系统 (Work Order Repair Management System)

**Branch**: `001-work-order-system` | **Date**: 2025-11-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-work-order-system/spec.md`

## Summary

Building a WeChat mini-program for internal work order management covering the complete maintenance workflow: property staff submit work orders with photos → system auto-assigns to maintenance workers via round-robin → workers execute repairs and update status → property staff review and approve/reject → complete audit trail with SLA monitoring and analytics dashboard for managers.

**Technical Approach**: WeChat Mini-Program frontend (WXML/WXSS/JavaScript) + Node.js REST API backend + MySQL database + Redis caching + scheduled jobs for SLA monitoring + WeChat template messages for notifications.

## Technical Context

**Language/Version**: JavaScript ES2020+ (Node.js 18 LTS for backend, WeChat Mini-Program SDK for frontend)
**Primary Dependencies**:
- Backend: Express 4.x, Sequelize ORM, JWT authentication, node-cron, axios
- Frontend: WeChat Mini-Program Native SDK, WeUI components
- Visualization: ECharts for WeChat Mini-Program

**Storage**: MySQL 8.0 for relational data (users, work orders, audit logs), Cloud Object Storage (COS) for photos, Redis for caching and session management
**Testing**: Jest for backend unit/integration tests, WeChat DevTools for mini-program testing
**Target Platform**: WeChat Mini-Program (mobile), Backend APIs deployed on Node.js server (Linux)
**Project Type**: Mobile + API (WeChat mini-program + REST backend)
**Performance Goals**:
- API response time < 200ms (p95)
- Mini-program initial load < 2 seconds on 3G
- Support 100+ concurrent users
- Photo upload/display < 3 seconds

**Constraints**:
- WeChat mini-program main package < 2MB
- Photo file size < 5MB per image
- Notification delivery within 10 seconds
- 99.5% uptime target

**Scale/Scope**:
- ~50-100 active users (property + maintenance staff)
- ~500-1000 work orders per month
- Indefinite photo retention (design for growth)
  - **Capacity projection**: ~100-120 GB/year (assuming 750 orders/month avg, 5 photos/order, 2MB avg/photo)
  - **Storage strategy**: Cloud Object Storage (COS) for cost-effective scaling, lifecycle policy moves photos >3 years to cold storage tier
  - **Growth planning**: System designed to handle 10x growth (1TB+ storage) without architectural changes
- 2-year audit log retention minimum

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: User Experience First (简洁易用优先)
- ✅ **PASS**: WeChat native components ensure familiar UX
- ✅ **PASS**: Work order creation limited to 3 steps (select floor → describe issue → upload photos)
- ✅ **PASS**: Card-based UI for visual scanning
- ✅ **PASS**: Loading states with WeUI loading indicators (< 300ms feedback)
- **Validation**: UAT required with actual property staff before launch

### Principle II: Role-Based Access Control (角色权限控制)
- ✅ **PASS**: JWT + RBAC middleware on all API endpoints
- ✅ **PASS**: 5 distinct roles with permission matrices
- ✅ **PASS**: Admin-only user creation (no self-registration)
- ✅ **PASS**: Module-level permissions configurable per role
- ✅ **PASS**: Session timeout + concurrent login policies enforced

### Principle III: Workflow Traceability (流程可追溯)
- ✅ **PASS**: Status History entity tracks all state transitions
- ✅ **PASS**: SLA timers auto-start on work order creation
- ✅ **PASS**: node-cron job monitors SLA violations and escalates
- ✅ **PASS**: Dashboard shows real-time work order visibility
- ✅ **PASS**: Historical data retained indefinitely (work orders) + 2 years (audit logs)
- ✅ **PASS**: Export functionality (Excel/PDF/CSV) via backend libraries

### Principle IV: Real-Time Notifications (状态通知)
- ✅ **PASS**: WeChat template messages triggered on every status change
- ✅ **PASS**: Notification service with exponential backoff retry (max 3 attempts)
- ✅ **PASS**: Push notifications for emergency orders and SLA violations
- ✅ **PASS**: Delivery status tracked in Notification entity

### Principle V: Audit Logging (操作日志)
- ✅ **PASS**: Audit Log entity captures all critical operations
- ✅ **PASS**: Append-only table with timestamp, user, IP, action, before/after state
- ✅ **PASS**: 2-year retention policy enforced via automated archival
- ✅ **PASS**: Searchable interface for administrators

### Principle VI: Data-Driven Quality (数据驱动质量)
- ✅ **PASS**: KPIs calculated: response time, resolution time, first-time fix rate, overdue rate
- ✅ **PASS**: Real-time dashboard updates (< 5 minute lag via caching)
- ✅ **PASS**: Export reports in multiple formats
- ✅ **PASS**: Filtering by time period, department, technician, category
- ✅ **PASS**: Automated weekly/monthly report generation via cron jobs

### Principle VII: Platform Compliance (平台规范)
- ✅ **PASS**: WeChat Mini-Program SDK used exclusively for frontend
- ✅ **PASS**: wx.login() + OpenID for authentication
- ✅ **PASS**: Main package size budget monitored (< 2MB)
- ✅ **PASS**: HTTPS backend APIs with valid SSL certificates
- ✅ **PASS**: WeChat privacy policy compliance (data collection consent)

### Principle VIII: Security & Reliability (安全可靠)
- ✅ **PASS**: Input validation on all API endpoints (prevent injection attacks)
- ✅ **PASS**: Sensitive data encrypted (bcrypt for passwords if stored, HTTPS for transit)
- ✅ **PASS**: Daily automated database backups with tested restore procedure
- ✅ **PASS**: Error handling prevents stack trace leakage
- ✅ **PASS**: Dependency vulnerability scanning (npm audit)
- ✅ **PASS**: Graceful degradation under load (rate limiting + circuit breakers)

**GATE RESULT**: ✅ ALL GATES PASSED - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/001-work-order-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API specs)
│   ├── auth.yaml
│   ├── workorders.yaml
│   ├── users.yaml
│   ├── notifications.yaml
│   └── analytics.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
miniprogram/               # WeChat Mini-Program frontend
├── pages/
│   ├── index/             # Landing/role-based home
│   ├── property/          # Property staff pages
│   │   ├── submit/        # Create work order
│   │   ├── submitted/     # View submitted orders
│   │   └── review/        # Review completed repairs
│   ├── maintenance/       # Maintenance worker pages
│   │   ├── pending/       # Pending repairs list
│   │   ├── inprogress/    # Active work orders
│   │   └── history/       # Completed/rework history
│   ├── admin-manager/     # Administrative manager pages
│   │   ├── dashboard/     # Overview + KPIs
│   │   └── analytics/     # Data visualization
│   └── admin/             # System administrator pages
│       ├── users/         # User management
│       ├── roles/         # Role/permission config
│       └── config/        # System settings
├── components/
│   ├── work-order-card/   # Reusable work order card
│   ├── status-badge/      # Status indicator
│   ├── timeline/          # Status history timeline
│   └── image-uploader/    # Photo upload component
├── services/
│   ├── api.js             # HTTP client wrapper
│   ├── auth.js            # Authentication service
│   └── storage.js         # Local storage wrapper
├── utils/
│   ├── constants.js       # Enums (statuses, priorities)
│   └── formatter.js       # Date/time formatting
└── app.js                 # Mini-program entry point

backend/
├── src/
│   ├── models/            # Sequelize ORM models
│   │   ├── User.js
│   │   ├── WorkOrder.js
│   │   ├── StatusHistory.js
│   │   ├── FaultType.js
│   │   ├── SLARule.js
│   │   ├── Notification.js
│   │   ├── AuditLog.js
│   │   └── Role.js
│   ├── controllers/       # Request handlers
│   │   ├── authController.js
│   │   ├── workOrderController.js
│   │   ├── userController.js
│   │   ├── notificationController.js
│   │   └── analyticsController.js
│   ├── services/          # Business logic
│   │   ├── assignmentService.js     # Round-robin assignment
│   │   ├── notificationService.js   # WeChat notifications
│   │   ├── slaService.js            # SLA monitoring
│   │   └── analyticsService.js      # KPI calculations
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification
│   │   ├── rbac.js                  # Permission checks
│   │   ├── validation.js            # Input validation
│   │   └── errorHandler.js          # Global error handling
│   ├── routes/
│   │   ├── auth.js
│   │   ├── workOrders.js
│   │   ├── users.js
│   │   ├── notifications.js
│   │   └── analytics.js
│   ├── jobs/              # Scheduled tasks
│   │   ├── slaMonitor.js            # Check overdue orders
│   │   ├── reportGenerator.js       # Weekly/monthly reports
│   │   └── notificationRetry.js     # Retry failed notifications
│   ├── utils/
│   │   ├── logger.js                # Logging utility
│   │   ├── photoUpload.js           # COS integration
│   │   └── constants.js             # Shared constants
│   ├── config/
│   │   ├── database.js              # Sequelize config
│   │   ├── wechat.js                # WeChat API keys
│   │   └── app.js                   # App configuration
│   └── app.js             # Express app entry point
└── tests/
    ├── unit/              # Unit tests (services, utils)
    ├── integration/       # API integration tests
    └── fixtures/          # Test data

database/
├── migrations/            # Database schema migrations
├── seeders/               # Initial data (roles, fault types)
└── scripts/               # DB maintenance scripts

docs/
├── api/                   # API documentation (generated from contracts/)
└── deployment/            # Deployment guides

.github/
└── workflows/             # CI/CD pipelines
```

**Structure Decision**: Selected "Option 3: Mobile + API" structure because this is a WeChat mini-program (mobile frontend) with a separate Node.js backend API. The `miniprogram/` directory contains the WeChat mini-program code following WeChat's standard structure, while `backend/` contains the Express.js REST API with MVC architecture (models, controllers, services, routes). This separation enables independent scaling and deployment of frontend/backend.

## Complexity Tracking

> No constitutional violations - all gates passed. This section is empty.

