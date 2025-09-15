# Discord Drive Bridge - Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the Discord Drive Bridge bot. It covers authentication problems, file operations, performance issues, and system errors.

## Quick Diagnostics

### Health Check
```bash
# Check application health
curl -f http://localhost:3000/health

# Check metrics
curl -f http://localhost:9090/metrics

# Check security stats
curl -f http://localhost:3000/security/stats
```

### Service Status
```bash
# Check if services are running
pm2 status
docker-compose ps

# Check service logs
pm2 logs discord-drive-bridge
docker-compose logs -f app
```

## Common Issues

### 1. Bot Not Responding

#### Symptoms
- Bot doesn't respond to slash commands
- Commands show "This interaction failed"
- Bot appears offline in Discord

#### Diagnosis
```bash
# Check bot status
pm2 status discord-drive-bridge

# Check logs for errors
pm2 logs discord-drive-bridge --lines 50

# Check Discord connection
curl -f http://localhost:3000/health
```

#### Solutions

**Issue: Bot not running**
```bash
# Start the bot
pm2 start discord-drive-bridge
# or
docker-compose up -d app
```

**Issue: Invalid Discord token**
```bash
# Check token in .env file
grep DISCORD_TOKEN .env

# Verify token format (should be long string)
# Get new token from Discord Developer Portal
```

**Issue: Network connectivity**
```bash
# Check internet connection
ping google.com

# Check Discord API access
curl -I https://discord.com/api/v10/gateway
```

**Issue: Rate limiting**
```bash
# Check rate limit logs
grep "rate limit" logs/combined.log

# Wait for rate limit to reset
# Check rate limit status
curl http://localhost:3000/security/stats
```

### 2. Authentication Issues

#### Symptoms
- `/login` command fails
- OAuth flow doesn't complete
- "Authentication required" errors

#### Diagnosis
```bash
# Check OAuth configuration
grep GOOGLE_CLIENT_ID .env
grep GOOGLE_CLIENT_SECRET .env
grep GOOGLE_REDIRECT_URI .env

# Check OAuth logs
grep "oauth" logs/combined.log | tail -20
```

#### Solutions

**Issue: Invalid OAuth credentials**
```bash
# Verify credentials in Google Cloud Console
# Check redirect URI matches exactly
# Ensure Drive API is enabled
```

**Issue: Redirect URI mismatch**
```bash
# Check .env file
echo $GOOGLE_REDIRECT_URI

# Must match exactly in Google Cloud Console
# Include protocol (https://) and port if needed
```

**Issue: CSRF token validation**
```bash
# Check CSRF logs
grep "csrf" logs/combined.log

# Clear Redis cache if needed
redis-cli FLUSHALL
```

### 3. File Upload Issues

#### Symptoms
- Files fail to upload
- "File too large" errors
- "Invalid file type" errors
- Upload progress stops

#### Diagnosis
```bash
# Check file size limits
grep MAX_FILE_SIZE .env

# Check file type validation
grep "file.*blocked" logs/combined.log

# Check Google Drive API logs
grep "drive" logs/combined.log | tail -20
```

#### Solutions

**Issue: File too large**
```bash
# Check file size (must be < 100MB)
ls -lh filename.ext

# For large files, use chunked upload
# Check if chunked upload is working
grep "chunked" logs/combined.log
```

**Issue: Invalid file type**
```bash
# Check allowed file types in code
# Common blocked types: .exe, .bat, .cmd, .js, .jar
# Use allowed types: .pdf, .docx, .jpg, .png, etc.
```

**Issue: Google Drive API errors**
```bash
# Check API quota
curl "https://www.googleapis.com/drive/v3/about?fields=user,storageQuota" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Check API logs
grep "googleapis" logs/combined.log
```

### 4. File Download Issues

#### Symptoms
- Files don't download to DMs
- "File not found" errors
- Download progress stops

#### Diagnosis
```bash
# Check file search logs
grep "download" logs/combined.log | tail -20

# Check DM permissions
# User must allow DMs from bot
```

#### Solutions

**Issue: File not found**
```bash
# Check file exists in Google Drive
# Verify file name spelling
# Check if file is in specified folder
```

**Issue: DM permissions**
```bash
# User must enable DMs from bot
# Check Discord privacy settings
# Bot must have "Send Messages" permission
```

**Issue: Large file download**
```bash
# Check chunked download logs
grep "chunked.*download" logs/combined.log

# Large files use chunked download
# Check if streaming is working
```

### 5. Database Issues

#### Symptoms
- "Database connection failed" errors
- Slow response times
- Data not saving

#### Diagnosis
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check connection pool
grep "database" logs/combined.log | tail -20
```

#### Solutions

**Issue: Connection refused**
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check port 5432 is open
netstat -tlnp | grep 5432
```

