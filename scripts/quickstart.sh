#!/bin/bash

################################################################################
# Work Order Management System - Quick Start Script
#
# This script automates the setup process for local development:
# - Checks prerequisites (Node.js, MySQL, Redis)
# - Creates database
# - Runs migrations
# - Runs seeders
# - Starts Redis
# - Starts backend server
# - Displays access URLs and test credentials
#
# Usage: ./scripts/quickstart.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
DB_NAME="workorder_dev"
REDIS_PORT=6379
SERVER_PORT=3000

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

################################################################################
# Prerequisites Check
################################################################################

check_prerequisites() {
    print_header "Checking Prerequisites"

    local all_ok=true

    # Check Node.js
    if check_command node; then
        local node_version=$(node --version)
        print_success "Node.js found: $node_version"

        # Check if version >= 18
        local major_version=$(echo $node_version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$major_version" -lt 18 ]; then
            print_error "Node.js version 18.0.0 or higher required"
            all_ok=false
        fi
    else
        print_error "Node.js not found. Please install Node.js >= 18.0.0"
        all_ok=false
    fi

    # Check npm
    if check_command npm; then
        local npm_version=$(npm --version)
        print_success "npm found: v$npm_version"
    else
        print_error "npm not found"
        all_ok=false
    fi

    # Check MySQL
    if check_command mysql; then
        local mysql_version=$(mysql --version | awk '{print $3}')
        print_success "MySQL found: $mysql_version"
    else
        print_error "MySQL not found. Please install MySQL >= 8.0"
        all_ok=false
    fi

    # Check Redis
    if check_command redis-cli; then
        local redis_version=$(redis-cli --version | awk '{print $2}')
        print_success "Redis CLI found: $redis_version"
    else
        print_warning "Redis CLI not found. Redis is optional but recommended."
    fi

    if [ "$all_ok" = false ]; then
        print_error "Prerequisites check failed. Please install missing dependencies."
        exit 1
    fi

    print_success "All prerequisites satisfied!"
}

################################################################################
# Environment Setup
################################################################################

setup_environment() {
    print_header "Setting Up Environment"

    cd "$BACKEND_DIR"

    # Check if .env exists
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            print_info "Creating .env file from .env.example..."
            cp .env.example .env
            print_success ".env file created"
            print_warning "Please edit .env file with your database credentials"
            print_info "Especially set: DB_PASSWORD, JWT_SECRET"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_success ".env file already exists"
    fi
}

################################################################################
# Install Dependencies
################################################################################

install_dependencies() {
    print_header "Installing Dependencies"

    cd "$BACKEND_DIR"

    if [ -d "node_modules" ]; then
        print_info "Dependencies already installed. Checking for updates..."
        npm install
    else
        print_info "Installing npm packages..."
        npm install
    fi

    print_success "Dependencies installed successfully"
}

################################################################################
# Database Setup
################################################################################

setup_database() {
    print_header "Setting Up Database"

    cd "$BACKEND_DIR"

    # Load database credentials from .env
    if [ -f .env ]; then
        export $(grep -v '^#' .env | xargs)
    fi

    local DB_USER=${DB_USER:-root}
    local DB_PASSWORD=${DB_PASSWORD:-}

    print_info "Database name: $DB_NAME"
    print_info "Database user: $DB_USER"

    # Prompt for MySQL password if not in .env
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Enter MySQL password for user '$DB_USER': " DB_PASSWORD
        echo ""
    fi

    # Check if database exists
    local db_exists=$(mysql -u "$DB_USER" -p"$DB_PASSWORD" -e "SHOW DATABASES LIKE '$DB_NAME';" | grep "$DB_NAME" || true)

    if [ -z "$db_exists" ]; then
        print_info "Creating database '$DB_NAME'..."
        mysql -u "$DB_USER" -p"$DB_PASSWORD" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        print_success "Database created"
    else
        print_success "Database '$DB_NAME' already exists"
    fi

    # Run migrations
    print_info "Running database migrations..."
    npm run db:migrate
    print_success "Migrations completed"

    # Run seeders
    print_info "Running database seeders..."
    npm run db:seed
    print_success "Seeders completed"

    print_success "Database setup complete!"
}

################################################################################
# Redis Setup
################################################################################

start_redis() {
    print_header "Starting Redis"

    # Check if Redis is already running
    if redis-cli -p $REDIS_PORT ping &> /dev/null; then
        print_success "Redis is already running on port $REDIS_PORT"
        return 0
    fi

    # Try to start Redis
    if check_command redis-server; then
        print_info "Starting Redis server..."
        redis-server --daemonize yes --port $REDIS_PORT
        sleep 2

        if redis-cli -p $REDIS_PORT ping &> /dev/null; then
            print_success "Redis started successfully on port $REDIS_PORT"
        else
            print_warning "Failed to start Redis. Continuing without Redis..."
        fi
    else
        print_warning "Redis not available. Some features may be limited."
    fi
}

################################################################################
# Start Backend Server
################################################################################

start_backend() {
    print_header "Starting Backend Server"

    cd "$BACKEND_DIR"

    # Check if port is already in use
    if lsof -Pi :$SERVER_PORT -sTCP:LISTEN -t &> /dev/null; then
        print_warning "Port $SERVER_PORT is already in use"
        print_info "Attempting to find process..."
        lsof -Pi :$SERVER_PORT -sTCP:LISTEN

        read -p "Kill existing process and restart? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $(lsof -t -i:$SERVER_PORT) || true
            sleep 2
        else
            print_info "Skipping server start"
            return 0
        fi
    fi

    print_info "Starting backend server on port $SERVER_PORT..."
    print_info "You can stop the server anytime with Ctrl+C"
    echo ""

    # Start server in foreground
    npm run dev
}

################################################################################
# Display Summary
################################################################################

display_summary() {
    print_header "Quick Start Complete!"

    echo -e "${GREEN}Your Work Order Management System is ready!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BLUE}Backend API URLs:${NC}"
    echo "  - Health Check:   http://localhost:$SERVER_PORT/api/health"
    echo "  - API Root:       http://localhost:$SERVER_PORT/api"
    echo "  - Authentication: http://localhost:$SERVER_PORT/api/auth"
    echo "  - Work Orders:    http://localhost:$SERVER_PORT/api/workorders"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BLUE}Test Accounts:${NC}"
    echo ""
    echo "  1. Super Admin"
    echo "     OpenID: test_openid_super_admin"
    echo "     Name:   测试超管"
    echo "     Role:   Super Admin (full access)"
    echo ""
    echo "  2. System Admin"
    echo "     OpenID: test_openid_sys_admin"
    echo "     Name:   测试管理"
    echo "     Role:   System Admin (manage users)"
    echo ""
    echo "  3. Administrative Manager"
    echo "     OpenID: test_openid_admin_manager"
    echo "     Name:   测试经理"
    echo "     Role:   Administrative Manager (view all orders)"
    echo ""
    echo "  4. Property Staff"
    echo "     OpenID: test_openid_property_staff"
    echo "     Name:   测试物业"
    echo "     Role:   Property Staff (submit work orders)"
    echo ""
    echo "  5. Maintenance Worker"
    echo "     OpenID: test_openid_maintenance_worker"
    echo "     Name:   测试维修"
    echo "     Role:   Maintenance Worker (repair work orders)"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BLUE}Quick Test (in another terminal):${NC}"
    echo ""
    echo "  # Health check"
    echo "  curl http://localhost:$SERVER_PORT/api/health"
    echo ""
    echo "  # Login as Property Staff"
    echo "  curl -X POST http://localhost:$SERVER_PORT/api/auth/wechat \\"
    echo "    -H \"Content-Type: application/json\" \\"
    echo "    -d '{\"code\": \"test_code_property_staff\"}'"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo ""
    echo "  1. Keep this terminal open (backend server is running)"
    echo "  2. Open WeChat Developer Tools"
    echo "  3. Import miniprogram project from:"
    echo "     $PROJECT_ROOT/miniprogram"
    echo "  4. Configure API base URL in miniprogram/config/api.js"
    echo "  5. Start testing in WeChat DevTools simulator"
    echo ""
    echo "  For detailed testing guide, see: TESTING_GUIDE.md"
    echo "  For deployment guide, see: DEPLOYMENT_CHECKLIST.md"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
    echo ""
}

################################################################################
# Main Execution
################################################################################

main() {
    clear

    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║   Work Order Management System - Quick Start         ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""

    # Run setup steps
    check_prerequisites
    setup_environment
    install_dependencies
    setup_database
    start_redis

    # Display summary before starting server
    display_summary

    # Prompt to start server
    read -p "Press Enter to start the backend server (or Ctrl+C to exit)..." -r
    echo ""

    start_backend
}

# Run main function
main
