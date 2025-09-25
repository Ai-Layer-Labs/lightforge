# Mac Troubleshooting Guide for RCRT

## Issue: Missing ONNX Runtime Library

On Mac (especially Apple Silicon), the RCRT server fails with:
```
An error occurred while attempting to load the ONNX Runtime binary at `libonnxruntime.so`
```

## Solutions

### Option 1: Disable ONNX Embeddings (Quick Fix)

If you don't need AI-powered semantic search, disable ONNX:

1. Edit `docker-compose.yml`:
```yaml
rcrt:
  build:
    context: .
    dockerfile: Dockerfile
    args:
      FEATURES: "nats"  # Remove "embed-onnx"
```

2. Rebuild and restart:
```bash
docker compose down
docker compose build rcrt
docker compose up -d
```

### Option 2: Use Mac-Optimized Build (Recommended)

We provide a Mac-optimized setup that properly handles ONNX Runtime:

```bash
# First, make the script executable
chmod +x setup-mac.sh

# Then run the Mac-specific setup script
./setup-mac.sh
```

This script:
- Uses a multi-architecture Dockerfile
- Properly configures ONNX Runtime for both x64 and ARM64
- Enables Rosetta emulation on Apple Silicon for compatibility
- Sets up all required library paths

### Option 3: Fix ONNX Runtime in Dockerfile

Create a Mac-compatible Dockerfile:

1. Create `Dockerfile.mac`:
```dockerfile
# Use the same base as main Dockerfile but ensure ONNX runtime is installed
FROM rust:1.75-bookworm as builder

# Install dependencies including ONNX runtime
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download ONNX Runtime for Linux x64 (will work in Docker on Mac)
RUN wget https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-linux-x64-1.16.3.tgz \
    && tar -xzf onnxruntime-linux-x64-1.16.3.tgz \
    && cp onnxruntime-linux-x64-1.16.3/lib/libonnxruntime.so* /usr/local/lib/ \
    && ldconfig

# Continue with rest of build...
```

### Option 4: Use Rosetta for x86 Emulation (Apple Silicon)

If on Apple Silicon Mac:

1. Enable Rosetta in Docker Desktop:
   - Docker Desktop → Settings → Features in development
   - Enable "Use Rosetta for x86/amd64 emulation on Apple Silicon"

2. Force x86 platform:
```yaml
rcrt:
  platform: linux/amd64  # Force x86 emulation
  build:
    context: .
    dockerfile: Dockerfile
```

## Verification Steps

After applying a fix:

1. Check RCRT logs for successful startup:
```bash
docker compose logs rcrt | grep "Loaded ONNX Runtime"
```

2. Verify no panic messages:
```bash
docker compose logs rcrt | grep -i panic
```

3. Check agent/tools runners connect successfully:
```bash
docker compose logs agent-runner tools-runner | grep "Connected to RCRT"
```

## Additional Mac-Specific Issues

### 1. File Permissions
Mac's file system may cause permission issues:
```bash
# Fix permissions
chmod -R 755 ./scripts
chmod +x setup.sh
```

### 2. Line Endings
If cloned on Mac, ensure Unix line endings:
```bash
# Install dos2unix if needed
brew install dos2unix

# Fix line endings
find . -name "*.sh" -exec dos2unix {} \;
```

### 3. Docker Resource Limits
Increase Docker Desktop resources:
- Docker Desktop → Settings → Resources
- Memory: At least 8GB
- CPU: At least 4 cores

## Recommended Approach

For immediate resolution, use **Option 1** (disable ONNX) to get the system running, then work on implementing Option 3 or 4 for full functionality.
