# Database Migration Guide

## Problem: `no column found for name: ttl_type`

This error occurs when you have an **existing database volume** from before the TTL enhancements were implemented.

## Why It Happens

The RCRT server **does run migrations automatically** on startup (see `crates/rcrt-server/src/main.rs:61`), but:

- **Docker volumes persist** even when containers are deleted
- `docker compose down` removes containers, but **NOT volumes**
- SQLx migrations only run if they haven't been applied before
- If your database already existed, it has the old schema

## Solution 1: Fresh Install (Recommended)

Complete cleanup and rebuild:

```bash
# Stop everything and remove volumes
docker compose down -v

# Run setup script (will create fresh database with all migrations)
./setup.sh
```

## Solution 2: Manual Migration

If you want to keep your existing data:

```bash
# Connect to the running database
docker exec -it $(docker ps -q -f name=db) psql -U postgres -d rcrt

# Run the migration manually
\i /path/to/migrations/0007_ttl_enhancements.sql

# Exit psql
\q
```

Or from your host machine (if you have psql installed):

```bash
psql -h localhost -U postgres -d rcrt -f migrations/0007_ttl_enhancements.sql
```

## Solution 3: Using Docker Exec

```bash
docker exec -i $(docker ps -q -f name=db) psql -U postgres -d rcrt < migrations/0007_ttl_enhancements.sql
```

## Verifying Migrations

Check which migrations have been applied:

```bash
docker exec -it $(docker ps -q -f name=db) psql -U postgres -d rcrt -c "SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC;"
```

## What Changed in Migration 0007

The migration adds enhanced TTL (Time-To-Live) capabilities:

- `ttl_type` - Type of TTL: 'never', 'datetime', 'duration', 'usage', 'hybrid'
- `ttl_config` - Configuration JSON for duration/usage policies
- `read_count` - Counter for usage-based TTL
- `ttl_source` - Tracking where the TTL policy came from

## Preventing This Issue

The `setup.sh` script now checks for existing volumes and warns you:

```bash
⚠️  Existing database volume found. For a truly fresh install, run:
   docker compose down -v  # Remove containers AND volumes
```

Always use `docker compose down -v` when you want a completely fresh start!

