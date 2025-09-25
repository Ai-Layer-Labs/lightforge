#!/bin/bash

# Script to ensure system agents exist in the database
# This prevents foreign key violations for system processes

echo "🔧 Ensuring system agents exist in RCRT database..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Get database URL
DB_URL="${DB_URL:-postgresql://postgres:postgres@localhost/rcrt}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Run the SQL script
psql "$DB_URL" < scripts/ensure-system-agent.sql

if [ $? -eq 0 ]; then
    echo "✅ System agents ensured successfully"
    echo ""
    echo "Default agents created/verified:"
    echo "  - System Agent: 00000000-0000-0000-0000-0000000000aa"
    echo "  - Tools Runner: 00000000-0000-0000-0000-0000000000bb"
    echo ""
    echo "You can now set these in your environment:"
    echo "  export AGENT_ID=00000000-0000-0000-0000-0000000000aa"
else
    echo "❌ Failed to ensure system agents"
    exit 1
fi
