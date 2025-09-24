#!/bin/bash
# Check OpenRouter setup

echo "🔍 Checking OpenRouter configuration..."
echo ""

# Check if OPENROUTER_API_KEY is set
if [ -z "$OPENROUTER_API_KEY" ]; then
    echo "❌ OPENROUTER_API_KEY is not set!"
    echo ""
    echo "To fix this, you need to:"
    echo "1. Get your API key from https://openrouter.ai/keys"
    echo "2. Set it in your environment:"
    echo ""
    echo "   # For this session only:"
    echo "   export OPENROUTER_API_KEY='your-key-here'"
    echo ""
    echo "   # Or add to .env file:"
    echo "   echo 'OPENROUTER_API_KEY=your-key-here' >> .env"
    echo ""
    echo "3. Restart the containers:"
    echo "   docker-compose restart"
else
    echo "✅ OPENROUTER_API_KEY is set: ${OPENROUTER_API_KEY:0:10}..."
fi

# Check if .env file exists
echo ""
if [ -f .env ]; then
    echo "📄 .env file exists"
    if grep -q "OPENROUTER_API_KEY" .env; then
        echo "✅ OPENROUTER_API_KEY found in .env"
    else
        echo "⚠️  OPENROUTER_API_KEY not found in .env"
    fi
else
    echo "❌ No .env file found"
fi

# Check if the containers have the key
echo ""
echo "🐳 Checking containers..."
if docker exec breadcrums-rcrt-1 sh -c 'test -n "$OPENROUTER_API_KEY"' 2>/dev/null; then
    echo "✅ RCRT container has OPENROUTER_API_KEY"
else
    echo "❌ RCRT container does NOT have OPENROUTER_API_KEY"
fi

if docker exec breadcrums-agent-runner-1 sh -c 'test -n "$OPENROUTER_API_KEY"' 2>/dev/null; then
    echo "✅ Agent-runner container has OPENROUTER_API_KEY"
else
    echo "❌ Agent-runner container does NOT have OPENROUTER_API_KEY"
fi

if docker exec breadcrums-tools-runner-1 sh -c 'test -n "$OPENROUTER_API_KEY"' 2>/dev/null; then
    echo "✅ Tools-runner container has OPENROUTER_API_KEY"
else
    echo "❌ Tools-runner container does NOT have OPENROUTER_API_KEY"
fi

echo ""
echo "💡 The frontend configuration UI is currently disconnected from the backend."
echo "   The only way to configure OpenRouter is through environment variables."
