# Forge — Backlog, Roadmap & Releases

> **Project:** Forge — Open Source Supabase Alternative
> **Repo:** github.com/Skndan/forge
> **Monorepo:** Turborepo | **DB:** Raw SQL Migrations | **Storage:** RustFS | **Auth:** Keycloak

---

## 🗺️ Roadmap Overview

```
v0.1 — Foundation      │ Scaffold + DB + Auth + Gateway    │ P0
v0.2 — Data Layer      │ Realtime + Storage + Workers      │ P0
v0.3 — Frontend+SDK    │ Dashboard + Flutter SDK           │ P1
v0.4 — Compute         │ Function Runner (DinD)            │ P1
v0.5 — DX & Polish     │ CI/CD + Docs + Monitoring         │ P2
```

---

## 📦 Release v0.1 — "Foundation" (P0)

> **Goal:** Working monorepo with Docker Compose, database, auth, and gateway API.
> **Dependencies:** None (starting from scratch)

### EPIC: Project Scaffold [v0.1]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| F-001 | Initialize Turborepo monorepo | S | — | `pnpm dlx create-turbo@latest`, configure workspaces |
| F-002 | Root config files | S | F-001 | `tsconfig.json`, `.gitignore`, `.prettierrc`, `eslint.config.js` |
| F-003 | Package directories scaffold | M | F-001 | Create all `packages/*` dirs with `package.json` stubs |
| F-004 | Docker Compose — full services | L | F-003 | Single `docker-compose.yml` with all 9 services, healthchecks, deps |
| F-005 | `.env.example` | S | F-004 | All env vars with sensible defaults |
| F-006 | Init scripts for Docker Compose | M | F-005 | Keycloak realm import, DB migration runner, healthcheck scripts |
| F-007 | Shared TypeScript types package | M | F-003 | `packages/types/` — shared types for all services |

### EPIC: Database Schema [v0.1]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| DB-001 | Initial migration — schema DDL | XL | F-005 | `tenants`, `users`, `storage_metadata`, `function_definitions`, `webhook_subscriptions`, `webhook_deliveries`, `audit_logs` tables |
| DB-002 | RLS policies | L | DB-001 | Row-level security using `app.current_user_id` + `app.current_roles` |
| DB-003 | pg_notify triggers | M | DB-001 | `CREATE OR REPLACE FUNCTION notify_change()` + triggers on INSERT/UPDATE/DELETE |
| DB-004 | pgmq extension + queue setup | M | DB-001 | Setup pgmq for webhook queue (fallback if not available during build) |
| DB-005 | Migration runner script | M | F-005 | Bash script that runs `.sql` files in order, tracks applied migrations |

### EPIC: Auth Layer (Keycloak) [v0.1]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| A-001 | Keycloak realm export | L | F-005 | `realm.json` with realm config, custom JWT mappers (tenant_id, plan, roles) |
| A-002 | Keycloak client definitions | M | A-001 | `forge-api` (confidential), `forge-dashboard` (public), `forge-flutter` (public) |
| A-003 | Docker Compose healthcheck + init | M | F-004, A-001 | Healthcheck waits for Keycloak, init script imports realm on first boot |

### EPIC: Gateway Service [v0.1]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| G-001 | Bun + Fastify project scaffold | S | F-003 | `packages/gateway/` — tsconfig, package.json, entry point |
| G-002 | JWKS fetch + cache (15-min TTL) | M | G-001, A-001 | Fetch JWKS from Keycloak on startup, cache with `jose` |
| G-003 | JWT verification middleware | M | G-002 | Verify Bearer token, extract claims using jose |
| G-004 | Postgres session variable middleware | M | G-003 | Set `app.current_user_id`, `app.current_roles` via `SET LOCAL` |
| G-005 | Admin service token middleware | S | G-003 | Separate middleware for admin routes with service token check |
| G-006 | Route: `POST /v1/db/query` | M | G-004 | Database query endpoint (parameterized, RLS-aware) |
| G-007 | Route: `POST /v1/storage/upload-url` | S | G-004 | Presigned upload URL generation |
| G-008 | Route: `GET /v1/storage/download-url` | S | G-004 | Presigned download URL generation |
| G-009 | Route: `POST /v1/functions/invoke` | S | G-004 | Stub for function invocation |
| G-010 | Route: `POST /v1/webhooks` | M | G-004 | Webhook subscription CRUD |
| G-011 | Route: `GET /v1/auth/me` | S | G-004 | Current user info endpoint |
| G-012 | Route: `GET /v1/health` | S | G-001 | Health check endpoint |
| G-013 | Error handling middleware | M | G-001 | Global error handler, structured error responses |
| G-014 | CORS configuration | S | G-001 | Proper CORS for dashboard + Flutter SDK |
| G-015 | Rate limiting | M | G-001 | Basic rate limiting (token bucket or similar) |
| G-016 | Admin routes scaffold | M | G-005, G-004 | `GET /v1/admin/*` routes for dashboard |

