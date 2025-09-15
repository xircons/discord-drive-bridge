#!/bin/bash

# Discord Drive Bridge - Production Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="discord-drive-bot"
DOCKER_IMAGE="discord-drive-bot"
DOCKER_TAG="latest"
CONTAINER_NAME="discord-drive-bot"
NETWORK_NAME="discord-bot-network"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if required commands exist
check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed or not in PATH"
    fi
    
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed or not in PATH"
    fi
    
    success "All dependencies found"
}

# Check if .env file exists
check_env() {
    log "Checking environment configuration..."
    
    if [ ! -f .env ]; then
        error ".env file not found. Please copy env.example to .env and configure it"
    fi
    
    # Check required environment variables
    source .env
    
    required_vars=(
        "DISCORD_TOKEN"
        "DISCORD_CLIENT_ID"
        "DISCORD_GUILD_ID"
        "GOOGLE_CLIENT_ID"
        "GOOGLE_CLIENT_SECRET"
        "GOOGLE_REDIRECT_URI"
        "DATABASE_URL"
        "DATABASE_ENCRYPTION_KEY"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    success "Environment configuration is valid"
}

# Build Docker image
build_image() {
    log "Building Docker image..."
    
    docker build -t $DOCKER_IMAGE:$DOCKER_TAG . || error "Failed to build Docker image"
    
    success "Docker image built successfully"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    # Install dependencies
    npm ci || error "Failed to install dependencies"
    
    # Run linting
    npm run lint || error "Linting failed"
    
    # Run tests
    npm test || error "Tests failed"
    
    # Run type checking
    npx tsc --noEmit || error "Type checking failed"
    
    success "All tests passed"
}

# Deploy with Docker Compose
deploy() {
    log "Deploying application..."
    
    # Stop existing containers
    docker-compose down || warning "No existing containers to stop"
    
    # Start services
    docker-compose up -d || error "Failed to start services"
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        error "Services failed to start properly"
    fi
    
    success "Application deployed successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 10
    
    # Run migrations
    docker-compose exec app npm run db:migrate || error "Database migrations failed"
    
    success "Database migrations completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for application to start
    sleep 10
    
    # Check health endpoint
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        success "Application is healthy"
    else
        error "Health check failed"
    fi
}

# Show logs
show_logs() {
    log "Showing application logs..."
    docker-compose logs -f --tail=100
}

# Cleanup
cleanup() {
    log "Cleaning up..."
    
    # Remove unused Docker images
    docker image prune -f || warning "Failed to clean up Docker images"
    
    # Remove unused volumes
    docker volume prune -f || warning "Failed to clean up Docker volumes"
    
    success "Cleanup completed"
}

# Main deployment function
main() {
    log "Starting Discord Drive Bridge deployment..."
    
    case "${1:-deploy}" in
        "build")
            check_dependencies
            check_env
            build_image
            ;;
        "test")
            check_dependencies
            check_env
            run_tests
            ;;
        "deploy")
            check_dependencies
            check_env
            run_tests
            build_image
            deploy
            run_migrations
            health_check
            ;;
        "logs")
            show_logs
            ;;
        "cleanup")
            cleanup
            ;;
        "help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  build    - Build Docker image only"
            echo "  test     - Run tests only"
            echo "  deploy   - Full deployment (default)"
            echo "  logs     - Show application logs"
            echo "  cleanup  - Clean up unused Docker resources"
            echo "  help     - Show this help message"
            ;;
        *)
            error "Unknown command: $1. Use 'help' for available commands"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