**Issue: Authentication failed**
```bash
# Check database credentials
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL

# Reset password if needed
sudo -u postgres psql
ALTER USER bot_user PASSWORD 'new_password';
```

**Issue: Database not found**
```bash
# Create database
createdb discord_drive_bridge

# Run migrations
npm run db:migrate
```

### 6. Redis Issues

#### Symptoms
- "Redis connection failed" errors
- Rate limiting not working
- Cache misses

#### Diagnosis
```bash
# Check Redis connection
redis-cli ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Check Redis memory usage
redis-cli info memory
```

#### Solutions

**Issue: Redis not running**
```bash
# Start Redis
sudo systemctl start redis-server

# Check Redis status
sudo systemctl status redis-server
```

**Issue: Memory issues**
```bash
# Check Redis memory usage
redis-cli info memory

# Clear Redis cache if needed
redis-cli FLUSHALL

# Restart Redis
sudo systemctl restart redis-server
```

### 7. Performance Issues

#### Symptoms
- Slow response times
- High memory usage
- Timeout errors

#### Diagnosis
```bash
# Check system resources
free -h
top -p $(pgrep node)

# Check application metrics
curl http://localhost:9090/metrics | grep memory

# Check response times
grep "response.*time" logs/combined.log
```

#### Solutions

**Issue: High memory usage**
```bash
# Check for memory leaks
node --inspect dist/index.js

# Restart application
pm2 restart discord-drive-bridge

# Check for memory leaks in code
```

**Issue: Slow database queries**
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Analyze tables
ANALYZE;
```

**Issue: Redis performance**
```bash
# Check Redis performance
redis-cli --latency-history -i 1

# Check Redis memory usage
redis-cli info memory

# Restart Redis if needed
sudo systemctl restart redis-server
```

### 8. Security Issues

#### Symptoms
- CSRF token errors
- Rate limit exceeded
- Suspicious activity alerts

#### Diagnosis
```bash
# Check security logs
grep "security" logs/combined.log | tail -20

# Check rate limit status
curl http://localhost:3000/security/stats

# Check CSRF logs
grep "csrf" logs/combined.log
```

#### Solutions

**Issue: CSRF token errors**
```bash
# Clear CSRF tokens
redis-cli DEL "csrf_token:*"

# Check CSRF configuration
grep "csrf" src/middleware/securityMiddleware.ts
```

**Issue: Rate limit exceeded**
```bash
# Check rate limit configuration
grep "RATE_LIMIT" .env

# Clear rate limit data
redis-cli DEL "rate_limit:*"

# Wait for rate limit to reset
```

**Issue: Suspicious activity**
```bash
# Check security events
curl http://localhost:3000/security/stats

# Review security logs
grep "suspicious" logs/combined.log

# Check input validation
grep "validation" logs/combined.log
```

## Advanced Troubleshooting

### 1. Log Analysis

#### Application Logs
```bash
# View recent logs
tail -f logs/combined.log

# Filter by level
grep "ERROR" logs/combined.log
grep "WARN" logs/combined.log

# Filter by component
grep "DiscordService" logs/combined.log
grep "GoogleDriveService" logs/combined.log
```

#### System Logs
```bash
# Check system logs
sudo journalctl -u discord-drive-bridge

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### 2. Performance Profiling

#### Node.js Profiling
```bash
# Start with profiling
node --prof dist/index.js

# Generate profile report
node --prof-process isolate-*.log > profile.txt

# Analyze profile
cat profile.txt | head -50
```

#### Memory Profiling
```bash
# Start with memory profiling
node --inspect dist/index.js

# Connect with Chrome DevTools
# chrome://inspect
```

### 3. Network Diagnostics

#### Connectivity Tests
```bash
# Test Discord API
curl -I https://discord.com/api/v10/gateway

# Test Google APIs
curl -I https://www.googleapis.com/drive/v3

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Redis connection
redis-cli ping
```

#### DNS Resolution
```bash
# Check DNS resolution
nslookup discord.com
nslookup googleapis.com

# Check DNS configuration
cat /etc/resolv.conf
```

### 4. Configuration Validation

#### Environment Variables
```bash
# Check all required variables
grep -E "^(DISCORD|GOOGLE|DATABASE|REDIS|JWT)" .env

# Validate format
echo $DISCORD_TOKEN | wc -c  # Should be long
echo $GOOGLE_CLIENT_ID | wc -c  # Should be long
```

#### Database Schema
```bash
# Check database schema
psql $DATABASE_URL -c "\dt"

# Check migrations
psql $DATABASE_URL -c "SELECT * FROM knex_migrations;"
```

### 5. Backup and Recovery

