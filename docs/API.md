# Discord Drive Bridge API Documentation

## Overview

The Discord Drive Bridge provides a comprehensive REST API for managing Google Drive files through Discord commands. The API is built with TypeScript and includes enterprise-grade security, monitoring, and performance features.

## Base URL

```
Production: https://yourbot.com
Development: http://localhost:3000
```

## Authentication

All API endpoints require proper authentication through Discord OAuth 2.0 with PKCE. The bot handles authentication automatically through Discord slash commands.

## Rate Limiting

- **Per User**: 100 requests per 15 minutes
- **Per Command**: Varies by command complexity
- **Global**: 1000 requests per minute
- **Redis Cached**: High-performance rate limiting

## Security

- **CSRF Protection**: All state-changing operations require CSRF tokens
- **Input Validation**: All inputs are sanitized and validated
- **Security Headers**: XSS, clickjacking, and MIME sniffing protection
- **Audit Logging**: All operations are logged for security monitoring

## Endpoints

### OAuth Endpoints

#### Start OAuth Flow
```http
GET /auth/start/:userId
```

Initiates the OAuth 2.0 flow for a Discord user.

**Parameters:**
- `userId` (string, required): Discord user ID

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "user_id:random_string"
  }
}
```

**Security:**
- CSRF protection enabled
- State parameter validation
- Rate limiting applied

#### OAuth Callback
```http
GET /auth/callback
```

Handles the OAuth callback from Google.

**Query Parameters:**
- `code` (string): Authorization code from Google
- `state` (string): State parameter for CSRF protection
- `error` (string, optional): Error message if OAuth failed

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful"
}
```

**Security:**
- CSRF protection enabled
- State parameter validation
- Error sanitization

### Health & Monitoring

#### Health Check
```http
GET /health
```

Returns the current health status of the service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "discord": "healthy"
  },
  "metrics": {
    "memoryUsage": "45MB",
    "cpuUsage": "2.5%",
    "activeConnections": 150
  }
}
```

#### Prometheus Metrics
```http
GET /metrics
```

Returns Prometheus-formatted metrics for monitoring.

**Response:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",endpoint="/health",status="200"} 150

# HELP discord_commands_total Total number of Discord commands executed
# TYPE discord_commands_total counter
discord_commands_total{command="upload",status="success"} 45
```

#### Security Statistics
```http
GET /security/stats
```

Returns security analytics and statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 1250,
    "eventsByType": {
      "login_attempt": 800,
      "csrf_violation": 15,
      "suspicious_activity": 5,
      "rate_limit_exceeded": 30,
      "file_upload_blocked": 10
    },
    "eventsBySeverity": {
      "low": 1000,
      "medium": 200,
      "high": 45,
      "critical": 5
    },
    "recentEvents": [...],
    "lockedAccounts": 2
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Discord Commands

### Authentication Commands

#### `/login`
Connect your Google Drive account.

**Parameters:**
- None

**Response:**
- Sends OAuth URL to user's DMs
- Creates secure authentication session

**Security:**
- Rate limiting: 5 attempts per 15 minutes
- CSRF protection
- Audit logging

#### `/logout`
Disconnect your Google Drive account.

**Parameters:**
- None

**Response:**
- Revokes all tokens
- Clears user session
- Confirmation message

**Security:**
- User authentication required
- Token revocation
- Audit logging

#### `/status`
Check connection status and storage information.

**Parameters:**
- None

**Response:**
```json
{
  "connected": true,
  "email": "user@example.com",
  "storage": {
    "used": "2.5GB",
    "total": "15GB",
    "percentage": 16.7
  },
  "lastSync": "2024-01-01T00:00:00.000Z"
}
```

### File Management Commands

#### `/upload`
Upload a file to Google Drive.

**Parameters:**
- `file` (attachment, required): File to upload
- `folder` (string, optional): Target folder name
- `description` (string, optional): File description

