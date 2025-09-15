#!/bin/bash

# MySQL + Redis Docker Setup Script for Discord Drive Bridge
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Discord Drive Bridge with MySQL + Redis..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive

# Database Configuration (MySQL)
DATABASE_URL=mysql://discordbot:secure_password_123@localhost:3306/discordbot
DB_PASSWORD=secure_password_123

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3000
NODE_ENV=development

# Security Configuration
JWT_SECRET=your_jwt_secret_here_change_this
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload Limits
MAX_FILE_SIZE_MB=100
MAX_FILES_PER_UPLOAD=10

# Logging
LOG_LEVEL=info
LOG_FILE=logs/combined.log
ERROR_LOG_FILE=logs/error.log

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
EOF
    echo "✅ .env file created. Please update it with your actual credentials."
else
    echo "✅ .env file already exists."
fi

# Create logs directory
mkdir -p logs

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

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate

echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with real credentials"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Run 'npm run deploy-commands' to deploy Discord slash commands"
echo ""
echo "🔗 Useful commands:"
echo "- View logs: docker-compose logs -f"
echo "- Stop services: docker-compose down"
echo "- Restart services: docker-compose restart"
echo "- Access MySQL: docker-compose exec db mysql -u discordbot -p discordbot"
echo "- Access Redis: docker-compose exec redis redis-cli"
