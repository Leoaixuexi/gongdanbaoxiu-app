# Quickstart Guide: 工单报修管理系统

**Last Updated**: 2025-11-12
**Estimated Setup Time**: 30 minutes

## Prerequisites

Before starting, ensure you have:

### Required Software
- **Node.js**: 18 LTS or higher
- **MySQL**: 8.0 or higher
- **Redis**: 6.0 or higher
- **WeChat DevTools**: Latest version for mini-program development
- **Git**: For version control

### Required Accounts
- **WeChat Mini-Program**: Registered AppID and AppSecret
- **Cloud Object Storage**: Tencent COS or Alibaba OSS account
- **Development Environment**: macOS, Windows, or Linux

### Knowledge Prerequisites
- JavaScript ES6+
- Node.js/Express basics
- MySQL/SQL basics
- WeChat Mini-Program fundamentals

---

## Quick Start (5 Minutes)

### 1. Clone Repository

```bash
git clone <repository-url>
cd gongdanbaoxiu
git checkout 001-work-order-system
```

### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend (Mini-Program):**
```bash
cd miniprogram
npm install
```

### 3. Configure Environment

Create `backend/.env` file:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=workorder_dev
DB_USER=root
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# WeChat
WECHAT_APPID=your_mini_program_appid
WECHAT_SECRET=your_mini_program_secret

# Cloud Storage
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou

# Server
PORT=3000
NODE_ENV=development
```

### 4. Initialize Database

```bash
cd backend

# Run migrations
npx sequelize-cli db:migrate

# Seed initial data (roles, fault types, SLA rules, test users)
npx sequelize-cli db:seed:all
```

### 5. Start Development Servers

**Terminal 1 - Backend API:**
```bash
cd backend
npm run dev
```

**Terminal 2 - WeChat DevTools:**
1. Open WeChat Developer Tools
2. Import project from `miniprogram/` directory
3. Enter your AppID
4. Click "Compile"

### 6. Test the System

**Backend Health Check:**
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"2025-11-12T..."}
```

**Mini-Program:**
1. In WeChat DevTools, click "Preview"
2. Scan QR code with WeChat
3. Login with test account

**Test Accounts** (from seed data):
- Property Staff: `test_property@example.com` (OpenID: `test_openid_property_001`)
- Maintenance Worker: `test_maintenance@example.com` (OpenID: `test_openid_maintenance_001`)
- Admin Manager: `test_admin@example.com` (OpenID: `test_openid_admin_001`)

---

## Detailed Setup Guide

### Database Setup

**1. Create MySQL Database:**
```sql
CREATE DATABASE workorder_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'workorder_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON workorder_dev.* TO 'workorder_user'@'localhost';
FLUSH PRIVILEGES;
```

**2. Run Migrations:**
```bash
cd backend
npx sequelize-cli db:migrate
```

**Expected Output:**
```
== 20251112000001-create-users: migrating
== 20251112000001-create-users: migrated (0.234s)
== 20251112000002-create-roles: migrating
== 20251112000002-create-roles: migrated (0.123s)
...
```

**3. Seed Data:**
```bash
npx sequelize-cli db:seed:all
```

**Seed Data Includes:**
- 5 Roles (Super Admin, System Admin, Administrative Manager, Property Staff, Maintenance Worker)
- 10 Fault Types (Electrical, Plumbing, HVAC categories)
- 4 SLA Rules (Emergency: 2h, High: 4h, Normal: 24h, Low: 72h)
- 5 Test Users (one per role)

### Redis Setup

**1. Install Redis** (if not installed):

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
```bash
# Download from https://github.com/microsoftarchive/redis/releases
# Or use Docker: docker run -d -p 6379:6379 redis
```

**2. Verify Redis:**
```bash
redis-cli ping
# Expected: PONG
```

### Cloud Object Storage Setup

**1. Tencent COS:**
- Login to Tencent Cloud Console
- Create new COS bucket (name: `workorder-photos-dev`)
- Generate SecretId and SecretKey
- Copy credentials to `.env`

**2. Configure CORS:**
```json
[
  {
    "allowedOrigins": ["*"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

### WeChat Mini-Program Configuration

**1. Configure project.config.json:**
```json
{
  "appid": "your_appid",
  "projectname": "Work Order System",
  "description": "Internal work order management system",
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "compileHotReLoad": true
  }
}
```

**2. Configure API Base URL:**

Edit `miniprogram/services/api.js`:
```javascript
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.workorder.example.com/v1'
  : 'http://localhost:3000/v1';
