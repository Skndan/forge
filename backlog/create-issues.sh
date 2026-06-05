#!/bin/bash
# Create all Forge issues via GitHub API

REPO="Skndan/forge"

create_issue() {
  local title="$1"
  local milestone="$2"
  local labels="$3"
  local body="$4"
  
  gh api "repos/$REPO/issues" -X POST \
    -f title="$title" \
    -f milestone="$milestone" \
    -f labels="[$labels]" \
    -f body="$body" \
    --jq '.number' 2>/dev/null
}

echo "=== CREATING v0.1 — Foundation Issues ==="

# F-001 to F-007
create_issue "F-001: Initialize Turborepo monorepo" 1 '"epic/scaffold","P0","size/S"' "Initialize pnpm Turborepo monorepo with workspace configuration.
- Run create-turbo
- Configure pnpm workspaces
- Set up root scripts"
echo "F-001 done"

create_issue "F-002: Root config files (tsconfig, gitignore, prettier, eslint)" 1 '"epic/scaffold","P0","size/S"' "tsconfig.json, .gitignore, .prettierrc, eslint.config.js at root."
echo "F-002 done"

create_issue "F-003: Package directories scaffold" 1 '"epic/scaffold","P0","size/M"' "Create all packages/* directories with package.json stubs:
- packages/gateway, packages/database, packages/realtime, packages/storage
- packages/worker-webhook, packages/worker-scheduler, packages/worker-audit
- packages/dashboard, packages/flutter-sdk, packages/function-runner
- packages/types"
echo "F-003 done"

create_issue "F-004: Docker Compose — full services" 1 '"epic/scaffold","P0","size/L"' "Single docker-compose.yml with all 9 services:
- Gateway (custom Bun), Keycloak, Postgres 16, Realtime, Function Runner
- Webhook Worker, RustFS, Valkey, Admin Dashboard
- Healthchecks, dependency ordering, volumes"
echo "F-004 done"

create_issue "F-005: .env.example with all config vars" 1 '"epic/scaffold","P0","size/S"' "All environment variables with sensible defaults."
echo "F-005 done"

create_issue "F-006: Init scripts for Docker Compose" 1 '"epic/scaffold","P0","size/M"' "Keycloak realm import, DB migration runner, healthcheck scripts."
echo "F-006 done"

create_issue "F-007: Shared TypeScript types package" 1 '"epic/scaffold","P0","size/M"' "packages/types/ with shared types for all services."
echo "F-007 done"

# DB-001 to DB-005
create_issue "DB-001: Initial migration — schema DDL" 1 '"epic/database","P0","size/XL"' "Tables: tenants, users, storage_metadata, function_definitions, webhook_subscriptions, webhook_deliveries, audit_logs"
echo "DB-001 done"

create_issue "DB-002: RLS policies for multi-tenancy" 1 '"epic/database","P0","size/L"' "Row-level security using app.current_user_id + app.current_roles"
echo "DB-002 done"

create_issue "DB-003: pg_notify triggers" 1 '"epic/database","P0","size/M"' "Notify change triggers on INSERT/UPDATE/DELETE for relevant tables."
echo "DB-003 done"

create_issue "DB-004: pgmq extension + queue setup" 1 '"epic/database","P0","size/M"' "Setup pgmq for webhook queue."
echo "DB-004 done"

create_issue "DB-005: Migration runner script" 1 '"epic/database","P0","size/M"' "Bash/script that runs .sql files in order, tracks applied migrations."
echo "DB-005 done"

# A-001 to A-003
create_issue "A-001: Keycloak realm export" 1 '"epic/auth","P0","size/L"' "realm.json with realm config, custom JWT mappers (tenant_id, plan, roles)"
echo "A-001 done"

create_issue "A-002: Keycloak client definitions" 1 '"epic/auth","P0","size/M"' "Clients: forge-api (confidential), forge-dashboard (public), forge-flutter (public)"
echo "A-002 done"

create_issue "A-003: Keycloak Docker healthcheck + init" 1 '"epic/auth","P0","size/M"' "Healthcheck waits for Keycloak, init script imports realm on first boot."
echo "A-003 done"

# G-001 to G-016
create_issue "G-001: Gateway — Bun + Fastify scaffold" 1 '"epic/gateway","P0","size/S"' "packages/gateway/ — tsconfig, package.json, entry point."
echo "G-001 done"

