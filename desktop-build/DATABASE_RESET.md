# Database Reset & Rebootstrap - Desktop Build

## Quick Reset (Complete Fresh Start)

### Option 1: Stop, Delete Volume, Restart

```bash
# 1. Stop all services
podman compose down

# 2. Remove PostgreSQL volume (deletes all data)
podman volume rm thinkos-1_postgres-data

# 3. Start services (will create fresh database)
podman compose up -d

# 4. Wait for services
timeout 30

# 5. Run bootstrap
podman compose exec bootstrap-runner node /app/bootstrap.js

# 6. Restart tools-runner to load catalog
podman compose restart tools-runner
```

### Option 2: Full Nuclear Reset

```bash
# Stop everything
podman compose down -v

# This removes:
# - All containers
# - All volumes (database data)
# - All networks

# Start fresh
podman compose up -d

# Wait and bootstrap
timeout 30
podman compose exec bootstrap-runner node /app/bootstrap.js
podman compose restart tools-runner
```

---

## Via Desktop Installer App

### Using System Tray

1. **Right-click RCRT icon in system tray**
2. Click **"Stop Services"**
3. **Open PowerShell as Administrator**
4. Run:
   ```powershell
   podman volume rm thinkos-1_postgres-data
   ```
5. **Right-click RCRT icon again**
6. Click **"Restart Services"**
7. Wait ~1 minute for bootstrap to run automatically

---

## Manual Database Purge (Keep Services Running)

### Using SQL

```bash
# Connect to PostgreSQL
podman exec -it thinkos-1-postgres-1 psql -U rcrt_user -d rcrt_db

# Delete all breadcrumbs
DELETE FROM breadcrumbs;

# Delete all agents
DELETE FROM agents;

# Delete all subscriptions
DELETE FROM selector_subscriptions;

# Exit
\q

# Restart bootstrap
podman compose restart bootstrap-runner

# Wait for bootstrap
timeout 30

# Restart tools-runner
podman compose restart tools-runner
```

### Using RCRT API

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8081/auth/token \
  -H "Content-Type: application/json" \
  -d '{"owner_id":"00000000-0000-0000-0000-000000000001","agent_id":"00000000-0000-0000-0000-000000000AAA","roles":["curator"]}' \
  | jq -r '.token')

# Purge expired breadcrumbs (if any have TTL)
curl -X POST http://localhost:8081/hygiene/run \
  -H "Authorization: Bearer $TOKEN"

# For manual deletion, would need to:
# 1. List all breadcrumbs
# 2. Delete each one
# (Volume reset is faster!)
```

---

## After Reset - Verify

```bash
# Check services are running
podman compose ps

# Check database is fresh
podman exec -it thinkos-1-postgres-1 psql -U rcrt_user -d rcrt_db -c "SELECT COUNT(*) FROM breadcrumbs;"
# Should show count > 0 (bootstrap created breadcrumbs)

# Check agents loaded
curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1 | jq '. | length'
# Should show 5 (default-chat + 4 note agents)

# Check tools loaded
curl http://localhost:8081/breadcrumbs?schema_name=tool.v1 | jq '. | length'
# Should show 12-13
```

---

## Browser Extension After Reset

1. **Reload extension**:
   - `chrome://extensions/`
   - RCRT Browser Extension v2 → Reload (⟳)

2. **Fresh session**:
   - Extension opens → SessionManager (no old sessions)
   - Start First Chat
   - Send message
   - Get response!

---

## Why Reinstall Didn't Help

**Installer preserves data:**
- Uninstall → Keeps Podman volumes
- Reinstall → Reuses existing volumes
- Database persists across installs

**To truly reset:**
- Must delete Podman volumes
- OR: `podman compose down -v` (removes volumes)

---

## Automated Reset Script

Create `reset-database.bat`:

```batch
@echo off
echo Resetting RCRT database...

podman compose down
podman volume rm thinkos-1_postgres-data
podman compose up -d

timeout /t 30

podman compose exec bootstrap-runner node /app/bootstrap.js
podman compose restart tools-runner

echo Done! Database reset and rebootstrapped.
```

Run: `reset-database.bat`

---

## Summary

**Fastest reset:**
```bash
podman compose down -v && podman compose up -d
# Wait 30s
podman compose exec bootstrap-runner node /app/bootstrap.js
podman compose restart tools-runner
```

**This gives you:**
- ✅ Fresh PostgreSQL database
- ✅ Fresh NATS streams
- ✅ Rebootstrapped agents & tools
- ✅ Clean slate


