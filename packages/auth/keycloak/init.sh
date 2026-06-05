#!/usr/bin/env bash
# Forge Keycloak Init Script
# Imports realm configuration and creates initial admin user
set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:?err}"
REALM_FILE="${REALM_FILE:-/opt/keycloak/data/import/forge-realm.json}"

echo "🚀 Forge — Keycloak Init"
echo "========================="

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if curl -sf "${KEYCLOAK_URL}/health/ready" > /dev/null 2>&1; then
    echo "  ✅ Keycloak is ready"
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "  ❌ Keycloak not ready after ${max_attempts} attempts"
  exit 1
fi

# Get admin token
echo "🔑 Authenticating..."
TOKEN=$(curl -sf -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" \
  -d "username=${KEYCLOAK_ADMIN}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  -d "grant_type=password" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "  ❌ Failed to authenticate"
  exit 1
fi
echo "  ✅ Authenticated"

# Import realm
echo "📦 Importing realm configuration..."
if [ -f "$REALM_FILE" ]; then
  REALM_CONFIG=$(cat "$REALM_FILE")
  
  # Check if realm already exists
  REALM_EXISTS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    "${KEYCLOAK_URL}/admin/realms/forge" 2>/dev/null || echo "404")
  
  if [ "$REALM_EXISTS" = "200" ]; then
    echo "  ⚠️  Realm 'forge' already exists, updating..."
    curl -sf -X PUT \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$REALM_CONFIG" \
      "${KEYCLOAK_URL}/admin/realms/forge"
  else
    echo "  ✨ Creating realm 'forge'..."
    curl -sf -X POST \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$REALM_CONFIG" \
      "${KEYCLOAK_URL}/admin/realms"
  fi
  echo "  ✅ Realm imported"
else
  echo "  ⚠️  Realm file not found at ${REALM_FILE}"
fi

echo ""
echo "✅ Keycloak init complete!"
echo ""
echo "Clients:"
echo "  - forge-api:      confidential backend client"
echo "  - forge-dashboard: public SPA client"
echo "  - forge-flutter:   public mobile client"
