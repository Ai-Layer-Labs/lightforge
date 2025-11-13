# Running ThinkOS with Docker

## Prerequisites

1. **Docker Desktop must be running**
   - Open Docker Desktop
   - Wait for it to fully start (whale icon in system tray should be steady)
   - Check: Run `docker ps` in terminal - should work without errors

## Start the System

```bash
# From the project root
docker compose up --build
```

## If You Get "Access is denied" Error

**The problem:** Docker Desktop isn't running or isn't accessible.

**Solutions:**

### Solution 1: Start Docker Desktop
1. Open Docker Desktop application
2. Wait for it to fully initialize
3. Try again

### Solution 2: Run Docker Desktop as Administrator
1. Right-click Docker Desktop
2. Select "Run as administrator"
3. Wait for startup
4. Try again

### Solution 3: Reset Docker Desktop
1. Right-click Docker Desktop in system tray
2. Select "Troubleshoot" → "Reset to factory defaults"
3. Restart Docker Desktop
4. Try again

## Verify Docker is Working

```bash
# Should list running containers (might be empty, but shouldn't error)
docker ps

# Should show Docker info
docker info
```

If these commands work, Docker is ready and you can run:
```bash
docker compose up --build
```



