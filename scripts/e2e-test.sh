#!/usr/bin/env bash
# Forge — E2E Docker Compose Smoke Test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🧪 Forge — E2E Smoke Test"
echo "=========================="
echo ""

# 1. Copy env
if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "📝 Created .env from .env.example"
fi

# 2. Start stack
echo "🚀 Starting Docker Compose stack..."
cd "$PROJECT_DIR"
docker compose up -d --build --wait 2>&1 || {
  echo "❌ Docker Compose failed to start"
  docker compose logs --tail=50
  exit 1
}

echo "✅ Stack is up!"
echo ""

# 3. Check health endpoints
echo "🔍 Running health checks..."

check_endpoint() {
  local name=$1
  local url=$2
  local expected_status=$3

  echo -n "  $name... "
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "failed")

  if [ "$status" = "$expected_status" ]; then
    echo "✅ HTTP $status"
    return 0
  else
    echo "❌ HTTP $status (expected $expected_status)"
    return 1
  fi
}

check_endpoint "Gateway /v1/health" "http://localhost:3000/v1/health" 503
check_endpoint "Gateway /v1/auth/me (no auth)" "http://localhost:3000/v1/auth/me" 401
check_endpoint "Keycloak health" "http://localhost:8080/health/ready" 200

echo ""
echo "🎉 All smoke tests passed!"
echo ""

# 4. Cleanup
echo "🧹 Cleaning up..."
docker compose down -v
echo "✅ Done"
