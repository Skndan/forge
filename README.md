# 🔥 Forge

> **Open-source Supabase alternative** — Self-hostable BaaS with PostgreSQL, realtime subscriptions, file storage, serverless functions, and an admin dashboard.

![Forge](https://img.shields.io/badge/status-v0.1--Foundation-blue)
[![GitHub Repo](https://img.shields.io/github/stars/Skndan/forge?style=social)](https://github.com/Skndan/forge)
[![Project Board](https://img.shields.io/badge/board-view-2ea44f)](https://github.com/orgs/Skndan/projects/2)

---

## ✨ Features

| Feature | Status | Release |
|---|---|---|
| **PostgreSQL 16** with RLS, pg_notify, pgmq | ✅ Done | v0.1 |
| **Auth** via Keycloak (PKCE, JWT mappers) | ✅ Done | v0.1 |
| **API Gateway** (Bun + Fastify, JWT verify) | ✅ Done | v0.1 |
| **Realtime subscriptions** (WebSocket + Valkey) | ✅ Done | v0.2 |
| **File storage** (RustFS S3-compatible) | ✅ Done | v0.2 |
| **Background workers** (Webhook, Scheduler, Audit) | ✅ Done | v0.2 |
| **Admin Dashboard** (Next.js) | ⏳ Planned | v0.3 |
| **Flutter SDK** (Mobile client) | ⏳ Planned | v0.3 |
| **Function Runner** (DinD secure sandbox) | ⏳ Planned | v0.4 |
| **CI/CD + Monitoring** | ⏳ Planned | v0.5 |

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
```

---

## 🚀 Quick Start

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
pnpm install
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
pnpm dev
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

---

## 🧪 Testing

### Run all tests

```bash
pnpm test
```

### Run tests for a specific package

```bash
# Gateway
pnpm --filter @forge/gateway test

# Realtime
pnpm --filter @forge/realtime test

# Storage
pnpm --filter @forge/storage test

# Workers
pnpm --filter @forge/worker-webhook test
pnpm --filter @forge/worker-scheduler test
pnpm --filter @forge/worker-audit test

# Dashboard
pnpm --filter @forge/dashboard test
```

### End-to-end test

```bash
# Ensure all services are running first
./scripts/e2e-test.sh
```

### Watch mode (development)

```bash
pnpm --filter @forge/gateway test -- --watch
```

### Makefile (alternative)

```bash
make test         # all tests
make test-e2e     # e2e tests
make test-gateway # gateway tests
make lint         # lint check
make typecheck    # TypeScript check
```

---

## 💻 Local Development Workflow

```bash
# Terminal 1: Docker services
make up

# Terminal 2: Services with hot-reload
make dev

# Terminal 3: Tests in watch mode
make test-watch

# Before committing
make lint
make typecheck
```

> For complete details on every command, see [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## 📦 Packages

| Package | Tech | Description |
|---|---|---|
| `packages/gateway` | Bun + Fastify | API gateway, JWT auth, route handlers |
| `packages/database` | SQL | Migrations, RLS, triggers, pgmq |
| `packages/auth` | Keycloak | Realm config, clients, JWT mappers |
| `packages/realtime` | Bun + WS | WebSocket subscriptions, Valkey pub/sub |
| `packages/storage` | Bun | RustFS integration, presigned URLs |
| `packages/worker-webhook` | Bun | Webhook delivery with retry + HMAC |
| `packages/worker-scheduler` | Bun | Cron-based function triggers |
| `packages/worker-audit` | Bun | Audit log writer |
| `packages/dashboard` | Next.js | Admin UI (table browser, auth manager) |
| `packages/flutter-sdk` | Dart | Mobile client SDK |
| `packages/function-runner` | Bun + DinD | Serverless function execution |
| `packages/types` | TypeScript | Shared type definitions |

---

## 🗺️ Roadmap

| Release | Focus | Status |
|---|---|---|
| **v0.1 — Foundation** 🏗️ | Scaffold · Database · Auth · Gateway | ✅ **Done** |
| **v0.2 — Data Layer** 📡 | Realtime · Storage · Workers | ✅ **Done** |
| **v0.3 — Frontend + SDK** 🎨 | Dashboard · Flutter SDK | ⏳ Planned |
| **v0.4 — Compute** ⚡ | Function Runner (DinD) | ⏳ Planned |
| **v0.5 — DX & Polish** ✨ | CI/CD · Docs · Monitoring | ⏳ Planned |

See [ROADMAP.md](./ROADMAP.md) for full details + architecture diagrams.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun, Next.js, Flutter |
| Database | PostgreSQL 16 + RLS + pgmq |
| Auth | Keycloak (PKCE, JWT) |
| Realtime | WebSocket + Valkey pub/sub |
| Storage | RustFS (S3-compatible) |
| Functions | Docker-in-Docker |
| Infrastructure | Docker Compose |

---

## 📊 Project Board

Track progress and view all tasks on the **[Forge Project Board](https://github.com/orgs/Skndan/projects/2)**.

---

## 🤝 Contributing

This is early-stage and moving fast. Check the [issues](https://github.com/Skndan/forge/issues) for active work items.

---

## 📄 License

MIT