**Response:**
- Progress indicator for large files
- Success confirmation with file details
- Direct link to file in Google Drive

**Security:**
- File type validation
- Size limits (100MB max)
- Dangerous extension blocking
- Input sanitization

**Features:**
- Chunked upload for files >5MB
- Progress tracking
- Automatic folder creation

#### `/download`
Download a file from Google Drive.

**Parameters:**
- `filename` (string, required): Name of file to download
- `folder` (string, optional): Source folder name

**Response:**
- File sent to user's DMs
- Progress indicator for large files
- File metadata

**Security:**
- User authentication required
- File access validation
- Rate limiting

**Features:**
- Chunked download for files >10MB
- Progress tracking
- DM delivery

#### `/delete`
Delete a file from Google Drive.

**Parameters:**
- `filename` (string, required): Name of file to delete
- `folder` (string, optional): Source folder name

**Response:**
- Confirmation prompt
- Success/error message

**Security:**
- User authentication required
- Confirmation required
- Audit logging

#### `/list`
List files and folders in Google Drive.

**Parameters:**
- `folder` (string, optional): Folder to list (default: root)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 25)

**Response:**
```json
{
  "files": [
    {
      "id": "file_id",
      "name": "filename.pdf",
      "mimeType": "application/pdf",
      "size": "1.2MB",
      "modifiedTime": "2024-01-01T00:00:00.000Z",
      "webViewLink": "https://drive.google.com/..."
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 125
  }
}
```

**Features:**
- Pagination support
- File type filtering
- Size information
- Direct links

### Advanced Operations

#### `/create-folder`
Create a new folder in Google Drive.

**Parameters:**
- `name` (string, required): Folder name
- `parent` (string, optional): Parent folder ID

**Response:**
- Success confirmation
- Folder details and ID

**Security:**
- Input validation
- Name sanitization
- Permission checks

#### `/search`
Search for files in Google Drive.

**Parameters:**
- `query` (string, required): Search query
- `folder` (string, optional): Search within specific folder
- `mimeType` (string, optional): Filter by file type
- `limit` (number, optional): Maximum results (default: 25)

**Response:**
```json
{
  "files": [...],
  "query": "search term",
  "totalResults": 50,
  "executionTime": "150ms"
}
```

**Features:**
- Fuzzy search
- Type filtering
- Performance optimization
- Redis caching

### Backup Commands

#### `/backup create`
Create an automated backup schedule.

**Parameters:**
- `folder` (string, required): Folder to backup
- `schedule` (string, required): Cron expression or preset

**Preset Schedules:**
- `0 2 * * *` - Daily at 2 AM
- `0 3 * * 0` - Weekly on Sunday at 3 AM
- `0 4 1 * *` - Monthly on 1st at 4 AM
- `0 */6 * * *` - Every 6 hours
- `0 */12 * * *` - Every 12 hours

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduleId": "backup_user_1234567890_1640995200000",
    "folderName": "My Documents",
    "cronExpression": "0 2 * * *",
    "nextRun": "2024-01-02T02:00:00.000Z",
    "enabled": true
  }
}
```

#### `/backup list`
List all backup schedules for the user.

**Parameters:**
- None

**Response:**
```json
{
  "schedules": [
    {
      "id": "backup_user_1234567890_1640995200000",
      "folderName": "My Documents",
      "cronExpression": "0 2 * * *",
      "enabled": true,
      "lastRun": "2024-01-01T02:00:00.000Z",
      "nextRun": "2024-01-02T02:00:00.000Z"
    }
  ]
}
```

#### `/backup run`
Manually execute a backup.

**Parameters:**
- `schedule_id` (string, required): Schedule ID to run

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_backup_1234567890_1640995200000",
    "status": "completed",
    "filesBackedUp": 25,
    "totalFiles": 25,
    "duration": "45s"
  }
}
```

#### `/backup delete`
Delete a backup schedule.

**Parameters:**
- `schedule_id` (string, required): Schedule ID to delete

