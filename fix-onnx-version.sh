#!/bin/bash
# Quick fix for ONNX Runtime version mismatch

echo "🔧 Fixing ONNX Runtime version mismatch..."
echo ""
echo "The issue: ort crate expects ONNX Runtime 1.22.x but found 1.16.3"
echo "This fix updates to the correct version."
echo ""

# Stop services
echo "🛑 Stopping services..."
docker compose down

# Remove old RCRT image to force rebuild
echo "🗑️ Removing old RCRT image..."
docker rmi $(docker images -q '*rcrt*' 2>/dev/null) 2>/dev/null || true

# Rebuild with correct ONNX version
echo "🔨 Rebuilding RCRT with ONNX Runtime 1.22.0..."
docker compose build rcrt

# Start everything fresh
echo "🚀 Starting services..."
docker compose up -d

# Wait a bit
echo "⏳ Waiting for services to initialize..."
sleep 30

# Check health
echo ""
echo "🏥 Checking RCRT health..."
if curl -s http://localhost:8081/health > /dev/null; then
    echo "✅ RCRT is healthy!"
else
    echo "⚠️  RCRT might still be starting. Checking logs..."
    docker compose logs rcrt --tail 20
fi

echo ""
echo "✅ Fix applied! RCRT should now be using the correct ONNX Runtime version."
echo ""
echo "🔍 To verify the fix worked, check for:"
echo "   - No more 'ort 2.0.0-rc.10 is not compatible' errors"
echo "   - Successful ONNX model loading messages"
echo ""
echo "📋 Check logs with: docker compose logs -f rcrt"
