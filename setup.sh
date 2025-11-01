#!/bin/bash
# Universal RCRT Setup Script - Works on Mac, Linux, and Windows!
# Fully portable - supports custom container name prefixes

set -e

echo "🚀 Starting RCRT Setup..."
echo ""

# PROJECT_PREFIX: Customize this to avoid container name conflicts
# Examples: "lightforge-", "mycompany-", "dev-", etc.
# Leave empty for default names (no prefix)
PROJECT_PREFIX="${PROJECT_PREFIX:-}"

if [ -n "$PROJECT_PREFIX" ]; then
    echo "🏷️  Using custom prefix: ${PROJECT_PREFIX}"
    echo "   Container names will be: ${PROJECT_PREFIX}rcrt, ${PROJECT_PREFIX}db, etc."
else
    echo "📦 Using default container names (no prefix)"
fi
echo ""

# Detect OS and Architecture
OS_TYPE="unknown"
ARCH_TYPE="unknown"

if [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="mac"
    ARCH_TYPE=$(uname -m)
    echo "🍎 Detected: macOS on $ARCH_TYPE"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_TYPE="linux"
    ARCH_TYPE=$(uname -m)
    echo "🐧 Detected: Linux on $ARCH_TYPE"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS_TYPE="windows"
    ARCH_TYPE="x86_64"
    echo "🪟 Detected: Windows"
else
    echo "⚠️  Unknown OS: $OSTYPE"
fi

# Check Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Mac-specific setup
if [[ "$OS_TYPE" == "mac" ]]; then
    echo ""
    if [[ "$ARCH_TYPE" == "arm64" ]]; then
        echo "🔧 Apple Silicon detected - optimizing build for ARM64"
        echo "💡 Note: We'll build natively for better performance!"
    else
        echo "🔧 Intel Mac detected - optimizing build for x64"
    fi
    
    # Enable buildx for better multi-arch support
    docker buildx create --use --name rcrt-builder 2>/dev/null || docker buildx use rcrt-builder || true
fi

# Generate .env if missing
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# RCRT Environment Configuration
# Generated with prefix: ${PROJECT_PREFIX:-none}

# Container name prefix (leave empty for default)
PROJECT_PREFIX=${PROJECT_PREFIX}

# Service URLs (auto-configured based on prefix)
RCRT_BASE_URL=http://${PROJECT_PREFIX}rcrt:8080
DB_HOST=${PROJECT_PREFIX}db
DB_URL=postgresql://postgres:postgres@\${DB_HOST}/rcrt
NATS_URL=nats://${PROJECT_PREFIX}nats:4222

# External URLs (for browser/extension access)
RCRT_EXTERNAL_URL=http://localhost:8081
DASHBOARD_EXTERNAL_URL=http://localhost:8082
BUILDER_EXTERNAL_URL=http://localhost:3000

# Security
LOCAL_KEK_BASE64="your-encryption-key-here"

# API Keys
OPENROUTER_API_KEY="your-openrouter-api-key-here"
OPENROUTER_REFERER="http://localhost:3000"
OPENROUTER_SITE_TITLE="RCRT Local"

# IDs (change if needed for isolation)
OWNER_ID=00000000-0000-0000-0000-000000000001
AGENT_ID=00000000-0000-0000-0000-000000000AAA
TOOLS_AGENT_ID=00000000-0000-0000-0000-0000000000aa
EXTENSION_AGENT_ID=00000000-0000-0000-0000-000000000EEE
EOF
    echo "⚠️  Please edit .env with your actual API keys"
else
    echo "📝 .env file exists, ensuring prefix is set..."
    # Add PROJECT_PREFIX to existing .env if missing
    if ! grep -q "^PROJECT_PREFIX=" .env; then
        echo "" >> .env
        echo "# Container prefix (added by setup)" >> .env
        echo "PROJECT_PREFIX=${PROJECT_PREFIX}" >> .env
    fi
fi

# Clean any problematic files first
echo "🧹 Cleaning up..."
rm -rf rcrt-visual-builder/apps/builder/node_modules || true
rm -rf rcrt-visual-builder/node_modules || true

# Build the browser extension first (if node/npm available)
if command -v npm >/dev/null 2>&1; then
    echo "🧩 Building browser extension..."
    (cd extension && npm install && npm run build) || echo "⚠️  Extension build failed (not critical)"
    echo "✅ Extension built in extension/dist/"
else
    echo "⚠️  Node.js not found - skipping extension build"
    echo "   You can build it later with: cd extension && npm install && npm run build"
fi

# Build core services with platform-specific options
echo "🔨 Building core services..."

if [[ "$OS_TYPE" == "mac" ]]; then
    # Mac: Build with buildx for native architecture
    echo "   Using native build for $ARCH_TYPE..."
    
    # Translate Mac arch names to Docker arch names
    if [[ "$ARCH_TYPE" == "arm64" ]]; then
        DOCKER_ARCH="arm64"
    elif [[ "$ARCH_TYPE" == "x86_64" ]]; then
        DOCKER_ARCH="amd64"
    else
        DOCKER_ARCH="amd64"  # Default fallback
    fi
    
    export DOCKER_DEFAULT_PLATFORM=linux/$DOCKER_ARCH
    docker compose build --build-arg TARGETARCH=$DOCKER_ARCH rcrt
fi

# Generate docker-compose override for custom prefix (if needed)
if [ -n "$PROJECT_PREFIX" ]; then
    echo "📝 Generating docker-compose.override.yml for prefix: ${PROJECT_PREFIX}"
    cat > docker-compose.override.yml << EOF
# Auto-generated override for custom container prefix: ${PROJECT_PREFIX}
# This file is created by setup.sh and can be regenerated

services:
  db:
    container_name: ${PROJECT_PREFIX}db
    
  nats:
    container_name: ${PROJECT_PREFIX}nats
    
  rcrt:
    container_name: ${PROJECT_PREFIX}rcrt
    environment:
      - DB_URL=postgresql://postgres:postgres@${PROJECT_PREFIX}db/rcrt
      - NATS_URL=nats://${PROJECT_PREFIX}nats:4222
    depends_on:
      - ${PROJECT_PREFIX}db
      - ${PROJECT_PREFIX}nats
      
  dashboard:
    container_name: ${PROJECT_PREFIX}dashboard
    environment:
      - VITE_RCRT_BASE_URL=http://${PROJECT_PREFIX}rcrt:8080
      
  agent-runner:
    container_name: ${PROJECT_PREFIX}agent-runner
    environment:
      - RCRT_BASE_URL=http://${PROJECT_PREFIX}rcrt:8080
      
  tools-runner:
    container_name: ${PROJECT_PREFIX}tools-runner
    environment:
      - RCRT_BASE_URL=http://${PROJECT_PREFIX}rcrt:8080
      
  context-builder:
    container_name: ${PROJECT_PREFIX}context-builder
    environment:
      - RCRT_API_URL=http://${PROJECT_PREFIX}rcrt:8080
      - DATABASE_URL=postgresql://postgres:postgres@${PROJECT_PREFIX}db/rcrt
      
  builder:
    container_name: ${PROJECT_PREFIX}builder
    environment:
      - VITE_RCRT_BASE_URL=http://${PROJECT_PREFIX}rcrt:8080
EOF
    echo "✅ Custom override created"
fi

# Start services
echo "🚀 Starting services with prefix: ${PROJECT_PREFIX:-none}"
docker compose up -d db nats rcrt context-builder dashboard tools-runner

# Wait for core services to be ready
echo "⏳ Waiting for core services..."
sleep 15

# Try to start builder (may fail due to node_modules issues)
echo "🔨 Starting builder (optional)..."
docker compose up -d builder || echo "⚠️  Builder may have build issues (not critical)"

echo "⏳ Waiting for services..."
sleep 30

# Note: Agent registration handled later via load-default-agent.js

# Bootstrap the system
echo ""
echo "🌱 Bootstrapping RCRT system..."

# Ensure system agents exist first
echo "🔧 Ensuring system agents exist..."
if command -v psql >/dev/null 2>&1; then
    psql "postgresql://postgres:postgres@localhost/rcrt" < scripts/ensure-system-agent.sql 2>/dev/null || echo "⚠️  Could not ensure system agents (database might handle this automatically)"
else
    echo "⚠️  psql not found - skipping system agent creation (database will handle on first use)"
fi

# Wait for tools-runner to fully initialize and register tools
echo "⏳ Waiting for tools-runner to initialize..."
sleep 15

# Bootstrap system using SINGLE SOURCE OF TRUTH
echo "🌱 Bootstrapping system from bootstrap-breadcrumbs/ ..."
echo "   Note: First startup loads AI models and can take 1-2 minutes"
if command -v node >/dev/null 2>&1; then
    (cd bootstrap-breadcrumbs && npm install --silent && node bootstrap.js) || {
        echo "❌ Bootstrap failed!"
        echo ""
        echo "To fix:"
        echo "  1. Check bootstrap-breadcrumbs/system/default-chat-agent.json exists"
        echo "  2. Manually run: cd bootstrap-breadcrumbs && node bootstrap.js"
        echo "  3. Check logs for specific errors"
        echo ""
        exit 1
    }
    
    # Wait for bootstrap tools to execute (openrouter-models-sync needs to run)
    echo "⏳ Waiting for bootstrap tools to complete initial execution..."
    echo "   (This includes syncing OpenRouter model catalog)"
    sleep 20
    
    # Restart tools-runner to ensure it picks up the model catalog
    echo "🔄 Restarting tools-runner to load model catalog..."
    docker compose restart tools-runner
    sleep 10
else
    echo "❌ Node.js not found - bootstrap requires Node.js"
    echo "   Install Node.js and run: cd bootstrap-breadcrumbs && node bootstrap.js"
    exit 1
fi

# Add OpenRouter key if .env has been updated
if grep -q "your-openrouter-api-key-here" .env; then
  echo "⚠️  OpenRouter API key not configured in .env"
  echo "   Please update .env and run: node add-openrouter-key.js"
else
  echo "🔑 Adding OpenRouter API key to secrets..."
  node add-openrouter-key.js 2>/dev/null || echo "⚠️  Failed to add OpenRouter key (you can run this manually later)"
fi

# NOW start the agent-runner after default agent is loaded
echo ""
echo "🤖 Starting agent-runner..."
docker compose up -d agent-runner

# Final wait
echo "⏳ Waiting for agent-runner to initialize..."
sleep 10

echo ""
echo "✅ RCRT Setup Complete!"
echo ""
if [ -n "$PROJECT_PREFIX" ]; then
    echo "🏷️  Custom prefix: ${PROJECT_PREFIX}"
    echo "   Container names: ${PROJECT_PREFIX}rcrt, ${PROJECT_PREFIX}db, etc."
    echo ""
fi
echo "🌐 Access your services:"
echo "   • Dashboard:     http://localhost:8082  (Main UI)"
echo "   • RCRT API:      http://localhost:8081  (Backend)"
echo "   • Builder UI:    http://localhost:3000  (Visual Builder - if running)"
echo ""
echo "📋 What's running:"
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo ""
echo "🤖 System Components:"
echo "   ✅ Modern Agent Runner  - Executes agent definitions"
echo "   ✅ Tools Runner         - Handles tool invocations (Deno-based)"
echo "   ✅ Context Builder      - Rust-based context assembly"
echo "   ✅ Database & NATS      - Core infrastructure"
echo "   ✅ Dashboard            - Visual management interface"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env with your OpenRouter API key for LLM features"
echo "   2. Visit http://localhost:8082 to explore the dashboard"
echo "   3. Create agent definitions and see them execute automatically"
echo "   4. Check logs: docker compose logs -f [service-name]"
echo ""
echo "🛑 To stop: docker compose down"
echo "🔄 If agent-runner shows 0 agents: ./reload-agents.js"
echo ""
echo "🧩 Browser Extension:"
if [ -d "extension/dist" ]; then
    echo "   ✅ Extension is built and ready in: extension/dist/"
    echo "   📋 To install in Chrome/Edge:"
    echo "      1. Open chrome://extensions/ (or edge://extensions/)"
    echo "      2. Enable 'Developer mode' (toggle in top right)"
    echo "      3. Click 'Load unpacked'"
    echo "      4. Select the 'extension/dist' folder"
    echo "      5. Click the RCRT extension icon to start chatting!"
else
    echo "   ⚠️  Extension not built yet. To build:"
    echo "      cd extension && npm install && npm run build"
fi