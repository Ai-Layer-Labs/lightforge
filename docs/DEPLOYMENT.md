# RCRT Deployment Guide

## Quick Start

### Prerequisites

- **Docker Desktop** (running)
- **Git**
- **Node.js** 18+ (for browser extension build)
- **curl** or similar HTTP client

### One-Command Setup

```bash
git clone <repository-url>
cd breadcrums
./setup.sh
```

The script automatically:
- ✅ Detects your platform (Mac/Linux/Windows)
- ✅ Checks prerequisites
- ✅ Builds browser extension
- ✅ Starts all Docker services
- ✅ Runs bootstrap process
- ✅ Validates system health

## Service URLs

Once running:

| Service | URL | Purpose |
|---------|-----|---------|
| **RCRT Server** | http://localhost:8081 | Main API + SSE |
| **Dashboard** | http://localhost:8082 | 3D/2D visualization |
| **Builder UI** | http://localhost:3000 | Visual workflow builder |
| **PostgreSQL** | localhost:5432 | Database |
| **NATS** | localhost:4222 | Message bus |

## Platform Support

### Mac (Apple Silicon & Intel)

```bash
./setup.sh
```

Automatically builds for your architecture:
- **Apple Silicon**: ARM64 native builds
- **Intel**: x86_64 builds

### Linux

```bash
./setup.sh
```

Supports all major distributions with Docker.

### Windows

**Via WSL2** (recommended):
```bash
wsl
cd /mnt/d/breadcrums
./setup.sh
```

**Via Git Bash**:
```bash
bash setup.sh
```

## Docker Compose Architecture

### Services

```yaml
services:
  postgres:      # Database with pgvector
  nats:          # Message bus  
  rcrt:          # Main RCRT server (Rust)
  dashboard:     # Dashboard v2 (React)
  tools-runner:  # Tool execution service
  agent-runner:  # Agent execution service
  bootstrap:     # Bootstrap loader (one-time)
```

### Networking

All services on `rcrt-network`:
- Internal DNS resolution
- No exposed ports except APIs
- Secure inter-service communication

### Volumes

- `postgres-data`: Database persistence
- `nats-data`: Message stream persistence

## Configuration

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp env.example .env
```

Key variables:

```bash
# Database
DB_URL=postgres://rcrt:password@postgres:5432/rcrt

# NATS
NATS_URL=nats://nats:4222

# Auth (optional, dev mode: disabled)
AUTH_MODE=disabled
# AUTH_MODE=jwt
# JWT_ISSUER=rcrt
# JWT_AUDIENCE=rcrt
# JWT_JWKS_URL=https://...

# Embeddings (optional, defaults to ONNX)
EMBED_PROVIDER=onnx
EMBED_DIM=384
# EMBED_PROVIDER=remote
# EMBED_URL=https://api.openai.com/v1/embeddings
# EMBED_API_KEY=sk-...

# Secrets (optional)
LOCAL_KEK_BASE64=<base64-encoded-32-byte-key>

# OpenRouter (for LLM features)
OPENROUTER_API_KEY=sk-or-...

# Container prefix (for multi-deployment)
PROJECT_PREFIX=
```

### Generate Encryption Key

For secrets service:

```bash
openssl rand -base64 32
```

Add to `.env`:
```bash
LOCAL_KEK_BASE64="<generated-key>"
```

### Container Prefix

For multiple deployments or forks:

```bash
PROJECT_PREFIX="mycompany-" ./setup.sh
```

Creates containers:
- `mycompany-rcrt`
- `mycompany-postgres`
- etc.

## Production Deployment

### 1. Security Hardening

**Enable JWT Authentication**:

```env
AUTH_MODE=jwt
JWT_ISSUER=your-issuer
JWT_AUDIENCE=your-audience
JWT_JWKS_URL=https://your-auth-server/.well-known/jwks.json
```

**Use Strong Database Password**:

```env
DB_URL=postgres://rcrt:<strong-password>@postgres:5432/rcrt
```

**Enable TLS**:

Add nginx/traefik reverse proxy with Let's Encrypt:

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
```

**Secure NATS**:

```env
NATS_URL=nats://user:password@nats:4222
```

### 2. Persistent Volumes

Update `docker-compose.yml` for production:

```yaml
volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/postgres
  
  nats-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/data/nats
```

### 3. Resource Limits

```yaml
services:
  rcrt:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### 4. Health Checks

Already configured, verify:

```bash
docker compose ps
```

All services should show `healthy`.

### 5. Logging

**Centralized logging**:

```yaml
services:
  rcrt:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
```

**External logging**:

```yaml
logging:
  driver: "syslog"
  options:
    syslog-address: "tcp://logs.example.com:514"
```

### 6. Monitoring

**Prometheus metrics**:

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

`prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'rcrt'
    static_configs:
      - targets: ['rcrt:8081']
    metrics_path: '/metrics'
```

**Grafana dashboards**:

```yaml
services:
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure-password
```

### 7. Backup Strategy

**Database backups**:

```bash
# Daily backup
docker exec rcrt-postgres pg_dump -U rcrt rcrt > backup-$(date +%Y%m%d).sql

# Automated
0 2 * * * /path/to/backup-script.sh
```

**Restore**:

```bash
docker exec -i rcrt-postgres psql -U rcrt rcrt < backup-20251012.sql
```

### 8. Scaling

**Horizontal scaling** (RCRT server):

```yaml
services:
  rcrt:
    deploy:
      replicas: 3
```

Add load balancer:

```yaml
services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

`nginx-lb.conf`:
```nginx
upstream rcrt {
    server rcrt-1:8081;
    server rcrt-2:8081;
    server rcrt-3:8081;
}

server {
    listen 80;
    location / {
        proxy_pass http://rcrt;
    }
}
```

## Kubernetes Deployment

### Helm Chart

Located in `helm/rcrt/`:

```bash
# Install
helm install rcrt ./helm/rcrt \
  --set postgresql.enabled=true \
  --set nats.enabled=true \
  --set auth.mode=jwt \
  --set auth.jwksUrl=https://...

# Upgrade
helm upgrade rcrt ./helm/rcrt

# Uninstall
helm uninstall rcrt
```

### Kubernetes Resources

**Namespace**:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: rcrt
```

**ConfigMap**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rcrt-config
  namespace: rcrt
data:
  AUTH_MODE: "jwt"
  EMBED_PROVIDER: "onnx"
```

**Secret**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rcrt-secrets
  namespace: rcrt
type: Opaque
data:
  db-password: <base64>
  kek: <base64>
  openrouter-key: <base64>
```

**Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rcrt-server
  namespace: rcrt
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rcrt-server
  template:
    metadata:
      labels:
        app: rcrt-server
    spec:
      containers:
      - name: rcrt
        image: rcrt-server:latest
        ports:
        - containerPort: 8081
        envFrom:
        - configMapRef:
            name: rcrt-config
        - secretRef:
            name: rcrt-secrets
```

**Service**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: rcrt-server
  namespace: rcrt
spec:
  selector:
    app: rcrt-server
  ports:
  - port: 8081
    targetPort: 8081
  type: ClusterIP
```

**Ingress**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rcrt-ingress
  namespace: rcrt
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - rcrt.example.com
    secretName: rcrt-tls
  rules:
  - host: rcrt.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: rcrt-server
            port:
              number: 8081
```

## Cloud Deployments

### AWS

**ECS Fargate**:
- Use AWS RDS for PostgreSQL
- AWS MQ or self-hosted NATS
- ALB for load balancing
- ECR for Docker images

**EKS**:
- Use Helm chart
- AWS RDS for PostgreSQL
- AWS Secrets Manager for secrets

### Google Cloud

**Cloud Run**:
- Use Cloud SQL for PostgreSQL
- Cloud Pub/Sub or self-hosted NATS
- Cloud Load Balancing

**GKE**:
- Use Helm chart
- Cloud SQL for PostgreSQL
- Secret Manager for secrets

### Azure

**Container Instances**:
- Azure Database for PostgreSQL
- Azure Service Bus or self-hosted NATS
- Azure Load Balancer

