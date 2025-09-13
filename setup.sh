#!/bin/bash
# RCRT One-Click Setup Script
# Automatically sets up the RCRT system on a fresh machine

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting RCRT One-Click Setup...${NC}"
echo "========================================"

# Function to check if a command exists
check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    fi
}

# Function to check if Docker is running
check_docker_running() {
    if docker info >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Docker is not running${NC}"
        return 1
    fi
}

echo -e "${BLUE}📋 Checking Prerequisites...${NC}"

# Check required tools
MISSING_TOOLS=()

if ! check_command "docker"; then
    MISSING_TOOLS+=("docker")
fi

if ! check_command "docker-compose"; then
    # Try docker compose (newer syntax)
    if ! docker compose version >/dev/null 2>&1; then
        MISSING_TOOLS+=("docker-compose")
    else
        echo -e "${GREEN}✅ docker compose is available${NC}"
    fi
else
    echo -e "${GREEN}✅ docker-compose is installed${NC}"
fi

if ! check_command "cargo"; then
    MISSING_TOOLS+=("cargo")
fi

if ! check_command "git"; then
    MISSING_TOOLS+=("git")
fi

if ! check_command "curl"; then
    MISSING_TOOLS+=("curl")
fi

# Report missing tools
if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required tools: ${MISSING_TOOLS[*]}${NC}"
    echo -e "${YELLOW}Please install the missing tools and run this script again.${NC}"
    exit 1
fi

# Check if Docker is running
if ! check_docker_running; then
    echo -e "${YELLOW}Please start Docker and run this script again.${NC}"
    exit 1
fi

echo -e "${BLUE}🔧 Preparing Environment...${NC}"

# Generate Cargo.lock if it doesn't exist
if [ ! -f "Cargo.lock" ]; then
    echo -e "${YELLOW}⚠️  Cargo.lock not found. Generating...${NC}"
    cargo generate-lockfile
    echo -e "${GREEN}✅ Cargo.lock generated${NC}"
else
    echo -e "${GREEN}✅ Cargo.lock exists${NC}"
fi

# Check for required environment variables
echo -e "${BLUE}🔍 Checking Environment Variables...${NC}"

# Check if .env file exists or if required env vars are set
ENV_WARNINGS=()

if [ -z "$LOCAL_KEK_BASE64" ] && [ ! -f ".env" ]; then
    ENV_WARNINGS+=("LOCAL_KEK_BASE64 not set")
fi

if [ -z "$OPENROUTER_API_KEY" ] && [ ! -f ".env" ]; then
    ENV_WARNINGS+=("OPENROUTER_API_KEY not set")
fi

if [ ${#ENV_WARNINGS[@]} -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Environment variable warnings: ${ENV_WARNINGS[*]}${NC}"
    echo -e "${YELLOW}   Some features may not work without these variables.${NC}"
    echo -e "${YELLOW}   Consider creating a .env file with required variables.${NC}"
fi

echo -e "${BLUE}🐳 Starting Docker Services...${NC}"

# Build and start services
echo "Building and starting all services..."
docker compose up -d

echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"

# Wait for services to be healthy
MAX_WAIT=180  # 3 minutes
WAIT_TIME=0
INTERVAL=10

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    echo "Checking service health... (${WAIT_TIME}s/${MAX_WAIT}s)"
    
    # Check service status
    docker compose ps --format "table {{.Service}}\t{{.Status}}" | grep -v "SERVICE"
    
    # Check if builder is specifically healthy (it's the one that takes longest)
    if docker compose ps builder | grep -q "healthy"; then
        echo -e "${GREEN}✅ All critical services are ready${NC}"
        break
    fi
    
    sleep $INTERVAL
    WAIT_TIME=$((WAIT_TIME + INTERVAL))
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo -e "${RED}❌ Timeout waiting for services to start${NC}"
    echo "Current service status:"
    docker compose ps
    exit 1
fi

echo -e "${BLUE}🧪 Testing Service Endpoints...${NC}"

# Test key endpoints
test_endpoint() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_code"; then
        echo -e "${GREEN}✅ $name is responding${NC}"
    else
        echo -e "${RED}❌ $name is not responding${NC}"
        return 1
    fi
}

# Test endpoints
test_endpoint "http://localhost:3000/api/health" "Builder UI"
test_endpoint "http://localhost:8081/health" "RCRT Server"  
test_endpoint "http://localhost:8082" "Dashboard" "308"  # Expects redirect

echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "========================================"
echo -e "${BLUE}Services are running on:${NC}"
echo "  • Builder UI:    http://localhost:3000"
echo "  • RCRT Server:   http://localhost:8081" 
echo "  • Dashboard:     http://localhost:8082"
echo "  • Database:      localhost:5432"
echo "  • NATS:          localhost:4222"
echo ""
echo -e "${BLUE}To view logs:${NC} docker compose logs -f"
echo -e "${BLUE}To stop:${NC}     docker compose down"
echo ""
echo -e "${GREEN}✅ RCRT is ready to use!${NC}"
