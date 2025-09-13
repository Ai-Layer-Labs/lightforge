# RCRT Quick Start Guide

## One-Click Setup 🚀

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd breadcrums
   ```

2. **Run the setup script**:
   ```bash
   ./setup.sh
   ```

That's it! The script will:
- ✅ Check all prerequisites
- ✅ Generate missing files (Cargo.lock)
- ✅ Start all Docker services
- ✅ Validate everything is working

## Manual Setup (if needed)

If the automated script doesn't work, follow these steps:

### Prerequisites
- Docker Desktop (running)
- Git
- Rust/Cargo toolchain
- curl

### Steps
1. Generate Cargo.lock: `cargo generate-lockfile`
2. Start services: `docker compose up -d`
3. Wait for services to be healthy: `docker compose ps`

## Service URLs

Once running, access these URLs:

| Service | URL | Purpose |
|---------|-----|---------|
| **Builder UI** | http://localhost:3000 | Visual workflow builder |
| **RCRT Server** | http://localhost:8081 | Main API server |
| **Dashboard** | http://localhost:8082 | System dashboard |
| **Database** | localhost:5432 | PostgreSQL + pgvector |
| **NATS** | localhost:4222 | Message broker |

## Environment Variables (Optional)

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
# Edit .env with your values
```

Key variables:
- `LOCAL_KEK_BASE64` - Encryption key for secrets
- `OPENROUTER_API_KEY` - For LLM features

## Troubleshooting

### Services not starting?
```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f

# Restart a specific service
docker compose restart <service-name>
```

### Health checks failing?
```bash
# Test endpoints manually
curl http://localhost:3000/api/health  # Builder
curl http://localhost:8081/health      # RCRT Server
curl -I http://localhost:8082          # Dashboard
```

### Complete reset
```bash
# Stop and remove everything
docker compose down -v

# Rebuild and start
docker compose up -d --build
```

## Development

### View logs
```bash
docker compose logs -f [service-name]
```

### Stop services
```bash
docker compose down
```

### Rebuild after changes
```bash
docker compose up -d --build
```

## Need Help?

Check the detailed setup analysis: [SETUP_GAPS_AND_FIXES.md](./SETUP_GAPS_AND_FIXES.md)
