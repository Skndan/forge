# Forge — Build Plan

> Open-source Supabase alternative
> Repo: `github.com/Skndan/forge`
> Monorepo: Turborepo | DB: raw SQL migrations | Storage: RustFS

---

## Decisions

| Question | Answer |
|---|---|
| PostgreSQL migrations | Raw `.sql` files |
| S3-compatible storage | RustFS |
| Monorepo tool | Turborepo |
| Build scope | Docker Compose + Gateway first, then rest |

---

## Phase 1: Core Infrastructure

### Step 1 — Project Scaffold
- Turborepo monorepo with all package directories
- Root `package.json` (workspaces), `tsconfig.json`, `.gitignore`
- `docker-compose.yml` with all 9 services
- `.env.example` with all configuration vars

### Step 2 — Database Schema
- PostgreSQL 16 migrations via raw `.sql` files
- Tables: tenants, users, storage_metadata, function_definitions, webhook_subscriptions, webhook_deliveries, audit_logs
- RLS policies with `app.current_user_id` + `app.current_roles`
- `pg_notify` triggers on INSERT/UPDATE/DELETE
- pgmq extension for webhook queue

### Step 3 — Auth Layer
- Keycloak realm config (realm.json export)
- Custom JWT mappers: tenant_id, plan, roles
- Client definitions: forge-api (confidential), forge-dashboard (public), forge-flutter (public)
- Docker Compose healthcheck + init script for realm import

### Step 4 — Gateway Service (packages/gateway)
- Bun + Fastify
- JWKS fetch on startup (15-min cache) using jose
- JWT verification middleware
- Postgres session variable middleware (`app.current_user_id`, `app.current_roles`)
- Route stubs:
  - `POST /v1/db/query` — database query endpoint
  - `POST /v1/storage/upload-url` — presigned upload URL
  - `GET /v1/storage/download-url` — presigned download URL
  - `POST /v1/functions/invoke` — invoke a function
  - `POST /v1/webhooks` — manage webhook subscriptions
  - `GET /v1/auth/me` — current user info
  - Admin routes (prefix /v1/admin, admin service token check)

### Step 5 — Realtime Service (packages/realtime)
- Bun WebSocket server
- JWT auth on connect
- Postgres LISTEN on `pg_notify` channels
- Valkey pub/sub for multi-instance fan-out
- Subscription management with filters

### Step 6 — Storage Service (packages/storage)
- RustFS (S3-compatible) integration
- Presigned URL generation (client uploads direct, never through server)
- Metadata tracked in Postgres

### Step 7 — Workers
- **Webhook Worker** (packages/worker-webhook): Bun, `SELECT FOR UPDATE SKIP LOCKED`, exponential backoff, HMAC-SHA256 signing
- **Scheduler** (packages/worker-scheduler): Bun, cron-based function triggers
- **Audit Logger** (packages/worker-audit): Write audit events to Postgres

### Step 8 — Admin Dashboard (packages/dashboard)
- Next.js (App Router)
- Login via Keycloak (PKCE)
- Table browser, auth manager, storage browser
- RBAC editor, webhook manager, function manager

### Step 9 — Flutter SDK (packages/flutter-sdk)
- `ForgeClient` singleton
- `flutter_appauth` for PKCE
- `flutter_secure_storage` for tokens
- Dio with token interceptor (auto-refresh)
- Dart Stream for realtime

### Step 10 — Function Runner (packages/function-runner)
- Bun runtime with Docker-in-Docker isolation
- Scoped JWT per function invocation
- Warm pool for frequently used functions

---

## Phase 2: Polish & DX (After Phase 1)

- Healthcheck improvements
- Metrics / monitoring
- CI/CD with GitHub Actions
- Documentation site
- Example apps

---

## Build Order

```
Phase 1, Step 1  →  Scaffold (Turborepo + Docker Compose + .env)
        ↓
Phase 1, Step 2  →  Database Schema (raw SQL migrations)
        ↓
Phase 1, Step 3  →  Auth Layer (Keycloak config)
        ↓
Phase 1, Step 4  →  Gateway Service (Bun + Fastify) ← BUILD THIS FIRST
        ↓
Phase 1, Step 5  →  Realtime Service
        ↓
Phase 1, Step 6  →  Storage Service
        ↓
Phase 1, Step 7  →  Workers (Webhook, Scheduler, Audit)
        ↓
Phase 1, Step 8  →  Admin Dashboard
        ↓
Phase 1, Step 9  →  Flutter SDK
        ↓
Phase 1, Step 10 →  Function Runner
```

## Definitions of Done

Each step is done when:
- [ ] Code compiles/runs without errors
- [ ] Docker Compose starts all services cleanly
- [ ] Proper TypeScript types throughout
- [ ] Error handling for all routes
- [ ] Committed and pushed to GitHub

---

## ❓ Staged Questions (will ask as we build)

1. Keycloak realm name — `forge` or something else?
2. Gateway port — `8080` or custom?
3. Database name — `forge` or `postgres`?
4. RustFS — official image or community build?
