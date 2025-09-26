# Fix for Mike's Docker Cache Issue

## The Problem
Docker is likely using a cached image of the tools-runner that has the old code with `mode: 'replace'` instead of the new code with `mode: 'merge'`.

## Quick Fix

```bash
# 1. Stop everything
docker compose down

# 2. Force rebuild WITHOUT cache
docker compose build --no-cache tools-runner

# 3. Start services again
docker compose up -d

# 4. Check logs to confirm
docker compose logs tools-runner --tail 50
```

## Alternative: Complete Clean Build

If the above doesn't work:

```bash
# 1. Stop and remove everything
docker compose down -v

# 2. Remove the specific image
docker rmi breadcrums-tools-runner

# 3. Rebuild from scratch
docker compose build tools-runner

# 4. Start fresh
./setup.sh
```

## Verify the Fix

After rebuilding, check the logs for:
- "catalog now has X tools in database" (where X > 0)
- The context should show both `tools: [...]` array AND the transformed fields

## Why This Happens

Docker aggressively caches build layers. Even with code changes, if the package.json hasn't changed, Docker might skip rebuilding the actual code. The `--no-cache` flag forces a complete rebuild.