### EPIC: Docker Compose Integration [v0.1]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| DC-001 | End-to-end Docker Compose test | L | All v0.1 | Verify all services start, healthchecks pass, gateway talks to Keycloak + Postgres |
| DC-002 | Dockerfile for Gateway | M | G-001 | Multi-stage Dockerfile (Bun install → build → production) |
| DC-003 | Gateway healthcheck in Compose | S | DC-002 | `curl --fail http://localhost:3030/v1/health` |

---

## 📦 Release v0.2 — "Data Layer" (P0)

> **Goal:** Real-time subscriptions, file storage, and background workers operational.

### EPIC: Realtime Service [v0.2]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| R-001 | Realtime project scaffold | S | F-003 | `packages/realtime/` — Bun + WS |
| R-002 | JWT auth on WebSocket connect | M | R-001, G-002 | Verify JWT during WS upgrade |
| R-003 | Postgres LISTEN on pg_notify | M | R-001, DB-003 | Listen to pg_notify channels, parse payloads |
| R-004 | Valkey pub/sub for multi-instance | M | R-001 | Pub/sub fan-out for horizontal scaling |
| R-005 | Subscription management | L | R-002 | Client subscribes with table/filter/row_id, server pushes matching changes |
| R-006 | Reconnection handling | M | R-005 | Client reconnect with last-known state |
| R-007 | Channel filtering | M | R-005 | Per-client filters (only receive relevant changes) |

### EPIC: Storage Service [v0.2]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| S-001 | Storage project scaffold | S | F-003 | `packages/storage/` — Bun project |
| S-002 | RustFS client integration | M | S-001 | S3-compatible client for RustFS |
| S-003 | Presigned upload URL generation | M | S-002 | Temporary upload URLs, expiry config |
| S-004 | Presigned download URL generation | M | S-002 | Temporary download URLs, expiry config |
| S-005 | Storage metadata CRUD in Postgres | M | S-001, DB-001 | Track file metadata (bucket, path, size, content_type) |
| S-006 | Bucket management (CRUD) | M | S-005 | Create/list/delete buckets |
| S-007 | CORS for storage endpoints | S | S-001 | Allow direct browser uploads to RustFS |

### EPIC: Workers — Webhook, Scheduler, Audit [v0.2]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| W-001 | Webhook Worker scaffold | S | F-003 | `packages/worker-webhook/` |
| W-002 | Webhook delivery loop | L | W-001, DB-001 | `SELECT FOR UPDATE SKIP LOCKED`, deliver with retry |
| W-003 | Exponential backoff for webhooks | M | W-002 | Retry with backoff, max attempts config |
| W-004 | HMAC-SHA256 signing of webhooks | M | W-002 | Sign payloads so consumers can verify |
| W-005 | Scheduler Worker scaffold | S | F-003 | `packages/worker-scheduler/` |
| W-006 | Cron-based function triggers | M | W-005 | Parse cron expressions, trigger functions on schedule |
| W-007 | Audit Logger Worker scaffold | S | F-003 | `packages/worker-audit/` |
| W-008 | Audit event writing | M | W-007 | Write audit events to `audit_logs` table |
| W-009 | Worker healthchecks + retry | S | W-002, W-006, W-008 | Each worker reports health, retries on failure |

---

## 📦 Release v0.3 — "Frontend + SDK" (P1)

> **Goal:** Admin dashboard for managing the platform + Flutter SDK for mobile clients.

### EPIC: Admin Dashboard (Next.js) [v0.3]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| D-001 | Next.js project scaffold | M | F-003 | `packages/dashboard/` — App Router, Tailwind, shadcn/ui |
| D-002 | Login via Keycloak (PKCE) | L | D-001, A-002 | PKCE flow with `next-auth` or custom |
| D-003 | Admin service token integration | M | D-001, G-005 | Token exchange after login |
| D-004 | Table browser UI | L | D-003 | View/edit rows, define RLS policies visually |
| D-005 | Auth manager UI | L | D-003 | Keycloak user management, role assignment |
| D-006 | Storage browser UI | M | D-003 | Browse buckets, upload files, manage policies |
| D-007 | Webhook manager UI | M | D-003 | Create/edit webhook subscriptions, view delivery logs |
| D-008 | Function manager UI | M | D-003 | Deploy/update functions, view logs, test invoke |
| D-009 | RBAC editor | L | D-003 | Visual role/permission editor |
| D-010 | Dashboard Dockerfile | M | D-001 | Multi-stage Next.js Docker build |

