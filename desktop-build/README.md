# RCRT Desktop Installer

**One-Click Install, Docker-Powered, Zero Configuration**

## 🚀 Quick Build

```bash
cd /d/ThinkOS-1/desktop-build
./build.sh
```

That's it! One command builds everything.

## 📦 What It Does

1. **Builds your Docker images** (from docker-compose.yml)
2. **Saves images as tar files** (for bundling)
3. **Downloads Podman + Helium** (if not cached)
4. **Builds service manager** (system tray app)
5. **Creates installer** (NSIS for Windows)

**Output:** `desktop-build/dist/RCRT-Setup.exe` (~500-600MB with images)

## 🎯 What Users Get

**Installation:**
1. Download RCRT-Setup.exe
2. Run installer (~3-5 minutes)
   - Podman installs automatically
   - WSL installs if needed (automatic!)
3. Click "Start RCRT Services" on finish
4. Done!

**First Launch:**
1. Podman machine initializes (~1 min)
2. Docker images import (~2 min)
3. Services start via `podman compose up`
4. Browser opens with extension
5. Ready to use!

**Subsequent Launches:**
- Services start in ~10 seconds
- Browser opens immediately

## ✅ Features

- ✅ One-click install (just one .exe)
- ✅ Automatic WSL setup
- ✅ Automatic Podman configuration
- ✅ Pre-built Docker images (no build on user machine)
- ✅ Helium browser with extension
- ✅ System tray management
- ✅ All your Docker services working

## 📝 Prerequisites

### For Building

- Docker Desktop running
- Go 1.21+ installed
- NSIS installed (Windows)
- Extension built: `cd extension && npm run build`

### For Users

- Windows 10/11 (64-bit)
- 8GB RAM recommended
- 10GB disk space

**That's it!** WSL and Podman install automatically.

## 📊 File Structure

```
desktop-build/
├── build.sh                  # ← ONE BUILD COMMAND
├── podman/
│   ├── podman-5.3.1-setup.exe (31MB)
│   ├── helium-windows.zip (370MB)
│   └── images/               # Docker images (created by build)
│       ├── rcrt.tar
│       ├── dashboard.tar
│       ├── agent-runner.tar
│       ├── tools-runner.tar
│       ├── context-builder.tar
│       ├── postgres.tar
│       └── nats.tar
├── service-manager/
│   └── main.go (simple!)
├── installers/windows/
│   └── installer.nsi
└── dist/
    └── RCRT-Setup.exe ✅
```

## 🎊 Why This Works

Your Docker setup is proven and working. We:
1. Bundle the container runtime (Podman)
2. Bundle pre-built images  
3. Add a simple launcher
4. Done!

**No extraction complexity. No path issues. Just works!**

---

**Build command:** `./desktop-build/build.sh`  
**Output:** `desktop-build/dist/RCRT-Setup.exe`  
**Ready to ship!** 🚀