**Response:**
- Success confirmation
- Schedule details

#### `/backup status`
Check backup status and recent jobs.

**Parameters:**
- None

**Response:**
```json
{
  "totalSchedules": 3,
  "activeSchedules": 2,
  "recentJobs": [
    {
      "id": "job_1234567890_1640995200000",
      "status": "completed",
      "startTime": "2024-01-01T02:00:00.000Z",
      "filesBackedUp": 25,
      "totalFiles": 25,
      "duration": "45s"
    }
  ]
}
```

### Utility Commands

#### `/storage`
Show storage usage statistics.

**Parameters:**
- None

**Response:**
```json
{
  "totalSpace": "15GB",
  "usedSpace": "2.5GB",
  "availableSpace": "12.5GB",
  "usagePercentage": 16.7,
  "fileCount": 1250,
  "folderCount": 45,
  "breakdown": {
    "documents": "1.2GB",
    "images": "800MB",
    "videos": "500MB",
    "other": "0MB"
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | User must be authenticated | 401 |
| `INVALID_CREDENTIALS` | Invalid authentication credentials | 401 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `CSRF_TOKEN_INVALID` | Invalid or missing CSRF token | 403 |
| `FILE_NOT_FOUND` | Requested file does not exist | 404 |
| `FILE_TOO_LARGE` | File exceeds size limit | 413 |
| `INVALID_FILE_TYPE` | File type not allowed | 400 |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | 403 |
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `INTERNAL_ERROR` | Internal server error | 500 |

## Rate Limits

### Per-User Limits
- **Upload**: 10 files per hour
- **Download**: 50 files per hour
- **Search**: 100 queries per hour
- **Backup**: 5 operations per hour
- **General**: 100 commands per 15 minutes

### Per-Command Limits
- **File Operations**: 1 per 5 seconds
- **Bulk Operations**: 1 per 30 seconds
- **Backup Operations**: 1 per 60 seconds

## Security Considerations

### CSRF Protection
- All state-changing operations require CSRF tokens
- Tokens are generated per user session
- Tokens expire after 1 hour
- Tokens are single-use only

### Input Validation
- All inputs are sanitized to prevent XSS
- File names are validated for security
- File types are restricted to safe formats
- File sizes are limited to prevent abuse

### Rate Limiting
- Redis-based rate limiting for performance
- Per-user and per-command limits
- Automatic lockout after excessive attempts
- Graceful degradation under load

### Audit Logging
- All operations are logged with timestamps
- Security events are tracked and monitored
- User actions are recorded for compliance
- Error conditions are logged for debugging

## Performance

### Caching
- Redis caching for frequently accessed data
- Metadata caching for improved performance
- Search result caching for better UX
- Rate limit caching for efficiency

### Optimization
- Chunked uploads/downloads for large files
- Asynchronous processing for bulk operations
- Database query optimization
- Connection pooling for database access

### Monitoring
- Prometheus metrics for performance tracking
- Health checks for service availability
- Error tracking and alerting
- Resource usage monitoring

## Examples

### Complete Upload Flow
```bash
# 1. User runs /upload command with file attachment
# 2. Bot validates file type and size
# 3. Bot generates CSRF token
# 4. Bot uploads file with progress tracking
# 5. Bot sends success confirmation with file link
```

### Backup Schedule Creation
```bash
# 1. User runs /backup create with folder and schedule
# 2. Bot validates folder exists and user has access
# 3. Bot creates cron job for scheduled execution
# 4. Bot stores schedule in Redis cache
# 5. Bot confirms schedule creation with next run time
```

### Security Event Handling
```bash
# 1. Suspicious activity detected
# 2. Security service logs event with severity level
# 3. Rate limiting applied if necessary
# 4. Admin notification sent for critical events
# 5. Event stored in security analytics
```

## Support

For API support and questions:
- Check the troubleshooting guide
- Review the security documentation
- Contact the development team
- Submit issues on GitHub