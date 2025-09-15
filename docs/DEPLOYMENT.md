# Discord Drive Bridge - Deployment Guide

## Overview

This guide covers the complete deployment process for the Discord Drive Bridge bot, including production setup, security configuration, monitoring, and maintenance.

## Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB+ available space
- **Network**: Stable internet connection

### Software Requirements
- **Node.js**: 18.0.0 or higher
- **PostgreSQL**: 13.0 or higher
- **Redis**: 6.0 or higher
- **Docker**: 20.10 or higher (optional)
- **Docker Compose**: 2.0 or higher (optional)

### External Services
- **Discord Application**: Bot token and permissions
- **Google Cloud Project**: OAuth credentials and Drive API
- **Domain Name**: For OAuth callbacks (production)
- **SSL Certificate**: For HTTPS (production)

## Environment Setup

### 1. Discord Application Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to "Bot" section
4. Create a bot and copy the token
5. Set bot permissions:
   - `Send Messages`
   - `Use Slash Commands`
   - `Read Message History`
   - `Attach Files`
   - `Embed Links`
6. Navigate to "OAuth2" > "General"
7. Copy the Client ID
8. Add redirect URI: `https://yourdomain.com/auth/callback`

### 2. Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `https://yourdomain.com/auth/callback`
   - `http://localhost:3000/auth/callback` (development)
7. Copy Client ID and Client Secret

### 3. Database Setup

#### PostgreSQL Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE discord_drive_bridge;
CREATE USER bot_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE discord_drive_bridge TO bot_user;
\q
```

#### Redis Installation
```bash
# Ubuntu/Debian
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
```

## Configuration

### 1. Environment Variables

Create `.env` file with the following variables:

```env
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback

# Database Configuration
DATABASE_URL=postgresql://bot_user:secure_password@localhost:5432/discord_drive_bridge
DATABASE_ENCRYPTION_KEY=your_32_byte_hex_encryption_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Security Configuration
JWT_SECRET=your_jwt_secret_here
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
MAX_FILE_SIZE=104857600

# Server Configuration
PORT=3000
NODE_ENV=production
BASE_URL=https://yourdomain.com

# Monitoring (Optional)
SENTRY_DSN=your_sentry_dsn_here
PROMETHEUS_PORT=9090
```

### 2. Generate Encryption Keys

```bash
# Generate 32-byte hex encryption key
openssl rand -hex 32

# Generate JWT secret
openssl rand -base64 64
```

### 3. SSL Certificate Setup

#### Using Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates will be stored in:
# /etc/letsencrypt/live/yourdomain.com/
```

#### Using Nginx (Optional)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### 1. Clone Repository
```bash
git clone https://github.com/your-username/discord-drive-bridge.git
cd discord-drive-bridge
```

#### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your configuration
```

#### 3. Start Services
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

#### 4. Run Database Migrations
```bash
# Run migrations
docker-compose exec app npm run db:migrate

# (Optional) Seed database
docker-compose exec app npm run db:seed
```

### Method 2: Manual Installation

#### 1. Clone and Install
```bash
git clone https://github.com/your-username/discord-drive-bridge.git
cd discord-drive-bridge
npm install
npm run build
```

#### 2. Database Setup
```bash
# Run migrations
npm run db:migrate

# (Optional) Seed database
npm run db:seed
```

#### 3. Start Application
```bash
# Development
npm run dev

# Production
npm start
```

### Method 3: PM2 Process Manager

#### 1. Install PM2
```bash
npm install -g pm2
```

#### 2. Create PM2 Configuration
```json
{
  "name": "discord-drive-bridge",
  "script": "dist/index.js",
  "instances": 1,
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production"
  },
  "log_file": "logs/combined.log",
  "error_file": "logs/error.log",
  "out_file": "logs/out.log",
  "log_date_format": "YYYY-MM-DD HH:mm:ss Z"
}
```

#### 3. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Production Configuration

### 1. Security Hardening

#### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5432  # PostgreSQL (if external access needed)
sudo ufw enable
```

#### Database Security
```sql
-- Create read-only user for monitoring
CREATE USER monitor_user WITH PASSWORD 'monitor_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitor_user;

-- Enable SSL for PostgreSQL
-- Edit postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

#### Application Security
```bash
# Set proper file permissions
chmod 600 .env
chmod 700 logs/
chown -R bot_user:bot_user /path/to/app

# Disable unnecessary services
sudo systemctl disable apache2
sudo systemctl disable nginx  # If not using
```

### 2. Monitoring Setup

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'discord-drive-bridge'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 5s
```

