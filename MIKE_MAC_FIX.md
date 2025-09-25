# Quick Fix for Mike's Mac ONNX Issue

## The Problem
Your RCRT server is crashing because it can't find the ONNX Runtime library (`libonnxruntime.so`). This is causing all services to fail in a loop.

## The Solution

Run these commands:

```bash
# 1. Stop everything
docker compose down

# 2. Make the Mac setup script executable
chmod +x setup-mac.sh

# 3. Run the Mac-optimized setup
./setup-mac.sh
```

This will:
- Build RCRT with proper ONNX Runtime support for Mac
- Use x64 emulation on Apple Silicon (via Rosetta) for compatibility
- Configure all library paths correctly
- Keep full ONNX functionality (no features disabled!)

## If You're on Apple Silicon (M1/M2/M3)

Make sure Rosetta is enabled in Docker Desktop:
1. Open Docker Desktop
2. Go to Settings → Features in development
3. Enable "Use Rosetta for x86/amd64 emulation on Apple Silicon"
4. Restart Docker Desktop

## Verification

After setup completes, verify RCRT is working:

```bash
# Check logs - should see "listening on 0.0.0.0:8080" with NO panic messages
docker compose logs rcrt | tail -20

# Check health
curl http://localhost:8081/health
```

## If Issues Persist

1. Check Docker logs:
   ```bash
   docker compose logs rcrt --tail 50
   ```

2. Check the detailed troubleshooting guide:
   - `MAC_TROUBLESHOOTING.md`

## What This Fix Does

Unlike the "disable ONNX" approach, this:
- ✅ Keeps all AI/embedding features
- ✅ Properly installs ONNX Runtime for your platform
- ✅ Sets up correct library paths
- ✅ Uses Rosetta on Apple Silicon for compatibility
- ✅ Provides a working multi-arch build

The key changes:
1. Uses `Dockerfile.multiarch` that downloads the correct ONNX Runtime
2. Properly copies libraries to standard locations
3. Uses Debian base image (not distroless) for better compatibility
4. Sets `LD_LIBRARY_PATH` and `ORT_DYLIB_PATH` correctly
