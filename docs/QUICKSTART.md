# Discord Drive Bridge - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will help you get the Discord Drive Bridge bot up and running quickly.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 13+ running
- Redis 6+ running
- Discord application created
- Google Cloud project with Drive API enabled

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/discord-drive-bridge.git
cd discord-drive-bridge

# Install dependencies
npm install
```

## Step 2: Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit configuration
nano .env
```

### Required Environment Variables

```env
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/discord_drive_bridge
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
BASE_URL=http://localhost:3000
```

## Step 3: Database Setup

```bash
# Run database migrations
npm run db:migrate

# (Optional) Seed with test data
npm run db:seed
```

## Step 4: Start the Bot

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## Step 5: Test the Bot

1. **Invite the bot to your Discord server**
2. **Run `/login` to authenticate with Google Drive**
3. **Upload a file with `/upload`**
4. **List files with `/list`**

## 🎯 Quick Commands

### Authentication
- `/login` - Connect your Google Drive account
- `/logout` - Disconnect your account
- `/status` - Check connection status

### File Operations
- `/upload [file]` - Upload a file
- `/download [filename]` - Download a file
- `/list` - List your files
- `/search [query]` - Search for files

### Advanced Features
- `/create-folder [name]` - Create a folder
- `/backup create [folder] [schedule]` - Create backup schedule
- `/storage` - Check storage usage

## 🔧 Troubleshooting

### Bot Not Responding
```bash
# Check if bot is running
pm2 status

# Check logs
pm2 logs discord-drive-bridge
```

### Database Issues
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Run migrations
npm run db:migrate
```

### Redis Issues
```bash
# Check Redis connection
redis-cli ping

# Check Redis status
sudo systemctl status redis-server
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Metrics
```bash
curl http://localhost:9090/metrics
```

### Security Stats
```bash
curl http://localhost:3000/security/stats
```

## 🐳 Docker Quick Start

```bash
# Start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 📚 Next Steps

1. **Read the [API Documentation](API.md)** for detailed API reference
2. **Check the [Security Guide](SECURITY.md)** for security best practices
3. **Review the [Deployment Guide](DEPLOYMENT.md)** for production deployment
4. **Explore [Features](FEATURES.md)** for complete feature overview

## 🆘 Need Help?

- **Documentation**: Check the `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/your-username/discord-drive-bridge/issues)
- **Discord**: [Discord Server](https://discord.gg/your-server)
- **Email**: support@yourdomain.com

## 🎉 You're Ready!

Your Discord Drive Bridge bot is now running! Start managing your Google Drive files through Discord commands.

For more advanced configuration and features, please refer to the complete documentation.
