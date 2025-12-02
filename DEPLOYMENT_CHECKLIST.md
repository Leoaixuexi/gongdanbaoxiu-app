# Deployment Checklist - Work Order Management System

This checklist guides you through deploying the Work Order Management System to production. Follow each step carefully and check off items as you complete them.

---

## Pre-deployment Checklist

### Code Quality & Testing

- [ ] All unit tests passed (`npm run test:unit`)
- [ ] All integration tests passed (`npm run test:integration`)
- [ ] Code coverage meets minimum threshold (>80%)
- [ ] No critical bugs in issue tracker
- [ ] Code reviewed and approved
- [ ] All TODO comments addressed or documented
- [ ] Dependencies updated to stable versions
- [ ] Security audit completed (`npm audit`)

### Database

- [ ] Database migrations run successfully on staging
- [ ] Migration rollback tested
- [ ] Database backup created
- [ ] Seeder data appropriate for production (test users removed)
- [ ] Database indexes verified
- [ ] Slow query log reviewed

### Environment Configuration

- [ ] Production `.env` file configured (see `.env.production.example`)
- [ ] All required environment variables set
- [ ] JWT secret changed from default
- [ ] Database credentials secured
- [ ] WeChat AppID and Secret obtained for production
- [ ] Tencent COS credentials obtained
- [ ] Redis password configured
- [ ] All secrets stored securely (not in version control)

### Security

- [ ] SSL/TLS certificates obtained
- [ ] HTTPS enforced
- [ ] Security headers configured (helmet.js)
- [ ] CORS settings configured for production domains
- [ ] Rate limiting configured
- [ ] Input validation enabled on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] File upload limits configured

### Infrastructure

- [ ] Server provisioned (CPU, RAM, Storage requirements met)
- [ ] Domain name configured
- [ ] DNS records set up
- [ ] Firewall rules configured
- [ ] Load balancer configured (if applicable)
- [ ] CDN configured for static assets (if applicable)

### Backup Strategy

- [ ] Database backup strategy in place
  - [ ] Daily full backups
  - [ ] Hourly incremental backups
  - [ ] Backup retention policy defined
  - [ ] Backup restoration tested
- [ ] Application backup strategy in place
- [ ] Redis data persistence configured
- [ ] Uploaded files backup configured

### Monitoring & Logging

- [ ] Logging configuration verified
- [ ] Log rotation configured
- [ ] Error tracking service integrated (e.g., Sentry)
- [ ] Application monitoring set up (e.g., PM2 monitoring)
- [ ] Server monitoring configured (CPU, RAM, Disk)
- [ ] Database monitoring configured
- [ ] Uptime monitoring configured
- [ ] Alert notifications configured

---

## Backend Deployment

### Step 1: Server Preparation

- [ ] Connect to production server via SSH
- [ ] Update system packages:
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

