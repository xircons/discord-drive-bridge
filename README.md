# Discord Google Drive Bridge

A secure, enterprise-grade Discord bot that enables users to manage their personal Google Drive accounts through Discord commands. Built with TypeScript, featuring OAuth 2.0 authentication, comprehensive security measures, and production-ready deployment.

## 🚀 Features

### Authentication & Security
- **OAuth 2.0 with PKCE** - Secure Google Drive authentication
- **Token Encryption** - AES-256-CBC encryption for all stored tokens
- **Rate Limiting** - Per-user and per-command limits with Redis caching
- **CSRF Protection** - Token-based protection for all state-changing operations
- **Input Validation** - Comprehensive sanitization and XSS prevention
- **Security Headers** - XSS, clickjacking, and MIME sniffing protection
- **Suspicious Activity Detection** - Real-time threat monitoring
- **Audit Logging** - Complete operation tracking with security events

### File Management
- **Upload Files** - Single and bulk file uploads with progress tracking
- **Download Files** - Direct download to DMs with chunked streaming
- **File Operations** - Delete, rename, move, copy with confirmation
- **Folder Management** - Create, navigate, organize folders
- **Search** - Advanced file search with fuzzy matching and filters
- **Sharing** - Generate shareable links with permission controls

### Advanced Features
- **Chunked Uploads/Downloads** - Efficient handling of large files (>100MB)
- **Progress Indicators** - Real-time progress bars for uploads/downloads
- **Scheduled Backups** - Automated folder backups with cron scheduling
- **Storage Monitoring** - Real-time usage statistics and analytics
- **Redis Caching** - High-performance metadata and search result caching
- **Bulk Operations** - Efficient batch processing with progress tracking
- **File Type Validation** - Comprehensive security checks for uploads

### Monitoring & Observability
- **Prometheus Metrics** - Comprehensive application and performance metrics
- **Health Checks** - Service availability and database health monitoring
- **Error Tracking** - Detailed error logging and reporting
- **Security Analytics** - Real-time security event monitoring
- **Performance Monitoring** - Response time and resource usage tracking

## 🛠️ Technology Stack

- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with encryption + Redis for caching
- **Authentication**: OAuth 2.0 with PKCE
- **Framework**: Discord.js v14+
- **Google API**: Google Drive API v3
- **Security**: bcrypt, helmet, rate-limiting, CSRF protection
- **Caching**: Redis for high-performance data caching
- **Monitoring**: Prometheus metrics + Winston logging
- **Scheduling**: node-cron for automated backups
- **Testing**: Jest with 90%+ coverage
- **Deployment**: Docker containers with multi-stage builds

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- Discord Application
- Google Cloud Project with Drive API enabled

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/discord-drive-bridge.git
cd discord-drive-bridge
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp env.example .env
```

Edit `.env` with your configuration:
```env
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://yourbot.com/auth/callback

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/drivebot
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
NODE_ENV=development
BASE_URL=https://yourbot.com
```

### 4. Database Setup
```bash
# Run migrations
npm run db:migrate

# (Optional) Seed database
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```

## 🐳 Docker Deployment

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Docker Build
```bash
# Build image
docker build -t discord-drive-bot .

# Run container
docker run -p 3000:3000 --env-file .env discord-drive-bot
```

## 📚 Documentation

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get started in 5 minutes
- **[API Documentation](docs/API.md)** - Complete API reference
- **[Features Overview](docs/FEATURES.md)** - Detailed feature list
- **[Security Guide](docs/SECURITY.md)** - Security best practices
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 📚 Available Commands

### Authentication Commands
- `/login` - Connect your Google Drive account
- `/logout` - Disconnect your Google Drive account
- `/status` - Check connection status and storage info

### File Management Commands
- `/upload [file] [folder] [description]` - Upload a file to Google Drive
- `/download [folder] [filename]` - Download a file to your DMs
- `/delete [folder] [filename]` - Delete a file (with confirmation)
- `/list [folder] [page] [limit]` - List files and folders

### Advanced Operations
- `/create-folder [name] [parent]` - Create a new folder
- `/rename [type] [old_name] [new_name] [folder]` - Rename file/folder
- `/move [filename] [from_folder] [to_folder]` - Move a file
- `/copy [filename] [from_folder] [to_folder]` - Copy a file
- `/share [folder] [filename] [permission]` - Generate shareable link

### Bulk Operations
- `/bulk-upload [folder]` - Upload multiple files at once
- `/bulk-download [folder]` - Download entire folder as ZIP

### Backup Commands
- `/backup create [folder] [schedule]` - Create automated backup schedule
- `/backup list` - List your backup schedules
- `/backup run [schedule_id]` - Run backup manually
- `/backup delete [schedule_id]` - Delete backup schedule
- `/backup status` - Check backup status and recent jobs

### Utility Commands
- `/search [query] [folder] [mimeType]` - Search files by name
- `/recent [limit]` - Show recently modified files
- `/storage` - Show storage usage statistics
- `/favorites` - Manage favorite folders
- `/help` - Show all available commands

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run Specific Test Suites
```bash
# Unit tests only
npm test -- --testPathPattern=unit

