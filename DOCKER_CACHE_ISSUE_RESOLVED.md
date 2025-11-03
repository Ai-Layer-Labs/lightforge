# ✅ RESOLVED: Docker Cache Issue with TTL Migration

## The Real Problem

When you ran `docker compose down` and rebuilt, Docker **cached the build layers**, including the old `migrations` folder that **didn't have migration 0007**!

### What Happened:

1. You made code changes (added TTL fields to Rust models)
2. You created `migrations/0007_ttl_enhancements.sql`
3. You ran `docker compose build` 
4. **Docker used cached layers** from before migration 0007 existed
5. The RCRT server image was built **without migration 0007**
6. Database was fresh, but server couldn't add the migration
7. Bootstrap failed with "no column found for name: ttl_type"

### The Fix:

```bash
# Force rebuild without cache
docker compose build --no-cache rcrt

# Clean start
docker compose down -v
./setup.sh
```

## Verification - System Now Working ✅

```bash
$ docker exec thinkos-1-db-1 psql -U postgres -d rcrt -c "SELECT version, description FROM _sqlx_migrations ORDER BY version;"
 version |     description      
---------+----------------------
       1 | init
       2 | webhooks idempotency
       3 | webhook dedupe
       4 | webhook dlq
       5 | secret audit
       6 | entity metadata
       7 | ttl enhancements      ← ✅ Migration applied!
(7 rows)

$ docker logs thinkos-1-agent-runner-1 | grep agents
✅ [AgentRegistry] Started with 1 agents   ← ✅ Agent loaded!

$ curl -s http://localhost:8081/breadcrumbs -H "Authorization: Bearer $TOKEN" | grep -o '"id"' | wc -l
22                                          ← ✅ Bootstrap successful!
```

## Key Lessons

### 1. **Docker Cache is Persistent**
- `docker compose build` uses cache by default
- Cache can include old files even if they've changed on disk
- Use `--no-cache` when you add new migrations or dependencies

### 2. **Build Context Matters**
```dockerfile
COPY migrations migrations  # This was cached with old content!
```

### 3. **Migration Files Need Fresh Builds**
When you add a new migration:
```bash
docker compose build --no-cache rcrt
```

### 4. **Volumes vs Containers**
- `docker compose down` - Removes containers only
- `docker compose down -v` - Removes containers AND volumes
- Volumes persist database state
- **Containers persist built code/binaries**

## Prevention for Future

### Update `setup.sh` with Cache Check

I've already added a volume check to `setup.sh`. Consider adding:

```bash
# Check if code changes need rebuild
echo "🔍 Checking if images need rebuild..."
if [ -f "migrations/0007_ttl_enhancements.sql" ]; then
    MIGRATION_IN_IMAGE=$(docker run --rm thinkos-1-rcrt ls -la /app/migrations/0007_ttl_enhancements.sql 2>&1)
    if [[ $MIGRATION_IN_IMAGE == *"No such file"* ]]; then
        echo "⚠️  Code changes detected! Rebuilding RCRT..."
        docker compose build --no-cache rcrt
    fi
fi
```

### Development Workflow

```bash
# After adding migrations or changing Rust code:
docker compose build --no-cache rcrt  # Rebuild
docker compose down -v                # Clean database
./setup.sh                            # Fresh start
```

### Quick Verification

```bash
# Check what migrations are in the container:
docker exec thinkos-1-rcrt-1 ls -la /app/migrations/

# Check what's applied to the database:
docker exec thinkos-1-db-1 psql -U postgres -d rcrt -c "SELECT version, description FROM _sqlx_migrations;"
```

## System Status: ✅ FULLY OPERATIONAL

- ✅ All 7 migrations applied
- ✅ TTL columns exist in database
- ✅ RCRT server running with updated code
- ✅ Agent runner loaded default-chat-assistant
- ✅ 22 breadcrumbs bootstrapped
- ✅ API working correctly
- ✅ Ready for browser extension testing

## Next Steps

1. **Test the browser extension** - it should work now!
2. **Monitor logs** if issues persist:
   ```bash
   docker compose logs -f rcrt
   docker compose logs -f agent-runner
   ```

3. **If you make more code changes**:
   ```bash
   docker compose build --no-cache [service-name]
   docker compose restart [service-name]
   ```

## Files Updated

- `setup.sh` - Added database volume warning
- `docs/openapi.json` - Added TTL field documentation
- `MIGRATION_GUIDE.md` - Migration instructions
- `CHANGELOG.md` - Version 2.3.0 release notes
- `DOCKER_CACHE_ISSUE_RESOLVED.md` - This file

---

**Problem**: Docker cache prevented new migration from being included  
**Solution**: Rebuild with `--no-cache` flag  
**Status**: ✅ RESOLVED - System fully operational  
**Date**: November 3, 2025