- [ ] Install Node.js (v18 or higher):
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt install -y nodejs
  node --version  # Verify >= 18.0.0
  ```

- [ ] Install MySQL:
  ```bash
  sudo apt install -y mysql-server
  sudo mysql_secure_installation
  mysql --version  # Verify >= 8.0
  ```

- [ ] Install Redis:
  ```bash
  sudo apt install -y redis-server
  sudo systemctl enable redis-server
  redis-cli --version  # Verify >= 6.0
  ```

- [ ] Install PM2 globally:
  ```bash
  sudo npm install -g pm2
  pm2 --version
  ```

- [ ] Install Nginx:
  ```bash
  sudo apt install -y nginx
  nginx -v
  ```

### Step 2: Clone Repository

- [ ] Clone repository to server:
  ```bash
  cd /var/www
  sudo git clone <repository-url> workorder-system
  cd workorder-system
  ```

- [ ] Checkout production branch:
  ```bash
  git checkout main  # or production branch
  git pull origin main
  ```

- [ ] Set correct permissions:
  ```bash
  sudo chown -R $USER:$USER /var/www/workorder-system
  ```

### Step 3: Install Dependencies

- [ ] Install backend dependencies:
  ```bash
  cd /var/www/workorder-system/backend
  npm install --production
  ```

- [ ] Verify dependencies installed:
  ```bash
  npm list --depth=0
  ```

### Step 4: Configure Environment Variables

- [ ] Create production `.env` file:
  ```bash
  cd /var/www/workorder-system/backend
  cp .env.production.example .env
  nano .env
  ```

- [ ] Set all required variables:
  ```env
  # Server Configuration
  PORT=3000
  NODE_ENV=production

  # Database Configuration
  DB_HOST=localhost
  DB_PORT=3306
  DB_NAME=workorder_production
  DB_USER=workorder_user
  DB_PASSWORD=<secure-password>

  # Redis Configuration
  REDIS_HOST=localhost
  REDIS_PORT=6379
  REDIS_PASSWORD=<secure-password>

  # JWT Configuration
  JWT_SECRET=<generate-strong-secret>
  JWT_EXPIRES_IN=24h

  # WeChat Configuration
  WECHAT_APPID=<production-appid>
  WECHAT_SECRET=<production-secret>
  WECHAT_TEMPLATE_CREATED=<template-id>
  WECHAT_TEMPLATE_STATUS=<template-id>
  WECHAT_TEMPLATE_SLA=<template-id>
  WECHAT_TEMPLATE_ESCALATION=<template-id>

  # COS Configuration
  COS_SECRET_ID=<production-secret-id>
  COS_SECRET_KEY=<production-secret-key>
  COS_BUCKET=<production-bucket>
  COS_REGION=ap-guangzhou

  # Notification Configuration
  NOTIFICATION_RETRY_MAX=3
  NOTIFICATION_RETRY_DELAY=10000

  # SLA Monitoring
  SLA_CHECK_INTERVAL=60000
  ```

- [ ] Secure `.env` file:
  ```bash
  chmod 600 .env
  ```

### Step 5: Database Setup

- [ ] Create production database:
  ```bash
  mysql -u root -p
  ```
  ```sql
  CREATE DATABASE workorder_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'workorder_user'@'localhost' IDENTIFIED BY '<secure-password>';
  GRANT ALL PRIVILEGES ON workorder_production.* TO 'workorder_user'@'localhost';
  FLUSH PRIVILEGES;
  EXIT;
  ```

- [ ] Run migrations:
  ```bash
  cd /var/www/workorder-system/backend
  npm run db:migrate
  ```

- [ ] Verify migrations:
  ```bash
  mysql -u workorder_user -p workorder_production
  ```
  ```sql
  SHOW TABLES;
  EXIT;
  ```

- [ ] **DO NOT** run test seeders in production
- [ ] Create initial production users manually through admin interface

### Step 6: Configure Logging

- [ ] Create logs directory:
  ```bash
  mkdir -p /var/www/workorder-system/backend/logs
  chmod 755 /var/www/workorder-system/backend/logs
  ```

- [ ] Configure log rotation:
  ```bash
  sudo nano /etc/logrotate.d/workorder-backend
  ```
  ```
  /var/www/workorder-system/backend/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 www-data www-data
  }
  ```

### Step 7: Set Up Process Manager (PM2)

- [ ] Create PM2 ecosystem file:
  ```bash
  cd /var/www/workorder-system/backend
  nano ecosystem.config.js
  ```
  ```javascript
  module.exports = {
    apps: [{
      name: 'workorder-backend',
      script: './src/app.js',
      instances: 2,  // or 'max' for all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
    }],
  };
  ```

- [ ] Start application with PM2:
  ```bash
  pm2 start ecosystem.config.js
  ```

- [ ] Verify application running:
  ```bash
  pm2 status
  pm2 logs workorder-backend --lines 50
  ```

- [ ] Save PM2 configuration:
  ```bash
  pm2 save
  ```

- [ ] Set PM2 to start on boot:
  ```bash
  pm2 startup
  # Follow the instructions output by the command
  ```

### Step 8: Configure Reverse Proxy (Nginx)

- [ ] Create Nginx configuration:
  ```bash
  sudo nano /etc/nginx/sites-available/workorder-backend
  ```
  ```nginx
  upstream workorder_backend {
      server localhost:3000;
      keepalive 64;
  }

  server {
      listen 80;
      server_name api.yourdomain.com;

      # Redirect HTTP to HTTPS
      return 301 https://$server_name$request_uri;
  }

  server {
      listen 443 ssl http2;
      server_name api.yourdomain.com;

      # SSL Configuration
      ssl_certificate /etc/ssl/certs/yourdomain.crt;
      ssl_certificate_key /etc/ssl/private/yourdomain.key;
      ssl_protocols TLSv1.2 TLSv1.3;
      ssl_ciphers HIGH:!aNULL:!MD5;
      ssl_prefer_server_ciphers on;

      # Security Headers
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

      # Proxy Settings
      location / {
          proxy_pass http://workorder_backend;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;

          # Timeouts
          proxy_connect_timeout 60s;
          proxy_send_timeout 60s;
          proxy_read_timeout 60s;
      }

      # Rate limiting
      limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
      location /api/ {
          limit_req zone=api_limit burst=20 nodelay;
          proxy_pass http://workorder_backend;
      }

      # Logging
      access_log /var/log/nginx/workorder-backend-access.log;
      error_log /var/log/nginx/workorder-backend-error.log;
  }
  ```

- [ ] Enable site:
  ```bash
  sudo ln -s /etc/nginx/sites-available/workorder-backend /etc/nginx/sites-enabled/
  ```

- [ ] Test Nginx configuration:
  ```bash
  sudo nginx -t
  ```

- [ ] Reload Nginx:
  ```bash
  sudo systemctl reload nginx
  ```

### Step 9: Health Check Verification

- [ ] Test health check endpoint:
  ```bash
  curl https://api.yourdomain.com/api/health
  ```

  **Expected response:**
  ```json
  {
    "success": true,
    "status": "healthy",
    "timestamp": "2025-11-13T10:00:00.000Z",
    "uptime": 123.456
  }
  ```

- [ ] Test API root endpoint:
  ```bash
  curl https://api.yourdomain.com/api
  ```

- [ ] Verify HTTPS redirect:
  ```bash
  curl -I http://api.yourdomain.com/api/health
  # Should return 301 redirect to HTTPS
  ```

### Step 10: Verify Background Jobs

- [ ] Check PM2 logs for SLA monitor:
  ```bash
  pm2 logs workorder-backend --lines 100 | grep "SLA monitor"
  ```

  **Expected log:**
  ```
  [2025-11-13 XX:XX:XX] info: SLA monitor job started (runs every 1 minute)
  [2025-11-13 XX:XX:XX] info: Running SLA monitor check...
  [2025-11-13 XX:XX:XX] info: SLA check completed
  ```

- [ ] Verify background job is running:
  ```bash
  pm2 monit
  # Monitor CPU/RAM usage, should show periodic activity
  ```

---

## Frontend Deployment

### Step 1: Update API Base URL

- [ ] Edit miniprogram configuration:
  ```bash
  cd /var/www/workorder-system/miniprogram
  nano config/api.js
  ```
  ```javascript
  const API_BASE_URL = 'https://api.yourdomain.com/api';
  module.exports = { API_BASE_URL };
  ```

### Step 2: Configure WeChat MiniProgram

- [ ] Log in to WeChat Official Account Platform:
  - URL: https://mp.weixin.qq.com/

- [ ] Configure server domain whitelist:
  - Navigate to: 开发 > 开发管理 > 开发设置 > 服务器域名
  - Add request domain: `https://api.yourdomain.com`
  - Add uploadFile domain: `https://<your-cos-bucket>.cos.<region>.myqcloud.com`
  - Add downloadFile domain: `https://<your-cos-bucket>.cos.<region>.myqcloud.com`

