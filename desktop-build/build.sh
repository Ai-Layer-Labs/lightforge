#!/bin/bash
# RCRT Desktop Installer - Complete Build Script
# One command builds everything

set -e

PLATFORM="${1:-windows}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 RCRT Desktop Installer Builder"
echo "=================================="
echo "Platform: $PLATFORM"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

step() { echo -e "${BLUE}▶${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }

# Step 1: Build Docker images
step "Step 1: Building Docker images..."
cd "$PROJECT_ROOT"
if ! docker compose build; then
    echo "❌ Docker build failed! Is Docker Desktop running?"
    exit 1
fi
success "Docker images built"

# Step 2: Save Docker images as tar files
step "Step 2: Saving Docker images for bundling..."
cd "$SCRIPT_DIR"

mkdir -p podman/images

echo "  Saving rcrt..."
docker save thinkos-1-rcrt -o podman/images/rcrt.tar
echo "  ✓ rcrt.tar ($(du -h podman/images/rcrt.tar | cut -f1))"

echo "  Saving dashboard..."
docker save thinkos-1-dashboard -o podman/images/dashboard.tar
echo "  ✓ dashboard.tar ($(du -h podman/images/dashboard.tar | cut -f1))"

echo "  Saving agent-runner..."
docker save thinkos-1-agent-runner -o podman/images/agent-runner.tar
echo "  ✓ agent-runner.tar ($(du -h podman/images/agent-runner.tar | cut -f1))"

echo "  Saving tools-runner..."
docker save thinkos-1-tools-runner -o podman/images/tools-runner.tar
echo "  ✓ tools-runner.tar ($(du -h podman/images/tools-runner.tar | cut -f1))"

echo "  Saving context-builder..."
docker save thinkos-1-context-builder -o podman/images/context-builder.tar
echo "  ✓ context-builder.tar ($(du -h podman/images/context-builder.tar | cut -f1))"

echo "  Pulling and saving PostgreSQL..."
docker pull pgvector/pgvector:pg16
docker save pgvector/pgvector:pg16 -o podman/images/postgres.tar
echo "  ✓ postgres.tar ($(du -h podman/images/postgres.tar | cut -f1))"

echo "  Pulling and saving NATS..."
docker pull nats:2
docker save nats:2 -o podman/images/nats.tar
echo "  ✓ nats.tar ($(du -h podman/images/nats.tar | cut -f1))"

success "Docker images saved"
echo "  Total images size: $(du -sh podman/images | cut -f1)"

# Step 3: Download Podman and Helium (if not already downloaded)
step "Step 3: Checking downloads..."
cd podman

if [ ! -f "podman-5.3.1-setup.exe" ] || [ ! -f "helium-windows.zip" ]; then
    echo "  Downloading Podman and Helium..."
    ./download-podman.sh $PLATFORM
else
    echo "  ✓ Podman and Helium already downloaded"
fi

success "Downloads ready"

# Step 4: Build service manager
step "Step 4: Building service manager..."
cd "$SCRIPT_DIR/service-manager"
if ! ./build.sh $PLATFORM; then
    echo "❌ Service manager build failed!"
    exit 1
fi
success "Service manager built"

# Step 5: Build installer
step "Step 5: Creating installer..."
cd "$SCRIPT_DIR/installers/$PLATFORM"
if ! ./build-$PLATFORM.sh; then
    echo "❌ Installer creation failed!"
    exit 1
fi
success "Installer created"

# Done!
echo ""
echo "✅ Build complete!"
echo ""
echo "📦 Your installer:"
ls -lh "$SCRIPT_DIR/dist/RCRT-Setup.exe"
echo ""
echo "📊 What's included:"
echo "  - Podman CLI (31MB)"
echo "  - Docker images (bundled, ready to import)"
echo "  - Helium browser (370MB)"
echo "  - System tray app"
echo "  - Extension (pre-configured)"
echo ""
echo "🧪 Test it:"
echo "  desktop-build/dist/RCRT-Setup.exe"
echo ""
echo "🎉 Ready to ship to your client!"

