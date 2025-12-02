# Troubleshooting Guide - Work Order Management System

This guide covers common issues you may encounter and their solutions.

---

## Table of Contents

- [Database Issues](#database-issues)
- [Redis Issues](#redis-issues)
- [WeChat Login Issues](#wechat-login-issues)
- [SLA Monitor Issues](#sla-monitor-issues)
- [Photo Upload Issues](#photo-upload-issues)
- [Permission Errors](#permission-errors)
- [Migration Issues](#migration-issues)
- [Port Conflicts](#port-conflicts)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)

---

## Database Issues

### Issue: Cannot connect to database

**Error message:**
```
Error: Unable to connect to database
ER_ACCESS_DENIED_ERROR: Access denied for user 'root'@'localhost'
```

**Possible causes:**
1. Incorrect database credentials
2. MySQL server not running
3. Database doesn't exist

**Solutions:**

1. **Check MySQL is running:**
   ```bash
   # Check MySQL status (Linux)
   sudo systemctl status mysql

   # Check MySQL status (Windows)
   net start | findstr MySQL
   ```

2. **Verify credentials in .env file:**
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=workorder_dev
   DB_USER=root
   DB_PASSWORD=your_actual_password
   ```

3. **Test MySQL connection manually:**
   ```bash
   mysql -u root -p
   # Enter password when prompted
   ```

4. **Create database if it doesn't exist:**
   ```sql
   CREATE DATABASE workorder_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

5. **Grant permissions:**
   ```sql
   GRANT ALL PRIVILEGES ON workorder_dev.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

---

### Issue: Migration failed

**Error message:**
```
ERROR: Table 'workorder_dev.SequelizeMeta' doesn't exist
```

**Solution:**

1. **Check database exists:**
   ```bash
   mysql -u root -p -e "SHOW DATABASES LIKE 'workorder_dev';"
   ```

2. **Run migrations fresh:**
   ```bash
   cd backend
   npm run db:migrate
   ```

3. **If migrations are stuck, reset:**
   ```bash
   # WARNING: This will delete all data
   mysql -u root -p workorder_dev -e "DROP DATABASE workorder_dev;"
   mysql -u root -p -e "CREATE DATABASE workorder_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   npm run db:migrate
   npm run db:seed
   ```

---

### Issue: Slow database queries

**Symptoms:**
- API responses taking > 1 second
- High CPU usage on MySQL

**Solutions:**

1. **Check for missing indexes:**
   ```sql
   SHOW INDEX FROM work_orders;
   ```

2. **Enable slow query log:**
   ```sql
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 1;
   SHOW VARIABLES LIKE 'slow_query_log_file';
   ```

3. **Analyze slow queries:**
   ```bash
   sudo tail -f /var/log/mysql/mysql-slow.log
   ```

4. **Optimize tables:**
   ```sql
   OPTIMIZE TABLE work_orders;
   OPTIMIZE TABLE status_history;
   ```

---

## Redis Issues

### Issue: Redis connection failed

**Error message:**
```
Error: Redis connection failed
ECONNREFUSED: Connection refused
```

**Possible causes:**
1. Redis server not running
2. Incorrect Redis configuration
3. Port conflict

**Solutions:**

1. **Check Redis is running:**
   ```bash
   redis-cli ping
   # Expected: PONG
   ```

2. **Start Redis:**
   ```bash
   # Linux
   sudo systemctl start redis-server

   # Windows (if using WSL)
   redis-server --daemonize yes

   # macOS
   brew services start redis
   ```

3. **Check Redis configuration:**
   ```env
   # In .env file
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

4. **Test Redis connection:**
   ```bash
   redis-cli -h localhost -p 6379 ping
   ```

5. **Check Redis logs:**
   ```bash
   # Linux
   sudo tail -f /var/log/redis/redis-server.log

   # macOS
   tail -f /usr/local/var/log/redis.log
   ```

---

### Issue: Redis memory issues

**Error message:**
```
OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**

1. **Check Redis memory usage:**
   ```bash
   redis-cli INFO memory | grep used_memory_human
   ```

2. **Increase maxmemory:**
   ```bash
   redis-cli CONFIG SET maxmemory 2gb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

3. **Make permanent in redis.conf:**
   ```
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   ```

4. **Clear Redis cache:**
   ```bash
   redis-cli FLUSHDB
   ```

---

## WeChat Login Issues

### Issue: WeChat login fails

**Error message:**
```
Error: WeChat authentication failed
code: 40029, message: invalid code
```

**Possible causes:**
1. Invalid WeChat code
2. Incorrect AppID or Secret
3. Code already used (codes are single-use)
4. Network connectivity issues

**Solutions:**

1. **Verify WeChat credentials in .env:**
   ```env
   WECHAT_APPID=wx1234567890abcdef
   WECHAT_SECRET=your_wechat_secret_here
   ```

2. **Check WeChat code is fresh:**
   - WeChat codes expire after 5 minutes
   - Codes can only be used once
   - Request new code from WeChat

3. **Test WeChat API directly:**
   ```bash
   curl "https://api.weixin.qq.com/sns/jscode2session?appid=YOUR_APPID&secret=YOUR_SECRET&js_code=CODE&grant_type=authorization_code"
   ```

4. **Check backend logs:**
   ```bash
   tail -f backend/logs/combined.log | grep "WeChat"
   ```

5. **Verify server domain whitelist in WeChat platform:**
   - Log in to https://mp.weixin.qq.com/
   - Navigate to: 开发 > 开发管理 > 开发设置 > 服务器域名
   - Ensure your API domain is whitelisted

---

### Issue: User not found after login

**Error message:**
```
Error: User not found
No user record for openid: oXXXXXXXXXXXXXXXXX
```

**Possible causes:**
1. First-time user (not in database)
2. Database seeder not run
3. User deactivated

**Solutions:**

1. **For test users, run seeders:**
   ```bash
   cd backend
   npm run db:seed
   ```

2. **Check if user exists in database:**
   ```sql
   SELECT * FROM users WHERE wechat_openid = 'test_openid_property_staff';
   ```

3. **For new production users:**
   - Create user account through admin interface
   - Or implement auto-registration flow

4. **Check user is active:**
   ```sql
   SELECT id, name, wechat_openid, active FROM users WHERE active = false;
   ```

---

## SLA Monitor Issues

### Issue: SLA monitor not running

**Symptoms:**
- No SLA check logs in console
- Overdue work orders not being flagged

**Solutions:**

1. **Check backend logs:**
   ```bash
   tail -f backend/logs/combined.log | grep "SLA"
   ```

   Expected output every minute:
   ```
   [2025-11-13 10:00:00] info: Running SLA monitor check...
   [2025-11-13 10:00:00] info: SLA check completed
   ```

2. **Verify job is initialized:**
   Check `backend/src/app.js` - `initializeJobs()` function should be called

3. **Check cron schedule:**
   In `backend/src/jobs/slaMonitor.js`:
   ```javascript
   cron.schedule('* * * * *', async () => {
     // Runs every minute
   });
   ```

4. **Manually trigger SLA check:**
   ```bash
   # In Node.js REPL
   node
   > const slaMonitor = require('./backend/src/jobs/slaMonitor');
   > slaMonitor.checkSLAViolations();
   ```

5. **Restart backend server:**
   ```bash
   pm2 restart workorder-backend
   # or
   npm run dev
   ```

---

### Issue: Incorrect SLA deadlines

**Symptoms:**
- SLA deadlines not calculated correctly
- Work orders marked overdue incorrectly

**Solutions:**

1. **Check SLA rules in database:**
   ```sql
   SELECT * FROM sla_rules;
   ```

2. **Verify fault type and priority mapping:**
   ```sql
   SELECT wo.id, wo.order_number, wo.priority, ft.type_name, wo.sla_deadline
   FROM work_orders wo
   JOIN fault_types ft ON wo.fault_type_id = ft.id
   WHERE wo.id = 1;
   ```

3. **Check timezone settings:**
   ```javascript
   // In backend/src/config/database.js
   timezone: '+08:00'  // Ensure correct timezone
   ```

4. **Re-run seeders for SLA rules:**
   ```bash
   npm run db:seed:undo
   npm run db:seed
   ```

---

## Photo Upload Issues

### Issue: Photo upload fails

**Error message:**
```
Error: Failed to upload photo
COS upload error: InvalidAccessKeyId
```

**Possible causes:**
1. Invalid COS credentials
2. Incorrect bucket configuration
3. File size too large
4. Network connectivity issues

**Solutions:**

1. **Verify COS credentials in .env:**
   ```env
   COS_SECRET_ID=your_cos_secret_id
   COS_SECRET_KEY=your_cos_secret_key
   COS_BUCKET=your-bucket-name-1234567890
   COS_REGION=ap-guangzhou
   ```

2. **Check bucket exists:**
   - Log in to Tencent Cloud Console
   - Navigate to: 对象存储 > 存储桶列表
   - Verify bucket name and region

3. **Check bucket permissions:**
   - Ensure bucket has public read access (if needed)
   - Or configure CORS for your domain

4. **Check file size limit:**
   In `backend/src/utils/photoUpload.js`:
   ```javascript
   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
   ```

5. **Test COS upload manually:**
   ```javascript
   const COS = require('cos-nodejs-sdk-v5');
   const cos = new COS({
     SecretId: 'your_secret_id',
     SecretKey: 'your_secret_key',
   });

   cos.putObject({
     Bucket: 'your-bucket',
     Region: 'ap-guangzhou',
     Key: 'test.txt',
     Body: 'Hello World',
   }, (err, data) => {
     console.log(err || data);
   });
   ```

---

### Issue: Photos not displaying in miniprogram

**Symptoms:**
- Upload successful but images don't show
- Broken image icons

**Solutions:**

1. **Check image URL format:**
   ```javascript
   // Should be full HTTPS URL
   https://your-bucket-1234567890.cos.ap-guangzhou.myqcloud.com/photos/xxx.jpg
   ```

2. **Verify downloadFile domain in WeChat:**
   - Log in to https://mp.weixin.qq.com/
   - Navigate to: 开发 > 开发管理 > 开发设置 > 服务器域名
   - Add downloadFile domain: `https://your-bucket.cos.region.myqcloud.com`

3. **Check bucket CORS configuration:**
   ```json
   {
     "AllowedOrigins": ["*"],
     "AllowedMethods": ["GET", "PUT", "POST"],
     "AllowedHeaders": ["*"],
     "ExposeHeaders": ["ETag"],
     "MaxAgeSeconds": 3600
   }
   ```

4. **Test image URL directly:**
   ```bash
   curl -I "https://your-bucket.cos.region.myqcloud.com/photos/xxx.jpg"
   ```

---

## Permission Errors

### Issue: Permission denied

**Error message:**
```
Error: Permission denied
User does not have required permission: submit_work_orders
```

**Possible causes:**
1. User role doesn't have required permission
2. Incorrect role assignment
3. Permission not configured in database

**Solutions:**

1. **Check user's role:**
   ```sql
   SELECT u.id, u.name, r.role_name
   FROM users u
   JOIN roles r ON u.role_id = r.id
   WHERE u.id = 4;
   ```

2. **Check role permissions:**
   ```sql
   SELECT id, role_name, permissions
   FROM roles
   WHERE id = 4;
   ```

3. **Verify permission in permissions array:**
   Property Staff role should have:
   ```json
   {
     "permissions": [
       "submit_work_orders",
       "view_own_work_orders",
       "review_work_orders"
     ]
   }
   ```

4. **Re-run role seeder:**
   ```bash
   npm run db:seed:undo
   npm run db:seed
   ```

5. **Check RBAC middleware:**
   In `backend/src/middleware/rbac.js` - ensure permission checking is correct

---

### Issue: Unauthorized access

**Error message:**
```
Error: Unauthorized
No token provided
```

**Solutions:**

1. **Check Authorization header:**
   ```bash
   curl -X GET http://localhost:3000/api/workorders \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. **Verify token format:**
   - Should start with "Bearer "
   - Followed by JWT token

3. **Check token expiration:**
   ```javascript
   // Decode token (using jwt.io or library)
   const decoded = jwt.decode(token);
   console.log('Expires at:', new Date(decoded.exp * 1000));
   ```

4. **Re-login to get fresh token:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/wechat \
     -H "Content-Type: application/json" \
     -d '{"code": "test_code_property_staff"}'
   ```

---

## Migration Issues

### Issue: Migration already exists

**Error message:**
```
Error: Migration 20251112000001-create-roles already exists
```

**Solutions:**

1. **Check SequelizeMeta table:**
   ```sql
   SELECT * FROM SequelizeMeta;
   ```

2. **Undo last migration:**
   ```bash
   npm run db:migrate:undo
   ```

3. **Undo all migrations:**
   ```bash
   npm run db:migrate:undo:all
   ```

4. **Re-run migrations:**
   ```bash
   npm run db:migrate
   ```

---

### Issue: Migration version conflict

**Solution:**

1. **Reset SequelizeMeta table:**
   ```sql
   TRUNCATE TABLE SequelizeMeta;
   ```

2. **Re-run all migrations:**
   ```bash
   npm run db:migrate
   ```

---

## Port Conflicts

### Issue: Port already in use

**Error message:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. **Find process using port:**
   ```bash
   # Linux/macOS
   lsof -i :3000

   # Windows
   netstat -ano | findstr :3000
   ```

2. **Kill process:**
   ```bash
   # Linux/macOS
   kill -9 $(lsof -t -i:3000)

   # Windows
   taskkill /PID <PID> /F
   ```

3. **Change port in .env:**
   ```env
   PORT=3001
   ```

4. **Restart server:**
   ```bash
   npm run dev
   ```

---

## Performance Issues

### Issue: Slow API responses

**Symptoms:**
- API taking > 1 second to respond
- High CPU usage
- High memory usage

**Solutions:**

1. **Check database queries:**
   - Enable slow query log (see Database Issues)
   - Add missing indexes
   - Optimize N+1 queries

2. **Check Redis cache:**
   ```bash
   redis-cli INFO stats | grep keyspace_hits
   redis-cli INFO stats | grep keyspace_misses
   ```

   Calculate hit rate:
   ```
   Hit Rate = hits / (hits + misses) * 100
   # Should be > 80%
   ```

3. **Monitor Node.js performance:**
   ```bash
   pm2 monit
   ```

4. **Check for memory leaks:**
   ```bash
   pm2 logs workorder-backend --lines 1000 | grep "memory"
   ```

5. **Restart application:**
   ```bash
   pm2 restart workorder-backend
   ```

---

### Issue: High memory usage

**Solutions:**

1. **Check PM2 memory usage:**
   ```bash
   pm2 status
   ```

2. **Set memory limit:**
   ```javascript
   // In ecosystem.config.js
   max_memory_restart: '500M'
   ```

3. **Clear Redis cache:**
   ```bash
   redis-cli FLUSHDB
   ```

4. **Optimize database connections:**
   ```javascript
   // In backend/src/config/database.js
   pool: {
     max: 5,
     min: 0,
     acquire: 30000,
     idle: 10000
   }
   ```

---

## Deployment Issues

### Issue: PM2 not starting application

**Error message:**
```
Error: script not found: ./src/app.js
```

**Solutions:**

1. **Check working directory:**
   ```bash
   pwd
   # Should be: /var/www/workorder-system/backend
   ```

2. **Verify app.js exists:**
   ```bash
   ls -l src/app.js
   ```

3. **Check PM2 ecosystem file:**
   ```javascript
   // ecosystem.config.js
   script: './src/app.js',  // Correct path
   ```

4. **Start with full path:**
   ```bash
   pm2 start /var/www/workorder-system/backend/src/app.js --name workorder-backend
   ```

---

### Issue: Nginx 502 Bad Gateway

**Solutions:**

1. **Check backend is running:**
   ```bash
   pm2 status
   curl http://localhost:3000/api/health
   ```

2. **Check Nginx error log:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. **Verify upstream configuration:**
   ```nginx
   upstream workorder_backend {
       server localhost:3000;  # Ensure port matches backend
   }
   ```

4. **Test Nginx configuration:**
   ```bash
   sudo nginx -t
   ```

5. **Restart Nginx:**
   ```bash
   sudo systemctl restart nginx
   ```

---

### Issue: SSL certificate errors

**Error message:**
```
SSL certificate problem: unable to get local issuer certificate
```

**Solutions:**

1. **Verify certificate files exist:**
   ```bash
   ls -l /etc/ssl/certs/yourdomain.crt
   ls -l /etc/ssl/private/yourdomain.key
   ```

2. **Check certificate validity:**
   ```bash
   openssl x509 -in /etc/ssl/certs/yourdomain.crt -text -noout
   ```

3. **Verify Nginx SSL configuration:**
   ```nginx
   ssl_certificate /etc/ssl/certs/yourdomain.crt;
   ssl_certificate_key /etc/ssl/private/yourdomain.key;
   ```

4. **Reload Nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check application logs:**
   ```bash
   tail -f backend/logs/combined.log
   tail -f backend/logs/error.log
   ```

2. **Enable debug logging:**
   ```env
   # In .env
   LOG_LEVEL=debug
   ```

3. **Check GitHub Issues:**
   - Search for similar issues
   - Create new issue with error details

4. **Contact support:**
   - Email: support@example.com
   - Include: error message, logs, steps to reproduce

---

## Additional Resources

- [Testing Guide](./TESTING_GUIDE.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Test Accounts](./TEST_ACCOUNTS.md)
- [API Documentation](./API_DOCUMENTATION.md)
