#!/bin/bash
# RCRT Database Reset Script (Docker Compose)
# Purges all data and rebootstraps

set -e

echo ""
echo "========================================"
echo "RCRT Database Reset (Docker)"
echo "========================================"
echo ""
echo "This will DELETE ALL DATA including:"
echo "- All breadcrumbs"
echo "- All chat sessions"
echo "- All notes"
echo "- All agents"
echo ""
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "[1/5] Stopping services..."
docker compose down

echo ""
echo "[2/5] Removing PostgreSQL volume (deleting database)..."
docker volume rm thinkos-1_postgres-data || true

echo ""
echo "[3/5] Starting services with fresh database..."
docker compose up -d

echo ""
echo "[4/5] Waiting for services to be ready (30 seconds)..."
sleep 30

echo ""
echo "[5/5] Running bootstrap..."
cd bootstrap-breadcrumbs
npm install --silent
node bootstrap.js

echo ""
echo "Restarting tools-runner to load catalog..."
cd ..
docker compose restart tools-runner

echo ""
echo "========================================"
echo "Database reset complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Reload browser extension (chrome://extensions/)"
echo "2. Reload dashboard (http://localhost:8082)"
echo "3. Should show fresh system with all agents"
echo ""

