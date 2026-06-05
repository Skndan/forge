-- DB-006: Storage Buckets Table
-- ============================================================

CREATE TABLE forge.storage_buckets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  public              BOOLEAN NOT NULL DEFAULT false,
  allowed_mime_types  TEXT[],
  max_file_size_bytes BIGINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_storage_buckets_tenant ON forge.storage_buckets (tenant_id);

ALTER TABLE forge.storage_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY buckets_select_tenant ON forge.storage_buckets
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY buckets_insert_tenant ON forge.storage_buckets
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY buckets_update_tenant ON forge.storage_buckets
  FOR UPDATE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY buckets_delete_tenant ON forge.storage_buckets
  FOR DELETE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TRIGGER trg_storage_buckets_updated_at
  BEFORE UPDATE ON forge.storage_buckets
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();
