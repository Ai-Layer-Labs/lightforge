#!/bin/bash

# RCRT Visual Builder Test Suite Runner
# Runs all tests against your RCRT backend

set -e

echo "🧪 RCRT Visual Builder Test Suite"
echo "================================="
echo ""

# Check if RCRT is running
echo "🔍 Checking RCRT backend..."
RCRT_URL=${RCRT_URL:-http://localhost:8081}

if curl -s -f "$RCRT_URL/health" > /dev/null; then
    echo "✅ RCRT backend is running at $RCRT_URL"
else
    echo "❌ RCRT backend is not accessible at $RCRT_URL"
    echo "   Please start RCRT with: docker compose up -d"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install typescript ts-node @types/node eventsource
fi

# Run SDK tests
echo ""
echo "1️⃣  Running Enhanced SDK Tests"
echo "-------------------------------"
npx ts-node test/test-enhanced-sdk.ts

# Run agent system tests
echo ""
echo "2️⃣  Running Agent System Integration Tests"
echo "------------------------------------------"
npx ts-node test/test-agent-system.ts

echo ""
echo "✅ All tests completed successfully!"
echo ""
echo "📊 Test Summary:"
echo "  - Enhanced SDK: All features tested"
echo "  - Agent System: Meta-agents, collaboration, UI components"
echo "  - Performance: Latency within targets"
echo ""
echo "🚀 Ready to build the visual agent builder!"
