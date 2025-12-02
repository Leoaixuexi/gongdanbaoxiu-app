<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version Change: Initial → 1.0.0
Rationale: First constitution establishing core governance for WeChat mini-program work order system

Added Principles:
  1. User Experience First (简洁易用优先)
  2. Role-Based Access Control (角色权限控制)
  3. Workflow Traceability (流程可追溯)
  4. Real-Time Notifications (状态通知)
  5. Audit Logging (操作日志)
  6. Data-Driven Quality (数据驱动质量)
  7. Platform Compliance (平台规范)
  8. Security & Reliability (安全可靠)

Added Sections:
  - WeChat Mini-Program Constraints
  - Quality & Compliance Standards
  - Governance

Templates Status:
  ✅ plan-template.md - Reviewed (Constitution Check section aligns)
  ✅ spec-template.md - Reviewed (Requirements align with principles)
  ✅ tasks-template.md - Reviewed (Task categorization supports principles)
  ✅ agent-file-template.md - Reviewed (Compatible structure)
  ✅ checklist-template.md - Reviewed (No conflicts)

Follow-up TODOs: None

================================================================================
-->

# 工单报修系统 Constitution

## Core Principles

### I. User Experience First (简洁易用优先)

The system is designed for internal company use via WeChat mini-program. User experience must prioritize simplicity and ease of use above all other considerations. Complex features that compromise usability are prohibited.

**Rationale**: Property staff, maintenance workers, and administrative personnel are the primary users. The system must be intuitive enough for daily operations without extensive training, ensuring high adoption rates and operational efficiency.

**Non-Negotiable Rules**:
- UI components MUST follow WeChat Design Guidelines
- User workflows MUST require no more than 3 steps for common operations
- All user interfaces MUST be tested with actual target users (property staff, maintenance workers, administrators)
- Mobile-first responsive design is MANDATORY
- Loading states MUST provide clear visual feedback within 300ms

### II. Role-Based Access Control (角色权限控制)

The system MUST enforce strict role-based and module-level permission control. User self-registration is PROHIBITED. All user accounts and permissions must be managed by administrators.

**Rationale**: As an internal enterprise system, security and proper authorization are critical. Uncontrolled access could lead to data breaches, unauthorized workflow modifications, or operational disruptions.

**Non-Negotiable Rules**:
- Users MUST be created and assigned roles by system administrators
- Every API endpoint and UI component MUST verify user permissions
- Role hierarchy: Super Admin → System Admin → Department Manager → Property Staff → Maintenance Worker
- Module access MUST be configurable per role
- Permission changes MUST be logged and auditable
- Session management MUST enforce timeout and concurrent login policies

### III. Workflow Traceability (流程可追溯)

Work order workflows MUST be fully traceable and monitorable. The system MUST support automatic alert and escalation mechanisms when SLAs are at risk.

**Rationale**: Traceability ensures accountability, enables process optimization, and guarantees service quality. Automatic escalation prevents work orders from falling through the cracks.

**Non-Negotiable Rules**:
- Every work order state transition MUST be recorded with timestamp and actor
- Work orders MUST have configurable SLA timers
- System MUST auto-escalate overdue work orders to supervisors
- Dashboard MUST provide real-time visibility into all active work orders
- Historical workflow data MUST be retained for at least 1 year
- Reports MUST be exportable for external analysis

### IV. Real-Time Notifications (状态通知)

All state changes MUST trigger automatic notifications to relevant stakeholders. Notification delivery failures MUST be logged and retried.

**Rationale**: Timely communication is critical for rapid response to maintenance requests. Delays in notification directly impact service quality and customer satisfaction.

**Non-Negotiable Rules**:
- State changes MUST send WeChat template messages within 10 seconds
- Notifications MUST be sent to all relevant parties (submitter, assigned technician, supervisor)
- Critical events (emergency work orders, SLA violations) MUST send push notifications
- Notification preferences MUST be user-configurable
- Failed notifications MUST retry with exponential backoff (max 3 attempts)
- Notification delivery status MUST be tracked and auditable

### V. Audit Logging (操作日志)

Critical operations MUST be logged with complete context for security audits and compliance. Logs must be tamper-proof and queryable.

**Rationale**: Audit trails are essential for security investigations, compliance verification, dispute resolution, and system troubleshooting.

**Non-Negotiable Rules**:
- Log critical operations: user login, permission changes, work order creation/modification, status changes, configuration updates
- Each log entry MUST include: timestamp, user ID, IP address, action type, affected resource, before/after state
- Logs MUST be stored in append-only storage (no deletion or modification)
- Log retention MUST be at least 2 years
- Logs MUST be searchable by user, date range, action type, and resource
- Personal data in logs MUST comply with privacy regulations

### VI. Data-Driven Quality (数据驱动质量)

System MUST provide quantifiable metrics for data analysis, service quality assessment, and maintenance response efficiency. All metrics must be measurable and actionable.

**Rationale**: Continuous improvement requires objective measurement. Data-driven insights enable management to identify bottlenecks, optimize resource allocation, and improve service delivery.

