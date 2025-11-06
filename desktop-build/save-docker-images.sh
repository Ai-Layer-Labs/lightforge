#!/bin/bash
# Save Docker images as tar files for bundling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/podman/images"

mkdir -p "$OUTPUT_DIR"

echo "📦 Building and saving Docker images..."
echo ""

cd "$PROJECT_ROOT"

# Build all images
echo "1️⃣ Building Docker images..."
docker compose build

# Save each image
echo ""
echo "2️⃣ Saving images as tar files..."

echo "  Saving rcrt..."
docker save thinkos-1-rcrt -o "$OUTPUT_DIR/rcrt.tar"
echo "  ✓ rcrt.tar ($(du -h "$OUTPUT_DIR/rcrt.tar" | cut -f1))"

echo "  Saving dashboard..."
docker save thinkos-1-dashboard -o "$OUTPUT_DIR/dashboard.tar"
echo "  ✓ dashboard.tar ($(du -h "$OUTPUT_DIR/dashboard.tar" | cut -f1))"

echo "  Saving agent-runner..."
docker save thinkos-1-agent-runner -o "$OUTPUT_DIR/agent-runner.tar"
echo "  ✓ agent-runner.tar ($(du -h "$OUTPUT_DIR/agent-runner.tar" | cut -f1))"

echo "  Saving tools-runner..."
docker save thinkos-1-tools-runner -o "$OUTPUT_DIR/tools-runner.tar"
echo "  ✓ tools-runner.tar ($(du -h "$OUTPUT_DIR/tools-runner.tar" | cut -f1))"

echo "  Saving context-builder..."
docker save thinkos-1-context-builder -o "$OUTPUT_DIR/context-builder.tar"
echo "  ✓ context-builder.tar ($(du -h "$OUTPUT_DIR/context-builder.tar" | cut -f1))"

# Save base images (PostgreSQL, NATS)
echo "  Saving PostgreSQL..."
docker pull pgvector/pgvector:pg16
docker save pgvector/pgvector:pg16 -o "$OUTPUT_DIR/postgres.tar"
echo "  ✓ postgres.tar ($(du -h "$OUTPUT_DIR/postgres.tar" | cut -f1))"

echo "  Saving NATS..."
docker pull nats:2
docker save nats:2 -o "$OUTPUT_DIR/nats.tar"
echo "  ✓ nats.tar ($(du -h "$OUTPUT_DIR/nats.tar" | cut -f1))"

echo ""
echo "✅ All images saved!"
echo ""
echo "📊 Total size:"
du -sh "$OUTPUT_DIR"
echo ""
echo "These images will be bundled in the installer and imported on first launch"

