#!/bin/bash
# Simple RCRT Setup Script - Just Works™

set -e

echo "🚀 Starting RCRT Setup..."

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

# Build core services first (they're more reliable)
echo "🔨 Building core services..."
docker compose up -d db nats rcrt dashboard

# Wait a bit for core services
echo "⏳ Waiting for core services..."
sleep 15

# Start agent and tools runners
echo "🤖 Starting agent-runner and tools-runner..."
docker compose up -d tools-runner agent-runner

# Try to start builder (may fail due to node_modules issues)
echo "🔨 Starting builder (optional)..."
docker compose up -d builder || echo "⚠️  Builder may have build issues (not critical)"

echo "⏳ Waiting for services..."
sleep 30

# Register agents
echo "🤖 Registering agents..."
./scripts/ensure-agents.sh || echo "⚠️  Agent registration may need manual setup"

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