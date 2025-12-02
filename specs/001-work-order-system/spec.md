# Feature Specification: 工单报修管理系统 (Work Order Repair Management System)

**Feature Branch**: `001-work-order-system`
**Created**: 2025-11-12
**Status**: Draft
**Input**: User description: "建立一款公司内部使用的工单报修管理微信小程序"

## Overview

This system addresses critical gaps in the current maintenance workflow: incomplete process loops, difficult data traceability, low response efficiency, and unmeasurable repair quality. The solution provides end-to-end digital management from inspection discovery → work order submission → repair processing → review and closure.

**Target Platform**: WeChat Mini-Program for internal company use

**Primary Users**: Property staff, maintenance workers, administrative managers, system administrators

## Clarifications

### Session 2025-11-12

- Q: When a property staff member creates a new work order, how should the system determine which maintenance worker gets assigned? → A: Round-robin automatic - System automatically assigns to the next available maintenance worker in rotation order
- Q: Work order photos accumulate over time. What is the retention policy for uploaded images after a work order is completed? → A: Retain indefinitely - All photos stored permanently for full historical record
- Q: When the system needs to send escalation notifications for overdue work orders or issues requiring rework, who should receive these supervisor notifications? → A: Designated department supervisors - Each maintenance worker has an assigned supervisor (stored in user profile) who receives their escalations
- Q: The system needs to track building and floor locations for work orders. How should this organizational hierarchy be structured? → A: Single building assumed - Only floor selection needed (system serves a single building, building field auto-populated or hidden)
- Q: Can a maintenance worker have multiple work orders in "In Progress" status simultaneously, or should they complete one before starting another? → A: Multiple allowed (up to 5 concurrent) - Technician can have up to 5 work orders "In Progress" simultaneously, system warns when limit approached

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Work Order Submission and Assignment (Priority: P1)

Property staff discover facility or equipment issues during routine inspections and need to quickly report them to maintenance workers for resolution.

**Why this priority**: This is the core value proposition - enabling issue reporting and getting repair work started. Without this, no other workflows can function.

**Independent Test**: Property staff can create a work order with issue photos and details, which automatically notifies an assigned maintenance worker. The work order appears in both users' dashboards with correct status.

**Acceptance Scenarios**:

1. **Given** property staff discover a broken light during inspection, **When** they open the mini-program and create a new work order with floor (Floor 3), location (Room 301), fault type (Electrical - Lighting), priority (Normal), and upload 2 photos, **Then** the work order is created with a unique ID, initial status is "Pending Repair", and the assigned maintenance worker receives a WeChat notification within 10 seconds

2. **Given** a work order has been created, **When** the property staff views their "Submitted Orders" list, **Then** they see the work order card displaying: order number, floor, location, fault type, submission time, current status (Pending Repair), priority level, and thumbnail images

3. **Given** a maintenance worker receives a work order notification, **When** they open the mini-program, **Then** the work order appears in their "Pending Repair" list with all details visible

4. **Given** property staff are creating a work order, **When** they select priority level, **Then** they can choose from: Low, Normal, High, or Emergency

5. **Given** an emergency work order is created, **When** the system processes it, **Then** the assigned maintenance worker receives a push notification (not just in-app) and the work order is flagged with visual indicators

---

### User Story 2 - Repair Execution and Status Updates (Priority: P1)

Maintenance workers receive work order notifications, travel to the site, complete repairs, and update the work order status to reflect completion or need for rework.

**Why this priority**: Equally critical as P1 - completes the first half of the workflow loop. Without repair execution tracking, work orders would remain unresolved.

**Independent Test**: Maintenance worker can view assigned work orders, mark one as "In Progress", complete the repair, and update status to "Repaired" or "Needs Rework". Property staff receive automatic notifications of status changes.

**Acceptance Scenarios**:

1. **Given** a maintenance worker has pending work orders, **When** they arrive on site and begin work, **Then** they can update the work order status to "In Progress" and the property staff submitter receives a notification

