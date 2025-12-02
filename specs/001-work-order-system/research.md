# Technical Research: 工单报修管理系统

**Date**: 2025-11-12
**Feature**: Work Order Repair Management System
**Purpose**: Resolve technical unknowns and establish implementation patterns

## Research Overview

This document captures technical research decisions for building a WeChat mini-program work order management system with Node.js backend. All "NEEDS CLARIFICATION" items from Technical Context have been resolved through research and best practices analysis.

---

## R1: WeChat Mini-Program Framework Selection

**Question**: Should we use WeChat native framework, Taro, or Uni-App for the mini-program frontend?

**Decision**: **WeChat Native Mini-Program Framework**

**Rationale**:
1. **Performance**: Native framework provides best performance for WeChat platform (no transpilation overhead)
2. **Feature Parity**: Direct access to latest WeChat APIs without waiting for framework updates
3. **Team Learning Curve**: Simpler mental model - direct mapping to WeChat documentation
4. **Bundle Size**: No framework overhead helps stay under 2MB main package limit
5. **Debugging**: WeChat DevTools integration is optimized for native code

**Alternatives Considered**:
- **Taro**: Cross-platform capability not needed (WeChat-only requirement), adds bundle size
- **Uni-App**: Similar cross-platform overhead, team unfamiliar with Vue-based syntax

**Implementation Notes**:
- Use WXML for templates, WXSS for styles, JavaScript ES6+ for logic
- Leverage WeUI component library for consistent WeChat-native UX
- Adopt Component-based architecture (pages + reusable components)

---

## R2: Backend Framework & Language

**Question**: Node.js (Express/Koa) vs Java Spring Boot for REST API backend?

**Decision**: **Node.js 18 LTS with Express 4.x**

**Rationale**:
1. **Ecosystem Fit**: npm ecosystem has excellent WeChat SDK support (@weapp/wxlogin)
2. **JSON Handling**: Native JSON manipulation ideal for REST APIs serving JSON to mini-program
3. **Async I/O**: Event-driven architecture matches notification/webhook patterns
4. **Team Velocity**: JavaScript full-stack reduces context switching (same language as mini-program)
5. **Deployment**: Lightweight footprint suitable for cloud deployment (Docker, serverless options)

**Alternatives Considered**:
- **Java Spring Boot**: More verbose, heavier resource footprint, slower iteration cycle
- **Koa**: Lighter than Express but smaller ecosystem, fewer tutorials for specific patterns needed

**Implementation Notes**:
- Express 4.x for stability and maturity
- Sequelize ORM for database abstraction
- JWT for stateless authentication (fits micro-service evolution if needed)
- Helmet.js for security headers
- Morgan for HTTP request logging

---

## R3: Database Selection

**Question**: Which relational database for storing work orders, users, audit logs?

**Decision**: **MySQL 8.0**

**Rationale**:
1. **Relational Fit**: Work order workflow involves clear entity relationships (users → work orders → status history)
2. **ACID Compliance**: Critical for audit logs and status transitions (no lost state changes)
3. **Mature Ecosystem**: Sequelize ORM has excellent MySQL support
4. **Query Performance**: Indexed queries on work order filters (status, priority, date range) perform well
5. **Cost**: Open-source, widely available in cloud providers (AWS RDS, Alibaba Cloud RDS)

**Alternatives Considered**:
- **PostgreSQL**: Similar capabilities but MySQL more commonly available in Chinese cloud providers
- **MongoDB**: Document model doesn't fit structured relational data (work orders have fixed schema)
- **WeChat Cloud Database**: Vendor lock-in, limited query capabilities for complex analytics

**Implementation Notes**:
- Use Sequelize migrations for schema versioning
- Indexes on: work_orders(status, created_at), work_orders(assigned_technician_id), audit_logs(created_at)
- Partitioning strategy for audit_logs table (by year) to manage growth

---

## R4: Photo Storage Strategy

**Question**: Store photos in database BLOBs, local file system, or cloud object storage?

**Decision**: **Cloud Object Storage (Tencent COS / Alibaba Cloud OSS)**

**Rationale**:
1. **Scalability**: Indefinite retention requirement needs unbounded storage
2. **Performance**: CDN-backed URLs for fast photo loading in mini-program
3. **Cost**: Object storage cheaper than database storage for large binary files
4. **Backup**: Cloud provider handles redundancy and disaster recovery
5. **WeChat Integration**: Direct upload from mini-program to COS (wx.uploadFile → pre-signed URL)

**Alternatives Considered**:
- **Database BLOBs**: Poor performance at scale, bloats database backups
- **Local File System**: No redundancy, hard to scale horizontally

**Implementation Notes**:
- Store photo URLs in database (work_orders.photos_json column as JSON array)
- Pre-signed URLs for upload (backend generates temp credentials)
- Lifecycle policy: photos never expire (indefinite retention per spec)
- CDN caching for frequently accessed photos (recent work orders)

---

## R5: Caching Strategy

**Question**: Do we need caching layer? If so, what technology?

**Decision**: **Redis for session storage and dashboard metrics caching**

