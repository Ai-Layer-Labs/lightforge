# ONNX Runtime Version Fix

## The Problem

Mike encountered this error:
```
ort 2.0.0-rc.10 is not compatible with the ONNX Runtime binary found at `/usr/local/lib/libonnxruntime.so`; expected GetVersionString to return '1.22.x', but got '1.16.3'
```

This happens because:
- The Rust `ort` crate version 2.0.0-rc.10 requires ONNX Runtime 1.22.x
- Our Dockerfile was downloading ONNX Runtime 1.16.3
- Version mismatch causes RCRT to panic on startup

## The Solution

Updated the Dockerfile to use ONNX Runtime 1.22.0:

```dockerfile
# Download ONNX Runtime for the target architecture
# Using v1.22.0 to match the ort crate requirements
RUN mkdir -p /app/onnx && \
    if [ "$TARGETARCH" = "arm64" ]; then \
        echo "📱 Building for ARM64..." && \
        wget -q -O /tmp/onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/onnxruntime-linux-aarch64-1.22.0.tgz; \
    else \
        echo "💻 Building for x64..." && \
        wget -q -O /tmp/onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.22.0/onnxruntime-linux-x64-1.22.0.tgz; \
    fi && \
    tar -xzf /tmp/onnxruntime.tgz -C /app/onnx --strip-components=1 && \
    rm /tmp/onnxruntime.tgz
```

## Quick Fix

Run this to rebuild with the correct version:
```bash
./fix-onnx-version.sh
```

Or manually:
```bash
docker compose down
docker compose build rcrt
docker compose up -d
```

## Prevention

When updating Rust dependencies, always check:
1. What version of ONNX Runtime the `ort` crate expects
2. Update Dockerfile to match that version
3. Test on multiple architectures (x64 and ARM64)

## Version Compatibility

| ort crate version | Required ONNX Runtime |
|-------------------|----------------------|
| 2.0.0-rc.10      | 1.22.x               |
| 2.0.0-rc.9       | 1.21.x               |
| 1.16.x           | 1.16.x               |

Always check the [ort crate documentation](https://docs.rs/ort/) for version requirements.
