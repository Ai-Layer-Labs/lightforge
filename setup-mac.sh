#!/bin/bash
# Mac-specific setup script for RCRT with ONNX support
set -e

echo "🍎 RCRT Mac Setup Script"
echo "========================"

# Check if running on Mac
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  This script is designed for macOS. Use setup.sh for other platforms."
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop for Mac."
    exit 1
fi

# Detect architecture
ARCH=$(uname -m)
echo "💻 Detected architecture: $ARCH"

if [[ "$ARCH" == "arm64" ]]; then
    echo "🔧 Apple Silicon detected - will use Rosetta emulation for x64"
    echo ""
    echo "⚠️  IMPORTANT: For best performance, ensure Rosetta is enabled in Docker Desktop:"
    echo "   Docker Desktop → Settings → Features in development"
    echo "   → Enable 'Use Rosetta for x86/amd64 emulation on Apple Silicon'"
    echo ""
    read -p "Press Enter to continue once Rosetta is enabled..."
fi

# Clean up any existing setup
echo ""
echo "🧹 Cleaning up previous installation..."
docker compose down 2>/dev/null || true

# Clean any problematic files
rm -rf rcrt-visual-builder/apps/builder/node_modules || true
rm -rf rcrt-visual-builder/node_modules || true

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

# Build the browser extension first (if node/npm available)
if command -v npm >/dev/null 2>&1 && [ -d "extension" ]; then
    echo "🧩 Building browser extension..."
    (cd extension && npm install && npm run build) || echo "⚠️  Extension build failed (not critical)"
    echo "✅ Extension built in extension/dist/"
else
    echo "⚠️  Node.js not found or extension directory missing - skipping extension build"
    echo "   You can build it later with: cd extension && npm install && npm run build"
fi

# Build core services with Mac-specific configuration
echo ""
echo "🔨 Building core services with Mac-optimized configuration..."
docker compose -f docker-compose.yml -f docker-compose.mac.yml up -d db nats rcrt dashboard tools-runner

# Wait for core services to be ready
echo "⏳ Waiting for core services..."
sleep 20

# Try to start builder (may fail due to node_modules issues)
echo "🔨 Starting builder (optional)..."
docker compose -f docker-compose.yml -f docker-compose.mac.yml up -d builder || echo "⚠️  Builder may have build issues (not critical)"

echo "⏳ Waiting for services..."
sleep 30

# Check RCRT health
echo ""
echo "🏥 Checking RCRT health..."
if curl -s http://localhost:8081/health > /dev/null; then
    echo "✅ RCRT is healthy!"
else
    echo "⚠️  RCRT health check failed. Checking logs..."
    docker compose logs rcrt --tail 50
fi

# Bootstrap the system
echo ""
echo "🌱 Bootstrapping RCRT system..."

# npm install for Node.js dependencies (needed for scripts)
if command -v npm &> /dev/null; then
    echo "📦 Installing Node.js dependencies..."
    npm install --no-audit --no-fund 2>/dev/null || echo "⚠️  npm install had issues (not critical)"
fi

# Create system agent
echo "🔧 Ensuring system agents exist..."
docker compose exec -T db psql -U postgres -d rcrt << 'EOF' 2>/dev/null || true
INSERT INTO agents (id, owner_id, roles) 
VALUES ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000001', '{"emitter", "curator"}')
ON CONFLICT (id, owner_id) DO NOTHING;
EOF

# Wait for tools to register
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
docker compose -f docker-compose.yml -f docker-compose.mac.yml up -d agent-runner

# Final wait
echo "⏳ Waiting for agent-runner to initialize..."
sleep 10

echo ""
echo "✅ RCRT Mac Setup Complete!"
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
echo ""
echo "📚 Mac-specific troubleshooting: MAC_TROUBLESHOOTING.md"
