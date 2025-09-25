# Quick Fix for Mike's Mac ONNX Issue

## The Problem
Your RCRT server is crashing because it can't find the ONNX Runtime library (`libonnxruntime.so`). This is causing all services to fail in a loop.

## The Solution

Run these commands:

```bash
# 1. Stop everything
docker compose down

# 2. Run the universal setup script
./setup.sh
```

The script will automatically:
- Detect your Mac architecture (Apple Silicon or Intel)
- Build RCRT natively for your platform
- Use the correct ONNX Runtime version
- Configure all library paths correctly
- Keep full ONNX functionality with optimal performance

## Native Build Benefits

On Apple Silicon (M1/M2/M3):
- 🚀 No Rosetta emulation needed
- ⚡ Faster performance (native ARM64)
- 💾 Lower memory usage
- 🔋 Better battery life

On Intel Macs:
- 🚀 Native x64 build
- ⚡ No compatibility layers

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