### EPIC: Flutter SDK [v0.3]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| FL-001 | Flutter SDK project scaffold | S | F-003 | `packages/flutter-sdk/` — Dart package structure |
| FL-002 | ForgeClient singleton | M | FL-001 | Central client with configurable base URL |
| FL-003 | PKCE auth flow (flutter_appauth) | L | FL-002 | Login via Keycloak with PKCE |
| FL-004 | Secure token storage | M | FL-003 | `flutter_secure_storage` for access + refresh tokens |
| FL-005 | Dio HTTP client with token interceptor | M | FL-002 | Auto-attach tokens, transparent refresh on 401 |
| FL-006 | Realtime Dart Stream | L | FL-005 | WebSocket connection exposed as Dart Stream |
| FL-007 | Database query methods | M | FL-005 | CRUD methods that call gateway |
| FL-008 | Storage upload/download helpers | M | FL-005 | Upload/download files via presigned URLs |
| FL-009 | Function invocation methods | M | FL-005 | Call serverless functions |
| FL-010 | Auth state management | M | FL-003 | Stream of auth state, auto-logout on expiry |
| FL-011 | Error handling + retry | M | FL-005 | Structured error types, automatic retry |

---

## 📦 Release v0.4 — "Compute" (P1)

> **Goal:** Run user-deployed serverless functions securely.

### EPIC: Function Runner [v0.4]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| FR-001 | Function Runner scaffold | M | F-003 | `packages/function-runner/` |
| FR-002 | Bun runtime for function execution | L | FR-001 | Execute TypeScript functions in Bun |
| FR-003 | Docker-in-Docker isolation | XL | FR-001 | DinD setup for secure function sandboxing |
| FR-004 | Scoped JWT per function invocation | L | FR-003, G-002 | Each invocation gets a limited JWT with explicit table/bucket permissions |
| FR-005 | Warm function pool | L | FR-002 | Keep frequently-used functions warm (pre-loaded) |
| FR-006 | Function deployment API | M | FR-001 | Upload/update/delete functions via gateway |
| FR-007 | Function logs collection | M | FR-002 | Capture stdout/stderr, store in DB |
| FR-008 | Function timeout + resource limits | M | FR-002 | Configurable execution limits |
| FR-009 | Function Dockerfile | M | FR-001 | Multi-stage with DinD |

---

## 📦 Release v0.5 — "DX & Polish" (P2)

> **Goal:** Production readiness — CI/CD, docs, monitoring, examples.

### EPIC: CI/CD & Quality [v0.5]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| CI-001 | GitHub Actions — CI pipeline | L | F-001 | Lint, type-check, test on PR |
| CI-002 | GitHub Actions — Docker build | M | F-004 | Build and push Docker images |
| CI-003 | GitHub Actions — Release workflow | M | — | Tag → build → GitHub Release |
| CI-004 | Integration test suite | XL | v0.2 done | End-to-end tests with Docker Compose |
| CI-005 | Unit tests for Gateway | L | G-001 | Route tests, middleware tests |
| CI-006 | Security audit (npm audit, trivy) | M | — | Automated vulnerability scanning |

### EPIC: Documentation [v0.5]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| DOC-001 | README with quickstart | M | F-004 | Getting started in 5 minutes |
| DOC-002 | Architecture documentation | M | — | Service architecture, data flow diagrams |
| DOC-003 | API reference | L | G-006 through G-016 | Auto-generated from route definitions |
| DOC-004 | Self-hosting guide | L | DC-001 | Production deployment guide |
| DOC-005 | Flutter SDK documentation | M | FL-001 through FL-011 | SDK reference + examples |
| DOC-006 | Example apps | L | v0.3 done | Todo app, chat app, file gallery |

### EPIC: Monitoring & Observability [v0.5]

| # | Task | Size | Deps | Description |
|---|---|---|---|---|
| MO-001 | Health check improvements | M | — | Detailed health per service, dependency status |
| MO-002 | Structured logging | M | — | JSON logs everywhere, correlation IDs |
| MO-003 | Metrics endpoint | M | — | Prometheus-compatible metrics |
| MO-004 | Grafana dashboard | M | MO-003 | Pre-built dashboard for all services |
| MO-005 | Error tracking | M | — | Centralized error reporting |