create_issue "G-002: Gateway — JWKS fetch + cache (15-min TTL)" 1 '"epic/gateway","P0","size/M"' "Fetch JWKS from Keycloak on startup, cache with jose library."
echo "G-002 done"

create_issue "G-003: Gateway — JWT verification middleware" 1 '"epic/gateway","P0","size/M"' "Verify Bearer token, extract claims using jose."
echo "G-003 done"

create_issue "G-004: Gateway — Postgres session variable middleware" 1 '"epic/gateway","P0","size/M"' "Set app.current_user_id, app.current_roles via SET LOCAL."
echo "G-004 done"

create_issue "G-005: Gateway — Admin service token middleware" 1 '"epic/gateway","P0","size/S"' "Separate middleware for admin routes with service token check."
echo "G-005 done"

create_issue "G-006: Route — POST /v1/db/query" 1 '"epic/gateway","P0","size/M"' "Database query endpoint (parameterized, RLS-aware)."
echo "G-006 done"

create_issue "G-007: Route — POST /v1/storage/upload-url" 1 '"epic/gateway","P0","size/S"' "Presigned upload URL generation."
echo "G-007 done"

create_issue "G-008: Route — GET /v1/storage/download-url" 1 '"epic/gateway","P0","size/S"' "Presigned download URL generation."
echo "G-008 done"

create_issue "G-009: Route — POST /v1/functions/invoke" 1 '"epic/gateway","P0","size/S"' "Stub for function invocation."
echo "G-009 done"

create_issue "G-010: Route — POST /v1/webhooks" 1 '"epic/gateway","P0","size/M"' "Webhook subscription CRUD."
echo "G-010 done"

create_issue "G-011: Route — GET /v1/auth/me" 1 '"epic/gateway","P0","size/S"' "Current user info endpoint."
echo "G-011 done"

create_issue "G-012: Route — GET /v1/health" 1 '"epic/gateway","P0","size/S"' "Health check endpoint."
echo "G-012 done"

create_issue "G-013: Gateway — Error handling middleware" 1 '"epic/gateway","P0","size/M"' "Global error handler, structured error responses."
echo "G-013 done"

create_issue "G-014: Gateway — CORS configuration" 1 '"epic/gateway","P0","size/S"' "Proper CORS for dashboard + Flutter SDK."
echo "G-014 done"

create_issue "G-015: Gateway — Rate limiting" 1 '"epic/gateway","P0","size/M"' "Basic rate limiting (token bucket or similar)."
echo "G-015 done"

create_issue "G-016: Gateway — Admin routes scaffold" 1 '"epic/gateway","P0","size/M"' "GET /v1/admin/* routes for dashboard."
echo "G-016 done"

# DC-001 to DC-003
create_issue "DC-001: End-to-end Docker Compose test" 1 '"epic/scaffold","P0","size/L"' "Verify all services start, healthchecks pass, gateway talks to Keycloak + Postgres."
echo "DC-001 done"

create_issue "DC-002: Gateway Dockerfile" 1 '"epic/scaffold","P0","size/M"' "Multi-stage Dockerfile (Bun install → build → production)."
echo "DC-002 done"

create_issue "DC-003: Gateway healthcheck in Compose" 1 '"epic/scaffold","P0","size/S"' "curl --fail http://localhost:3030/v1/health in docker-compose.yml."
echo "DC-003 done"

echo ""
echo "=== v0.1 Done — 30 issues ==="
echo ""
echo "=== CREATING v0.2 — Data Layer Issues ==="

# R-001 to R-007
create_issue "R-001: Realtime — project scaffold" 2 '"epic/realtime","P0","size/S"' "packages/realtime/ — Bun + WS setup."
echo "R-001 done"

create_issue "R-002: Realtime — JWT auth on connect" 2 '"epic/realtime","P0","size/M"' "Verify JWT during WebSocket upgrade."
echo "R-002 done"

create_issue "R-003: Realtime — Postgres LISTEN on pg_notify" 2 '"epic/realtime","P0","size/M"' "Listen to pg_notify channels, parse payloads."
echo "R-003 done"

