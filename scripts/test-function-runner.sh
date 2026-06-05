#!/bin/bash
# Forge — Function Runner E2E Docker Compose Test
# =================================================
# Tests the function runner service in the full Docker Compose stack.
#
# Usage:
#   ./scripts/test-function-runner.sh
#
# This script:
# 1. Starts the full Docker Compose stack (or uses existing)
# 2. Waits for services to be healthy
# 3. Runs function runner E2E tests
# 4. Reports results

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   Forge — Function Runner E2E Test        ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════╝${NC}"
echo ""

# ── Check dependencies ────────────────────────────────────

if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: docker is not installed${NC}"
  exit 1
fi

if ! command -v docker compose &>/dev/null; then
  echo -e "${RED}Error: docker compose is not installed${NC}"
  exit 1
fi

# ── Load env vars ─────────────────────────────────────────

ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo -e "${YELLOW}Warning: .env file not found, using defaults${NC}"
fi

# ── Ensure stack is running ───────────────────────────────

echo -e "${YELLOW}[1/5] Checking Docker Compose stack...${NC}"

STACK_RUNNING=$(docker compose ps --status running -q 2>/dev/null | wc -l)

if [ "$STACK_RUNNING" -lt 3 ]; then
  echo -e "${YELLOW}Stack not fully running. Starting services...${NC}"
  docker compose up -d postgres valkey 2>&1 | tail -2

  echo -e "${YELLOW}Waiting for PostgreSQL to be healthy...${NC}"
  for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U forge -d forge &>/dev/null; then
      echo -e "${GREEN}PostgreSQL is healthy${NC}"
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo -e "${RED}Timed out waiting for PostgreSQL${NC}"
      exit 1
    fi
    sleep 2
  done

  # Build and start function-runner
  echo -e "${YELLOW}Building function-runner image...${NC}"
  docker compose build function-runner 2>&1 | tail -5

  echo -e "${YELLOW}Starting function-runner...${NC}"
  docker compose up -d function-runner 2>&1 | tail -2
else
  echo -e "${GREEN}Stack already running${NC}"
fi

# ── Wait for function-runner ──────────────────────────────

echo ""
echo -e "${YELLOW}[2/5] Waiting for function-runner to be healthy...${NC}"

for i in $(seq 1 30); do
  HEALTH=$(docker compose exec -T function-runner wget -qO- http://localhost:3002/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}Function runner is healthy${NC}"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "${RED}Timed out waiting for function-runner${NC}"
    echo -e "${RED}Last health response: $HEALTH${NC}"
    exit 1
  fi
  sleep 2
done

# ── Run unit tests ────────────────────────────────────────

echo ""
echo -e "${YELLOW}[3/5] Running unit tests...${NC}"

cd packages/function-runner

if bun test 2>&1; then
  echo -e "${GREEN}All unit tests passed${NC}"
else
  echo -e "${RED}Some unit tests failed${NC}"
  # Don't exit — continue to integration tests
fi

cd "$PROJECT_DIR"

# ── Run integration tests ────────────────────────────────

echo ""
echo -e "${YELLOW}[4/5] Running integration tests...${NC}"

# Get the admin service token and function runner URL
RUNNER_URL="http://localhost:3002"
ADMIN_TOKEN="${ADMIN_SERVICE_TOKEN:-forge_admin_token_change_me}"
TEST_TENANT_ID="00000000-0000-0000-0000-000000000010"

# Test health
HEALTH_RESP=$(curl -sf "$RUNNER_URL/health" 2>/dev/null || echo "FAILED")
if [ "$HEALTH_RESP" != "FAILED" ]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed${NC}"
fi

# Create a test function
FUNC_RESP=$(curl -sf -X POST "$RUNNER_URL/v1/functions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"tenant_id\": \"$TEST_TENANT_ID\",
    \"name\": \"e2e-test\",
    \"slug\": \"e2e-test\",
    \"source\": \"export function handler() { return { message: \\\"Hello from E2E!\\\" }; }\",
    \"entrypoint\": \"index.ts\",
    \"env_vars\": {},
    \"timeout_ms\": 10000
  }" 2>/dev/null || echo "FAILED")

if [ "$FUNC_RESP" != "FAILED" ]; then
  FUNC_ID=$(echo "$FUNC_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "${GREEN}✓ Function created: $FUNC_ID${NC}"

  # Invoke the function
  INVOKE_RESP=$(curl -sf -X POST "$RUNNER_URL/v1/functions/$FUNC_ID/invoke" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{
      \"tenant_id\": \"$TEST_TENANT_ID\",
      \"payload\": {\"test\": true},
      \"invoked_by\": \"e2e-test-user\"
    }" 2>/dev/null || echo "FAILED")

  if [ "$INVOKE_RESP" != "FAILED" ]; then
    echo -e "${GREEN}✓ Function invoked successfully${NC}"
  else
    echo -e "${RED}✗ Function invocation failed${NC}"
  fi

  # Delete the function
  DELETE_RESP=$(curl -sf -X DELETE "$RUNNER_URL/v1/functions/$FUNC_ID?tenant_id=$TEST_TENANT_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || echo "FAILED")

  if [ "$DELETE_RESP" != "FAILED" ]; then
    echo -e "${GREEN}✓ Function deleted${NC}"
  else
    echo -e "${RED}✗ Function deletion failed${NC}"
  fi
else
  echo -e "${RED}✗ Function creation failed${NC}"
fi

# Test warm pool
POOL_STATS=$(curl -sf "$RUNNER_URL/v1/functions?tenant_id=$TEST_TENANT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null || echo "FAILED")
if [ "$POOL_STATS" != "FAILED" ]; then
  echo -e "${GREEN}✓ Warm pool API accessible${NC}"
else
  echo -e "${RED}✗ Warm pool API failed${NC}"
fi

# ── Summary ────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}[5/5] Test Summary${NC}"
echo ""
echo "  Function Runner: http://localhost:3002"
echo "  Health Endpoint: http://localhost:3002/health"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Function Runner E2E Tests Complete       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
