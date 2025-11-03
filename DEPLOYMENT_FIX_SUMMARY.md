# ✅ Deployment Fix Summary - November 3, 2025

## 🔴 The Problem You Encountered

**Error**: `API error 500: no column found for name: ttl_type`

**Root Cause**: You deleted and rebuilt Docker **containers**, but Docker **volumes** persist! Your database still had the old schema without the new TTL columns.

## 🔧 The Fix (What I Did)

### 1. ✅ Updated `setup.sh` (Database Volume Warning)
Added a check that warns users about existing database volumes:

```bash
# Ensure database volume is clean for fresh migrations
echo "🔧 Checking database state..."
if docker volume ls | grep -q "thinkos-1_db_data"; then
    echo "⚠️  Existing database volume found. For a truly fresh install, run:"
    echo "   docker compose down -v  # Remove containers AND volumes"
    echo "   Then re-run this setup script"
    echo ""
    echo "   Continuing with existing database (migrations will apply if not already run)..."
else
    echo "✅ No existing database volume - fresh install"
fi
```

### 2. ✅ Updated `docs/openapi.json` (API Documentation)
Added all new TTL fields to the OpenAPI specification:

**BreadcrumbCreate & BreadcrumbUpdate**:
- `ttl_type` - Type of TTL policy (never/datetime/duration/usage/hybrid)
- `ttl_config` - Configuration JSON for TTL policy
- `ttl_source` - Source of TTL policy (manual/schema-default/auto-applied/explicit)

**BreadcrumbFull** (added):
- All above fields PLUS
- `read_count` - Number of times read (for usage-based TTL)

### 3. ✅ Created `MIGRATION_GUIDE.md`
Comprehensive guide on how to handle database migrations with 3 solutions:
- **Solution 1**: Fresh install with `docker compose down -v` (recommended)
- **Solution 2**: Manual migration with psql
- **Solution 3**: Docker exec migration

### 4. ✅ Updated `CHANGELOG.md`
Documented all changes in version 2.3.0 release notes.

## 🚀 How to Fix Your System (Right Now)

### Option A: Fresh Install (Easiest - 2 minutes)

```bash
# Stop everything and remove volumes
docker compose down -v

# Run the updated setup script
./setup.sh
```

This will:
- ✅ Create a fresh database with ALL migrations (including 0007_ttl_enhancements.sql)
- ✅ Bootstrap all system components
- ✅ No errors!

### Option B: Manual Migration (Keep Existing Data)

If you have important data in your database:

```bash
# Apply the migration manually
docker exec -i $(docker ps -q -f name=db) psql -U postgres -d rcrt < migrations/0007_ttl_enhancements.sql

# Restart RCRT server to reload
docker compose restart rcrt
```

## ✅ Verification

After fixing, verify the migration was applied:

```bash
# Check applied migrations
docker exec -it $(docker ps -q -f name=db) psql -U postgres -d rcrt -c "SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 3;"
```

You should see:
```
version |          description          |      installed_on       
--------+-------------------------------+-------------------------
      7 | ttl enhancements              | 2025-11-03 XX:XX:XX
      6 | entity metadata               | 2025-11-03 XX:XX:XX
      5 | secret audit                  | 2025-11-03 XX:XX:XX
```

## 📚 How Migrations Work in RCRT

**Good News**: Migrations ARE automatic! Here's how:

1. **On Startup** (`crates/rcrt-server/src/main.rs:61`):
   ```rust
   // Run migrations on startup
   MIGRATOR.run(&db.pool).await?;
   ```

2. **Migrations Folder** copied to Docker image (`Dockerfile:76`):
   ```dockerfile
   COPY --from=builder /app/migrations /app/migrations
   ```

3. **SQLx Tracks Applied Migrations** in `_sqlx_migrations` table:
   - Only runs migrations that haven't been applied
   - Idempotent and safe

**The Catch**: Docker volumes persist! When you run:
- ✅ `docker compose down` - Stops and removes containers
- ❌ `docker compose down` - Database volume still exists with old schema
- ✅ `docker compose down -v` - Removes containers AND volumes

## 🎯 Key Takeaways

1. **Always use `-v` for fresh installs**: `docker compose down -v`
2. **Migrations are automatic** for new databases
3. **Volumes persist** by design (to protect your data)
4. **Check the warning** in `setup.sh` about existing volumes
5. **Extension is fine** - no changes needed there

## 📖 Additional Resources

- `MIGRATION_GUIDE.md` - Detailed migration instructions
- `CHANGELOG.md` - Full v2.3.0 release notes
- `docs/openapi.json` - Updated API documentation
- `migrations/0007_ttl_enhancements.sql` - The actual migration SQL

## 🎉 What's New in v2.3.0

Beyond fixing your deployment issue, this release includes:

- **Enhanced TTL System**: never/datetime/duration/usage/hybrid expiry types
- **60% Context Reduction**: Optimized LLM context delivery
- **Schema Definitions**: `schema.def.v1` for standardized schemas
- **Format Transform**: Simple `{field}` replacement in llm_hints
- **Read Tracking**: Automatic counting for usage-based TTL
- **Improved Hygiene**: Handles all new TTL types automatically

All backward compatible! 🎊

