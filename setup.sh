#!/bin/bash
# Universal RCRT Setup Script - Works on Mac, Linux, and Windows!

set -e

echo "🚀 Starting RCRT Setup..."
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
    cat > .env << 'EOF'
# RCRT Environment Configuration
LOCAL_KEK_BASE64="your-encryption-key-here"
OPENROUTER_API_KEY="your-openrouter-api-key-here"
OPENROUTER_REFERER="http://localhost:3000"
OPENROUTER_SITE_TITLE="RCRT Local"
EOF
    echo "⚠️  Please edit .env with your actual API keys"
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

# Start services
docker compose up -d db nats rcrt dashboard tools-runner

# Wait for core services to be ready
echo "⏳ Waiting for core services..."
sleep 20

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

# Wait a bit more for tools-runner to register tools
echo "⏳ Waiting for tool catalog to be created..."
sleep 10

# Load default agent using robust script
echo "🤖 Ensuring default chat agent..."
echo "   Note: First startup loads AI models and can take 1-2 minutes"
node ensure-default-agent.js || echo "⚠️  Failed to load default agent (run 'node ensure-default-agent.js' manually)"

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
echo "   ✅ Tools Runner         - Handles tool invocations"
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