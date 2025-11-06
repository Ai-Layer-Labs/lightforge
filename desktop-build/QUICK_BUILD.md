# 🚀 RCRT Desktop - Build Guide

## One-Command Build

```bash
cd /d/ThinkOS-1/desktop-build/installers/windows
./build-windows.sh
```

**Output:** `../dist/RCRT-Setup.exe` (403MB) ✅

## What You Need

1. **Extension built:**
   ```bash
   cd extension && npm run build
   ```

2. **Podman & Helium downloaded (automatic):**
   ```bash
   cd desktop-build/podman
   ./download-podman.sh windows
   ```

3. **Go and NSIS installed** (one-time setup)

## What Gets Built

A simple installer that:
- Installs Podman Desktop silently
- Copies your docker-compose.yml
- Adds system tray launcher
- Installs Helium browser

**Users click icon → Docker services start → Browser opens → Works!**

## Directory Structure

```
desktop-build/
├── podman/
│   ├── podman-desktop-windows.exe (235MB)
│   └── helium-windows.zip (370MB)
├── service-manager/
│   └── main.go (simple: podman compose up)
├── installers/windows/
│   └── installer.nsi (simple)
└── dist/
    └── RCRT-Setup.exe (403MB) ✅
```

## Why Podman?

Your Docker setup works perfectly. We just bundle the runtime.

**No more:**
- Binary extraction
- Path fixing
- Symlink issues
- pgvector problems

**Just:**
- Download Podman
- Package installer
- Done!

---

**Build time: ~30 seconds**  
**Works: First try** ✅

