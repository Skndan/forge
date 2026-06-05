#!/bin/bash
REPO="Skndan/forge"

create_issue() {
  local title="$1"
  local milestone="$2"
  shift 2
  # remaining args are labels
  
  # Build the gh command with proper array input
  local cmd=("gh" "api" "repos/$REPO/issues" "-X" "POST")
  cmd+=(-f "title=$title")
  cmd+=(-f "milestone=$milestone")
  for label in "$@"; do
    cmd+=(-f "labels[]=$label")
  done
  
  # Execute
  "${cmd[@]}" --jq '.number' 2>/dev/null || echo "FAILED"
}

echo "=== FOUNDATION (v0.1) ==="

create_issue "F-001: Initialize Turborepo monorepo" 1 "epic/scaffold" "P0" "size/S"
create_issue "F-002: Root config files (tsconfig, gitignore, prettier, eslint)" 1 "epic/scaffold" "P0" "size/S"
create_issue "F-003: Package directories scaffold" 1 "epic/scaffold" "P0" "size/M"
create_issue "F-004: Docker Compose — full services" 1 "epic/scaffold" "P0" "size/L"
create_issue "F-005: .env.example with all config vars" 1 "epic/scaffold" "P0" "size/S"
create_issue "F-006: Init scripts for Docker Compose" 1 "epic/scaffold" "P0" "size/M"
create_issue "F-007: Shared TypeScript types package" 1 "epic/scaffold" "P0" "size/M"

create_issue "DB-001: Initial migration — schema DDL" 1 "epic/database" "P0" "size/XL"
create_issue "DB-002: RLS policies for multi-tenancy" 1 "epic/database" "P0" "size/L"
create_issue "DB-003: pg_notify triggers on INSERT/UPDATE/DELETE" 1 "epic/database" "P0" "size/M"
create_issue "DB-004: pgmq extension + queue setup" 1 "epic/database" "P0" "size/M"
create_issue "DB-005: Migration runner script" 1 "epic/database" "P0" "size/M"

create_issue "A-001: Keycloak realm export (JWT mappers)" 1 "epic/auth" "P0" "size/L"
create_issue "A-002: Keycloak client definitions (API, Dashboard, Flutter)" 1 "epic/auth" "P0" "size/M"
create_issue "A-003: Keycloak Docker healthcheck + init" 1 "epic/auth" "P0" "size/M"

create_issue "G-001: Gateway — Bun + Fastify scaffold" 1 "epic/gateway" "P0" "size/S"
create_issue "G-002: Gateway — JWKS fetch + cache (15-min TTL)" 1 "epic/gateway" "P0" "size/M"
create_issue "G-003: Gateway — JWT verification middleware" 1 "epic/gateway" "P0" "size/M"
create_issue "G-004: Gateway — Postgres session variable middleware" 1 "epic/gateway" "P0" "size/M"
create_issue "G-005: Gateway — Admin service token middleware" 1 "epic/gateway" "P0" "size/S"
create_issue "G-006: Route — POST /v1/db/query" 1 "epic/gateway" "P0" "size/M"
create_issue "G-007: Route — POST /v1/storage/upload-url" 1 "epic/gateway" "P0" "size/S"
create_issue "G-008: Route — GET /v1/storage/download-url" 1 "epic/gateway" "P0" "size/S"
create_issue "G-009: Route — POST /v1/functions/invoke" 1 "epic/gateway" "P0" "size/S"
create_issue "G-010: Route — POST /v1/webhooks" 1 "epic/gateway" "P0" "size/M"
create_issue "G-011: Route — GET /v1/auth/me" 1 "epic/gateway" "P0" "size/S"
create_issue "G-012: Route — GET /v1/health" 1 "epic/gateway" "P0" "size/S"
create_issue "G-013: Gateway — Error handling middleware" 1 "epic/gateway" "P0" "size/M"
create_issue "G-014: Gateway — CORS configuration" 1 "epic/gateway" "P0" "size/S"
create_issue "G-015: Gateway — Rate limiting" 1 "epic/gateway" "P0" "size/M"
create_issue "G-016: Gateway — Admin routes scaffold" 1 "epic/gateway" "P0" "size/M"

