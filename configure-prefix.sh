#!/bin/bash
# Helper script to configure RCRT with a custom container prefix
# Usage: ./configure-prefix.sh [prefix]

set -e

# Get prefix from argument or prompt
if [ -n "$1" ]; then
    PREFIX="$1"
else
    echo "🏷️  RCRT Container Prefix Configuration"
    echo ""
    echo "This script will configure RCRT to use custom container names."
    echo "Examples: 'lightforge-', 'mycompany-', 'dev-', 'staging-'"
    echo ""
    echo "Leave empty to use default names (no prefix)"
    echo ""
    read -p "Enter prefix (or press Enter for default): " PREFIX
fi

# Remove trailing dash if user added it (we'll add it)
PREFIX="${PREFIX%-}"

# Add dash if prefix provided
if [ -n "$PREFIX" ]; then
    PREFIX="${PREFIX}-"
fi

echo ""
if [ -n "$PREFIX" ]; then
    echo "✅ Will use prefix: ${PREFIX}"
    echo "   Container names: ${PREFIX}rcrt, ${PREFIX}db, ${PREFIX}nats, etc."
else
    echo "✅ Will use default names (no prefix)"
fi
echo ""

# Check if already running
if docker compose ps | grep -q "Up"; then
    echo "⚠️  RCRT services are currently running."
    read -p "   Stop services to reconfigure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 Stopping services..."
        docker compose down
    else
        echo "❌ Cancelled. Stop services manually with: docker compose down"
        exit 1
    fi
fi

# Backup existing config if present
if [ -f ".env" ]; then
    echo "💾 Backing up existing .env to .env.backup"
    cp .env .env.backup
fi

if [ -f "docker-compose.override.yml" ]; then
    echo "💾 Backing up existing docker-compose.override.yml"
    cp docker-compose.override.yml docker-compose.override.yml.backup
fi

# Set environment variable and run setup
echo ""
echo "🚀 Running setup with prefix: ${PREFIX:-none}"
export PROJECT_PREFIX="$PREFIX"
./setup.sh

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Summary:"
if [ -n "$PREFIX" ]; then
    echo "   • Prefix: ${PREFIX}"
    echo "   • Container names: ${PREFIX}rcrt, ${PREFIX}db, ${PREFIX}nats, etc."
    echo "   • Generated: docker-compose.override.yml with custom names"
else
    echo "   • Using default container names (no prefix)"
fi
echo "   • External access: http://localhost:8081 (RCRT), http://localhost:8082 (Dashboard)"
echo ""
echo "🔍 Verify:"
echo "   docker compose ps"
echo "   docker compose config | grep container_name"
echo ""

