# 🔧 Forge — Development Guide

Everything you need to set up, run, test, and build Forge locally.

---

## 📋 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | >= 20 | JS runtime (Dashboard) |
| [pnpm](https://pnpm.io/) | >= 9 | Package manager |
| [Bun](https://bun.sh/) | >= 1.1 | Services runtime |
| [Docker](https://www.docker.com/) | >= 24 | Containers |
| [Docker Compose](https://docs.docker.com/compose/) | >= 2.24 | Multi-service orchestration |
| [Flutter](https://flutter.dev/) | >= 3.19 | Flutter SDK (optional) |

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/Skndan/forge.git
cd forge

# 2. Install dependencies
pnpm install

# 3. Copy environment config
cp .env.example .env
# Edit .env with your values (defaults work for local dev)

# 4. Start infrastructure (Postgres, Keycloak, RustFS, Valkey)
docker compose up -d postgres keycloak rustfs valkey

# 5. Run services (in separate terminals or background)
pnpm dev
```

The gateway starts at **http://localhost:3000** 🎉

---

## 📁 Project Structure

```
forge/
├── packages/
│   ├── gateway/           # API Gateway (Bun + Fastify)
│   ├── database/          # SQL migrations & schema
│   ├── auth/              # Keycloak realm config
│   ├── realtime/          # WebSocket server (Bun)
│   ├── storage/           # RustFS file storage
│   ├── worker-webhook/    # Webhook delivery worker
│   ├── worker-scheduler/  # Cron-based scheduler
│   ├── worker-audit/      # Audit log worker
│   ├── dashboard/         # Admin dashboard (Next.js)
│   ├── flutter-sdk/       # Flutter client SDK (Dart)
│   ├── function-runner/   # Serverless function runner
│   └── types/             # Shared TypeScript types
├── docker-compose.yml     # Full stack orchestration
├── Makefile               # Common commands
└── .env.example           # Environment template
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required
POSTGRES_PASSWORD=changeme
KEYCLOAK_ADMIN_PASSWORD=changeme
ADMIN_SERVICE_TOKEN=changeme
RUSTFS_ACCESS_KEY=minioadmin
RUSTFS_SECRET_KEY=minioadmin

# Optional (defaults work for local dev)
GATEWAY_PORT=3000
KEYCLOAK_PORT=8080
POSTGRES_PORT=5432
RUSTFS_PORT=9000
VALKEY_PORT=6379
REALTIME_PORT=3001
FUNCTION_RUNNER_PORT=3002
DASHBOARD_PORT=3003
```

---

## 🧪 Running Tests

### All packages
```bash
pnpm test
```

### Specific package
```bash
pnpm --filter @forge/gateway test
pnpm --filter @forge/realtime test
pnpm --filter @forge/storage test
pnpm --filter @forge/worker-webhook test
```

### Watch mode (development)
```bash
pnpm --filter @forge/gateway test -- --watch
```

---

## 💻 Local Development

### Start all services
```bash
# Terminal 1: Infrastructure (Docker)
docker compose up -d

# Terminal 2: All services (hot-reload)
pnpm dev
```

### Start a single service
```bash
# Run just the gateway
pnpm --filter @forge/gateway dev

# Run just the realtime server
pnpm --filter @forge/realtime dev
```

### Database migrations
```bash
# Run all pending migrations
docker compose exec postgres psql -U forge -d forge -f /docker-entrypoint-initdb.d/001-initial.sql

# Or using the migration runner
./scripts/migrate.sh
```

---

## 🐳 Docker Commands (Makefile)

```bash
make help          # Show all commands
make up            # Start all services
make down          # Stop all services
make restart       # Restart all services
make logs          # Tail logs
make ps            # Service status
make test          # Run all tests
make test-e2e      # End-to-end tests
make clean         # Remove containers + volumes
make reset         # Full reset (clean + rebuild)
```

---

## 📡 Service Endpoints

| Service | URL | Notes |
|---|---|---|
| **Gateway API** | http://localhost:3000 | Main API endpoint |
| **Health** | http://localhost:3000/v1/health | Health check |
| **Keycloak** | http://localhost:8080 | Admin: admin/:password |
| **PostgreSQL** | localhost:5432 | Database: forge/forge |
| **RustFS Console** | http://localhost:9001 | Storage browser |
| **RustFS API** | http://localhost:9000 | S3-compatible endpoint |
| **Valkey** | localhost:6379 | Redis-compatible |
| **Realtime** | ws://localhost:3001 | WebSocket |
| **Dashboard** | http://localhost:3003 | Admin UI |
| **Function Runner** | http://localhost:3002 | Deploy functions |

---

## 🔄 Development Workflow

1. **Make changes** in `packages/*/src/`
2. **Tests auto-run** in watch mode with `pnpm dev`
3. **Lint** before committing: `pnpm lint`
4. **Type-check**: `pnpm typecheck`
5. **Commit** follows conventional commits
6. **Push** triggers CI pipeline

### Gateway API example
```bash
# Health check
curl http://localhost:3000/v1/health

# Get auth token (via Keycloak)
# Then use it
curl -H "Authorization: Bearer <token>" http://localhost:3000/v1/auth/me
```

---

## 🧹 Code Quality

```bash
pnpm lint          # ESLint check
pnpm typecheck     # TypeScript check
pnpm format        # Prettier format
pnpm clean         # Clean build artifacts
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---|---|
| `port already in use` | Change port in `.env` or kill the process |
| `Postgres connection refused` | Wait for Docker healthcheck, or `docker compose logs postgres` |
| `JWKS fetch failed` | Ensure Keycloak is healthy: `docker compose logs keycloak` |
| `pnpm install fails` | Clear cache: `pnpm store prune` then retry |
| `Docker permission denied` | Add user to docker group: `sudo usermod -aG docker $USER` |

---

## 📚 More

- [Architecture & Roadmap](./ROADMAP.md)
- [GitHub Issues](https://github.com/Skndan/forge/issues)
- [Project Board](https://github.com/orgs/Skndan/projects/2)