2. **Given** a maintenance worker has completed a repair, **When** they update the work order status to "Repaired" and optionally add completion notes or photos, **Then** the status changes, timestamp is recorded, and the property staff submitter receives a notification to review

3. **Given** a maintenance worker encounters an issue requiring rework (missing parts, incorrect diagnosis, etc.), **When** they update the status to "Needs Rework" with a reason, **Then** the work order returns to "Pending Repair" queue and notifications are sent to relevant supervisors

4. **Given** a work order is marked "Repaired", **When** the property staff views it, **Then** they see it in their "Pending Review" list with repair completion details

---

### User Story 3 - Work Order Review and Closure (Priority: P1)

Property staff receive notifications when repairs are completed, travel to the site to verify the repair quality, and either approve the closure or request rework.

**Why this priority**: Completes the workflow loop and ensures quality control. This is the final gate before work order closure and is essential for accountability.

**Independent Test**: Property staff can review a "Repaired" work order, visit the site, and either mark it "Completed" (closing the loop) or "Needs Rework" (sending it back to maintenance). All state changes are logged and notifications sent.

**Acceptance Scenarios**:

1. **Given** property staff receive a review notification, **When** they visit the site and verify the repair is satisfactory, **Then** they can mark the work order as "Completed", add optional approval notes, and the work order is closed with final timestamp recorded

2. **Given** property staff find the repair unsatisfactory during review, **When** they mark the work order as "Needs Rework" with specific reasons, **Then** the status changes back to "Pending Repair", the maintenance worker receives a re-assignment notification, and the work order re-enters their active queue

3. **Given** a work order is marked "Needs Rework" after review, **When** the maintenance worker views it, **Then** it appears in their "Needs Rework" list with review feedback visible

4. **Given** a work order moves through multiple rework cycles, **When** any user views the work order details, **Then** they see a complete timeline showing all status transitions with timestamps and actors

---

### User Story 4 - Real-Time Monitoring and Analytics Dashboard (Priority: P2)

Administrative managers need to monitor all work orders in real-time, track key performance indicators, identify bottlenecks, and make data-driven decisions to improve service quality.

**Why this priority**: Important for management oversight and continuous improvement, but the core workflow (P1 stories) can function without this. Adds strategic value but not operational necessity.

**Independent Test**: Administrative manager can log in, view a dashboard showing all active work orders (card view), filter by status/priority/date, and view analytics panels showing KPIs like average response time, resolution time, overdue rate, and technician performance.

**Acceptance Scenarios**:

1. **Given** an administrative manager logs in, **When** they access the dashboard, **Then** they see all work orders displayed as cards (similar to property staff view but unrestricted by submitter), with real-time status updates (max 5 minute lag)

2. **Given** the manager is viewing the dashboard, **When** they access the analytics panel, **Then** they see visualizations including: total active orders, average response time, average resolution time, first-time fix rate, overdue percentage, work orders by category, work orders by priority, and technician performance metrics

3. **Given** the manager wants to investigate a specific category, **When** they filter by fault type (e.g., "Electrical - Lighting"), **Then** the dashboard shows only matching work orders and analytics recalculate for that subset

4. **Given** the manager needs historical trends, **When** they select a date range (last 7 days, 30 days, 3 months), **Then** trend charts display showing work order volume over time, resolution time trends, and quality metrics

5. **Given** the manager identifies a bottleneck, **When** they export the data, **Then** they can download reports in Excel, PDF, or CSV formats for further analysis

---

### User Story 5 - User and Permission Management (Priority: P2)

System administrators need to create user accounts, assign roles (Property Staff, Maintenance Worker, Administrative Manager), configure module access permissions, and manage system settings.

**Why this priority**: Essential for system security and proper access control, but can be configured once during initial setup. Not needed for daily operations after initial configuration.

**Independent Test**: System administrator can create a new maintenance worker account, assign appropriate role, configure which modules they can access, and verify the user can log in with correct permissions.

**Acceptance Scenarios**:

1. **Given** a system administrator needs to onboard a new employee, **When** they create a new user account with role "Maintenance Worker", **Then** the account is created (no self-registration allowed), credentials are generated, and the user can log in to see only maintenance-related views