**Rationale**:
1. **Session Management**: JWT tokens stored in Redis for revocation capability (logout, concurrent login limits)
2. **Dashboard Performance**: Cache computed KPIs for 5 minutes (meets < 5 minute lag requirement)
3. **SLA Checks**: Cache maintenance worker round-robin pointer (atomic increment)
4. **Notification Queue**: Temporary queue for retry logic (failed notifications)

**Implementation Notes**:
- Use `ioredis` client library
- TTL for dashboard metrics: 5 minutes
- TTL for JWT sessions: match token expiration (24 hours default)
- Key patterns:
  - `session:{userId}` → JWT session data
  - `dashboard:kpis` → cached analytics
  - `assignment:round-robin` → next technician index
  - `notification:retry:{notificationId}` → retry count

---

## R6: Real-Time Notification Implementation

**Question**: How to implement WeChat template messages and push notifications?

**Decision**: **WeChat Official Account API + Template Messages**

**Rationale**:
1. **Native Integration**: WeChat provides official template message API (one-time subscribe)
2. **Delivery Tracking**: API returns message delivery status for audit logging
3. **Cost**: Free within reasonable limits (suitable for internal system scale)

**Implementation Notes**:
- Use `@weapp/api` npm package for WeChat API calls
- Template message flow:
  1. User subscribes to notifications on first mini-program use (wx.requestSubscribeMessage)
  2. Backend sends template message via POST to WeChat API on status change
  3. Retry failed sends with exponential backoff (10s, 30s, 90s intervals)
  4. Log delivery status in Notification entity
- Separate handling for push vs in-app notifications:
  - **Push**: Emergency work orders, SLA violations (wx.requestSubscribeMessage required)
  - **In-app**: All other status changes (template messages)

---

## R7: SLA Monitoring & Escalation

**Question**: How to implement automatic SLA monitoring and escalation?

**Decision**: **node-cron scheduled jobs + database polling**

**Rationale**:
1. **Simplicity**: Cron jobs avoid complexity of dedicated message queue for MVP
2. **Reliability**: node-cron runs in-process, no external dependencies
3. **Accuracy**: 1-minute cron interval sufficient for SLA precision (Emergency: 2h, High: 4h, Normal: 24h, Low: 72h)

**Implementation Notes**:
- Cron schedule: `*/1 * * * *` (every minute)
- Job logic:
  1. Query work_orders where `status IN ('Pending Repair', 'In Progress')` AND `sla_deadline < NOW()`
  2. Mark as overdue: `is_overdue = true`
  3. Send escalation notification to assigned technician's supervisor
  4. Log escalation event in audit_logs
- Separate cron for warnings at 80% SLA threshold:
  - Query: `sla_deadline < NOW() + (sla_deadline - created_at) * 0.2`
  - Send warning notification (not escalation)

**Alternatives Considered**:
- **Message Queue (RabbitMQ, Redis Pub/Sub)**: Overkill for ~1000 work orders/month, adds operational complexity
- **Database Triggers**: Not portable across databases, harder to test

---

## R8: Round-Robin Assignment Algorithm

**Question**: How to implement fair round-robin assignment for maintenance workers?

**Decision**: **Redis-backed atomic counter with active worker pool**

**Rationale**:
1. **Atomicity**: Redis INCR operation ensures no race conditions in concurrent work order creation
2. **Fairness**: Modulo operation distributes evenly across active workers
3. **Flexibility**: Easy to exclude workers on leave (update active pool list)

**Implementation Details**:
```javascript
// assignmentService.js
async function getNextTechnician() {
  // Get list of active maintenance workers (role = 'Maintenance Worker', active = true)
  const activeWorkers = await User.findAll({
    where: { role: 'Maintenance Worker', active: true },
    order: [['id', 'ASC']] // Consistent ordering
  });

  if (activeWorkers.length === 0) throw new Error('No active technicians');

  // Atomic increment in Redis
  const counter = await redis.incr('assignment:round-robin');
  const index = (counter - 1) % activeWorkers.length;

  return activeWorkers[index];
}
```

**Edge Cases Handled**:
- Worker deactivated mid-rotation: next assignment recalculates active pool
- New worker added: automatically included in next round
- All workers at max concurrent limit (5): assign anyway but log warning

---

## R9: Data Visualization Library

**Question**: Which charting library for admin dashboard analytics?

**Decision**: **ECharts for WeChat Mini-Program**

**Rationale**:
1. **Official Support**: Apache ECharts has official WeChat mini-program version (echarts-for-weixin)
2. **Feature-Rich**: Supports all required chart types (line, bar, pie, trend analysis)
3. **Performance**: Canvas-based rendering handles large datasets
4. **Chinese Documentation**: Well-documented in Chinese for team reference

**Implementation Notes**:
- Install: `echarts-for-weixin` component
- Chart types needed:
  - **Bar Chart**: Work orders by category, by priority
  - **Line Chart**: Trend over time (daily/weekly/monthly work order volume)
  - **Pie Chart**: Status distribution, technician workload distribution
  - **Gauge**: KPIs (first-time fix rate, overdue percentage)
