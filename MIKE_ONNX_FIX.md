# Mike - ONNX Version Fix

## The Issue
Your RCRT is crashing because of an ONNX Runtime version mismatch:
- The Rust code expects ONNX Runtime **1.22.x**
- But the Docker image has ONNX Runtime **1.16.3**

## Quick Fix

Run this command:
```bash
chmod +x fix-onnx-version.sh && ./fix-onnx-version.sh
```

This will:
1. Stop all services
2. Rebuild RCRT with the correct ONNX version (1.22.0)
3. Restart everything

## Manual Fix (if script fails)

```bash
# 1. Stop everything
docker compose down

# 2. Remove old images
docker rmi $(docker images -q '*rcrt*')

# 3. Rebuild
docker compose build rcrt

# 4. Start again
docker compose up -d
```

## Verification

After the fix, you should see:
- ✅ No more "ort 2.0.0-rc.10 is not compatible" errors
- ✅ RCRT starts successfully
- ✅ Agent runner connects properly

Check logs:
```bash
docker compose logs -f rcrt
```

The fix has already been committed to the main Dockerfile, so future setups won't have this issue!
