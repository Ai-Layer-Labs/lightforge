#!/bin/bash
# Build simplified Podman-based service manager

set -e

PLATFORM="${1:-all}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../output/bin"

mkdir -p "$OUTPUT_DIR"

echo "🔨 Building RCRT Podman Service Manager..."
echo ""

# Install dependencies
echo "📦 Installing Go dependencies..."
go mod tidy
go mod download
echo "✓ Dependencies installed"
echo ""

# Build for each platform
if [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "all" ]; then
    echo "Building for Windows..."
    GOOS=windows GOARCH=amd64 go build -o "$OUTPUT_DIR/rcrt-service.exe" .
    echo "✓ Windows binary created"
fi

if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "all" ]; then
    echo "Building for macOS (ARM64)..."
    GOOS=darwin GOARCH=arm64 go build -o "$OUTPUT_DIR/rcrt-service-mac-arm64" .
    echo "✓ macOS ARM64 binary created"
    
    echo "Building for macOS (AMD64)..."
    GOOS=darwin GOARCH=amd64 go build -o "$OUTPUT_DIR/rcrt-service-mac-amd64" .
    echo "✓ macOS AMD64 binary created"
fi

echo ""
echo "✅ Podman service manager built!"
ls -lh "$OUTPUT_DIR"/rcrt-service*

