# Changelog

## v0.1 — Foundation (2026-06-05)

### 🚀 Features
- Turborepo monorepo with 11 workspace packages
- Docker Compose stack with 9 services (Gateway, Keycloak, Postgres 16, Realtime, Function Runner, Webhook Worker, RustFS, Valkey, Dashboard)
- PostgreSQL 16 schema with tenants, users, storage_metadata, function_definitions, webhook_subscriptions, webhook_deliveries, audit_logs
- Row-Level Security with session variable-based tenant isolation
- pg_notify triggers for real-time change tracking
- pgmq extension for webhook queue
- Keycloak realm with 3 OIDC clients and custom JWT mappers (tenant_id, plan, roles)
- Gateway service (Bun+Fastify) with:
  - JWKS auth (15-min cache)
  - JWT verification and Postgres session middleware
  - Admin token middleware
  - In-memory rate limiting
  - CORS support
  - Routes: health, db/query, storage, functions, webhooks, auth/me, admin
- Migration runner for raw SQL migrations
- Init script, healthcheck script, and E2E smoke test

### 🧪 Tests
- 38 unit tests covering auth, errors, and route logic (all passing)

### 🔧 Internal
- Dockerfiles for all buildable services (gateway, realtime, function-runner, workers, dashboard)
- Shared TypeScript type definitions in @forge/types
- .env.example with all configuration variables