#### Database Backup
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql $DATABASE_URL < backup_file.sql
```

#### Application Backup
```bash
# Backup application
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz .

# Restore application
tar -xzf app_backup_file.tar.gz
```

## Prevention

### 1. Monitoring Setup

#### Health Checks
```bash
# Set up health check monitoring
# Add to crontab: */5 * * * * curl -f http://localhost:3000/health || alert
```

#### Log Monitoring
```bash
# Set up log monitoring
# Monitor for ERROR and WARN levels
# Set up alerts for critical errors
```

### 2. Regular Maintenance

#### Database Maintenance
```sql
-- Weekly maintenance
ANALYZE;
VACUUM;

-- Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

#### Application Maintenance
```bash
# Regular restarts
pm2 restart discord-drive-bridge

# Log rotation
pm2 reload discord-drive-bridge

# Update dependencies
npm audit
npm update
```

### 3. Security Maintenance

#### Security Updates
```bash
# Regular security updates
npm audit fix

# Update dependencies
npm update

# Check for vulnerabilities
npm audit
```

#### Security Monitoring
```bash
# Monitor security events
curl http://localhost:3000/security/stats

# Check for suspicious activity
grep "suspicious" logs/combined.log
```

## Getting Help

### 1. Self-Service Resources

#### Documentation
- [API Documentation](API.md)
- [Security Guide](SECURITY.md)
- [Deployment Guide](DEPLOYMENT.md)

#### Logs and Metrics
- Application logs: `logs/combined.log`
- Health check: `http://localhost:3000/health`
- Metrics: `http://localhost:9090/metrics`
- Security stats: `http://localhost:3000/security/stats`

### 2. Community Support

#### GitHub
- [Issues](https://github.com/your-username/discord-drive-bridge/issues)
- [Discussions](https://github.com/your-username/discord-drive-bridge/discussions)
- [Wiki](https://github.com/your-username/discord-drive-bridge/wiki)

#### Discord
- [Discord Server](https://discord.gg/your-server)
- #support channel
- #troubleshooting channel

### 3. Professional Support

#### Contact Information
- **Email**: support@yourdomain.com
- **Phone**: +1-555-0123
- **Hours**: 24/7 for critical issues

#### Support Tiers
- **Community**: Free support via GitHub/Discord
- **Standard**: Email support within 24 hours
- **Premium**: Phone support within 4 hours
- **Enterprise**: Dedicated support team

## Issue Reporting

### 1. Bug Reports

#### Required Information
- **Version**: Bot version and Node.js version
- **Environment**: OS, database, Redis versions
- **Steps**: Detailed steps to reproduce
- **Logs**: Relevant log entries
- **Expected**: What should happen
- **Actual**: What actually happens

#### Template
```markdown
**Bug Report**

**Version**: 1.0.0
**Environment**: Ubuntu 20.04, Node.js 18.0.0, PostgreSQL 13.0, Redis 6.0

**Steps to Reproduce**:
1. Run `/upload` command
2. Attach large file (>50MB)
3. Wait for upload to complete

**Expected Behavior**:
File should upload successfully with progress indicator

**Actual Behavior**:
Upload fails with "File too large" error

**Logs**:
```
2024-01-01T00:00:00.000Z ERROR: File upload failed: File too large
```

**Additional Context**:
This happens with files larger than 50MB, but the limit should be 100MB.
```

### 2. Feature Requests

#### Required Information
- **Description**: Clear description of the feature
- **Use Case**: Why this feature is needed
- **Proposed Solution**: How you think it should work
- **Alternatives**: Other ways to achieve the same goal

#### Template
```markdown
**Feature Request**

**Description**:
Add support for file versioning in Google Drive

**Use Case**:
Users need to track file versions and restore previous versions

**Proposed Solution**:
Add `/version` command to list file versions and `/restore` command to restore previous versions

**Alternatives**:
Use Google Drive's built-in version history through the web interface
```

### 3. Security Issues

#### Reporting Process
1. **Email**: Send to security@yourdomain.com
2. **Response**: Acknowledge within 24 hours
3. **Investigation**: Investigate within 72 hours
4. **Resolution**: Provide fix within 30 days
5. **Disclosure**: Coordinate public disclosure

#### Required Information
- **Description**: Clear description of the security issue
- **Impact**: Potential impact and severity
- **Steps**: Steps to reproduce (if applicable)
- **Evidence**: Screenshots, logs, or other evidence
- **Contact**: How to reach you for follow-up

## Conclusion

This troubleshooting guide covers the most common issues and their solutions. For issues not covered here, please check the logs, review the documentation, or contact support.

Remember to:
- Check logs first
- Verify configuration
- Test connectivity
- Monitor resources
- Keep backups
- Update regularly

For additional help, refer to the other documentation or contact the support team.