create_issue "R-004: Realtime — Valkey pub/sub for multi-instance" 2 '"epic/realtime","P0","size/M"' "Pub/sub fan-out for horizontal scaling."
echo "R-004 done"

create_issue "R-005: Realtime — Subscription management" 2 '"epic/realtime","P0","size/L"' "Client subscribes with table/filter/row_id, server pushes matching changes."
echo "R-005 done"

create_issue "R-006: Realtime — Reconnection handling" 2 '"epic/realtime","P0","size/M"' "Client reconnect with last-known state."
echo "R-006 done"

create_issue "R-007: Realtime — Channel filtering" 2 '"epic/realtime","P0","size/M"' "Per-client filters (only receive relevant changes)."
echo "R-007 done"

# S-001 to S-007
create_issue "S-001: Storage — project scaffold" 2 '"epic/storage","P0","size/S"' "packages/storage/ — Bun project."
echo "S-001 done"

create_issue "S-002: Storage — RustFS client integration" 2 '"epic/storage","P0","size/M"' "S3-compatible client for RustFS."
echo "S-002 done"

create_issue "S-003: Storage — Presigned upload URL generation" 2 '"epic/storage","P0","size/M"' "Temporary upload URLs, expiry config."
echo "S-003 done"

create_issue "S-004: Storage — Presigned download URL generation" 2 '"epic/storage","P0","size/M"' "Temporary download URLs, expiry config."
echo "S-004 done"

create_issue "S-005: Storage — Metadata CRUD in Postgres" 2 '"epic/storage","P0","size/M"' "Track file metadata (bucket, path, size, content_type)."
echo "S-005 done"

create_issue "S-006: Storage — Bucket management CRUD" 2 '"epic/storage","P0","size/M"' "Create/list/delete buckets."
echo "S-006 done"

create_issue "S-007: Storage — CORS for endpoints" 2 '"epic/storage","P0","size/S"' "Allow direct browser uploads to RustFS."
echo "S-007 done"

# W-001 to W-009
create_issue "W-001: Webhook Worker — scaffold" 2 '"epic/workers","P0","size/S"' "packages/worker-webhook/ setup."
echo "W-001 done"

create_issue "W-002: Webhook Worker — delivery loop" 2 '"epic/workers","P0","size/L"' "SELECT FOR UPDATE SKIP LOCKED, deliver with retry."
echo "W-002 done"

create_issue "W-003: Webhook Worker — exponential backoff" 2 '"epic/workers","P0","size/M"' "Retry with backoff, max attempts config."
echo "W-003 done"

create_issue "W-004: Webhook Worker — HMAC-SHA256 signing" 2 '"epic/workers","P0","size/M"' "Sign payloads so consumers can verify authenticity."
echo "W-004 done"

create_issue "W-005: Scheduler Worker — scaffold" 2 '"epic/workers","P0","size/S"' "packages/worker-scheduler/ setup."
echo "W-005 done"

create_issue "W-006: Scheduler Worker — cron-based triggers" 2 '"epic/workers","P0","size/M"' "Parse cron expressions, trigger functions on schedule."
echo "W-006 done"

create_issue "W-007: Audit Logger — scaffold" 2 '"epic/workers","P0","size/S"' "packages/worker-audit/ setup."
echo "W-007 done"

create_issue "W-008: Audit Logger — event writing" 2 '"epic/workers","P0","size/M"' "Write audit events to audit_logs table."
echo "W-008 done"

create_issue "W-009: Workers — healthchecks + retry" 2 '"epic/workers","P0","size/S"' "Each worker reports health, retries on failure."
echo "W-009 done"

echo ""
echo "=== v0.2 Done — 23 issues ==="
echo ""
echo "=== CREATING v0.3 — Frontend + SDK Issues ==="

# D-001 to D-010
create_issue "D-001: Dashboard — Next.js project scaffold" 3 '"epic/dashboard","P1","size/M"' "packages/dashboard/ — App Router, Tailwind, shadcn/ui."
echo "D-001 done"

create_issue "D-002: Dashboard — Login via Keycloak (PKCE)" 3 '"epic/dashboard","P1","size/L"' "PKCE flow with next-auth or custom."
echo "D-002 done"

create_issue "D-003: Dashboard — Admin service token integration" 3 '"epic/dashboard","P1","size/M"' "Token exchange after login."
echo "D-003 done"

