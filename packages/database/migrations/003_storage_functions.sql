-- DB-003: Storage Metadata + Functions + pg_notify
-- ============================================================

-- ── Storage Metadata ──────────────────────────────────────────
CREATE TABLE forge.storage_metadata (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  bucket       TEXT NOT NULL,
  path         TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, bucket, path)
);

CREATE INDEX idx_storage_tenant ON forge.storage_metadata (tenant_id);
CREATE INDEX idx_storage_bucket ON forge.storage_metadata (tenant_id, bucket);

ALTER TABLE forge.storage_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY storage_select_tenant ON forge.storage_metadata
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY storage_insert_tenant ON forge.storage_metadata
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TRIGGER trg_storage_updated_at
  BEFORE UPDATE ON forge.storage_metadata
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();

-- ── Function Definitions ──────────────────────────────────────
CREATE TABLE forge.function_definitions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  runtime      TEXT NOT NULL DEFAULT 'bun' CHECK (runtime IN ('bun', 'node')),
  source       TEXT NOT NULL DEFAULT '',
  entrypoint   TEXT NOT NULL DEFAULT 'index.ts',
  env_vars     JSONB NOT NULL DEFAULT '{}',
  timeout_ms   INTEGER NOT NULL DEFAULT 30000,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_functions_tenant ON forge.function_definitions (tenant_id);
CREATE INDEX idx_functions_active ON forge.function_definitions (tenant_id, is_active);

ALTER TABLE forge.function_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY functions_select_tenant ON forge.function_definitions
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY functions_insert_tenant ON forge.function_definitions
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY functions_update_tenant ON forge.function_definitions
  FOR UPDATE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY functions_delete_tenant ON forge.function_definitions
  FOR DELETE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TRIGGER trg_functions_updated_at
  BEFORE UPDATE ON forge.function_definitions
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();

-- ── pg_notify triggers ────────────────────────────────────────
CREATE OR REPLACE FUNCTION forge.notify_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  channel TEXT;
BEGIN
  channel := TG_ARGV[0]::TEXT;

  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'op', 'INSERT',
      'id', NEW.id,
      'tenant_id', NEW.tenant_id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'op', 'UPDATE',
      'id', NEW.id,
      'tenant_id', NEW.tenant_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'op', 'DELETE',
      'id', OLD.id,
      'tenant_id', OLD.tenant_id
    );
  END IF;

  PERFORM pg_notify(channel, payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Storage changefeed
CREATE TRIGGER trg_storage_notify
  AFTER INSERT OR UPDATE OR DELETE ON forge.storage_metadata
  FOR EACH ROW EXECUTE FUNCTION forge.notify_change('forge:storage');

-- Functions changefeed
CREATE TRIGGER trg_functions_notify
  AFTER INSERT OR UPDATE OR DELETE ON forge.function_definitions
  FOR EACH ROW EXECUTE FUNCTION forge.notify_change('forge:functions');
