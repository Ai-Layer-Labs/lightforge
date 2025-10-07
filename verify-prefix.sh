#!/bin/bash
# Verification script for RCRT prefix configuration

set -e

echo "🔍 RCRT Prefix Configuration Verification"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Run ./setup.sh first."
    exit 1
fi

# Load .env
source .env 2>/dev/null || true

# Get prefix
PREFIX="${PROJECT_PREFIX:-}"

echo "📋 Configuration:"
echo "   Prefix: ${PREFIX:-none}"
echo "   RCRT URL: ${RCRT_BASE_URL:-not set}"
echo "   DB URL: ${DB_URL:-not set}"
echo "   NATS URL: ${NATS_URL:-not set}"
echo ""

# Check docker-compose.override.yml
if [ -n "$PREFIX" ]; then
    if [ -f "docker-compose.override.yml" ]; then
        echo "✅ docker-compose.override.yml exists"
    else
        echo "⚠️  docker-compose.override.yml not found (expected with prefix)"
    fi
else
    echo "ℹ️  No prefix configured (using defaults)"
fi
echo ""

# Check running containers
echo "🐳 Docker Containers:"
if docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -q "${PREFIX}"; then
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep "${PREFIX}" || echo "   None running with prefix"
else
    if [ -n "$PREFIX" ]; then
        echo "   ⚠️  No containers found with prefix: ${PREFIX}"
        echo "   Run: docker compose up -d"
    else
        docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(rcrt|db|nats|dashboard)" || echo "   No RCRT containers running"
    fi
fi
echo ""

# Test connectivity
echo "🌐 External Connectivity:"

# Test RCRT server
if curl -s http://localhost:8081/health >/dev/null 2>&1; then
    echo "   ✅ RCRT Server: http://localhost:8081 (reachable)"
else
    echo "   ❌ RCRT Server: http://localhost:8081 (not reachable)"
fi

# Test dashboard
if curl -s http://localhost:8082 >/dev/null 2>&1; then
    echo "   ✅ Dashboard: http://localhost:8082 (reachable)"
else
    echo "   ❌ Dashboard: http://localhost:8082 (not reachable)"
fi
echo ""

# Check service communication (if running)
echo "🔗 Internal Service Communication:"
if docker compose ps | grep -q "Up"; then
    # Check if rcrt can reach db
    if docker compose exec -T rcrt sh -c 'exit 0' 2>/dev/null; then
        echo "   ✅ RCRT container accessible"
        
        # Try to check database connection
        if docker compose exec -T db psql -U postgres -d rcrt -c "SELECT 1" >/dev/null 2>&1; then
            echo "   ✅ Database accessible from host"
        else
            echo "   ⚠️  Database not accessible (might be initializing)"
        fi
    else
        echo "   ⚠️  RCRT container not accessible"
    fi
else
    echo "   ℹ️  Services not running. Start with: docker compose up -d"
fi
echo ""

# Summary
echo "📊 Summary:"
if [ -n "$PREFIX" ]; then
    echo "   • Using prefix: ${PREFIX}"
    echo "   • Container names: ${PREFIX}rcrt, ${PREFIX}db, etc."
    echo "   • Override file: $([ -f docker-compose.override.yml ] && echo 'Present' || echo 'Missing')"
else
    echo "   • Using default container names (no prefix)"
fi

RUNNING_COUNT=$(docker compose ps --status running 2>/dev/null | wc -l)
echo "   • Running services: $((RUNNING_COUNT - 1))"  # Subtract header line

RCRT_STATUS=$(curl -s http://localhost:8081/health >/dev/null 2>&1 && echo "Healthy" || echo "Down")
echo "   • RCRT API: $RCRT_STATUS"

DASH_STATUS=$(curl -s http://localhost:8082 >/dev/null 2>&1 && echo "Healthy" || echo "Down")
echo "   • Dashboard: $DASH_STATUS"
echo ""

# Final verdict
if [ "$RCRT_STATUS" = "Healthy" ] && [ "$DASH_STATUS" = "Healthy" ]; then
    echo "✅ System is healthy and properly configured!"
    exit 0
elif docker compose ps --status running 2>/dev/null | grep -q "Up"; then
    echo "⚠️  Services are running but not fully healthy yet."
    echo "   Give it a few more seconds, then run: curl http://localhost:8081/health"
    exit 0
else
    echo "❌ Services are not running."
    echo "   Start with: docker compose up -d"
    exit 1
fi