create_issue "DC-001: End-to-end Docker Compose test" 1 "epic/scaffold" "P0" "size/L"
create_issue "DC-002: Gateway Dockerfile (multi-stage)" 1 "epic/scaffold" "P0" "size/M"
create_issue "DC-003: Gateway healthcheck in docker-compose.yml" 1 "epic/scaffold" "P0" "size/S"

echo "=== v0.1 DONE ==="
echo ""
echo "=== DATA LAYER (v0.2) ==="

create_issue "R-001: Realtime — project scaffold (Bun + WS)" 2 "epic/realtime" "P0" "size/S"
create_issue "R-002: Realtime — JWT auth on WebSocket connect" 2 "epic/realtime" "P0" "size/M"
create_issue "R-003: Realtime — Postgres LISTEN on pg_notify" 2 "epic/realtime" "P0" "size/M"
create_issue "R-004: Realtime — Valkey pub/sub for multi-instance" 2 "epic/realtime" "P0" "size/M"
create_issue "R-005: Realtime — Subscription management with filters" 2 "epic/realtime" "P0" "size/L"
create_issue "R-006: Realtime — Reconnection handling" 2 "epic/realtime" "P0" "size/M"
create_issue "R-007: Realtime — Channel filtering" 2 "epic/realtime" "P0" "size/M"

create_issue "S-001: Storage — project scaffold" 2 "epic/storage" "P0" "size/S"
create_issue "S-002: Storage — RustFS S3 client integration" 2 "epic/storage" "P0" "size/M"
create_issue "S-003: Storage — Presigned upload URL generation" 2 "epic/storage" "P0" "size/M"
create_issue "S-004: Storage — Presigned download URL generation" 2 "epic/storage" "P0" "size/M"
create_issue "S-005: Storage — Metadata CRUD in Postgres" 2 "epic/storage" "P0" "size/M"
create_issue "S-006: Storage — Bucket management (CRUD)" 2 "epic/storage" "P0" "size/M"
create_issue "S-007: Storage — CORS for endpoints" 2 "epic/storage" "P0" "size/S"

create_issue "W-001: Webhook Worker — scaffold" 2 "epic/workers" "P0" "size/S"
create_issue "W-002: Webhook Worker — delivery loop (SKIP LOCKED)" 2 "epic/workers" "P0" "size/L"
create_issue "W-003: Webhook Worker — exponential backoff" 2 "epic/workers" "P0" "size/M"
create_issue "W-004: Webhook Worker — HMAC-SHA256 signing" 2 "epic/workers" "P0" "size/M"
create_issue "W-005: Scheduler Worker — scaffold" 2 "epic/workers" "P0" "size/S"
create_issue "W-006: Scheduler Worker — cron-based triggers" 2 "epic/workers" "P0" "size/M"
create_issue "W-007: Audit Logger — scaffold" 2 "epic/workers" "P0" "size/S"
create_issue "W-008: Audit Logger — event writing to Postgres" 2 "epic/workers" "P0" "size/M"
create_issue "W-009: Workers — healthchecks + retry logic" 2 "epic/workers" "P0" "size/S"

echo "=== v0.2 DONE ==="
echo ""
echo "=== FRONTEND + SDK (v0.3) ==="

create_issue "D-001: Dashboard — Next.js project scaffold (App Router)" 3 "epic/dashboard" "P1" "size/M"
create_issue "D-002: Dashboard — Login via Keycloak (PKCE)" 3 "epic/dashboard" "P1" "size/L"
create_issue "D-003: Dashboard — Admin service token integration" 3 "epic/dashboard" "P1" "size/M"
create_issue "D-004: Dashboard — Table browser UI" 3 "epic/dashboard" "P1" "size/L"
create_issue "D-005: Dashboard — Auth manager UI" 3 "epic/dashboard" "P1" "size/L"
create_issue "D-006: Dashboard — Storage browser UI" 3 "epic/dashboard" "P1" "size/M"
create_issue "D-007: Dashboard — Webhook manager UI" 3 "epic/dashboard" "P1" "size/M"
create_issue "D-008: Dashboard — Function manager UI" 3 "epic/dashboard" "P1" "size/M"
create_issue "D-009: Dashboard — RBAC editor" 3 "epic/dashboard" "P1" "size/L"
create_issue "D-010: Dashboard — Dockerfile" 3 "epic/dashboard" "P1" "size/M"