create_issue "D-004: Dashboard — Table browser UI" 3 '"epic/dashboard","P1","size/L"' "View/edit rows, define RLS policies visually."
echo "D-004 done"

create_issue "D-005: Dashboard — Auth manager UI" 3 '"epic/dashboard","P1","size/L"' "Keycloak user management, role assignment."
echo "D-005 done"

create_issue "D-006: Dashboard — Storage browser UI" 3 '"epic/dashboard","P1","size/M"' "Browse buckets, upload files, manage policies."
echo "D-006 done"

create_issue "D-007: Dashboard — Webhook manager UI" 3 '"epic/dashboard","P1","size/M"' "Create/edit webhook subscriptions, view delivery logs."
echo "D-007 done"

create_issue "D-008: Dashboard — Function manager UI" 3 '"epic/dashboard","P1","size/M"' "Deploy/update functions, view logs, test invoke."
echo "D-008 done"

create_issue "D-009: Dashboard — RBAC editor" 3 '"epic/dashboard","P1","size/L"' "Visual role/permission editor."
echo "D-009 done"

create_issue "D-010: Dashboard — Dockerfile" 3 '"epic/dashboard","P1","size/M"' "Multi-stage Next.js Docker build."
echo "D-010 done"

# FL-001 to FL-011
create_issue "FL-001: Flutter SDK — project scaffold" 3 '"epic/flutter-sdk","P1","size/S"' "packages/flutter-sdk/ — Dart package structure."
echo "FL-001 done"

create_issue "FL-002: Flutter SDK — ForgeClient singleton" 3 '"epic/flutter-sdk","P1","size/M"' "Central client with configurable base URL."
echo "FL-002 done"

create_issue "FL-003: Flutter SDK — PKCE auth flow" 3 '"epic/flutter-sdk","P1","size/L"' "Login via Keycloak with flutter_appauth."
echo "FL-003 done"

create_issue "FL-004: Flutter SDK — Secure token storage" 3 '"epic/flutter-sdk","P1","size/M"' "flutter_secure_storage for access + refresh tokens."
echo "FL-004 done"

create_issue "FL-005: Flutter SDK — Dio with token interceptor" 3 '"epic/flutter-sdk","P1","size/M"' "Auto-attach tokens, transparent refresh on 401."
echo "FL-005 done"

create_issue "FL-006: Flutter SDK — Realtime Dart Stream" 3 '"epic/flutter-sdk","P1","size/L"' "WebSocket connection exposed as Dart Stream."
echo "FL-006 done"

create_issue "FL-007: Flutter SDK — Database query methods" 3 '"epic/flutter-sdk","P1","size/M"' "CRUD methods that call gateway."
echo "FL-007 done"

create_issue "FL-008: Flutter SDK — Storage upload/download helpers" 3 '"epic/flutter-sdk","P1","size/M"' "Upload/download files via presigned URLs."
echo "FL-008 done"

create_issue "FL-009: Flutter SDK — Function invocation methods" 3 '"epic/flutter-sdk","P1","size/M"' "Call serverless functions."
echo "FL-009 done"

create_issue "FL-010: Flutter SDK — Auth state management" 3 '"epic/flutter-sdk","P1","size/M"' "Stream of auth state, auto-logout on expiry."
echo "FL-010 done"

create_issue "FL-011: Flutter SDK — Error handling + retry" 3 '"epic/flutter-sdk","P1","size/M"' "Structured error types, automatic retry."
echo "FL-011 done"

echo ""
echo "=== v0.3 Done — 21 issues ==="
echo ""
echo "=== CREATING v0.4 — Compute Issues ==="

# FR-001 to FR-009
create_issue "FR-001: Function Runner — project scaffold" 4 '"epic/function-runner","P1","size/M"' "packages/function-runner/ setup."
echo "FR-001 done"

create_issue "FR-002: Function Runner — Bun runtime for execution" 4 '"epic/function-runner","P1","size/L"' "Execute TypeScript functions in Bun."
echo "FR-002 done"

create_issue "FR-003: Function Runner — Docker-in-Docker isolation" 4 '"epic/function-runner","P1","size/XL"' "DinD setup for secure function sandboxing."
echo "FR-003 done"

