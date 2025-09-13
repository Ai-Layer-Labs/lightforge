# One-Click Setup - Gap Analysis & Fixes

## Overview
This document tracks every gap encountered when setting up the RCRT system on a fresh machine, along with permanent fixes implemented.

## Setup Session: 2025-09-13

### Environment
- **OS**: Windows 10 (Build 26100) 
- **Shell**: Git Bash
- **Docker**: Docker Desktop
- **Goal**: Achieve true one-click deployment

---

## Issues Found & Fixed

### ✅ FIXED: Issue #1 - Missing Cargo.lock File
**Problem**: Docker build failing with "Cargo.lock": not found
**Root Cause**: Dashboard Dockerfile expects Cargo.lock but it wasn't committed to repo
**Impact**: Complete build failure on fresh checkout
**Fix Applied**: 
- Generated `Cargo.lock` with `cargo generate-lockfile`
- **Permanent Fix Needed**: Commit Cargo.lock to repository

**Files Affected**: 
- `crates/rcrt-dashboard/Dockerfile` (line 13)

---

### ✅ FIXED: Issue #2 - Builder Service Health Check Failed
**Problem**: Builder service shows as "unhealthy" in docker-compose ps
**Root Cause**: Health check uses `localhost` but inside container should use `0.0.0.0` or `127.0.0.1`
**Impact**: Service appears broken but actually works
**Status**: Fixed

**Current Health Check**: 
```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
  interval: 5s
  timeout: 3s
  retries: 20
```

**Issue**: `wget -qO- http://localhost:3000/api/health` fails inside container with "Connection refused"
**Solution**: Changed to `wget -qO- http://0.0.0.0:3000/api/health`
**Fix Applied**: Updated `docker-compose.yml` line 137 health check command
**Permanent Fix**: Configuration change committed

**Test Results**:
- External: `curl http://localhost:3000/api/health` ✅ works (200, `{"ok":true}`)  
- Internal: `wget -qO- http://localhost:3000/api/health` ❌ fails (Connection refused)
- Internal: `wget -qO- http://0.0.0.0:3000/api/health` ✅ works

---

## Current Service Status  
```
SERVICE         STATUS              PORTS               ENDPOINT
db              Up (healthy)        5432                postgresql://postgres:postgres@localhost:5432/rcrt
nats            Up                  4222, 8222          nats://localhost:4222
rcrt            Up                  8081->8080          http://localhost:8081/health
builder         Up (healthy)        3000                http://localhost:3000/api/health  
dashboard       Up                  8082                http://localhost:8082
tools-runner    Up (healthy)        (internal)          N/A
```

**All services are now healthy! ✅**

---

## Prerequisites Identified
- [x] Docker Desktop installed and running
- [x] Git (for cloning repository) 
- [x] Cargo/Rust toolchain (for generating Cargo.lock)
- [x] curl/wget (for testing endpoints)

## Environment Variables (Optional)
- `LOCAL_KEK_BASE64` - Local encryption key (for secrets)
- `OPENROUTER_API_KEY` - OpenRouter API key (for LLM features)
- `OPENROUTER_REFERER` - OpenRouter referer header (optional)
- `OPENROUTER_SITE_TITLE` - OpenRouter site title (optional)

---

## Completed ✅
1. ✅ Fix builder health check issue  
2. ✅ Create automated setup script (`setup.sh`)
3. ✅ Document all environment variables needed
4. ✅ Create validation checks for prerequisites (in setup.sh)
5. ✅ Create env.example template
6. ✅ Test setup flow - **WORKING!**

## Future Improvements
7. [ ] Add Windows batch script equivalent
8. [ ] Add automated tests for setup script
9. [ ] Create Docker health check improvements
10. [ ] Add monitoring/alerting setup

---

## Setup Script Created ✅
- **Location**: `./setup.sh`
- **Features**: 
  - Checks all prerequisites
  - Generates missing Cargo.lock
  - Validates Docker is running
  - Starts all services
  - Tests endpoint health
  - Provides clear status updates
- **Usage**: `./setup.sh`