- Data fetched from `/api/analytics/*` endpoints (backend computes, frontend renders)

---

## R10: Testing Strategy

**Question**: What testing approach for mini-program frontend and Node.js backend?

**Decision**: **Jest for backend unit/integration, WeChat DevTools for frontend**

**Rationale**:
1. **Jest**: Industry standard for Node.js, excellent Sequelize/Express integration
2. **WeChat DevTools**: Built-in simulator for mini-program UI testing, no setup needed

**Testing Priorities** (from spec Success Criteria):
1. **Backend Unit Tests**:
   - Assignment service (round-robin logic)
   - Notification service (retry logic, exponential backoff)
   - SLA service (deadline calculations, escalation triggers)
   - Analytics service (KPI calculations: response time, resolution time, first-time fix rate)

2. **Backend Integration Tests**:
   - Work order creation flow (POST /api/workorders → auto-assign → notification sent)
   - Status transition flow (PATCH /api/workorders/:id/repair → notification → audit log)
   - Authentication flow (POST /api/login → JWT issued → protected route access)

3. **Frontend Manual Testing** (WeChat DevTools):
   - Each user story's acceptance scenarios
   - Photo upload (wx.chooseImage → backend upload → COS storage)
   - Role-based view rendering (different home screens per role)
   - Offline caching (view work orders with no network)

**Test Coverage Goals**:
- Backend services: 70%+ line coverage
- Critical paths (auth, work order lifecycle): 90%+ coverage
- No coverage requirement for mini-program (manual UAT with real users per constitution)

---

## R11: Security Best Practices

**Question**: How to implement security requirements from constitution (Principle VIII)?

**Decision**: **Layered Security Approach**

**Implementation Checklist**:

1. **Input Validation** (prevent injection attacks):
   - Use `express-validator` for request validation
   - Sanitize all user inputs (work order descriptions, review notes)
   - File upload validation: MIME type check, file size limit (< 5MB)

2. **Authentication & Authorization**:
   - JWT with HS256 signing (secret in environment variable)
   - RBAC middleware checks permissions before controller execution
   - Session timeout: 24 hours (configurable)
   - Concurrent login limit: 3 devices per user (tracked in Redis)

3. **Data Encryption**:
   - HTTPS enforced for all API endpoints (TLS 1.2+)
   - Passwords hashed with bcrypt (if storing admin passwords)
   - Environment variables for secrets (never commit to Git)

4. **Error Handling**:
   - Global error handler catches all exceptions
   - Production mode: generic error messages ("Internal server error")
   - Development mode: detailed stack traces for debugging
   - All errors logged with request context (user ID, IP, endpoint)

5. **Rate Limiting**:
   - `express-rate-limit` middleware: 100 requests per 15 minutes per IP
   - Stricter limit on auth endpoints: 5 login attempts per 15 minutes
   - Circuit breaker pattern for external WeChat API calls

6. **Dependency Security**:
   - Run `npm audit` in CI/CD pipeline (fail build on high/critical vulnerabilities)
   - Automated Dependabot pull requests for security patches
   - Lock file committed (`package-lock.json`) for reproducible builds

---

## R12: Deployment & Operations

**Question**: What deployment strategy ensures 99.5% uptime target?

**Decision**: **Docker + Cloud Deployment with Health Checks**

**Rationale**:
1. **Containerization**: Consistent environment (dev/staging/prod)
2. **Health Monitoring**: Load balancer health checks detect failures, restart containers
3. **Zero-Downtime Deploys**: Rolling updates with health check validation before traffic shift

**Deployment Architecture**:
```
[WeChat Mini-Program] → [Alibaba Cloud SLB]
                              ↓
                     [2x Node.js Containers]
                              ↓
                     [RDS MySQL (Multi-AZ)]
                     [Redis (Sentinel)]
                     [OSS (Object Storage)]
```

**Operational Requirements**:
1. **Monitoring**:
   - Application logs: Winston → Cloud Log Service
   - Metrics: Custom metrics (work order creation rate, API latency) → Cloud Monitor
   - Alerts: PagerDuty/email for critical errors, API downtime

2. **Backups**:
   - MySQL: Automated daily backups (retain 30 days)
   - Redis: RDB snapshots every 6 hours
   - OSS: Object versioning enabled (photos never deleted, only marked inactive)

3. **Disaster Recovery**:
   - RTO (Recovery Time Objective): 1 hour
   - RPO (Recovery Point Objective): 24 hours
   - Runbook for common failures (database crash, API server crash, Redis failure)

---

## Research Summary

All technical unknowns resolved. Technology choices prioritize:
1. **Simplicity**: Native WeChat framework, proven Node.js/Express stack
2. **Performance**: Redis caching, COS for photos, indexed MySQL queries
3. **Reliability**: ACID transactions, retry logic, health monitoring
4. **Security**: JWT auth, RBAC, input validation, encryption
5. **Maintainability**: Sequelize ORM, structured logging, automated testing

**Next Steps**: Proceed to Phase 1 (data model, API contracts, quickstart guide)