create_issue "FL-001: Flutter SDK — project scaffold" 3 "epic/flutter-sdk" "P1" "size/S"
create_issue "FL-002: Flutter SDK — ForgeClient singleton" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-003: Flutter SDK — PKCE auth (flutter_appauth)" 3 "epic/flutter-sdk" "P1" "size/L"
create_issue "FL-004: Flutter SDK — Secure token storage" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-005: Flutter SDK — Dio with token interceptor" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-006: Flutter SDK — Realtime Dart Stream" 3 "epic/flutter-sdk" "P1" "size/L"
create_issue "FL-007: Flutter SDK — Database query methods" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-008: Flutter SDK — Storage upload/download helpers" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-009: Flutter SDK — Function invocation methods" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-010: Flutter SDK — Auth state management" 3 "epic/flutter-sdk" "P1" "size/M"
create_issue "FL-011: Flutter SDK — Error handling + retry" 3 "epic/flutter-sdk" "P1" "size/M"

echo "=== v0.3 DONE ==="
echo ""
echo "=== COMPUTE (v0.4) ==="

create_issue "FR-001: Function Runner — project scaffold" 4 "epic/function-runner" "P1" "size/M"
create_issue "FR-002: Function Runner — Bun runtime for execution" 4 "epic/function-runner" "P1" "size/L"
create_issue "FR-003: Function Runner — Docker-in-Docker isolation" 4 "epic/function-runner" "P1" "size/XL"
create_issue "FR-004: Function Runner — Scoped JWT per invocation" 4 "epic/function-runner" "P1" "size/L"
create_issue "FR-005: Function Runner — Warm function pool" 4 "epic/function-runner" "P1" "size/L"
create_issue "FR-006: Function Runner — Deployment API" 4 "epic/function-runner" "P1" "size/M"
create_issue "FR-007: Function Runner — Logs collection" 4 "epic/function-runner" "P1" "size/M"
create_issue "FR-008: Function Runner — Timeout + resource limits" 4 "epic/function-runner" "P1" "size/M"
create_issue "FR-009: Function Runner — Dockerfile (DinD multi-stage)" 4 "epic/function-runner" "P1" "size/M"

echo "=== v0.4 DONE ==="
echo ""
echo "=== DX & POLISH (v0.5) ==="

create_issue "CI-001: GitHub Actions — CI pipeline (lint, type-check, test)" 5 "epic/ci-cd" "P2" "size/L"
create_issue "CI-002: GitHub Actions — Docker image build" 5 "epic/ci-cd" "P2" "size/M"
create_issue "CI-003: GitHub Actions — Release workflow" 5 "epic/ci-cd" "P2" "size/M"
create_issue "CI-004: Integration test suite (Docker Compose E2E)" 5 "epic/ci-cd" "P2" "size/XL"
create_issue "CI-005: Unit tests for Gateway" 5 "epic/ci-cd" "P2" "size/L"
create_issue "CI-006: Security audit pipeline (npm audit, trivy)" 5 "epic/ci-cd" "P2" "size/M"

create_issue "DOC-001: README with quickstart guide" 5 "epic/docs" "P2" "size/M"
create_issue "DOC-002: Architecture documentation" 5 "epic/docs" "P2" "size/M"
create_issue "DOC-003: API reference (auto-generated)" 5 "epic/docs" "P2" "size/L"
create_issue "DOC-004: Self-hosting / production deployment guide" 5 "epic/docs" "P2" "size/L"
create_issue "DOC-005: Flutter SDK documentation + examples" 5 "epic/docs" "P2" "size/M"
create_issue "DOC-006: Example apps (todo, chat, file gallery)" 5 "epic/docs" "P2" "size/L"

create_issue "MO-001: Health check improvements (per-service)" 5 "epic/monitoring" "P2" "size/M"
create_issue "MO-002: Structured logging (JSON, correlation IDs)" 5 "epic/monitoring" "P2" "size/M"
create_issue "MO-003: Prometheus metrics endpoint" 5 "epic/monitoring" "P2" "size/M"
create_issue "MO-004: Grafana dashboard for all services" 5 "epic/monitoring" "P2" "size/M"
create_issue "MO-005: Centralized error tracking" 5 "epic/monitoring" "P2" "size/M"

echo ""
echo "=== 🎉 ALL 100 ISSUES CREATED ==="
