# Changelog

## v0.5 — DX & Polish (2026-06-05)

### 🚀 CI/CD
- GitHub Actions CI pipeline — lint, type-check, test, security audit on PR
- Docker image build + push workflow for all 7 services
- Release workflow — tag → build → GitHub Release
- Integration test suite (Docker Compose E2E with health/auth/DB/storage/worker tests)
- Security audit pipeline (npm audit + Trivy filesystem scanning)

### 📚 Documentation
- Full README rewrite with 5-minute quickstart
- Architecture guide with data flow diagrams and sequence diagrams
- Complete API reference with request/response schemas and error codes
- Production deployment guide with security hardening and scaling
- Flutter SDK reference with code examples
- Example apps: Todo, Chat, File Gallery

### 📊 Monitoring & Observability
- Enhanced per-service health checks with latency tracking
- Structured JSON logging with correlation IDs across all services
- Prometheus metrics endpoint (`/metrics`) with counters, gauges, histograms
- Pre-configured Grafana dashboard auto-provisioned on startup
- Centralized error tracking with webhook batching
- Prometheus and Grafana added to Docker Compose stack
- PostgreSQL and Valkey Prometheus exporters

### 🔧 Internal
- Correlation ID tracing via X-Correlation-Id header
- Metrics hooks on request/response lifecycle
- JSON logging mode toggle via JSON_LOGS env var
- Error tracking flush timer and queue management

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
