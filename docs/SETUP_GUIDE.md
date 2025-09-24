# RCRT Setup Guide

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js (for utility scripts)

### Basic Setup
```bash
# Clone and navigate to repo
git clone <repo-url>
cd breadcrums

# Quick start (recommended)
./setup.sh

# Clean restart if needed
./clean-start.sh
```

### Environment Configuration
Create `.env` file with your API keys:
```bash
# RCRT Environment Configuration
LOCAL_KEK_BASE64="your-encryption-key-here"
OPENROUTER_API_KEY="your-openrouter-api-key-here"
OPENROUTER_REFERER="http://localhost:3000"
OPENROUTER_SITE_TITLE="RCRT Local"
```

## Services Overview

### Core Services (Required)
- **Database** (port 5432): PostgreSQL with pgvector
- **NATS** (port 4222): Message bus for events
- **RCRT** (port 8081): Core API server
- **Dashboard** (port 8082): System monitoring UI

### Agent Services
- **Agent Runner**: Executes agent definitions
- **Tools Runner**: Provides tool execution capabilities

### Development Services (Optional)
- **Builder** (port 3000): Visual agent builder UI

## Service Startup Order
The setup script ensures proper startup order:
1. Database and NATS (infrastructure)
2. RCRT core server
3. Dashboard and tools runner
4. Load default chat agent
5. Start agent runner (after agents are loaded)
6. Builder UI (optional)

## Verification

### Check Service Status
```bash
docker compose ps
```

### Check Agent Runner
```bash
# Should show "Found 1 agent definitions"
docker compose logs agent-runner | grep "Found"
```

### Access Services
- Dashboard: http://localhost:8082
- RCRT API: http://localhost:8081
- Builder: http://localhost:3000 (if running)

## Troubleshooting

### Agent Runner Shows 0 Agents
```bash
# Option 1: Restart agent runner
docker compose restart agent-runner

# Option 2: Trigger reload
./reload-agents.js

# Option 3: Check if default agent exists
curl http://localhost:8081/breadcrumbs?schema_name=agent.def.v1
```

### OpenRouter API Issues
1. Verify API key in `.env` file
2. Add key to RCRT secrets: `node add-openrouter-key.js`
3. Check agent logs for authentication errors

### Database Connection Issues
```bash
# Check database health
docker compose logs db

# Restart database
docker compose restart db
```

### Complete Reset
```bash
# Stop everything and remove data
docker compose down -v

# Clean start
./clean-start.sh
```

## Development Workflow

### Making Changes
1. Edit code in respective service directories
2. Rebuild affected services: `docker compose build <service>`
3. Restart services: `docker compose up -d <service>`

### Adding Agents
1. Use Visual Builder (http://localhost:3000)
2. Or manually create `agent.def.v1` breadcrumbs via API
3. Agent runner will auto-detect new agents

### Adding Tools
1. Edit `rcrt-visual-builder/apps/tools-runner/src/`
2. Rebuild: `docker compose build tools-runner`
3. Restart: `docker compose up -d tools-runner`

## Production Deployment
- Update JWT keys in `docker-compose.yml`
- Set proper `LOCAL_KEK_BASE64` for encryption
- Configure external PostgreSQL and NATS if needed
- Set up proper TLS/SSL certificates
- Review security settings in RCRT configuration
