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
| **Realtime subscriptions** (WebSocket + Valkey) | 🚧 In Progress | v0.2 |
| **File storage** (RustFS S3-compatible) | 🚧 In Progress | v0.2 |
| **Background workers** (Webhook, Scheduler, Audit) | 🚧 In Progress | v0.2 |
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

```bash
git clone https://github.com/Skndan/forge.git
cd forge

# Copy environment config
cp .env.example .env

# Start all services
docker compose up -d

# Gateway runs on http://localhost:3030
# Keycloak runs on http://localhost:8080
# Healthcheck: http://localhost:3030/v1/health
```

> **Prerequisites:** Docker & Docker Compose

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
| **v0.2 — Data Layer** 📡 | Realtime · Storage · Workers | 🚧 **In Progress** |
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
