#!/bin/bash

# Discord Drive Bridge - Complete Setup Script
# This script will set up your entire development environment

set -e

echo "🚀 Discord Drive Bridge - Complete Setup"
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Discord Drive Bridge Environment Configuration
# Update these values with your actual credentials

# ===========================================
# DISCORD CONFIGURATION
# ===========================================
# Get these from https://discord.com/developers/applications
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here

# ===========================================
# GOOGLE OAUTH CONFIGURATION
# ===========================================
# Get these from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile

# ===========================================
# DATABASE CONFIGURATION (MySQL)
# ===========================================
# For local development with Docker
DATABASE_URL=mysql://discordbot:secure_password_123@localhost:3307/discordbot
DB_PASSWORD=secure_password_123

# ===========================================
# REDIS CONFIGURATION
# ===========================================
REDIS_URL=redis://localhost:6379

# ===========================================
# SECURITY CONFIGURATION
# ===========================================
# Generate secure keys - CHANGE THESE!
JWT_SECRET=your_jwt_secret_here_change_this_to_something_secure_32_chars_min
DATABASE_ENCRYPTION_KEY=your_32_character_encryption_key_here

# ===========================================
# RATE LIMITING CONFIGURATION
# ===========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ===========================================
# FILE UPLOAD LIMITS
# ===========================================
MAX_FILE_SIZE_MB=100
MAX_FILES_PER_UPLOAD=10

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# ===========================================
# LOGGING CONFIGURATION
# ===========================================
LOG_LEVEL=info
LOG_FILE=logs/app.log

# ===========================================
# MONITORING CONFIGURATION
# ===========================================
ENABLE_METRICS=true
METRICS_PORT=9090
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✅ Logs directory created"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Start MySQL and Redis
echo "🐳 Starting MySQL and Redis containers..."
docker-compose up -d db redis

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
timeout=60
counter=0
while ! docker-compose exec -T db mysqladmin ping -h localhost --silent; do
    if [ $counter -eq $timeout ]; then
        echo "❌ MySQL failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
done

echo "✅ MySQL is ready!"

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
timeout=30
counter=0
while ! docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        echo "❌ Redis failed to start within $timeout seconds"
        exit 1
    fi
    sleep 1
    counter=$((counter + 1))
done

echo "✅ Redis is ready!"

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Next Steps:"
echo "1. Update your .env file with real credentials:"
echo "   - Discord bot token and IDs"
echo "   - Google OAuth credentials"
echo "   - Generate secure JWT_SECRET and DATABASE_ENCRYPTION_KEY"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Deploy Discord commands:"
echo "   npm run deploy:commands"
echo ""
echo "🔗 Useful Commands:"
echo "- View logs: docker-compose logs -f"
echo "- Stop services: docker-compose down"
echo "- Restart services: docker-compose restart"
echo "- Access MySQL: docker-compose exec db mysql -u discordbot -p discordbot"
echo "- Access Redis: docker-compose exec redis redis-cli"
echo ""
echo "📚 Documentation:"
echo "- Quick Start: docs/QUICKSTART.md"
echo "- API Reference: docs/API.md"
echo "- Security Guide: docs/SECURITY.md"
echo ""
echo "⚠️  IMPORTANT: Update your .env file with real credentials before starting the bot!"
