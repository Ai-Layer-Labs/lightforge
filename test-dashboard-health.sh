#!/bin/bash
# Dashboard Health Check Script

echo "🔍 Testing RCRT Dashboard v2 Health..."
echo ""

# Test main page
echo "1️⃣ Testing main page (http://localhost:8082/):"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/)
if [ "$STATUS" = "200" ]; then
    echo "   ✅ Main page: OK (200)"
else
    echo "   ❌ Main page: FAILED (HTTP $STATUS)"
fi

# Test JavaScript asset
echo ""
echo "2️⃣ Testing JavaScript assets:"
JS_FILE=$(curl -s http://localhost:8082/ | grep -o '/assets/index-[^"]*\.js' | head -1)
if [ -n "$JS_FILE" ]; then
    JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8082$JS_FILE")
    if [ "$JS_STATUS" = "200" ]; then
        echo "   ✅ JavaScript: OK (200) - $JS_FILE"
    else
        echo "   ❌ JavaScript: FAILED (HTTP $JS_STATUS) - $JS_FILE"
    fi
else
    echo "   ❌ JavaScript: No JS file found in HTML"
fi

# Test RCRT API proxy
echo ""
echo "3️⃣ Testing RCRT API proxy (http://localhost:8082/api/health):"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/api/health)
API_RESPONSE=$(curl -s http://localhost:8082/api/health)
if [ "$API_STATUS" = "200" ]; then
    echo "   ✅ API Proxy: OK (200) - Response: $API_RESPONSE"
else
    echo "   ❌ API Proxy: FAILED (HTTP $API_STATUS)"
fi

# Test direct RCRT API
echo ""
echo "4️⃣ Testing direct RCRT API (http://localhost:8081/health):"
DIRECT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/health)
DIRECT_RESPONSE=$(curl -s http://localhost:8081/health)
if [ "$DIRECT_STATUS" = "200" ]; then
    echo "   ✅ Direct API: OK (200) - Response: $DIRECT_RESPONSE"
else
    echo "   ❌ Direct API: FAILED (HTTP $DIRECT_STATUS)"
fi

# Check container health
echo ""
echo "5️⃣ Container Health Status:"
docker compose ps --format "table {{.Service}}\t{{.Status}}" | grep -E "(dashboard|rcrt)"

echo ""
echo "📝 Summary:"
echo "   - Dashboard URL: http://localhost:8082"
echo "   - If page loads but shows blank, check browser console for errors"
echo "   - If page doesn't load at all, check network/firewall settings"