2. **Given** an administrator is managing roles, **When** they configure module access for the "Property Staff" role, **Then** they can enable/disable access to modules like: Submit Work Orders, Review Orders, View Analytics, Manage Users

3. **Given** an administrator needs to change a user's role, **When** they update a user from "Maintenance Worker" to "Administrative Manager", **Then** the user's dashboard and available features update immediately upon next login

4. **Given** security requirements, **When** the administrator configures session settings, **Then** they can set session timeout duration and concurrent login policies

5. **Given** an administrator views the audit log, **When** they search for specific events (user login, permission changes, role modifications), **Then** they see complete logs with timestamp, user ID, IP address, and action details

---

### User Story 6 - Automated Alerts and SLA Management (Priority: P3)

The system automatically monitors work order SLAs (Service Level Agreements), sends escalation alerts when deadlines are at risk, and notifies supervisors of overdue work orders.

**Why this priority**: Improves service quality and accountability but the system can function without automatic escalation. Manual monitoring can substitute initially.

**Independent Test**: Create a work order with a short SLA (e.g., 2 hours for emergency priority), wait for SLA threshold to be reached, and verify that escalation notifications are sent to supervisors and the work order is visually flagged as overdue.

**Acceptance Scenarios**:

1. **Given** SLA rules are configured (Emergency: 2 hours, High: 4 hours, Normal: 24 hours, Low: 72 hours), **When** a work order is created, **Then** an SLA timer starts and is visible on the work order card

2. **Given** a work order approaches its SLA deadline (e.g., 80% of time elapsed), **When** the system checks SLA status, **Then** warning notifications are sent to the assigned maintenance worker and their supervisor

3. **Given** a work order exceeds its SLA deadline, **When** the deadline passes, **Then** the work order is flagged as "Overdue" with visual indicators (red badge), supervisor receives escalation notification, and it appears in the overdue report on the admin dashboard

4. **Given** an overdue work order is eventually completed, **When** viewing historical data, **Then** the analytics dashboard tracks it as an SLA violation and includes it in quality metrics (impacts first-time fix rate and overdue percentage)

---

### Edge Cases

- **What happens when a maintenance worker marks a work order "Repaired" but property staff never review it?** System should send reminder notifications after a configurable period (e.g., 24 hours) and flag it as "Pending Review - Delayed" in reports

- **What happens when property staff submit a work order with no photos?** System should allow submission (photos are not mandatory) but display a placeholder or empty state in the photo gallery section

- **What happens when the same issue is reported multiple times by different property staff?** System should allow duplicate work orders (no automatic deduplication) but the admin dashboard should provide tools to identify and merge potential duplicates manually

- **What happens when a maintenance worker is unavailable or on leave?** System administrator should be able to reassign work orders to another maintenance worker, with notification sent to the new assignee

- **What happens when a work order goes through multiple rework cycles (e.g., 5+ times)?** System should continue to support the workflow but flag excessive rework cycles in the admin dashboard for quality investigation

- **What happens when network connectivity is lost while creating a work order?** Mini-program should cache the draft locally and allow the user to submit when connectivity is restored (WeChat mini-program offline storage capability)

- **What happens when an emergency work order is created outside business hours?** System should still send push notifications to on-call maintenance workers (requires on-call schedule configuration in admin panel)

- **What happens when a user tries to update a work order that was just modified by another user?** System should detect the conflict and show the latest state, requiring the user to refresh before making changes (optimistic locking)

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & Authorization

- **FR-001**: System MUST integrate with WeChat login (wx.login() and OpenID) for user authentication
- **FR-002**: System MUST prohibit user self-registration - all accounts created only by system administrators
- **FR-003**: System MUST enforce role-based access control with roles: Super Admin, System Admin, Administrative Manager, Property Staff, Maintenance Worker
- **FR-004**: System MUST support module-level permission configuration per role
- **FR-005**: System MUST enforce session timeout and concurrent login policies (configurable by administrators)
- **FR-006**: Every API endpoint MUST verify user authentication and authorization before processing requests