---

## 📋 Full Backlog (All Tasks Sorted)

### P0 — Must Have (v0.1 + v0.2)
```
F-001  F-002  F-003  F-004  F-005  F-006  F-007
DB-001 DB-002 DB-003 DB-004 DB-005
A-001  A-002  A-003
G-001  G-002  G-003  G-004  G-005  G-006  G-007
G-008  G-009  G-010  G-011  G-012  G-013  G-014  G-015  G-016
DC-001 DC-002 DC-003
R-001  R-002  R-003  R-004  R-005  R-006  R-007
S-001  S-002  S-003  S-004  S-005  S-006  S-007
W-001  W-002  W-003  W-004  W-005  W-006  W-007  W-008  W-009
```

### P1 — Should Have (v0.3 + v0.4)
```
D-001  D-002  D-003  D-004  D-005  D-006  D-007  D-008  D-009  D-010
FL-001 FL-002 FL-003 FL-004 FL-005 FL-006 FL-007 FL-008 FL-009 FL-010 FL-011
FR-001 FR-002 FR-003 FR-004 FR-005 FR-006 FR-007 FR-008 FR-009
```

### P2 — Nice to Have (v0.5+)
```
CI-001 CI-002 CI-003 CI-004 CI-005 CI-006
DOC-001 DOC-002 DOC-003 DOC-004 DOC-005 DOC-006
MO-001 MO-002 MO-003 MO-004 MO-005
```

---

## 📐 Story Point Estimation Summary

| Release | Tasks | S | M | L | XL | Est. Points |
|---|---|---|---|---|---|---|
| v0.1 — Foundation | 30 | 12 | 10 | 6 | 2 | ~120 |
| v0.2 — Data Layer | 23 | 10 | 8 | 4 | 1 | ~85 |
| v0.3 — Frontend+SDK | 21 | 4 | 10 | 6 | 1 | ~95 |
| v0.4 — Compute | 9 | 0 | 4 | 3 | 2 | ~55 |
| v0.5 — DX & Polish | 17 | 5 | 8 | 2 | 2 | ~75 |
| **Total** | **100** | **31** | **40** | **21** | **8** | **~430** |

> Stretch goals beyond v0.5: multi-region, billing, team collaboration, GraphQL API

---

## ⚠️ Risks & Unknowns

| Risk | Impact | Mitigation |
|---|---|---|
| RustFS stability/availability | High (blocks v0.2 storage) | Evaluate MinIO as fallback, have config toggle |
| DinD security isolation | High (blocks v0.4) | Spike early — test isolation boundaries, consider Firecracker/microVM |
| Keycloak realm migration handling | Medium | Test realm re-import on existing data, version the realm.json |
| pgmq extension availability on Postgres 16 | Medium | Implement `SELECT FOR UPDATE SKIP LOCKED` fallback first |
| Flutter PKCE flow complexity | Medium | Use well-tested `flutter_appauth`, follow Keycloak docs exactly |
| Gateway performance under load | Medium | Bench with k6 early, identify bottlenecks |
| Docker Compose multi-service orchestration | Low | Healthchecks + depends_on + retry logic |
| Turborepo learning curve | Low | Well-documented tool, standard patterns |

---

## 🔧 GitHub Board Setup

### Milestones (Releases)
1. **v0.1 — Foundation** (Due: TBD)
2. **v0.2 — Data Layer** (Due: TBD)
3. **v0.3 — Frontend + SDK** (Due: TBD)
4. **v0.4 — Compute** (Due: TBD)
5. **v0.5 — DX & Polish** (Due: TBD)

### Labels
- `P0`, `P1`, `P2` — Priority
- `epic/scaffold`, `epic/database`, `epic/auth`, `epic/gateway`, `epic/realtime`, `epic/storage`, `epic/workers`, `epic/dashboard`, `epic/flutter-sdk`, `epic/function-runner`, `epic/ci-cd`, `epic/docs`, `epic/monitoring`
- `size/S`, `size/M`, `size/L`, `size/XL`
- `risk`, `spike`, `blocked`

### Project Board Columns
```
🆕 Backlog  |  📋 Ready  |  🏗️ In Progress  |  ✅ Review  |  🚀 Done
```

---

## 📝 Plan Approval

> **Status:** 🟡 Draft — waiting for your review
>
> Once you approve, I'll:
> 1. Create all 100 GitHub Issues from this backlog
> 2. Set up Milestones (v0.1–v0.5)
> 3. Configure Project Board columns
> 4. Apply labels + assignees
> 5. Create ROADMAP.md in the repo root
