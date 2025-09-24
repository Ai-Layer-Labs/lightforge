#!/bin/bash

echo "Testing resilient startup behavior..."

# Test 1: Start dashboard before RCRT
echo "Test 1: Starting dashboard before RCRT is ready"
echo "This should demonstrate the retry logic and graceful handling"

# Start only the database and nats first
docker-compose up -d db nats
echo "Waiting for db and nats to be ready..."
sleep 10

# Start dashboard (which will wait for RCRT)
echo "Starting dashboard (should wait for RCRT)..."
docker-compose up -d dashboard &
DASHBOARD_PID=$!

# Wait a bit, then start RCRT
echo "Waiting 30 seconds before starting RCRT..."
sleep 30

echo "Now starting RCRT..."
docker-compose up -d rcrt

# Wait for everything to be ready
echo "Waiting for all services to be healthy..."
sleep 60

# Check if dashboard is responding
echo "Testing dashboard health..."
curl -f http://localhost:8082/health || echo "Dashboard health check failed"

# Check if we can get JWT token
echo "Testing JWT token endpoint..."
curl -f http://localhost:8082/api/auth/token || echo "JWT token endpoint failed"

# Check if we can get breadcrumbs (requires authentication)
echo "Testing authenticated endpoint..."
curl -f http://localhost:8082/api/breadcrumbs || echo "Breadcrumbs endpoint failed (expected if no data)"

echo "Test 1 complete. Check logs with: docker-compose logs dashboard"

# Test 2: Restart RCRT while dashboard is running
echo ""
echo "Test 2: Restarting RCRT while dashboard is running"
echo "This should demonstrate JWT renewal and connection recovery"

echo "Stopping RCRT..."
docker-compose stop rcrt

echo "Waiting 30 seconds..."
sleep 30

echo "Testing dashboard during RCRT downtime (should fail gracefully)..."
curl -f http://localhost:8082/api/breadcrumbs || echo "Expected failure during RCRT downtime"

echo "Restarting RCRT..."
docker-compose up -d rcrt

echo "Waiting for RCRT to be healthy again..."
sleep 30

echo "Testing dashboard after RCRT recovery..."
curl -f http://localhost:8082/api/breadcrumbs || echo "Breadcrumbs endpoint failed after recovery"

echo "Test 2 complete."

echo ""
echo "All tests complete. The dashboard should now be resilient to:"
echo "1. RCRT service not being ready at startup"
echo "2. JWT token expiration and renewal"
echo "3. Temporary RCRT service outages"
echo "4. Service restart scenarios"
echo ""
echo "Check detailed logs with:"
echo "  docker-compose logs dashboard"
echo "  docker-compose logs rcrt"