#### Work Order Management

- **FR-007**: System MUST allow property staff to create work orders with fields: floor (dropdown selection), location (room/area description), fault type, priority (Low/Normal/High/Emergency), description, and optional photos (up to 9 images using wx.chooseImage). Building is auto-populated as the system serves a single building.
- **FR-008**: System MUST generate unique work order IDs automatically upon creation
- **FR-008a**: System MUST automatically assign work orders to maintenance workers using round-robin rotation (next available worker in sequence based on last assignment)
- **FR-009**: System MUST support work order statuses: Pending Repair, In Progress, Repaired, Needs Rework, Completed
- **FR-009a**: System MUST allow maintenance workers to have up to 5 work orders in "In Progress" status concurrently and warn when approaching this limit
- **FR-010**: System MUST enforce valid status transitions: Pending Repair → In Progress → Repaired → Completed, with Needs Rework allowing loops back to Pending Repair
- **FR-011**: System MUST record timestamp and user ID for every status change
- **FR-012**: System MUST display work orders as cards showing: order number, floor, location, fault type, submitter, submission time, current status, priority, and thumbnail images
- **FR-013**: System MUST provide detailed work order view showing complete timeline of status changes with timestamps and actors
- **FR-014**: System MUST allow maintenance workers to add completion notes and photos when marking orders as "Repaired"
- **FR-015**: System MUST allow property staff to add review notes when marking orders as "Completed" or "Needs Rework"

#### Notification System

- **FR-016**: System MUST send WeChat template messages (in-app notifications) for all work order status changes within 10 seconds
- **FR-017**: System MUST send notifications to relevant parties: submitter (property staff), assigned technician (maintenance worker), and designated supervisor of the assigned technician (for escalations and rework scenarios)
- **FR-018**: System MUST send push notifications (WeChat work notifications) for emergency work orders and SLA violations
- **FR-019**: System MUST retry failed notifications with exponential backoff (max 3 attempts)
- **FR-020**: System MUST track notification delivery status for audit purposes
- **FR-021**: System MUST allow users to configure notification preferences (which events trigger notifications)

#### Dashboard & Analytics

- **FR-022**: System MUST provide role-specific home views: Property Staff (submitted/pending review/completed orders + create button), Maintenance Worker (pending/repaired/needs rework orders), Administrative Manager (all orders + analytics), System Admin (user management + config)
- **FR-023**: Administrative manager dashboard MUST display real-time KPIs: total active orders, average response time, average resolution time, first-time fix rate, overdue rate
- **FR-024**: Dashboard MUST support filtering by: status, priority, fault type, date range, floor, submitter, assigned technician
- **FR-025**: Dashboard MUST update metrics with max 5 minute lag from real-time (implemented via Redis caching with 5-minute TTL and automatic cache invalidation on work order state changes, see plan.md for technical details)
- **FR-026**: System MUST generate visualizations: work orders by category, work orders by priority, trend charts over time, technician performance metrics
- **FR-027**: System MUST support report export in Excel, PDF, and CSV formats
- **FR-028**: System MUST generate automated weekly and monthly performance reports

#### SLA & Escalation

- **FR-029**: System MUST support configurable SLA rules per priority level (e.g., Emergency: 2h, High: 4h, Normal: 24h, Low: 72h)
- **FR-030**: System MUST start SLA timer automatically when work order is created
- **FR-031**: System MUST send warning notifications when SLA threshold is reached (e.g., 80% of time elapsed)
- **FR-032**: System MUST flag work orders as "Overdue" when SLA deadline is exceeded
- **FR-033**: System MUST send escalation notifications to the designated supervisor of the assigned maintenance worker for overdue work orders
- **FR-034**: System MUST track SLA violations in analytics and quality reports

#### Audit & Logging

- **FR-035**: System MUST log critical operations: user login, permission changes, work order creation, status changes, configuration updates
- **FR-036**: Each audit log entry MUST include: timestamp, user ID, IP address, action type, affected resource, before/after state
- **FR-037**: System MUST store logs in append-only storage (no deletion or modification allowed)
- **FR-038**: System MUST retain audit logs for at least 2 years
- **FR-039**: System MUST provide searchable audit log interface for administrators (filter by user, date range, action type, resource)