- [ ] Verify AppID and Secret:
  - Navigate to: 开发 > 开发管理 > 开发设置
  - Copy AppID and AppSecret
  - Ensure they match backend `.env` file

### Step 3: Build and Upload

- [ ] Open WeChat Developer Tools

- [ ] Import project:
  - Project directory: `C:\Users\18538\Desktop\xiaowuye\gongdanbaoxiu\miniprogram`
  - AppID: Use production AppID
  - Project name: "Work Order Management System"

- [ ] Test in simulator:
  - Test login flow
  - Test each user role workflow
  - Verify API calls to production server

- [ ] Upload code:
  - Click "上传" (Upload) button
  - Enter version number (e.g., "1.0.0")
  - Enter description (e.g., "Initial production release")

### Step 4: Submit for Review

- [ ] Log in to WeChat Official Account Platform

- [ ] Navigate to: 版本管理 > 开发版本

- [ ] Click "提交审核" (Submit for Review)

- [ ] Fill in review information:
  - **Service Categories:** Select appropriate categories
  - **Test Accounts:** Provide test account credentials
  - **Functionality Description:** Describe all features
  - **Screenshots:** Upload screenshots of main features

- [ ] Submit and wait for review (typically 1-7 days)

### Step 5: Release

- [ ] After approval, navigate to: 版本管理 > 审核版本

- [ ] Click "发布" (Release)

- [ ] Confirm release

- [ ] Verify release in: 版本管理 > 线上版本

---

## Post-deployment Checklist

### Verification

- [ ] All API endpoints accessible via HTTPS
- [ ] Health check endpoint responding
- [ ] Login flow working (WeChat OAuth)
- [ ] Work order creation working
- [ ] Work order assignment working
- [ ] Status transitions working
- [ ] Notifications being sent
- [ ] File uploads working (photos)
- [ ] SLA monitor job running
- [ ] All user roles tested
- [ ] All workflows tested end-to-end

