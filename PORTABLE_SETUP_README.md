# RCRT Portable Setup

RCRT is **fully portable** and supports custom container name prefixes to avoid conflicts in multi-deployment environments.

## Quick Start

### Default Setup (No Prefix)
```bash
./setup.sh
```

### With Custom Prefix
```bash
# Option 1: Environment variable
export PROJECT_PREFIX="lightforge-"
./setup.sh

# Option 2: One-line
PROJECT_PREFIX="lightforge-" ./setup.sh

# Option 3: Interactive helper
./configure-prefix.sh lightforge
```

## What You Get

### Container Names
| Service | Default | With `lightforge-` |
|---------|---------|-------------------|
| RCRT Server | `rcrt` | `lightforge-rcrt` |
| Database | `db` | `lightforge-db` |
| NATS | `nats` | `lightforge-nats` |
| Dashboard | `dashboard` | `lightforge-dashboard` |
| Agent Runner | `agent-runner` | `lightforge-agent-runner` |
| Tools Runner | `tools-runner` | `lightforge-tools-runner` |

### External Access (Unchanged)
- Dashboard: http://localhost:8082
- RCRT API: http://localhost:8081
- Builder: http://localhost:3000

All external URLs remain the same regardless of prefix!

## How It Works

The setup script:
1. ✅ Generates `.env` with prefix-aware URLs
2. ✅ Creates `docker-compose.override.yml` with custom container names
3. ✅ Configures all services for internal communication
4. ✅ Sets up extension with correct URLs

### Generated Files

**.env**
```bash
PROJECT_PREFIX=lightforge-
RCRT_BASE_URL=http://lightforge-rcrt:8080
DB_URL=postgresql://postgres:postgres@lightforge-db/rcrt
NATS_URL=nats://lightforge-nats:4222
```

**docker-compose.override.yml**
```yaml
services:
  db:
    container_name: lightforge-db
  rcrt:
    container_name: lightforge-rcrt
    environment:
      - DB_URL=postgresql://postgres:postgres@lightforge-db/rcrt
```

## Use Cases

### 1. Multiple Environments
```bash
# Development
cd ~/dev/rcrt-dev
PROJECT_PREFIX="dev-" ./setup.sh

# Staging
cd ~/dev/rcrt-staging
PROJECT_PREFIX="staging-" ./setup.sh

# Production (no prefix)
cd ~/prod/rcrt
./setup.sh
```

### 2. Forked Repository
```bash
git clone https://github.com/yourcompany/rcrt-fork
cd rcrt-fork
PROJECT_PREFIX="yourcompany-" ./setup.sh
```

### 3. Multiple Projects
```bash
# Project A uses RCRT
cd ~/projects/project-a
PROJECT_PREFIX="projecta-" ./setup.sh

# Project B also uses RCRT
cd ~/projects/project-b
PROJECT_PREFIX="projectb-" ./setup.sh
```

## Verification

```bash
# Check container names
docker ps | grep lightforge-

# Verify services running
docker compose ps

# Test connectivity
curl http://localhost:8081/health

# Check internal URLs
docker compose config | grep RCRT_BASE_URL
```

## Changing Prefix

```bash
# Stop services
docker compose down

# Clean old config
rm docker-compose.override.yml .env

# Setup with new prefix
PROJECT_PREFIX="newprefix-" ./setup.sh
```

## Troubleshooting

### Services Can't Communicate
```bash
# Check override file exists
cat docker-compose.override.yml

# Verify environment variables
docker compose config
```

### Extension Can't Connect
Extension connects to `localhost:8081` regardless of prefix.
```bash
# Verify port mapping
docker compose ps | grep rcrt
# Should show: 0.0.0.0:8081->8080/tcp

# Test connection
curl http://localhost:8081/health
```

## Full Documentation

For complete details, see:
- **[Portable Deployment Guide](docs/PORTABLE_DEPLOYMENT_GUIDE.md)** - Complete guide
- **[Quick Reference](docs/QUICK_REFERENCE.md)** - API and commands
- **[System Architecture](docs/SYSTEM_ARCHITECTURE_OVERVIEW.md)** - How it works

## Windows Users

On Windows, use Git Bash or WSL to run the setup script:
```bash
# Git Bash
bash ./setup.sh

# WSL
wsl bash ./setup.sh

# Or use Docker Desktop + PowerShell
$env:PROJECT_PREFIX="lightforge-"
bash ./setup.sh
```

## Platform Support

✅ **Linux** - Full support  
✅ **macOS** - Full support (Intel + Apple Silicon)  
✅ **Windows** - Full support via Git Bash or WSL  
✅ **Docker** - Required  
✅ **Kubernetes** - Use namespaces + labels instead of prefix

---

**Quick Help**
- Setup with prefix: `PROJECT_PREFIX="myprefix-" ./setup.sh`
- Interactive setup: `./configure-prefix.sh`
- Stop services: `docker compose down`
- View logs: `docker compose logs -f [service]`
- Full docs: `docs/PORTABLE_DEPLOYMENT_GUIDE.md`
