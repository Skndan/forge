#!/usr/bin/env bash
# Forge — Init Script
# Run this to bootstrap the development environment
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Forge — Development Bootstrap"
echo "================================"
echo ""

# 1. Check prerequisites
echo "📋 Checking prerequisites..."

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "   ❌ $1 not found. Please install $1."
    return 1
  fi
  echo "   ✅ $1 found: $($1 --version 2>&1 | head -1)"
}

check_cmd docker
check_cmd bun

echo ""

# 2. Copy .env if needed
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "📝 Creating .env from .env.example..."
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "   ⚠️  Edit .env with your own values before starting."
else
  echo "✅ .env already exists"
fi

# 3. Install dependencies
echo "📦 Installing dependencies..."
cd "$PROJECT_DIR"
bun install

# 4. Build shared types
echo "🔨 Building @forge/types..."
cd "$PROJECT_DIR/packages/types"
bun run build

# 5. Docker infrastructure
echo "🐳 Starting Docker infrastructure..."
cd "$PROJECT_DIR"
docker compose up -d postgres valkey rustfs keycloak

echo ""
echo "✅ Bootstrap complete!"
echo ""
echo "Next steps:"
echo "  1. Run migrations:   cd packages/database && bun run migrate"
echo "  2. Start gateway:    bun run --cwd packages/gateway dev"
echo "  3. Open dashboard:   http://localhost:3003"
echo ""
echo "See ROADMAP.md for the full development plan."