create_issue "FR-004: Function Runner — Scoped JWT per invocation" 4 '"epic/function-runner","P1","size/L"' "Limited JWT with explicit table/bucket permissions."
echo "FR-004 done"

create_issue "FR-005: Function Runner — Warm function pool" 4 '"epic/function-runner","P1","size/L"' "Pre-load frequently-used functions for low latency."
echo "FR-005 done"

create_issue "FR-006: Function Runner — Deployment API" 4 '"epic/function-runner","P1","size/M"' "Upload/update/delete functions via gateway."
echo "FR-006 done"

create_issue "FR-007: Function Runner — Logs collection" 4 '"epic/function-runner","P1","size/M"' "Capture stdout/stderr, store in DB."
echo "FR-007 done"

create_issue "FR-008: Function Runner — Timeout + resource limits" 4 '"epic/function-runner","P1","size/M"' "Configurable execution limits."
echo "FR-008 done"

create_issue "FR-009: Function Runner — Dockerfile" 4 '"epic/function-runner","P1","size/M"' "Multi-stage with DinD."
echo "FR-009 done"

echo ""
echo "=== v0.4 Done — 9 issues ==="
echo ""
echo "=== CREATING v0.5 — DX & Polish Issues ==="

# CI-001 to CI-006
create_issue "CI-001: GitHub Actions — CI pipeline" 5 '"epic/ci-cd","P2","size/L"' "Lint, type-check, test on PR."
echo "CI-001 done"

create_issue "CI-002: GitHub Actions — Docker build" 5 '"epic/ci-cd","P2","size/M"' "Build and push Docker images on push to main."
echo "CI-002 done"

create_issue "CI-003: GitHub Actions — Release workflow" 5 '"epic/ci-cd","P2","size/M"' "Tag → build → GitHub Release."
echo "CI-003 done"

create_issue "CI-004: Integration test suite" 5 '"epic/ci-cd","P2","size/XL"' "End-to-end tests with Docker Compose."
echo "CI-004 done"

create_issue "CI-005: Unit tests for Gateway" 5 '"epic/ci-cd","P2","size/L"' "Route tests, middleware tests."
echo "CI-005 done"

create_issue "CI-006: Security audit pipeline" 5 '"epic/ci-cd","P2","size/M"' "npm audit, trivy scanning, automated."
echo "CI-006 done"

# DOC-001 to DOC-006
create_issue "DOC-001: README with quickstart" 5 '"epic/docs","P2","size/M"' "Getting started in 5 minutes."
echo "DOC-001 done"

create_issue "DOC-002: Architecture documentation" 5 '"epic/docs","P2","size/M"' "Service architecture, data flow diagrams."
echo "DOC-002 done"

create_issue "DOC-003: API reference" 5 '"epic/docs","P2","size/L"' "Auto-generated from route definitions."
echo "DOC-003 done"

create_issue "DOC-004: Self-hosting guide" 5 '"epic/docs","P2","size/L"' "Production deployment guide."
echo "DOC-004 done"

create_issue "DOC-005: Flutter SDK documentation" 5 '"epic/docs","P2","size/M"' "SDK reference + examples."
echo "DOC-005 done"

create_issue "DOC-006: Example apps" 5 '"epic/docs","P2","size/L"' "Todo app, chat app, file gallery."
echo "DOC-006 done"

# MO-001 to MO-005
create_issue "MO-001: Health check improvements" 5 '"epic/monitoring","P2","size/M"' "Detailed health per service, dependency status."
echo "MO-001 done"

create_issue "MO-002: Structured logging" 5 '"epic/monitoring","P2","size/M"' "JSON logs everywhere, correlation IDs."
echo "MO-002 done"

create_issue "MO-003: Metrics endpoint" 5 '"epic/monitoring","P2","size/M"' "Prometheus-compatible metrics."
echo "MO-003 done"

create_issue "MO-004: Grafana dashboard" 5 '"epic/monitoring","P2","size/M"' "Pre-built dashboard for all services."
echo "MO-004 done"

create_issue "MO-005: Error tracking" 5 '"epic/monitoring","P2","size/M"' "Centralized error reporting."
echo "MO-005 done"

echo ""
echo "=== 🎉 ALL DONE ==="
echo "100 issues created across 5 milestones"
