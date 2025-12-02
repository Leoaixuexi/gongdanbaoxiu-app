# Work Order Management System - Documentation Index

Welcome to the Work Order Management System documentation. This index provides quick access to all available documentation.

---

## Quick Start

### For Developers (First Time Setup)

1. **Quick Setup Script** - Automated setup for local development
   - Run: `bash scripts/quickstart.sh`
   - Checks prerequisites
   - Sets up database
   - Starts services
   - Displays test credentials

2. **[Testing Guide](./TESTING_GUIDE.md)** - Comprehensive testing instructions
   - Prerequisites verification
   - Database setup
   - Backend testing
   - Frontend testing
   - Integration testing scenarios
   - Performance testing

3. **[Test Accounts](./TEST_ACCOUNTS.md)** - Test user credentials and workflows
   - 5 test accounts (one per role)
   - Permissions for each role
   - Test workflows
   - Login examples

---

## Deployment

### For DevOps/Production

1. **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment guide
   - Pre-deployment checklist
   - Backend deployment
   - Frontend deployment
   - Post-deployment verification
   - Monitoring setup
   - Rollback procedures

2. **[Environment Configuration](./.env.production.example)** - Production environment template
   - All required variables
   - Security best practices
   - How to obtain API keys
   - Configuration examples

---

## Testing & API

### For QA and Developers

1. **[Postman Collection](./POSTMAN_COLLECTION.json)** - API testing collection
   - Import into Postman
   - Pre-configured requests
   - Test assertions
   - Environment variables
   - All endpoints organized by feature

2. **[Testing Guide](./TESTING_GUIDE.md)** - Manual and automated testing
   - Unit tests
   - Integration tests
   - End-to-end testing scenarios
   - Performance benchmarks

---

## Troubleshooting

### For All Users

