#!/bin/bash
# Test script for new React dashboard

set -e

echo "🧪 Testing New Dashboard Setup..."

# Check if dashboard service is defined
echo "📋 Checking docker-compose configuration..."
if docker compose config | grep -q "dashboard:"; then
    echo "✅ Dashboard service found in docker-compose.yml"
else
    echo "❌ Dashboard service not found!"
    exit 1
fi

# Build the new dashboard
echo ""
echo "🔨 Building new dashboard..."
docker compose build dashboard

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Dashboard build successful"
else
    echo "❌ Dashboard build failed!"
    exit 1
fi

# Start just the dashboard service (assumes rcrt is already running)
echo ""
echo "🚀 Starting dashboard service..."
docker compose up -d dashboard

# Wait for dashboard to be ready
echo "⏳ Waiting for dashboard to start..."
sleep 10

# Test dashboard health
echo ""
echo "🏥 Testing dashboard health..."
if curl -f -s http://localhost:8082/index.html > /dev/null; then
    echo "✅ Dashboard is serving static content"
else
    echo "❌ Dashboard static content check failed!"
    docker compose logs dashboard
    exit 1
fi

# Test API proxy
echo ""
echo "🔗 Testing API proxy..."
if curl -f -s http://localhost:8082/api/health > /dev/null 2>&1; then
    echo "✅ API proxy is working"
else
    echo "⚠️  API proxy test failed (RCRT might not be running)"
fi

# Show dashboard logs
echo ""
echo "📋 Dashboard logs (last 20 lines):"
docker compose logs --tail=20 dashboard

echo ""
echo "✅ Dashboard migration test complete!"
echo ""
echo "🌐 Access the new dashboard at: http://localhost:8082"
echo ""
echo "💡 Tips:"
echo "   - View logs: docker compose logs -f dashboard"
echo "   - Restart: docker compose restart dashboard"
echo "   - Stop: docker compose stop dashboard"