# Integration tests only
npm test -- --testPathPattern=integration

# E2E tests only
npm test -- --testPathPattern=e2e
```

## 🔧 Development

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Management
```bash
# Create new migration
npx knex migrate:make migration_name

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Run seeds
npm run db:seed
```

## 🔒 Security Features

- **Input Validation** - Comprehensive sanitization and XSS prevention
- **SQL Injection Prevention** - Parameterized queries only
- **Rate Limiting** - Per-user and per-command limits with Redis caching
- **Token Encryption** - AES-256-CBC encryption for all stored tokens
- **HTTPS Only** - SSL/TLS enforced in production
- **CSRF Protection** - Token-based protection for all state-changing operations
- **Security Headers** - XSS, clickjacking, and MIME sniffing protection
- **Suspicious Activity Detection** - Real-time threat monitoring
- **File Upload Security** - Type validation, size limits, and dangerous extension blocking
- **Login Attempt Tracking** - Account lockout after failed attempts
- **Error Sanitization** - No internal errors exposed
- **Audit Logging** - Complete operation tracking with security events
- **Security Analytics** - Real-time monitoring and reporting

## 📊 Monitoring

The bot includes comprehensive monitoring and observability:
- **Prometheus Metrics** - Application performance and usage statistics
- **Health Checks** - Service availability and database health monitoring
- **Error Tracking** - Detailed error logging and reporting with Winston
- **Security Analytics** - Real-time security event monitoring and reporting
- **Performance Monitoring** - Response time and resource usage tracking
- **Redis Monitoring** - Cache performance and hit rates
- **Google API Quota** - Usage tracking and alerts
- **Backup Monitoring** - Scheduled backup status and success rates
- **Rate Limit Monitoring** - User and command usage patterns
- **Security Event Tracking** - CSRF violations, suspicious activity, and threats

## 🚀 Production Deployment

### Environment Variables
Ensure all required environment variables are set:
- Discord bot token and IDs
- Google OAuth credentials
- Database connection string
- Encryption keys
- Security configuration

### Security Checklist
- [ ] SSL certificates configured
- [ ] Environment variables secured
- [ ] Database backups automated
- [ ] Log rotation configured
- [ ] Monitoring dashboards setup
- [ ] Alert rules configured
- [ ] Load balancing configured
- [ ] Auto-scaling enabled

### Performance Requirements
- Command response: < 3 seconds
- File upload: Progress indicators
- Concurrent users: Support 1000+
- Database queries: < 100ms average
- Memory usage: < 512MB baseline

## 📈 API Documentation

### OAuth Endpoints
- `GET /auth/start/:userId` - Initiate OAuth flow
- `GET /auth/callback` - Handle Google's response
- `POST /auth/refresh/:userId` - Refresh expired tokens
- `DELETE /auth/revoke/:userId` - Revoke user tokens

### Health & Monitoring
- `GET /health` - Service health status
- `GET /metrics` - Prometheus metrics endpoint
- `GET /security/stats` - Security analytics and statistics

### Security Features
- CSRF protection on all state-changing endpoints
- Rate limiting with Redis caching
- Input sanitization and validation
- Security event logging and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting guide

## 🔄 Changelog

### v1.0.0
- Initial release
- Complete OAuth 2.0 implementation with PKCE
- All core file operations (upload, download, delete, list, search)
- Advanced file operations (rename, move, copy, share)
- Bulk operations (bulk upload, bulk download)
- Chunked uploads/downloads for large files (>100MB)
- Progress indicators for uploads/downloads
- Scheduled backup functionality with cron scheduling
- Redis caching for high-performance data access
- Comprehensive security measures (CSRF, XSS, rate limiting)
- Prometheus metrics and monitoring
- Security analytics and threat detection
- Production-ready deployment with Docker