**[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues and solutions
- Database connection errors
- Redis connection errors
- WeChat login issues
- SLA monitor problems
- Photo upload failures
- Permission errors
- Migration issues
- Port conflicts
- Performance issues
- Deployment issues

---

## Documentation Overview

### Core Documentation Files

| Document | Purpose | Audience |
|----------|---------|----------|
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Comprehensive testing instructions | Developers, QA |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Production deployment guide | DevOps, Admins |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions | All users |
| [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md) | Test user credentials | Developers, QA |
| [.env.production.example](./.env.production.example) | Environment configuration template | DevOps, Developers |
| [POSTMAN_COLLECTION.json](./POSTMAN_COLLECTION.json) | API testing collection | Developers, QA |
| [scripts/quickstart.sh](./scripts/quickstart.sh) | Automated setup script | Developers |

---

## Project Structure

```
gongdanbaoxiu/
├── backend/                    # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── app.js             # Main application entry
│   │   ├── config/            # Configuration files
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # Authentication, RBAC, validation
│   │   ├── models/            # Sequelize models
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── jobs/              # Background jobs (SLA monitor)
│   │   └── utils/             # Utilities (logger, JWT, etc.)
│   ├── logs/                  # Application logs
│   ├── package.json           # Dependencies
│   └── .env.example           # Environment template
│
├── miniprogram/               # WeChat MiniProgram (Frontend)
│   ├── pages/                 # MiniProgram pages
│   ├── components/            # Reusable components
│   ├── utils/                 # Utility functions
│   ├── config/                # Configuration
│   └── app.json               # MiniProgram config
│
├── database/                  # Database migrations and seeders
│   ├── migrations/            # Schema migrations
│   └── seeders/               # Test data seeders
│
├── scripts/                   # Utility scripts
│   └── quickstart.sh          # Quick setup script
│
└── docs/                      # Documentation
    ├── TESTING_GUIDE.md
    ├── DEPLOYMENT_CHECKLIST.md
    ├── TROUBLESHOOTING.md
    ├── TEST_ACCOUNTS.md
    └── POSTMAN_COLLECTION.json
```

---

## Getting Started

### Step 1: Choose Your Path

**I'm a developer setting up for the first time:**
1. Run `bash scripts/quickstart.sh`
2. Read [TESTING_GUIDE.md](./TESTING_GUIDE.md)
3. Import [POSTMAN_COLLECTION.json](./POSTMAN_COLLECTION.json) into Postman
4. Review [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md) for test credentials

**I'm deploying to production:**
1. Read [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
2. Copy and configure [.env.production.example](./.env.production.example)
3. Follow deployment steps carefully
4. Bookmark [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

**I'm testing the system:**
1. Review [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md)
2. Import [POSTMAN_COLLECTION.json](./POSTMAN_COLLECTION.json)
3. Follow test scenarios in [TESTING_GUIDE.md](./TESTING_GUIDE.md)
4. Report issues with logs from troubleshooting guide

**I'm encountering issues:**
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Search for your error message
3. Follow suggested solutions
4. Check application logs

---

## Common Tasks

### Local Development Setup

```bash
# Quick setup (recommended)
bash scripts/quickstart.sh

# Manual setup
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run db:migrate
npm run db:seed
npm run dev
```

### Running Tests

```bash
cd backend

# All tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

### Database Management

```bash
cd backend

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:undo

# Run seeders (test data)
npm run db:seed

# Undo all seeders
npm run db:seed:undo
```

### Production Deployment

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for complete steps.

---

## API Documentation

### Authentication

All API endpoints (except `/health` and `/api`) require authentication via JWT token.

**Login:**
```bash
POST /api/auth/wechat
Content-Type: application/json

{
  "code": "wechat_login_code"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

**Using Token:**
```bash
GET /api/workorders
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Main Endpoints

- **Health Check:** `GET /api/health`
- **Authentication:** `POST /api/auth/wechat`
- **Work Orders:** `/api/workorders`
  - `POST /` - Create work order
  - `GET /` - List work orders
  - `GET /:id` - Get work order details
  - `PATCH /:id/start` - Start repair
  - `PATCH /:id/repair` - Update repair status
  - `PATCH /:id/review` - Review work order
  - `GET /duplicates` - Get duplicate orders (admin)
- **Analytics:** `/api/analytics`
  - `GET /dashboard` - Dashboard statistics
  - `GET /performance` - Performance report
  - `GET /sla-compliance` - SLA compliance
  - `GET /export/excel` - Export to Excel
- **Users:** `/api/users`
  - `GET /` - List users (admin)
  - `GET /me` - Current user profile
  - `GET /:id` - User details
  - `PATCH /:id` - Update user (admin)
  - `PATCH /:id/deactivate` - Deactivate user (admin)

For detailed API documentation with examples, see [POSTMAN_COLLECTION.json](./POSTMAN_COLLECTION.json).

---

## User Roles and Permissions

### 1. Super Admin (role_id: 1)
- Full system access
- Manage users, roles, system configuration
- View all audit logs

### 2. System Admin (role_id: 2)
- User management
- View all work orders
- Export reports
- View audit logs

### 3. Administrative Manager (role_id: 3)
- View all work orders
- Assign work orders
- View analytics and reports
- Submit work orders

### 4. Property Staff (role_id: 4)
- Submit work orders
- View own submitted orders
- Review completed repairs

### 5. Maintenance Worker (role_id: 5)
- View assigned work orders
- Update repair status
- Upload repair photos
- Max 5 concurrent in-progress orders

For detailed permissions and test workflows, see [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md).

---

## System Requirements

### Development

- **Node.js:** >= 18.0.0
- **MySQL:** >= 8.0
- **Redis:** >= 6.0 (optional, recommended)
- **WeChat Developer Tools:** Latest version

### Production

- **Server:** 2 CPU cores, 4GB RAM (minimum)
- **Node.js:** >= 18.0.0
- **MySQL:** >= 8.0 (or cloud database)
- **Redis:** >= 6.0 (or cloud cache)
- **Nginx:** Latest stable version
- **SSL Certificate:** Valid HTTPS certificate
- **Domain:** Configured and whitelisted in WeChat

---

## Support and Resources

### Documentation
- [Testing Guide](./TESTING_GUIDE.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Test Accounts](./TEST_ACCOUNTS.md)

### Tools
- [Postman Collection](./POSTMAN_COLLECTION.json)
- [Quick Start Script](./scripts/quickstart.sh)
- [Environment Template](./.env.production.example)

### External Resources
- [WeChat MiniProgram Documentation](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Tencent Cloud COS Documentation](https://cloud.tencent.com/document/product/436)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [Express.js Documentation](https://expressjs.com/)

---

## Contributing

For development guidelines and contribution instructions, please refer to:
- Code style guide in `backend/package.json` (ESLint configuration)
- Git workflow in project README
- Testing requirements in [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## Version History

- **v1.0.0** - Initial release
  - Core work order management
  - Role-based access control
  - WeChat MiniProgram integration
  - SLA monitoring
  - Analytics and reporting

---

## License

[Add license information here]

---

## Contact

For technical support or questions:
- **Development Team:** [Contact information]
- **System Administrator:** [Contact information]
- **WeChat Support:** [Contact method]

---

Last updated: 2025-11-13