```

**3. Request Domain Whitelist** (WeChat MP Admin):
- Add `https://your-api-domain.com` to request whitelist
- Add `https://your-cos-domain.com` to uploadFile whitelist

---

## Development Workflow

### Backend Development

**Start Dev Server with Auto-Reload:**
```bash
cd backend
npm run dev
```

**Run Tests:**
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests with coverage
npm run test:coverage
```

**Lint Code:**
```bash
npm run lint
npm run lint:fix
```

### Frontend Development

**Compile and Preview:**
1. Open WeChat DevTools
2. Click "Compile" to rebuild
3. Click "Preview" to test on real device

**Debug Tools:**
- Console: View logs and errors
- Network: Monitor API calls
- Storage: Inspect wx.setStorage data
- AppData: View component state

### Database Migrations

**Create New Migration:**
```bash
npx sequelize-cli migration:generate --name add-column-to-workorders
```

**Edit Migration File:**
```javascript
// database/migrations/20251112-add-column-to-workorders.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('work_orders', 'new_column', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('work_orders', 'new_column');
  }
};
```

**Run Migration:**
```bash
npx sequelize-cli db:migrate
```

**Rollback Migration:**
```bash
npx sequelize-cli db:migrate:undo
```

---

## Common Tasks

### Create Test Work Order via API

```bash
curl -X POST http://localhost:3000/v1/workorders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "floor": "Floor 3",
    "location": "Room 301",
    "fault_type_id": 1,
    "priority": "Normal",
    "description": "Ceiling light not working",
    "photos": []
  }'
```

### Test Round-Robin Assignment

```bash
# Create multiple work orders quickly
for i in {1..5}; do
  curl -X POST http://localhost:3000/v1/workorders \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"floor\":\"Floor $i\",\"location\":\"Room 30$i\",\"fault_type_id\":1,\"priority\":\"Normal\",\"description\":\"Test order $i\"}"
done

# Check assignments are distributed
curl http://localhost:3000/v1/analytics/technician-performance \
  -H "Authorization: Bearer $TOKEN"
```

### Trigger SLA Monitoring Job Manually

```bash
cd backend
node src/jobs/slaMonitor.js
```

### View Audit Logs

```bash
# SQL query
mysql -u workorder_user -p workorder_dev -e "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;"
```

---

## Troubleshooting

### Backend Won't Start

**Issue**: `Error: connect ECONNREFUSED 127.0.0.1:3306`
**Solution**: Ensure MySQL is running
```bash
# macOS
brew services start mysql

# Linux
sudo systemctl start mysql
```

**Issue**: `SequelizeConnectionError: Access denied for user`
**Solution**: Check database credentials in `.env`

### Redis Connection Failed

**Issue**: `Error: Redis connection to 127.0.0.1:6379 failed`
**Solution**: Start Redis server
```bash
redis-server
# Or: brew services start redis
```

### WeChat Login Failed

**Issue**: `40029: invalid code`
**Solution**:
1. Check `WECHAT_APPID` and `WECHAT_SECRET` in `.env`
2. Ensure AppID matches WeChat DevTools project config
3. Code expires after 5 minutes - try fresh wx.login()

### Photo Upload Fails

**Issue**: `COS: Access Denied`
**Solution**:
1. Verify COS credentials in `.env`
2. Check bucket CORS configuration
3. Ensure bucket region matches `.env` setting

### Port Already in Use

**Issue**: `Error: listen EADDRINUSE: address already in use :::3000`
**Solution**: Kill existing process
```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

---

## Next Steps

1. **Read Specification**: [spec.md](spec.md) for complete requirements
2. **Review Data Model**: [data-model.md](data-model.md) for database schema
3. **Explore API Contracts**: [contracts/](contracts/) for endpoint details
4. **Run Tests**: `npm test` to ensure system works correctly
5. **Generate Tasks**: Run `/speckit.tasks` to get implementation task list

---

## Resources

### Documentation
- [WeChat Mini-Program Docs](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Sequelize ORM](https://sequelize.org/docs/v6/)
- [ECharts for Mini-Program](https://github.com/ecomfe/echarts-for-weixin)

### Tools
- [Postman Collection](docs/api/postman_collection.json) - API testing
- [Database Diagram](docs/database/erd.png) - Visual schema reference
- [Seed Data Generator](database/seeders/README.md) - Custom test data

### Support
- **Issues**: GitHub Issues tracker
- **Slack**: #work-order-system channel
- **Email**: dev-team@example.com

---

**Setup Complete!** 🎉

You're ready to start development. For task-based workflow, run `/speckit.tasks` to generate the implementation task list.