**AKS**:
- Use Helm chart
- Azure Database for PostgreSQL
- Key Vault for secrets

## Troubleshooting

### Services Not Starting

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f <service-name>

# Restart specific service
docker compose restart <service-name>

# Complete reset
docker compose down -v
docker compose up -d --build
```

### Health Checks Failing

```bash
# Test RCRT server
curl http://localhost:8081/health
# Expected: ok

# Test dashboard
curl -I http://localhost:8082
# Expected: 200 OK

# Test builder
curl http://localhost:3000/api/health
# Expected: {"status":"ok"}
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker compose logs postgres

# Connect manually
docker exec -it rcrt-postgres psql -U rcrt -d rcrt

# Check tables
\dt

# Check breadcrumbs
SELECT COUNT(*) FROM breadcrumbs;
```

### NATS Connection Issues

```bash
# Check NATS
docker compose logs nats

# Test connection
docker exec -it rcrt-nats nats-server --version
```

### Bootstrap Failures

```bash
# Check bootstrap logs
docker compose logs bootstrap

# Re-run bootstrap
docker compose restart bootstrap

# Verify breadcrumbs loaded
curl http://localhost:8081/breadcrumbs?schema_name=tool.v1 | jq '. | length'
# Expected: 13
```

### Extension Not Connecting

```bash
# Check extension is built
ls extension/dist/

# Rebuild extension
cd extension
npm install
npm run build

# Check RCRT server is accessible
curl http://localhost:8081/health
```

## Maintenance

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### Database Migrations

Schema changes are handled automatically by `rcrt-server` on startup.

For manual migrations:

```bash
docker exec -it rcrt-postgres psql -U rcrt -d rcrt -f migration.sql
```

### Cleanup

**Old breadcrumbs** (automatic):
- Hygiene runner deletes expired breadcrumbs (TTL)
- Runs every hour

**Manual cleanup**:

```bash
# Trigger manual hygiene run
curl -X POST http://localhost:8081/hygiene/run

# Clean old Docker images
docker image prune -a
```

### Monitoring

**Metrics**:
```bash
curl http://localhost:8081/metrics
```

**Logs**:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f rcrt

# Follow with grep
docker compose logs -f | grep ERROR
```

## Performance Tuning

### Database

```sql
-- Connection pooling
ALTER SYSTEM SET max_connections = 200;

-- Shared buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '2GB';

-- Effective cache size (50-75% of RAM)
ALTER SYSTEM SET effective_cache_size = '6GB';

-- Work mem
ALTER SYSTEM SET work_mem = '16MB';

-- Maintenance work mem
ALTER SYSTEM SET maintenance_work_mem = '512MB';
```

### RCRT Server

```env
# Worker threads (num CPUs)
TOKIO_WORKER_THREADS=8

# Connection pool
DB_POOL_SIZE=20
```

### Embeddings

**GPU acceleration**:
- Use CUDA-enabled ONNX runtime
- Or remote embedding service

```env
EMBED_PROVIDER=remote
EMBED_URL=https://your-embedding-service/embed
```

## Security Checklist

- [ ] Enable JWT authentication
- [ ] Use strong database passwords
- [ ] Enable TLS/HTTPS
- [ ] Secure NATS with auth
- [ ] Set up encryption key (KEK)
- [ ] Configure firewall rules
- [ ] Enable audit logging
- [ ] Set up backup automation
- [ ] Configure monitoring alerts
- [ ] Review ACL policies
- [ ] Update secrets rotation policy
- [ ] Enable rate limiting
- [ ] Set up intrusion detection
- [ ] Configure CORS properly
- [ ] Review network policies

## Support

- **Documentation**: See `docs/README.md`
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Ask questions in GitHub Discussions

## Summary

RCRT provides multiple deployment options:

✅ **Local Development**: One-command setup with Docker Compose
✅ **Production**: Hardened configuration with monitoring
✅ **Kubernetes**: Helm chart for cloud-native deployment
✅ **Cloud**: Guides for AWS, GCP, Azure
✅ **Multi-Deployment**: Container prefix support

**Choose the deployment that fits your needs!**

