#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Forge — Integration Test Suite
# Runs end-to-end tests against a Docker Compose stack
# ═══════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0
TEST_LOG="/tmp/forge-integration-$$.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${YELLOW}[INTEGRATION]${NC} $*" | tee -a "$TEST_LOG"; }
pass() { echo -e "${GREEN}[PASS]${NC} $*" | tee -a "$TEST_LOG"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC} $*" | tee -a "$TEST_LOG"; ((FAIL++)); }

cleanup() {
  log "Cleaning up..."
  docker compose -p forge-test down -v --remove-orphans 2>/dev/null || true
}

trap cleanup EXIT

# ── 1. Start the stack ─────────────────────────────────────
log "Starting Forge stack for integration tests..."
cp .env.example .env.test
export $(grep -v '^#' .env.test | xargs)

docker compose -p forge-test up -d --build --wait 120 2>&1 | tee -a "$TEST_LOG"
log "Stack started."

# ── 2. Health endpoint tests ──────────────────────────────
log "Testing health endpoints..."

GATEWAY_URL="http://localhost:${GATEWAY_PORT:-3000}"
REALTIME_URL="http://localhost:${REALTIME_PORT:-3001}"

# Gateway health
HEALTH=$(curl -sf "$GATEWAY_URL/v1/health" 2>/dev/null || echo '{"success":false}')
if echo "$HEALTH" | grep -q '"success":true'; then
  pass "Gateway health endpoint returns healthy"
else
  fail "Gateway health endpoint: $HEALTH"
fi

# Detailed health fields
HEALTH_STATUS=$(curl -sf "$GATEWAY_URL/v1/health" 2>/dev/null || echo '{}')
if echo "$HEALTH_STATUS" | grep -q '"status":"healthy"'; then
  pass "Gateway reports healthy status"
else
  fail "Gateway health status degraded: $(echo "$HEALTH_STATUS" | head -c 200)"
fi

# ── 3. Auth flow test ──────────────────────────────────────
log "Testing auth flow..."

# Get admin token from Keycloak
ADMIN_TOKEN=$(curl -sf -X POST "http://localhost:${KEYCLOAK_PORT:-8080}/realms/forge/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=forge-api" \
  -d "client_secret=CHANGE_ME" \
  -d "grant_type=password" \
  -d "username=admin" \
  -d "password=admin" 2>/dev/null | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$ADMIN_TOKEN" ]; then
  pass "Keycloak token endpoint works"
else
  fail "Failed to get admin token from Keycloak"
fi

# ── 4. Gateway route tests (authenticated) ─────────────────
log "Testing authenticated gateway routes..."

# /v1/auth/me
if [ -n "$ADMIN_TOKEN" ]; then
  AUTH_ME=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$GATEWAY_URL/v1/auth/me")
  if echo "$AUTH_ME" | grep -q '"success"'; then
    pass "GET /v1/auth/me works"
  else
    fail "GET /v1/auth/me failed: $(echo "$AUTH_ME" | head -c 100)"
  fi
fi

# Admin route with service token
ADMIN_RESULT=$(curl -s -H "X-Admin-Token: ${ADMIN_SERVICE_TOKEN:-forge_admin_token_change_me}" "$GATEWAY_URL/v1/admin/tenants")
if [ "$(echo "$ADMIN_RESULT" | head -c 1)" = "{" ]; then
  pass "GET /v1/admin/tenants is reachable"
else
  fail "GET /v1/admin/tenants failed: $(echo "$ADMIN_RESULT" | head -c 100)"
fi

# Rate limiting test
RATE_LIMITED=false
for i in $(seq 1 120); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/v1/health")
  if [ "$STATUS" != "200" ]; then
    RATE_LIMITED=true
    break
  fi
done
if [ "$RATE_LIMITED" = true ]; then
  pass "Rate limiting triggers after limit reached"
else
  fail "Rate limiting test inconclusive (health route is excluded from rate limiting)"
fi

# ── 5. Database connectivity ───────────────────────────────
log "Testing database connectivity..."

DB_RESULT=$(docker compose -p forge-test exec -T postgres psql -U forge -d forge -c "SELECT 1 AS ok" 2>/dev/null || echo "ERROR")
if echo "$DB_RESULT" | grep -q "1"; then
  pass "Postgres is queryable"
else
  fail "Postgres query failed: $DB_RESULT"
fi

# Check tables exist
TABLE_CHECK=$(docker compose -p forge-test exec -T postgres psql -U forge -d forge -c "\dt forge.*" 2>/dev/null || echo "ERROR")
if echo "$TABLE_CHECK" | grep -q "forge."; then
  pass "Database tables exist in forge schema"
else
  fail "Tables not found: $TABLE_CHECK"
fi

# ── 6. Realtime WebSocket test ─────────────────────────────
log "Testing realtime WebSocket..."

WS_RESULT=$(timeout 5 bash -c "echo '' | nc -w 3 localhost ${REALTIME_PORT:-3001} 2>/dev/null && echo 'WS_OPEN' || echo 'WS_FAIL'")
if echo "$WS_RESULT" | grep -q "WS_OPEN"; then
  pass "Realtime WebSocket port is accepting connections"
else
  # WebSocket upgrades require HTTP, so netcat might not work. Try curl upgrade.
  WS_UPGRADE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Connection: Upgrade" -H "Upgrade: websocket" \
    http://localhost:${REALTIME_PORT:-3001}/ 2>/dev/null || echo "000")
  if [ "$WS_UPGRADE" = "426" ] || [ "$WS_UPGRADE" = "101" ]; then
    pass "Realtime WebSocket upgrade endpoint responds"
  else
    fail "Realtime WebSocket test: HTTP $WS_UPGRADE"
  fi
fi

# ── 7. Worker health checks ────────────────────────────────
log "Checking worker health..."

WORKERS=("worker-webhook" "worker-scheduler" "worker-audit")
for worker in "${WORKERS[@]}"; do
  STATUS=$(docker compose -p forge-test ps --format json "$worker" 2>/dev/null | grep -c '"running"' || true)
  if [ "$STATUS" -gt 0 ]; then
    pass "Worker $worker is running"
  else
    fail "Worker $worker is not running"
  fi
done

# ── 8. Storage service check ───────────────────────────────
log "Checking storage service..."

RUSTFS_STATUS=$(docker compose -p forge-test ps --format json rustfs 2>/dev/null | grep -c '"running"' || true)
if [ "$RUSTFS_STATUS" -gt 0 ]; then
  pass "RustFS storage service is running"
else
  fail "RustFS is not running"
fi

# ── 9. Valkey check ────────────────────────────────────────
log "Checking Valkey..."

VALKEY_STATUS=$(docker compose -p forge-test ps --format json valkey 2>/dev/null | grep -c '"running"' || true)
if [ "$VALKEY_STATUS" -gt 0 ]; then
  pass "Valkey is running"
else
  fail "Valkey is not running"
fi

# ── Summary ────────────────────────────────────────────────
log "========================================"
log "Integration Test Results"
log "  PASSED: $PASS"
log "  FAILED: $FAIL"
log "========================================"

if [ "$FAIL" -gt 0 ]; then
  log "Some tests failed. Check logs for details."
  exit 1
else
  log "All integration tests passed! 🎉"
  exit 0
fi
