.PHONY: help up down restart logs ps test test-e2e dev build clean reset setup migrate lint typecheck format

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Container Management ──────────────────────────────────────────

up: ## Start all Docker services
	docker compose up -d

down: ## Stop all Docker services
	docker compose down

restart: ## Restart all Docker services
	docker compose restart

logs: ## Tail logs from all services
	docker compose logs -f

ps: ## Show service status
	docker compose ps

# ── Testing ───────────────────────────────────────────────────────

test: ## Run all package tests
	pnpm test

test-watch: ## Run tests in watch mode
	pnpm test -- --watch

test-e2e: ## Run end-to-end tests
	./scripts/e2e-test.sh

test-gateway: ## Run gateway tests
	pnpm --filter @forge/gateway test

test-realtime: ## Run realtime tests
	pnpm --filter @forge/realtime test

test-storage: ## Run storage tests
	pnpm --filter @forge/storage test

test-workers: ## Run worker tests
	pnpm --filter @forge/worker-webhook test
	pnpm --filter @forge/worker-scheduler test
	pnpm --filter @forge/worker-audit test

# ── Development ───────────────────────────────────────────────────

dev: ## Start all services in dev mode (hot-reload)
	pnpm dev

dev-gateway: ## Start gateway in dev mode
	pnpm --filter @forge/gateway dev

dev-realtime: ## Start realtime in dev mode
	pnpm --filter @forge/realtime dev

build: ## Build all packages
	pnpm build

# ── Code Quality ──────────────────────────────────────────────────

lint: ## Lint all packages
	pnpm lint

typecheck: ## TypeScript type check
	pnpm typecheck

format: ## Format code with Prettier
	pnpm format

# ── Database ──────────────────────────────────────────────────────

migrate: ## Run database migrations
	./scripts/migrate.sh

db-reset: ## Reset database (drop + recreate)
	docker compose exec -T postgres psql -U forge -d forge -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) migrate

# ── Setup & Cleanup ───────────────────────────────────────────────

setup: ## Initial setup (install deps + start infra)
	pnpm install
	cp -n .env.example .env 2>/dev/null || true
	docker compose up -d postgres keycloak rustfs valkey

clean: ## Remove containers + volumes
	docker compose down -v

reset: clean ## Full reset
	rm -rf node_modules packages/*/node_modules packages/*/.turbo
	pnpm install
	docker compose up -d

health: ## Check health of all services
	@echo "Gateway:"
	@curl -s http://localhost:3000/v1/health | jq . 2>/dev/null || echo "  ❌ Not running"
	@echo "Postgres:"
	@docker compose exec postgres pg_isready -U forge 2>/dev/null && echo "  ✅ Healthy" || echo "  ❌ Not running"
	@echo "Keycloak:"
	@curl -s http://localhost:8080/health/ready > /dev/null 2>&1 && echo "  ✅ Healthy" || echo "  ❌ Not running"
