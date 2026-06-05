# Forge Roadmap

> Open Source Supabase Alternative
> Last updated: 2026-06-05

---

## 🎯 Vision

A self-hostable, developer-friendly Backend-as-a-Service with PostgreSQL, realtime subscriptions, file storage, serverless functions, and an admin dashboard — all behind a single API gateway.

---

## 🗺️ Releases

```
v0.1 ── Foundation ──── Scaffold · Database · Auth · Gateway
v0.2 ── Data Layer ──── Realtime · Storage · Workers
v0.3 ── Frontend+SDK ── Admin Dashboard · Flutter SDK
v0.4 ── Compute ─────── Function Runner (DinD)
v0.5 ── DX & Polish ─── CI/CD · Docs · Monitoring
```

### v0.1 — Foundation
The platform backbone. A working monorepo that starts with Docker Compose and serves API requests through the gateway.

- ✅ Turborepo monorepo with all package directories
- ✅ PostgreSQL 16 schema with RLS + pg_notify + pgmq
- ✅ Keycloak auth realm with JWT mappers
- ✅ Gateway service (Bun + Fastify) with JWT verification + Postgres session vars
- ✅ Route stubs for all platform features
- ✅ Docker Compose with healthchecks and init scripts

### v0.2 — Data Layer
Real-time data sync, file storage, and background workers.

- ✅ Realtime WebSocket server (pg_notify + Valkey fan-out)
- ✅ RustFS S3-compatible storage with presigned URLs
- ✅ Webhook worker with exponential backoff + HMAC signing
- ✅ Scheduler worker (cron-based triggers)
- ✅ Audit logger worker

### v0.3 — Frontend + SDK
Manage the platform and connect from mobile.

- ✅ Next.js admin dashboard (table browser, auth manager, storage browser)
- ✅ RBAC editor, webhook manager, function manager
- ✅ Flutter SDK with PKCE auth, token management, realtime streams

### v0.4 — Compute
Run user-deployed serverless functions.

- ✅ Bun runtime with Docker-in-Docker isolation
- ✅ Scoped JWT per function invocation
- ✅ Warm function pool for low-latency execution

### v0.5 — DX & Polish
Production readiness.

- ✅ CI/CD with GitHub Actions
- ✅ Comprehensive documentation + example apps
- ✅ Monitoring with metrics + structured logging + Grafana

---

## 📊 Progress

| Release | Issues | Status | Target |
|---|---|---|---|
| v0.1 | 30 | ✅ Done | 2026-06-05 |
| v0.2 | 23 | ✅ Done | 2026-06-05 |
| v0.3 | 21 | ✅ Done | 2026-06-05 |
| v0.4 | 9 | ✅ Done | 2026-06-05 |
| v0.5 | 17 | ✅ Done | 2026-06-05 |

> 🎉 **All planned releases are complete!** Forge is ready for production use.

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
                  ┌─────▼──────┐
                  │  Gateway    │  ← JWT auth (Keycloak)
                  │  (Bun)      │
                  └──┬───┬───┬─┘
                     │   │   │
          ┌──────────┘   │   └──────────┐
          ▼               ▼              ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ Realtime │   │ Workers   │   │ Function │
   │ (Bun+WS) │   │(Webhook,  │   │ Runner   │
   │          │   │Scheduler, │   │ (DinD)   │
   │ Valkey   │   │Audit)     │   │          │
   └────┬─────┘   └────┬─────┘   └────┬─────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
              ┌────────▼────────┐
              │  PostgreSQL 16   │
              │  + RustFS (S3)   │
              └─────────────────┘

  Auth (Keycloak) — trusted identity authority (separate)
```

## 🔗 Links

- **Repository:** [github.com/Skndan/forge](https://github.com/Skndan/forge)
- **Issues:** [github.com/Skndan/forge/issues](https://github.com/Skndan/forge/issues)
- **Project Board:** [github.com/orgs/Skndan/projects/2](https://github.com/orgs/Skndan/projects/2)
