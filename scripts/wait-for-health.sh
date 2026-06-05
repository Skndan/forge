#!/usr/bin/env bash
# Forge — Docker Compose Healthcheck Script
# Used by CI / dev to wait for all services to be healthy
set -euo pipefail

echo "⏳ Waiting for Forge stack to become healthy..."
echo ""

SERVICES=("postgres" "keycloak" "gateway" "valkey")

wait_for_service() {
  local service=$1
  local max_attempts=${2:-30}
  local attempt=0

  echo "  Waiting for $service..."
  while [ $attempt -lt $max_attempts ]; do
    status=$(docker compose ps --format json "$service" 2>/dev/null | jq -r '.Health' 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      echo "  ✅ $service is healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  echo "  ❌ $service failed to become healthy after $max_attempts attempts"
  docker compose logs "$service" --tail=20
  return 1
}

for svc in "${SERVICES[@]}"; do
  wait_for_service "$svc"
done

echo ""
echo "✅ All services healthy!"
