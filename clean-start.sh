#!/bin/bash
# Clean start - removes everything and starts fresh

echo "🧹 Cleaning up old containers and volumes..."
docker compose down -v
docker compose rm -f

echo "🗑️ Removing any stale data..."
rm -rf rcrt-visual-builder/apps/builder/node_modules || true
rm -rf rcrt-visual-builder/node_modules || true
rm -rf rcrt-visual-builder/apps/agent-runner/node_modules || true
rm -rf rcrt-visual-builder/apps/tools-runner/node_modules || true

echo "🚀 Starting fresh setup..."
./setup.sh
