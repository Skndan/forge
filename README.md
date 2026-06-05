# 🔥 Forge

> **Open-source Supabase alternative** — Self-hostable BaaS with PostgreSQL, realtime subscriptions, file storage, serverless functions, and an admin dashboard.

[![Build Status](https://github.com/Skndan/forge/actions/workflows/ci.yml/badge.svg)](https://github.com/Skndan/forge/actions)
[![Docker Build](https://github.com/Skndan/forge/actions/workflows/docker-build.yml/badge.svg)](https://github.com/Skndan/forge/actions)
[![GitHub Release](https://img.shields.io/github/v/release/Skndan/forge)](https://github.com/Skndan/forge/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Project Board](https://img.shields.io/badge/board-view-2ea44f)](https://github.com/orgs/Skndan/projects/2)

---

## ✨ Features

| Feature | Status | Release |
|---|---|---|
| **PostgreSQL 16** with RLS, pg_notify, pgmq | ✅ v0.1 | Foundation |
| **Auth** via Keycloak (PKCE, JWT mappers) | ✅ v0.1 | Foundation |
| **API Gateway** (Bun + Fastify, JWT verify) | ✅ v0.1 | Foundation |
| **Realtime subscriptions** (WebSocket + Valkey) | ✅ v0.2 | Data Layer |
| **File storage** (RustFS S3-compatible) | ✅ v0.2 | Data Layer |
| **Background workers** (Webhook, Scheduler, Audit) | ✅ v0.2 | Data Layer |
| **Admin Dashboard** (Next.js) | ✅ v0.3 | Frontend+SDK |
| **Flutter SDK** (Mobile client) | ✅ v0.3 | Frontend+SDK |
| **Function Runner** (DinD secure sandbox) | ✅ v0.4 | Compute |
| **CI/CD + Monitoring** | ✅ v0.5 | DX & Polish |

---

## 🚀 Quick Start — 5 Minutes

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) v2.20+
- Git

### 1. Clone & Configure

```bash
git clone https://github.com/Skndan/forge.git
cd forge
cp .env.example .env
# Edit .env if you want custom passwords/ports
```

### 2. Start All Services

```bash
docker compose up -d
```

This starts the full stack (15 services):
- Gateway API on `http://localhost:3000`
- Keycloak Auth on `http://localhost:8080`
- Admin Dashboard on `http://localhost:3003`
- Prometheus on `http://localhost:9090`
- Grafana on `http://localhost:3004` (admin/admin)

### 3. Verify

```bash
# Check all services are healthy
curl http://localhost:3000/v1/health

# Should return: {"success":true,"status":"healthy"}
```

### 4. Use the API

```bash
# Get a token (via Keycloak)
TOKEN=$(curl -s -X POST http://localhost:8080/realms/forge/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=forge-api" \
  -d "client_secret=CHANGE_ME" \
  -d "grant_type=password" \
  -d "username=admin" \
  -d "password=admin" | jq -r '.access_token')

# Query the database
curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3000/v1/db/query \
  -d '{"query": "SELECT * FROM forge.tenants"}'
```

That's it! You have a fully-functional BaaS running locally.

---

## 🏗️ Architecture

```
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│  Flutter SDK  │  │  Dashboard    │  │  External     │
│  (Mobile)     │  │  (Next.js)    │  │  Clients      │
└──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        │
                  ┌─────▼──────┐         ┌──────────┐
                  │  Gateway    │◄────────│ Keycloak │
                  │  (Bun)      │  JWKS   │  Auth    │
                  └──┬───┬───┬─┘         └──────────┘
                     │   │   │
          ┌──────────┘   │   └──────────┐
          ▼               ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Realtime │   │ Workers   │   │ Function │
   │ (Bun+WS) │   │(Webhook,  │   │ Runner   │
   │ Valkey   │   │Scheduler, │   │ (DinD)   │
   └────┬─────┘   │Audit)     │   └────┬─────┘
        │         └────┬─────┘         │
        └──────────────┼───────────────┘
                       │
              ┌────────▼────────┐
              │  PostgreSQL 16   │
              │  + RustFS (S3)   │
              └─────────────────┘


        ┌────────────────────────────────────────┐
        │        Monitoring & Observability       │
        │  ┌──────────┐  ┌────────┐  ┌────────┐  │
        │  │Prometheus│  │Grafana │  │Postgres│  │
        │  │:9090     │  │:3004   │  │Exporter│  │
        │  └──────────┘  └────────┘  └────────┘  │
        └────────────────────────────────────────┘
```

### Service Overview

| Service | Tech | Port | Role |
|---|---|---|---|
| **gateway** | Bun + Fastify | 3000 | API gateway, auth, routing |
| **realtime** | Bun + WS | 3001 | WebSocket subscriptions |
| **worker-webhook** | Bun | — | Webhook delivery with retry |
| **worker-scheduler** | Bun | — | Cron-based triggers |
| **worker-audit** | Bun | — | Audit log writer |
| **function-runner** | Bun + DinD | 3002 | Serverless functions |
| **dashboard** | Next.js | 3003 | Admin UI |
| **postgres** | PostgreSQL 16 | 5432 | Primary database |
| **keycloak** | Keycloak 24 | 8080 | Identity & auth |
| **rustfs** | RustFS | 9000 | S3-compatible storage |
| **valkey** | Valkey 7.2 | 6379 | Pub/sub + caching |
| **prometheus** | Prometheus | 9090 | Metrics collection |
| **grafana** | Grafana | 3004 | Dashboards & viz |
| **postgres-exporter** | Prometheus community | 9187 | PG metrics |
| **valkey-exporter** | Redis exporter | 9121 | Valkey metrics |

---

## 📚 Documentation

| Document | Description |
|---|---|
| [Architecture Guide](docs/architecture/README.md) | Service architecture, data flow, sequence diagrams |
| [API Reference](docs/api/README.md) | Full API reference with request/response examples |
| [Deployment Guide](docs/deployment/README.md) | Self-hosting, production configs, scaling |
| [Flutter SDK](docs/flutter-sdk/README.md) | SDK reference, installation, code examples |
| [Example Apps](examples/) | Todo app, chat app, file gallery |

---

## 🧪 Testing

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org/) |
| pnpm | >= 9 | `npm i -g pnpm` |
| Bun | >= 1.1 | `curl -fsSL https://bun.sh/install \| bash` |
| Docker | >= 24 | [docker.com](https://www.docker.com/) |
| Docker Compose | >= 2.24 | Included with Docker Desktop |

### Setup

```bash
git clone https://github.com/Skndan/forge.git
cd forge
cp .env.example .env
```

Edit `.env` and set these required values:
- `POSTGRES_PASSWORD` — database password
- `KEYCLOAK_ADMIN_PASSWORD` — Keycloak admin password
- `ADMIN_SERVICE_TOKEN` — token for admin dashboard (any random string)
- `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` — storage credentials

### Run (Development)

```bash
# Start infrastructure (Postgres + Keycloak + RustFS + Valkey)
docker compose up -d postgres keycloak rustfs valkey

# Start all services in dev mode with hot-reload
bun dev
```

### Run (Production)

```bash
# Build everything
docker compose build

# Start the full stack
docker compose up -d
```

### Service Endpoints

| Service | URL | Notes |
|---|---|---|
| **Gateway API** | http://localhost:3000 | Main API |
| **Keycloak** | http://localhost:8080 | Admin: `admin` / your password |
| **PostgreSQL** | `localhost:5432` | Database: `forge` / `forge` |
| **RustFS Console** | http://localhost:9001 | Storage browser |
| **Valkey** | `localhost:6379` | Redis-compatible |
| **Realtime WS** | `ws://localhost:3001` | WebSocket |
| **Dashboard** | http://localhost:3003 | Admin UI |
| **Healthcheck** | http://localhost:3000/v1/health | API status |
| **Prometheus** | http://localhost:9090 | Metrics |
| **Grafana** | http://localhost:3004 | Dashboards (admin/admin) |

---

## 🧪 Testing

```bash
# Run all unit tests
bun test

# Run integration tests (requires Docker Compose stack)
./scripts/integration-test.sh
```

---

## 📊 Monitoring

Forge ships with pre-configured monitoring:

- **Prometheus** at `http://localhost:9090` — collects metrics from all services
- **Grafana** at `http://localhost:3004` (admin/admin) — pre-built Forge dashboard
- **Structured JSON logging** — all services log JSON with correlation IDs
- **Health checks** — comprehensive per-service health endpoints
- **Error tracking** — centralized error collection with webhook support

### Quick Monitoring

```bash
# Health check
curl http://localhost:3000/v1/health

# Prometheus metrics
curl http://localhost:3000/metrics

# Grafana dashboard (browser)
open http://localhost:3004
```

---

## 🐳 Docker Images

Pre-built Docker images are available on GitHub Container Registry:

```bash
docker pull ghcr.io/skndan/forge/gateway:latest
docker pull ghcr.io/skndan/forge/realtime:latest
docker pull ghcr.io/skndan/forge/function-runner:latest
docker pull ghcr.io/skndan/forge/worker-webhook:latest
docker pull ghcr.io/skndan/forge/worker-scheduler:latest
docker pull ghcr.io/skndan/forge/worker-audit:latest
docker pull ghcr.io/skndan/forge/dashboard:latest
```

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Runtime | Bun 1.x, Node.js 20 |
| Framework | Fastify, Next.js 14 |
| Database | PostgreSQL 16 |
| Auth | Keycloak 24 (OIDC/PKCE) |
| Storage | RustFS (S3-compatible) |
| Pub/Sub | Valkey 7.2 (Redis-compatible) |
| Monitoring | Prometheus, Grafana |
| Language | TypeScript, Dart (Flutter SDK) |
| Tooling | Turborepo, Docker Compose |

---

## 📋 Releases

| Release | Features | Status |
|---|---|---|
| [v0.1](https://github.com/Skndan/forge/releases/tag/v0.1) | Foundation — Scaffold, DB, Auth, Gateway | ✅ |
| [v0.2](https://github.com/Skndan/forge/releases/tag/v0.2) | Data Layer — Realtime, Storage, Workers | ✅ |
| [v0.3](https://github.com/Skndan/forge/releases/tag/v0.3) | Frontend+SDK — Dashboard, Flutter SDK | ✅ |
| [v0.4](https://github.com/Skndan/forge/releases/tag/v0.4) | Compute — Function Runner (DinD) | ✅ |
| [v0.5](https://github.com/Skndan/forge/releases/tag/v0.5) | DX & Polish — CI/CD, Docs, Monitoring | ✅ |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push (`git push origin feat/amazing`)
5. Open a Pull Request

See the [project board](https://github.com/orgs/Skndan/projects/2) for planned features.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **Repository:** [github.com/Skndan/forge](https://github.com/Skndan/forge)
- **Issues:** [github.com/Skndan/forge/issues](https://github.com/Skndan/forge/issues)
- **Project Board:** [github.com/orgs/Skndan/projects/2](https://github.com/orgs/Skndan/projects/2)