### Monitoring Setup

- [ ] Application monitoring active (PM2/New Relic/DataDog)
- [ ] Error tracking active (Sentry/Rollbar)
- [ ] Server monitoring active (CPU, RAM, Disk, Network)
- [ ] Database monitoring active (connections, slow queries)
- [ ] Redis monitoring active (memory, hit rate)
- [ ] Log aggregation configured (ELK/Graylog/CloudWatch)
- [ ] Uptime monitoring configured (Pingdom/UptimeRobot)

### Alerting Configuration

- [ ] Alert on application errors (500 errors)
- [ ] Alert on high CPU usage (>80%)
- [ ] Alert on high memory usage (>80%)
- [ ] Alert on disk space (>80%)
- [ ] Alert on database connection failures
- [ ] Alert on Redis connection failures
- [ ] Alert on API response time degradation
- [ ] Alert on failed background jobs
- [ ] Alert on SSL certificate expiration (30 days)

### Performance Verification

- [ ] Load test completed successfully
- [ ] Response times within acceptable range
- [ ] Database query performance optimized
- [ ] Redis cache hit rate acceptable (>80%)
- [ ] No memory leaks detected
- [ ] No N+1 query issues

### Security Verification

- [ ] SSL certificate valid
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] CORS configured correctly
- [ ] Rate limiting working
- [ ] No exposed secrets in code
- [ ] No test accounts in production database
- [ ] File upload validation working
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified

### Documentation

- [ ] Deployment documentation updated
- [ ] API documentation published
- [ ] User manual created
- [ ] Admin guide created
- [ ] Troubleshooting guide updated
- [ ] Runbook created for operations team

### Rollback Procedure

Document rollback steps in case of critical issues:

- [ ] **Database Rollback:**
  ```bash
  cd /var/www/workorder-system/backend
  npm run db:migrate:undo
  ```

- [ ] **Application Rollback:**
  ```bash
  cd /var/www/workorder-system
  git checkout <previous-commit-hash>
  cd backend
  pm2 restart workorder-backend
  ```

- [ ] **WeChat MiniProgram Rollback:**
  - Log in to WeChat Official Account Platform
  - Navigate to: 版本管理 > 版本回退
  - Select previous version
  - Click "回退" (Rollback)

- [ ] **Database Restore from Backup:**
  ```bash
  mysql -u workorder_user -p workorder_production < /path/to/backup.sql
  ```

### Backup Verification

- [ ] Verify database backup completed:
  ```bash
  ls -lh /var/backups/mysql/
  ```

- [ ] Test database restore:
  ```bash
  # Create test database
  mysql -u root -p -e "CREATE DATABASE workorder_test;"
  # Restore backup
  mysql -u workorder_user -p workorder_test < /path/to/latest-backup.sql
  # Verify
  mysql -u workorder_user -p workorder_test -e "SHOW TABLES;"
  # Cleanup
  mysql -u root -p -e "DROP DATABASE workorder_test;"
  ```

- [ ] Verify uploaded files backup

---

## Production Maintenance

### Daily Tasks

- [ ] Check application logs for errors
- [ ] Verify background jobs running
- [ ] Monitor server resources
- [ ] Check uptime status

### Weekly Tasks

- [ ] Review error tracking dashboard
- [ ] Analyze performance metrics
- [ ] Review slow query log
- [ ] Check disk space usage
- [ ] Review security logs

### Monthly Tasks

- [ ] Update dependencies (security patches)
- [ ] Review and rotate logs
- [ ] Test backup restoration
- [ ] Review and optimize database
- [ ] Review and clean up old data
- [ ] Update SSL certificates if needed

---

## Emergency Contacts

Document key contacts for production support:

- **Development Team Lead:** [Name] - [Phone] - [Email]
- **DevOps Engineer:** [Name] - [Phone] - [Email]
- **Database Administrator:** [Name] - [Phone] - [Email]
- **System Administrator:** [Name] - [Phone] - [Email]
- **WeChat Support:** [Contact Method]
- **Cloud Provider Support:** [Contact Method]

---

## Deployment Sign-off

- [ ] Development team sign-off
- [ ] QA team sign-off
- [ ] Operations team sign-off
- [ ] Product owner sign-off
- [ ] Security team sign-off

**Deployed by:** ___________________
**Date:** ___________________
**Version:** ___________________
**Git Commit:** ___________________

---

## Notes

Document any deployment-specific notes or deviations from standard process:

```
[Add notes here]
```