**Non-Negotiable Rules**:
- Track KPIs: average response time, resolution time, first-time fix rate, overdue rate, customer satisfaction
- Dashboards MUST update metrics in real-time (< 5 minute lag)
- Reports MUST be exportable in multiple formats (Excel, PDF, CSV)
- Metrics MUST support filtering by time period, department, technician, work order category
- System MUST generate automated weekly/monthly performance reports
- Trend analysis MUST identify performance degradation early

### VII. Platform Compliance (平台规范)

All development MUST comply with WeChat Mini-Program platform requirements, guidelines, and best practices.

**Rationale**: Non-compliance risks app rejection, suspension, or degraded user experience. WeChat enforces strict policies that must be followed.

**Non-Negotiable Rules**:
- Code MUST pass WeChat审核 (review process)
- API calls MUST respect WeChat rate limits
- User data collection MUST follow WeChat privacy policies
- UI MUST use WeChat native components where available
- Mini-program size MUST stay within WeChat limits (main package < 2MB)
- Backend APIs MUST use HTTPS with valid SSL certificates
- Authentication MUST integrate with WeChat OpenID

### VIII. Security & Reliability (安全可靠)

The system MUST exhibit high reliability, maintainability, and extensibility. Security vulnerabilities are unacceptable.

**Rationale**: Enterprise systems require trust. Downtime, data loss, or security breaches damage credibility and disrupt operations.

**Non-Negotiable Rules**:
- System uptime MUST be ≥ 99.5% (excluding planned maintenance)
- All user inputs MUST be validated and sanitized (prevent XSS, SQL injection, command injection)
- Sensitive data (passwords, personal info) MUST be encrypted at rest and in transit
- Database backups MUST run daily with tested restore procedures
- Error handling MUST prevent information leakage (no stack traces to end users)
- Dependencies MUST be scanned for known vulnerabilities monthly
- Code MUST undergo security review before production deployment
- System MUST gracefully degrade under high load (no crashes)

## WeChat Mini-Program Constraints

### Technical Requirements

- **Development Framework**: WeChat Mini-Program SDK (WXML, WXSS, JavaScript)
- **Backend Communication**: RESTful APIs over HTTPS
- **Authentication**: WeChat login via wx.login() and OpenID
- **Storage**: Local storage via wx.setStorage for offline capability
- **File Upload**: Use wx.chooseImage and wx.uploadFile for work order attachments
- **Performance**: Initial render < 2 seconds on 3G network
- **Compatibility**: Support WeChat versions released within last 12 months

### Design Constraints

- UI MUST use WeChat Design System components (WeUI)
- Navigation MUST follow WeChat tab bar and navigation bar patterns
- Forms MUST use WeChat native input components for better UX
- Images MUST be optimized for mobile bandwidth (WebP preferred)
- Offline mode MUST cache critical data for view-only access

## Quality & Compliance Standards

### Testing Requirements

- **Unit Tests**: Required for all business logic functions (target coverage ≥ 70%)
- **Integration Tests**: Required for all API endpoints
- **User Acceptance Testing**: Required with actual target users before release
- **Performance Testing**: Required for workflows with > 100 concurrent users
- **Security Testing**: Required before each major release

### Code Quality

- Code MUST follow ESLint rules configured for WeChat mini-program
- Functions MUST have JSDoc comments describing purpose, parameters, and return values
- Complex logic (cyclomatic complexity > 10) MUST be refactored
- Magic numbers MUST be replaced with named constants
- Error messages MUST be user-friendly and localized (Chinese)

### Deployment

- Staging environment MUST mirror production configuration
- Deployments MUST use automated CI/CD pipelines
- Production deployments MUST have rollback procedures
- Database migrations MUST be backward-compatible for zero-downtime deployments
- Release notes MUST be maintained for every production release

## Governance

### Amendment Process

This constitution is the authoritative source for all development decisions. Any deviation requires documented justification and approval from the project stakeholder.

**Amendment Procedure**:
1. Proposed change must be documented with rationale
2. Impact analysis on existing system must be completed
3. Stakeholder approval required before implementation
4. Constitution version must be incremented appropriately
5. All dependent templates and documentation must be updated

### Versioning Policy

- **MAJOR** (X.0.0): Breaking changes to governance structure, removal/redefinition of core principles
- **MINOR** (x.Y.0): Addition of new principles, new sections, material expansions
- **PATCH** (x.y.Z): Clarifications, wording improvements, non-semantic refinements

### Compliance

- All PRs/code reviews MUST verify compliance with constitutional principles
- Non-compliance must be flagged immediately during review
- Exceptions must be documented in plan.md Complexity Tracking section
- Quarterly compliance audits MUST be conducted
- Principle violations in production MUST be remediated within 2 weeks

### Development Workflow

- Feature specifications MUST reference applicable constitutional principles
- Implementation plans MUST include Constitution Check section
- Task lists MUST categorize work by principle alignment
- Code reviews MUST verify principle adherence
- Retrospectives MUST assess whether principles are being followed

**Version**: 1.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12
