-- DB-001: Foundation — Extensions + Tenants + Users
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgmq";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Schema ────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS forge;

-- ── Session vars for RLS ──────────────────────────────────────
CREATE OR REPLACE FUNCTION forge.set_session_context(
  p_user_id  TEXT,
  p_roles    TEXT DEFAULT '{}',
  p_tenant_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id',   p_user_id,    true);
  PERFORM set_config('app.current_roles',     p_roles,      true);
  PERFORM set_config('app.current_tenant_id', p_tenant_id,  true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Tenants ───────────────────────────────────────────────────
CREATE TABLE forge.tenants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON forge.tenants (slug);

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE forge.users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url   TEXT,
  is_admin     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON forge.users (tenant_id);
CREATE INDEX idx_users_email ON forge.users (email);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION forge.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON forge.tenants
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON forge.users
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();
