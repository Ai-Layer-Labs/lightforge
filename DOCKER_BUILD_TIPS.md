# Docker Build Tips for RCRT Development

## Quick Commands

### Force Rebuild (Most Common Fix)
```bash
docker compose build --no-cache tools-runner
```

### Complete Reset
```bash
docker compose down -v && docker compose build --no-cache && docker compose up -d
```

## Preventing Cache Issues

1. **Always rebuild after pulling changes**:
   ```bash
   git pull
   docker compose build tools-runner  # or whichever service changed
   docker compose restart tools-runner
   ```

2. **For development, use this workflow**:
   ```bash
   # After making changes
   docker compose build tools-runner && docker compose restart tools-runner
   ```

3. **Check which image is being used**:
   ```bash
   docker compose ps --format "table {{.Service}}\t{{.Image}}\t{{.CreatedAt}}"
   ```

## Debugging Tips

1. **Verify the fix is in the container**:
   ```bash
   docker compose exec tools-runner grep -n "mode: 'merge'" /app/packages/tools/dist/registry.js
   ```

2. **Check build date**:
   ```bash
   docker inspect breadcrums-tools-runner | grep Created
   ```

3. **Force fresh pull and build**:
   ```bash
   git pull && docker compose build --pull --no-cache tools-runner
   ```

## Why This Matters

The tools-runner builds TypeScript to JavaScript during the Docker build. If Docker uses a cached layer from before your code changes, it will run the old JavaScript even though the TypeScript source is updated.
