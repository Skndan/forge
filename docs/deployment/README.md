# Forge Deployment Guide

> Production-ready self-hosting guide for Forge.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Deploy (Docker Compose)](#quick-deploy-docker-compose)
- [Production Configuration](#production-configuration)
- [Environment Variables Reference](#environment-variables-reference)
- [Required Secrets](#required-secrets)
- [Security Hardening](#security-hardening)
- [Database Backup & Restore](#database-backup--restore)
- [Scaling](#scaling)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Server**: Linux (Ubuntu 22.04+, Debian 12+ recommended)
- **Docker**: 24.0+ with Docker Compose plugin v2.20+
- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 50GB+ SSD (scales with data)
- **Domain**: A DNS record pointing to your server (for Keycloak HTTPS)
- **Reverse Proxy**: Caddy, Nginx, or Traefik (recommended for TLS)

---

## Quick Deploy (Docker Compose)

### 1. Clone & Configure

```bash
git clone https://github.com/Skndan/forge.git
cd forge
cp .env.example .env
```

### 2. Set Production Secrets

Edit `.env` with strong, unique values:

```bash
# Generate strong secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32)
KEYCLOAK_ADMIN_PASSWORD=$(openssl rand -base64 16)
ADMIN_SERVICE_TOKEN=$(openssl rand -base64 32)
RUSTFS_SECRET_KEY=$(openssl rand -base64 32)
```

### 3. Configure Domain

```bash
# In .env
KEYCLOAK_URL=https://auth.yourdomain.com
GATEWAY_URL=https://api.yourdomain.com
JWKS_URL=https://auth.yourdomain.com/realms/forge/protocol/openid-connect/certs
KC_HOSTNAME=auth.yourdomain.com
CORS_ORIGINS=https://dashboard.yourdomain.com
```

### 4. Deploy

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 5. Verify

```bash
curl https://api.yourdomain.com/v1/health
# → {"success":true,"status":"healthy"}
```

---

## Production Configuration

### Docker Compose Production Override

Create `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  keycloak:
    command: ["start", "--import-realm"]
    environment:
      KC_HOSTNAME: auth.yourdomain.com
      KC_HOSTNAME_STRICT: "true"
      KC_HTTPS_PORT: 443
      KC_PROXY: edge
      KC_HTTP_ENABLED: "false"
    # Remove port mapping if behind reverse proxy
    ports: []

  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    deploy:
      resources:
        limits:
          memory: 4G
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./backups:/backups

  gateway:
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/v1/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s

  prometheus:
    deploy:
      resources:
        limits:
          memory: 1G

  grafana:
    environment:
      GF_SERVER_ROOT_URL: https://grafana.yourdomain.com
      GF_SERVER_SERVE_FROM_SUB_PATH: "true"
```

### Reverse Proxy (Caddy Example)

Save as `Caddyfile`:

```caddy
api.yourdomain.com {
    reverse_proxy gateway:3000
}

auth.yourdomain.com {
    reverse_proxy keycloak:8080
}

dashboard.yourdomain.com {
    reverse_proxy dashboard:3003
}

grafana.yourdomain.com {
    reverse_proxy grafana:3000
}
```

### Reverse Proxy (Nginx Example)

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Environment Variables Reference

### Database

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | — | **Required.** Postgres password (must be strong) |
| `POSTGRES_PORT` | `5432` | Postgres external port |

### Keycloak

| Variable | Default | Description |
|---|---|---|
| `KEYCLOAK_ADMIN_PASSWORD` | — | **Required.** Keycloak admin password |
| `KEYCLOAK_PORT` | `8080` | Keycloak external port |
| `KEYCLOAK_ISSUER` | `http://localhost:8080/realms/forge` | JWT issuer URL |
| `JWKS_URL` | `http://keycloak:8080/realms/forge/protocol/openid-connect/certs` | JWKS endpoint |

### Gateway

| Variable | Default | Description |
|---|---|---|
| `GATEWAY_PORT` | `3000` | Gateway external port |
| `ADMIN_SERVICE_TOKEN` | — | **Required.** Token for admin routes |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |
| `RATE_LIMIT_MAX` | `100` | Requests/minute per IP |

### Storage

| Variable | Default | Description |
|---|---|---|
| `RUSTFS_ACCESS_KEY` | `forge_access_key` | Access key for RustFS |
| `RUSTFS_SECRET_KEY` | — | **Required.** Secret key for RustFS |
| `RUSTFS_PORT` | `9000` | RustFS S3 API port |

### Monitoring

| Variable | Default | Description |
|---|---|---|
| `PROMETHEUS_PORT` | `9090` | Prometheus UI port |
| `GRAFANA_PORT` | `3004` | Grafana UI port |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |
| `ERROR_WEBHOOK_URL` | — | Error tracking webhook (optional) |

---

## Required Secrets

On first deploy, you **must** set these in `.env`:

```bash
POSTGRES_PASSWORD=<strong random password>
KEYCLOAK_ADMIN_PASSWORD=<strong random password>
ADMIN_SERVICE_TOKEN=<strong random token>
RUSTFS_SECRET_KEY=<strong random key>
```

After first deploy, store these in a password manager or secrets vault.

---

## Security Hardening

1. **Change all default passwords** before exposing to the internet
2. **Use a reverse proxy** with TLS termination (Caddy, Nginx, Traefik)
3. **Configure strict CORS** — set `CORS_ORIGINS` to your dashboard domain
4. **Restrict Keycloak admin** — use a strong password and consider SSO
5. **Enable Keycloak HTTPS** — set `KC_HOSTNAME_STRICT=true` in production
6. **Database network isolation** — use Docker internal network only
7. **Regular updates** — rebuild Docker images with `docker compose pull`
8. **Audit logs** — Forge's audit worker logs all admin operations
9. **Rate limiting** — configure `RATE_LIMIT_MAX` appropriately
10. **Backups** — use the backup script below

---

## Database Backup & Restore

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh — Run daily via cron
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"

mkdir -p "$BACKUP_DIR"

docker exec forge-postgres pg_dump -U forge forge \
  | gzip > "$BACKUP_DIR/forge_$TIMESTAMP.sql.gz"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
```

### Restore

```bash
gunzip -c backups/forge_20260101_000000.sql.gz | \
  docker exec -i forge-postgres psql -U forge forge
```

### Cron Job

```bash
# Run backup daily at 2 AM
0 2 * * * /path/to/forge/scripts/backup.sh
```

---

## Scaling

### Vertical Scaling
- Increase Postgres memory: `shared_buffers = 25% of RAM`
- Increase worker pool size for Function Runner
- Adjust Valkey `maxmemory` setting

### Horizontal Scaling
- **Gateway**: Run multiple replicas behind load balancer
- **Realtime**: Add instances behind Valkey pub/sub
- **Workers**: Increase replicas — pgmq `SKIP LOCKED` prevents duplicates
- **Postgres**: Add read replicas for query-heavy workloads
- **RustFS**: Use distributed mode for high-availability storage

### Resource Sizing Guide

| Scale | Users | RAM | CPU | Services |
|---|---|---|---|---|
| Small | < 100 | 8 GB | 4 cores | All services on 1 host |
| Medium | 100-1000 | 16 GB | 8 cores | Separate DB host |
| Large | 1000+ | 32+ GB | 16+ cores | Multi-host with LB |

---

## Monitoring Setup

### Accessing Grafana

1. Open `https://grafana.yourdomain.com` (or `http://localhost:3004`)
2. Login with `admin`/`admin` (change password on first login)
3. The "Forge — Service Overview" dashboard is pre-configured

### Alerts

Forge ships with Prometheus metrics. Recommended alert rules:

```yaml
groups:
  - name: forge
    rules:
      - alert: GatewayDown
        expr: up{service="forge-gateway"} == 0
        for: 1m

      - alert: HighErrorRate
        expr: rate(http_requests_total{status="5xx"}[5m]) > 0.05
        for: 5m

      - alert: HighLatency
        expr: rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]) > 2
        for: 5m

      - alert: PostgresDown
        expr: pg_up == 0
        for: 1m
```

### Logging

All services output structured JSON logs. Collect with:

```bash
# View logs for a service
docker logs forge-gateway

# Stream all logs
docker compose logs -f

# With jq for structured querying
docker logs forge-gateway | jq 'select(.level == "error")'
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|---|---|
| Keycloak won't start | Check Postgres connection; wait longer for `start_period` |
| Gateway health returns degraded | Check `JWKS_URL` and `POSTGRES_URL` env vars |
| CORS errors in browser | Set `CORS_ORIGINS` to your dashboard URL |
| Rate limiting too aggressive | Increase `RATE_LIMIT_MAX` |
| Webhook delivery failing | Check webhook URL is reachable from Docker network |
| Disk space low | Clean old Docker images: `docker system prune -a` |

### Health Check Endpoints

```bash
# Gateway full health
curl http://localhost:3000/v1/health

# Keycloak health
curl http://localhost:8080/health/ready

# Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development docker compose up -d

# Or for a single service
docker compose logs -f gateway --tail=100
```

---

## Upgrading

```bash
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
```

Check [CHANGELOG.md](../../CHANGELOG.md) for breaking changes between releases.
