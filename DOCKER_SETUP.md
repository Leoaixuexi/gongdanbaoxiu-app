# Docker 部署指南

本文档说明如何使用 Docker 和 Docker Compose 部署工单报修管理系统。

## 📋 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

## 🚀 快速开始

### 1. 启动所有服务

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
```

### 2. 初始化数据库

```bash
# 进入后端容器
docker-compose exec backend sh

# 运行数据库迁移
npm run db:migrate

# 运行种子数据
npm run db:seed

# 退出容器
exit
```

### 3. 验证部署

访问以下地址验证服务是否正常运行：

- **后端 API**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 4. (可选) 启动管理工具

```bash
# 启动 pgAdmin 和 Redis Commander
docker-compose --profile tools up -d

# 访问工具
# - pgAdmin: http://localhost:5050 (admin@workorder.local / admin)
# - Redis Commander: http://localhost:8081
```

## 📦 服务说明

### Backend (后端 API)
- **端口**: 3000
- **容器名**: workorder-backend
- **健康检查**: 每 30 秒检查一次
- **日志**: `./backend/logs`

### PostgreSQL (数据库)
- **端口**: 5432
- **容器名**: workorder-postgres
- **数据库名**: workorder_db
- **用户名**: workorder_user
- **密码**: workorder_password
- **数据卷**: postgres_data

### Redis (缓存)
- **端口**: 6379
- **容器名**: workorder-redis
- **密码**: redis_password
- **数据卷**: redis_data
- **持久化**: AOF 模式

## 🔧 常用命令

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f [service_name]

# 查看资源使用
docker-compose stats
```

### 数据库操作

```bash
# 连接到 PostgreSQL
docker-compose exec postgres psql -U workorder_user -d workorder_db

# 备份数据库
docker-compose exec postgres pg_dump -U workorder_user workorder_db > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U workorder_user workorder_db < backup.sql

# 运行迁移
docker-compose exec backend npm run db:migrate

# 回滚迁移
docker-compose exec backend npm run db:migrate:undo
```

### Redis 操作

```bash
# 连接到 Redis
docker-compose exec redis redis-cli -a redis_password

# 查看所有键
docker-compose exec redis redis-cli -a redis_password KEYS '*'

# 清空缓存
docker-compose exec redis redis-cli -a redis_password FLUSHALL
```

### 调试

```bash
# 进入后端容器
docker-compose exec backend sh

# 查看后端日志
docker-compose logs -f backend

# 重新构建镜像
docker-compose build --no-cache backend

# 查看容器详情
docker-compose exec backend env
```

## 🔒 环境变量

在生产环境中，请修改以下环境变量：

```yaml
# docker-compose.yml 中的关键变量
JWT_SECRET: 更改为强随机字符串
POSTGRES_PASSWORD: 更改数据库密码
REDIS_PASSWORD: 更改 Redis 密码
NODE_ENV: 设置为 production
```

建议创建 `.env` 文件：

```bash
# .env 示例
NODE_ENV=production
JWT_SECRET=your-production-secret-here
DB_PASSWORD=your-db-password
REDIS_PASSWORD=your-redis-password
WECHAT_APP_ID=your-wechat-appid
WECHAT_APP_SECRET=your-wechat-secret
```

然后在 `docker-compose.yml` 中引用：

```yaml
environment:
  - JWT_SECRET=${JWT_SECRET}
  - DB_PASSWORD=${DB_PASSWORD}
```

## 📊 监控和维护

### 健康检查

所有服务都配置了健康检查：

```bash
# 查看健康状态
docker-compose ps

# 手动触发健康检查
docker inspect --format='{{json .State.Health}}' workorder-backend
```

### 日志管理

```bash
# 查看最近 100 行日志
docker-compose logs --tail=100 backend

# 实时查看日志
docker-compose logs -f --tail=50 backend

# 查看所有服务日志
docker-compose logs -f
```

### 数据备份

```bash
# 创建备份脚本
./scripts/backup.sh

# 备份内容：
# - PostgreSQL 数据库
# - Redis 数据
# - 日志文件
```

## 🔄 更新部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 停止服务
docker-compose down

# 3. 重新构建镜像
docker-compose build

# 4. 启动服务
docker-compose up -d

# 5. 运行迁移（如有）
docker-compose exec backend npm run db:migrate
```

## ⚠️ 故障排除

### 容器启动失败

```bash
# 查看容器日志
docker-compose logs backend

# 检查容器状态
docker-compose ps

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 数据库连接失败

```bash
# 检查数据库是否就绪
docker-compose exec postgres pg_isready -U workorder_user

# 查看数据库日志
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres
```

### 端口冲突

```bash
# 检查端口占用
netstat -an | grep 3000
netstat -an | grep 5432

# 修改 docker-compose.yml 中的端口映射
ports:
  - "3001:3000"  # 将宿主机端口改为 3001
```

## 🧹 清理

```bash
# 停止并删除容器
docker-compose down

# 删除容器和数据卷
docker-compose down -v

# 删除所有相关镜像
docker-compose down --rmi all

# 完全清理（包括数据）
docker-compose down -v --rmi all
docker volume prune
```

## 📝 生产环境建议

1. **使用外部数据库**: 生产环境建议使用云数据库服务（如 AWS RDS、阿里云 RDS）
2. **配置反向代理**: 使用 Nginx 或 Traefik 作为反向代理
3. **启用 HTTPS**: 配置 SSL/TLS 证书
4. **资源限制**: 为容器设置 CPU 和内存限制
5. **日志管理**: 使用日志聚合工具（如 ELK Stack）
6. **监控告警**: 集成 Prometheus + Grafana 监控
7. **自动备份**: 配置定时备份任务
8. **密钥管理**: 使用 Docker Secrets 或外部密钥管理服务

## 📚 更多资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [项目部署文档](./DEPLOYMENT.md)
- [API 文档](./docs/api/)