#### Grafana Dashboard
1. Install Grafana
2. Import Discord Drive Bridge dashboard
3. Configure data source (Prometheus)
4. Set up alerts for critical metrics

#### Log Management
```bash
# Install logrotate
sudo apt install logrotate

# Configure log rotation
sudo nano /etc/logrotate.d/discord-drive-bridge
```

```bash
/path/to/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 bot_user bot_user
    postrotate
        pm2 reload discord-drive-bridge
    endscript
}
```

### 3. Backup Strategy

#### Database Backups
```bash
#!/bin/bash
# backup_db.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/database"
mkdir -p $BACKUP_DIR

pg_dump discord_drive_bridge > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

#### Application Backups
```bash
#!/bin/bash
# backup_app.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/application"
APP_DIR="/path/to/app"

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C $APP_DIR .

# Keep only last 7 days
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +7 -delete
```

#### Automated Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup_db.sh
0 3 * * * /path/to/backup_app.sh
```

## Health Checks

### 1. Application Health
```bash
# Check if application is running
curl -f http://localhost:3000/health || exit 1

# Check metrics endpoint
curl -f http://localhost:9090/metrics || exit 1
```

### 2. Database Health
```bash
# Check PostgreSQL connection
pg_isready -h localhost -p 5432 -U bot_user

# Check database size
psql -h localhost -U bot_user -d discord_drive_bridge -c "SELECT pg_size_pretty(pg_database_size('discord_drive_bridge'));"
```

### 3. Redis Health
```bash
# Check Redis connection
redis-cli ping

# Check Redis memory usage
redis-cli info memory
```

## Maintenance

### 1. Regular Updates
```bash
# Update application
git pull origin main
npm install
npm run build
pm2 reload discord-drive-bridge

# Update dependencies
npm audit
npm update
```

### 2. Database Maintenance
```sql
-- Analyze tables for better performance
ANALYZE;

-- Vacuum database
VACUUM ANALYZE;

-- Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

### 3. Log Rotation
```bash
# Manual log rotation
pm2 reload discord-drive-bridge

# Check log sizes
du -sh logs/*
```

## Troubleshooting

### Common Issues

#### 1. Bot Not Responding
```bash
# Check if bot is running
pm2 status

# Check logs
pm2 logs discord-drive-bridge

# Restart bot
pm2 restart discord-drive-bridge
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U bot_user -d discord_drive_bridge

# Check logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log
```

#### 3. Redis Connection Issues
```bash
# Check Redis status
sudo systemctl status redis-server

# Check connection
redis-cli ping

# Check logs
sudo tail -f /var/log/redis/redis-server.log
```

#### 4. OAuth Issues
- Verify Google OAuth credentials
- Check redirect URI configuration
- Ensure HTTPS is properly configured
- Check firewall settings

### Performance Issues

#### 1. High Memory Usage
```bash
# Check memory usage
free -h
pm2 monit

# Check for memory leaks
node --inspect dist/index.js
```

#### 2. Slow Database Queries
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### 3. Redis Performance
```bash
# Check Redis performance
redis-cli --latency-history -i 1

# Check memory usage
redis-cli info memory
```

## Security Checklist

### Pre-Deployment
- [ ] All environment variables secured
- [ ] SSL certificates valid and configured
- [ ] Firewall rules configured
- [ ] Database access restricted
- [ ] Redis access restricted
- [ ] File permissions set correctly
- [ ] Log rotation configured
- [ ] Backup strategy implemented

### Post-Deployment
- [ ] Health checks passing
- [ ] Monitoring dashboards active
- [ ] Alert rules configured
- [ ] Security scanning completed
- [ ] Performance benchmarks met
- [ ] Backup verification successful
- [ ] Documentation updated
- [ ] Team training completed

## Scaling

### Horizontal Scaling
1. Use load balancer (Nginx/HAProxy)
2. Deploy multiple application instances
3. Use Redis Cluster for caching
4. Implement database read replicas

### Vertical Scaling
1. Increase server resources
2. Optimize database configuration
3. Tune Redis settings
4. Implement connection pooling

## Support

### Monitoring
- Prometheus metrics: `http://localhost:9090/metrics`
- Health check: `http://localhost:3000/health`
- Security stats: `http://localhost:3000/security/stats`

### Logs
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- PM2 logs: `pm2 logs discord-drive-bridge`

### Documentation
- API Documentation: `docs/API.md`
- Security Guide: `docs/SECURITY.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`

For additional support:
- GitHub Issues: [Repository Issues](https://github.com/your-username/discord-drive-bridge/issues)
- Documentation: [Project Wiki](https://github.com/your-username/discord-drive-bridge/wiki)
- Community: [Discord Server](https://discord.gg/your-server)