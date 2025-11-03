# 🚑 QUICK FIX - Database Migration Issue

## Your Error
```
Error: API error 500: no column found for name: ttl_type
```

## The Fix (Copy & Paste)

```bash
# Stop containers and remove volumes (⚠️ This deletes your database!)
docker compose down -v

# Fresh install with all migrations
./setup.sh
```

**Done! 🎉** The system will start fresh with all migrations applied.

---

## Alternative: Keep Existing Data

```bash
# Apply the missing migration
docker exec -i $(docker ps -q -f name=db) psql -U postgres -d rcrt < migrations/0007_ttl_enhancements.sql

# Restart RCRT server
docker compose restart rcrt

# Test
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8081/health
```

---

## What Changed

✅ **setup.sh** - Now warns about existing database volumes  
✅ **docs/openapi.json** - TTL fields documented  
✅ **MIGRATION_GUIDE.md** - Full migration instructions  
✅ **CHANGELOG.md** - Version 2.3.0 release notes  

## Why It Happened

- Docker volumes persist even after `docker compose down`
- Use `docker compose down -v` to remove volumes too
- Migrations only run for NEW databases

## Files Updated
- `setup.sh` - Added volume check warning
- `docs/openapi.json` - Added TTL fields to API docs
- `MIGRATION_GUIDE.md` - New file
- `CHANGELOG.md` - Updated with v2.3.0
- `DEPLOYMENT_FIX_SUMMARY.md` - Detailed explanation
- `QUICK_FIX.md` - This file

**Extension unchanged** - works fine as-is! 🎊

