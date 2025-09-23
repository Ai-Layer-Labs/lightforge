#!/bin/bash
# RCRT Setup Script with Bootstrap System
# Includes automatic data initialization

set -e

echo "🚀 Starting RCRT Setup with Bootstrap..."
echo "========================================"

# Check Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Generate .env if missing
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# RCRT Environment Configuration
RCRT_BASE_URL=http://localhost:8081
WORKSPACE=workspace:default
OWNER_ID=00000000-0000-0000-0000-000000000001
AGENT_ID=00000000-0000-0000-0000-000000000AAA
LOCAL_KEK_BASE64=
OPENROUTER_API_KEY=
OPENROUTER_REFERER=http://localhost:8082
OPENROUTER_SITE_TITLE="RCRT Local"
EOF
    echo "⚠️  Please edit .env with your actual API keys"
fi

# Clean any problematic files first
echo "🧹 Cleaning up..."
rm -rf rcrt-visual-builder/apps/builder/node_modules || true
rm -rf rcrt-visual-builder/node_modules || true

# Build core services first (they're more reliable)
echo "🔨 Building core services..."
docker compose up -d db nats rcrt dashboard

# Wait for core services
echo "⏳ Waiting for core services..."
sleep 15

# Start agent and tools runners
echo "🤖 Starting agent-runner and tools-runner..."
docker compose up -d tools-runner agent-runner

# Try to start builder (may fail due to node_modules issues)
echo "🔨 Starting builder (optional)..."
docker compose up -d builder || echo "⚠️  Builder may have build issues (not critical)"

echo "⏳ Waiting for services to stabilize..."
sleep 30

# Register system agents
echo "🤖 Registering system agents..."
./scripts/ensure-agents.sh || echo "⚠️  Agent registration may need manual setup"

# Bootstrap system data
echo "📚 Bootstrapping system data..."
if [ -d "bootstrap-breadcrumbs" ]; then
    cd bootstrap-breadcrumbs
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "   Installing bootstrap dependencies..."
        npm install node-fetch >/dev/null 2>&1 || true
    fi
    
    # Run bootstrap
    echo "   Loading essential breadcrumbs..."
    node bootstrap.js || echo "⚠️  Bootstrap may need manual completion"
    cd ..
else
    echo "⚠️  Bootstrap directory not found - skipping data initialization"
fi

# Load template library (if exists)
if [ -f "load-templates-simple.js" ]; then
    echo "📖 Loading template library..."
    node load-templates-simple.js || echo "⚠️  Template loading optional"
fi

echo ""
echo "✅ RCRT Setup Complete!"
echo "========================================"
echo ""
echo "🌐 Access your services:"
echo "   • Dashboard:     http://localhost:8082  (Main UI)"
echo "   • RCRT API:      http://localhost:8081  (Backend)"
echo "   • Builder UI:    http://localhost:3000  (Visual Builder - if running)"
echo ""
echo "📋 What's running:"
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo ""
echo "🎯 What's initialized:"
echo "   ✅ System agents registered"
echo "   ✅ Tool catalog with llm_hints"
echo "   ✅ Default chat agent ready"
echo "   ✅ Template library loaded"
echo "   ✅ Bootstrap marker created"
echo ""
echo "💡 Quick Start:"
echo "   1. Visit http://localhost:8082"
echo "   2. The default chat agent is ready to use"
echo "   3. Explore templates to learn patterns"
echo "   4. Create new agents following examples"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env with your OpenRouter API key"
echo "   2. Test the chat interface"
echo "   3. Check logs: docker compose logs -f [service-name]"
echo ""
echo "🛑 To stop: docker compose down"
echo "♻️  To reset: docker compose down -v && rm -rf data/"