#### System Administration

- **FR-040**: System MUST allow administrators to create, update, and deactivate user accounts
- **FR-041**: System MUST allow administrators to assign and modify user roles
- **FR-041a**: System MUST allow administrators to assign a designated supervisor to each maintenance worker for escalation routing
- **FR-042**: System MUST allow administrators to configure module access permissions per role
- **FR-043**: System MUST allow administrators to configure SLA rules and thresholds
- **FR-044**: System MUST allow administrators to configure fault type categories and priority levels
- **FR-045**: System MUST allow administrators to reassign work orders to different maintenance workers
- **FR-046**: System MUST provide tools to identify potential duplicate work orders using fuzzy matching algorithm (comparing location, fault type, and 24-hour time window) and allow administrators to link duplicates or mark as non-duplicates (see tasks T149a, T149b, T160a, T160b)

#### Data & Performance

- **FR-047**: System MUST persist all work order data, status history, and user actions in backend database
- **FR-048**: System MUST support local caching of critical data for offline viewing (using wx.setStorage)
- **FR-049**: System MUST handle uploaded images with size optimization for mobile bandwidth (WebP format preferred)
- **FR-049a**: System MUST retain all uploaded photos indefinitely for complete historical record and audit trail. System SHOULD implement archival to cold storage after 3 years for cost optimization (capacity projection: ~100-120 GB/year, see plan.md)
- **FR-050**: System MUST support at least 100 concurrent users without performance degradation
- **FR-051**: System MUST render initial page in under 2 seconds on 3G network
- **FR-052**: System MUST comply with WeChat mini-program size limits (main package < 2MB)

### Key Entities

- **User**: Represents system users with attributes: user ID (WeChat OpenID), name, role (Property Staff/Maintenance Worker/Administrative Manager/System Admin/Super Admin), contact info, department, supervisor ID (for Maintenance Workers - references another User), active status, created date, last login. Relationships: creates work orders (if Property Staff), assigned to work orders (if Maintenance Worker), has designated supervisor (if Maintenance Worker), modified by admins

- **Work Order**: Represents a maintenance request with attributes: unique ID, floor, location (room/area description), fault type category, priority level (Low/Normal/High/Emergency), description, submission timestamp, current status, SLA deadline, submitter (User), assigned technician (User), review notes, completion notes. Note: Building is implicit (single building system). Relationships: created by Property Staff, assigned to Maintenance Worker, has multiple status history entries, has multiple attached photos

- **Status History**: Represents state transitions with attributes: work order ID, previous status, new status, timestamp, actor (User), notes, photos. Relationships: belongs to a work order, created by a user

- **Fault Type**: Represents categorization with attributes: category ID, name (e.g., Electrical - Lighting, Plumbing - Leak, HVAC - Air Conditioning), parent category (for hierarchy), active status. Relationships: referenced by work orders

- **SLA Rule**: Represents service level agreements with attributes: priority level, target response time, target resolution time, escalation threshold, active status. Relationships: applied to work orders based on priority

- **Notification**: Represents notification events with attributes: notification ID, work order ID, recipient (User), notification type (template message/push), content, delivery status, sent timestamp, delivery timestamp, retry count. Relationships: associated with work order, sent to user

- **Audit Log**: Represents system events with attributes: log ID, timestamp, user ID, IP address, action type, resource type, resource ID, before state, after state, success status. Relationships: created by user actions, references work orders/users/configurations

