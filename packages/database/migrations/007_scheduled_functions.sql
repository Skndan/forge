-- DB-007: Scheduled Functions Table
-- ============================================================

CREATE TABLE forge.scheduled_functions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  function_id     UUID NOT NULL REFERENCES forge.function_definitions(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_functions_tenant ON forge.scheduled_functions (tenant_id);
CREATE INDEX idx_scheduled_functions_active ON forge.scheduled_functions (is_active);
CREATE INDEX idx_scheduled_functions_next_run ON forge.scheduled_functions (next_run_at)
  WHERE is_active = true;

ALTER TABLE forge.scheduled_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_functions_select_tenant ON forge.scheduled_functions
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY scheduled_functions_insert_tenant ON forge.scheduled_functions
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY scheduled_functions_update_tenant ON forge.scheduled_functions
  FOR UPDATE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY scheduled_functions_delete_tenant ON forge.scheduled_functions
  FOR DELETE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TRIGGER trg_scheduled_functions_updated_at
  BEFORE UPDATE ON forge.scheduled_functions
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();
