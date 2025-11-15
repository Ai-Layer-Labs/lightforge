# Fix Docker Desktop Startup Error (Podman Conflict)

## The Error
```
starting services: initializing Docker API Proxy: setting up docker api proxy listener: 
open \\.\pipe\docker_engine: Access is denied.
```

## Cause
**Podman and Docker Desktop conflict on Windows.** They both try to use similar named pipes and services.

## Solution: Stop Podman Services

### Quick Fix

```bash
# Stop Podman machine
podman machine stop

# If that doesn't work, force stop
podman machine stop -f

# Verify it's stopped
podman machine list
```

Then try starting Docker Desktop again.

---

## If Quick Fix Doesn't Work

### Option 1: Stop Podman WSL Distribution

```bash
# List all WSL distributions
wsl --list --verbose

# Stop the Podman one (usually "podman-machine-default")
wsl --terminate podman-machine-default

# Or stop all WSL
wsl --shutdown
```

### Option 2: Disable Podman Service

```powershell
# Run PowerShell as Administrator

# Stop Podman service if it exists
Stop-Service -Name "Podman" -ErrorAction SilentlyContinue

# Disable it from auto-starting
Set-Service -Name "Podman" -StartupType Disabled -ErrorAction SilentlyContinue
```

### Option 3: Restart Docker Desktop as Admin

1. Close Docker Desktop completely
2. Right-click Docker Desktop
3. Select "Run as administrator"
4. Let it start

---

## Long-term Solution: Choose One

### Option A: Use Docker Only
```bash
# Uninstall Podman Desktop
# Control Panel → Programs → Uninstall Podman

# Then use Docker for development:
docker compose up --build
```

### Option B: Use Podman Only
```bash
# Uninstall Docker Desktop
# Control Panel → Programs → Uninstall Docker Desktop

# Then use Podman (it's Docker-compatible):
podman compose up --build
```

---

## Recommended for Your Use Case

Since your **desktop-build** is designed for Podman, I recommend:

**For Development:**
- Use **Docker Desktop** (what you have now)
- Keep Podman stopped: `podman machine stop`
- Run: `docker compose up --build`

**For Production/Distribution:**
- The installer uses Podman (no conflict for end users)

---

## Check What's Running

```bash
# Check Podman status
podman machine list

# Check WSL status
wsl --list --verbose

# Check Docker status (PowerShell as Admin)
Get-Service -Name "com.docker.*"
```