- **Role**: Represents access control with attributes: role ID, role name, module permissions (array of enabled modules), created date, modified date. Relationships: assigned to users, defines access rights

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Property staff can create a complete work order (including photos) in under 90 seconds from issue discovery
- **SC-002**: Maintenance workers receive work order notifications within 10 seconds of submission
- **SC-003**: System supports at least 100 concurrent users during peak hours without response time degradation
- **SC-004**: 90% of work orders progress through the complete workflow (submission → repair → review → closure) without errors
- **SC-005**: Average work order resolution time decreases by 30% compared to manual process baseline (baseline to be measured during first month pre-deployment by tracking paper-based or existing system resolution times; post-deployment comparison after 3 months of system usage)
- **SC-006**: All status changes are traceable with complete timeline showing who did what and when
- **SC-007**: Administrative managers can generate performance reports covering any date range in under 5 seconds
- **SC-008**: 95% of SLA violations trigger automatic escalation notifications within 1 minute of deadline breach
- **SC-009**: System achieves 99.5% uptime (excluding planned maintenance windows)
- **SC-010**: Zero unauthorized access incidents - all actions properly authenticated and authorized
- **SC-011**: First-time fix rate (work orders completed without rework) reaches at least 80% within 3 months of deployment
- **SC-012**: Property staff satisfaction score (post-task survey) averages 4.0 or higher out of 5.0 for ease of use
- **SC-013**: Maintenance worker task completion rate (percentage of assigned orders completed on time) reaches 85% or higher
- **SC-014**: Administrative managers can identify performance bottlenecks (overdue orders, slow technicians, common fault types) within 2 minutes of accessing analytics dashboard

## Assumptions

- WeChat mini-program environment is available and users have WeChat installed
- Users have smartphones with camera capability for taking photos
- Backend API infrastructure will be built to support this mini-program (RESTful APIs over HTTPS)
- Database will be provisioned and maintained separately from the mini-program
- Storage infrastructure can accommodate indefinite photo retention with capacity planning for growth
- Network connectivity is generally available but offline viewing capability is needed for basic read operations
- Fault type categories will be configured during initial system setup based on company's facilities (can be customized)
- SLA rules are standard across the organization but configurable per priority level
- System serves a single building; floor list will be pre-configured during setup
- Maintenance workers are generally available and workload is balanced enough for simple round-robin assignment (advanced assignment based on skills, location, or current workload is out of scope for MVP)
- On-call schedules for emergency work orders will be managed outside the system initially
- Integration with external facility management systems is out of scope for initial version
- Payment processing or vendor management for external repairs is out of scope
- Inventory management for spare parts is out of scope
- Preventive maintenance scheduling is out of scope (focus is reactive maintenance)

## Out of Scope

The following features are explicitly excluded from this version:

- Multi-building or multi-site support (system designed for single building only)
- Advanced work order assignment logic based on technician skills, location proximity, current workload, or specialization (simple round-robin rotation is used)
- Preventive maintenance scheduling and recurring work orders
- Spare parts inventory management
- Vendor management for external contractors
- Payment processing and budgeting for repairs
- Integration with building IoT sensors for automatic issue detection
- Mobile app versions (iOS/Android native) - WeChat mini-program only
- Multi-language support (Chinese only)
- Work order templates or bulk creation
- Customer/tenant facing interface (internal staff only)
- Advanced analytics like predictive maintenance or machine learning insights
- Video attachment support (photos only)
- Real-time chat between property staff and maintenance workers
- Calendar/scheduling view for maintenance workers
- Mobile offline data synchronization (view-only caching supported, but creating/editing work orders requires connectivity)

## Constitutional Alignment

This feature specification aligns with the project constitution:

- **User Experience First**: Designed for simplicity - 90 second work order creation, intuitive card-based UI, max 3 steps for common operations
- **Role-Based Access Control**: Strict permission enforcement, admin-only user creation, module-level access control
- **Workflow Traceability**: Complete status history, timeline view, audit logs for all operations
- **Real-Time Notifications**: WeChat notifications within 10 seconds, retry mechanism, delivery tracking
- **Audit Logging**: Comprehensive logging of critical operations, 2-year retention, searchable interface
- **Data-Driven Quality**: KPIs tracked (response time, resolution time, first-time fix rate, overdue rate), exportable reports, trend analysis
- **Platform Compliance**: WeChat mini-program SDK, wx.login integration, size limits respected, HTTPS APIs
- **Security & Reliability**: 99.5% uptime target, input validation, permission checks, encrypted data, daily backups
