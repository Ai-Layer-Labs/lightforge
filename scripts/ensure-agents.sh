#!/bin/bash

# Ensure Required Agents Script
# This script ensures all agents defined in docker-compose.yml are registered in the database

set -e

RCRT_URL="${RCRT_URL:-http://localhost:8081}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:8082}"

echo "🤖 Ensuring all required agents are registered..."

# Wait for services to be healthy
echo "⏳ Waiting for RCRT service to be ready..."
for i in {1..30}; do
    if curl -s "$RCRT_URL/health" > /dev/null 2>&1; then
        echo "✅ RCRT service is healthy"
        break
    fi
    echo "⏳ Attempt $i/30: RCRT not ready, waiting 2 seconds..."
    sleep 2
done

echo "⏳ Waiting for Dashboard service to be ready..."
for i in {1..30}; do
    if curl -s "$DASHBOARD_URL/health" > /dev/null 2>&1; then
        echo "✅ Dashboard service is healthy"
        break
    fi
    echo "⏳ Attempt $i/30: Dashboard not ready, waiting 2 seconds..."
    sleep 2
done

# Get JWT token for authentication
echo "🔑 Getting JWT token..."
JWT_TOKEN=$(curl -s "$DASHBOARD_URL/api/auth/token" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JWT_TOKEN" ]; then
    echo "❌ Failed to get JWT token"
    exit 1
fi

echo "✅ JWT token obtained"

# Define required agents from docker-compose.yml
declare -A REQUIRED_AGENTS=(
    ["00000000-0000-0000-0000-0000000000aa"]="RCRT Server"
    ["00000000-0000-0000-0000-0000000000bb"]="Tools Runner"  
    ["00000000-0000-0000-0000-000000000ddd"]="Dashboard"
    ["00000000-0000-0000-0000-000000000AAA"]="Agent Runner"
)

# Check and register each required agent
for AGENT_ID in "${!REQUIRED_AGENTS[@]}"; do
    AGENT_NAME="${REQUIRED_AGENTS[$AGENT_ID]}"
    echo "🔍 Checking agent: $AGENT_NAME ($AGENT_ID)"
    
    # Check if agent exists
    AGENT_EXISTS=$(curl -s "$DASHBOARD_URL/api/agents" | grep -c "$AGENT_ID" || echo "0")
    
    if [ "$AGENT_EXISTS" -eq "0" ]; then
        echo "❌ Agent $AGENT_NAME not found, registering..."
        
        # Register the agent
        RESPONSE=$(curl -s -w "%{http_code}" -X POST "$RCRT_URL/agents/$AGENT_ID" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $JWT_TOKEN" \
            -d '{"roles": ["curator", "emitter", "subscriber"]}')
        
        HTTP_CODE="${RESPONSE: -3}"
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ Agent $AGENT_NAME registered successfully"
        else
            echo "⚠️ Agent $AGENT_NAME registration returned HTTP $HTTP_CODE"
        fi
    else
        echo "✅ Agent $AGENT_NAME already exists"
    fi
done

echo "🎉 Agent registration check complete!"

# Verify all agents are now present
echo "📋 Final agent count:"
TOTAL_AGENTS=$(curl -s "$DASHBOARD_URL/api/agents" | grep -c '"id"' || echo "0")
echo "   Total agents registered: $TOTAL_AGENTS"

if [ "$TOTAL_AGENTS" -ge "3" ]; then
    echo "✅ All required agents are registered"
else
    echo "⚠️ Expected at least 3 agents, found $TOTAL_AGENTS"
fi

echo "🚀 System ready for use!"
