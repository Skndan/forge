-- DB-008: Function Execution Logs + Invocations
-- ============================================================

-- ── Function Invocations ────────────────────────────────────
CREATE TABLE forge.function_invocations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id     UUID NOT NULL REFERENCES forge.function_definitions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timed_out')),
  input_payload   JSONB NOT NULL DEFAULT '{}',
  output_payload  JSONB,
  error_message   TEXT,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_invocations_function ON forge.function_invocations (function_id);
CREATE INDEX idx_invocations_tenant   ON forge.function_invocations (tenant_id);
CREATE INDEX idx_invocations_status   ON forge.function_invocations (status);
CREATE INDEX idx_invocations_created  ON forge.function_invocations (created_at DESC);

ALTER TABLE forge.function_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invocations_select_tenant ON forge.function_invocations
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY invocations_insert_tenant ON forge.function_invocations
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ── Function Logs ───────────────────────────────────────────
CREATE TABLE forge.function_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id     UUID NOT NULL REFERENCES forge.function_definitions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  invocation_id   UUID NOT NULL REFERENCES forge.function_invocations(id) ON DELETE CASCADE,
  log_type        TEXT NOT NULL CHECK (log_type IN ('stdout', 'stderr')),
  message         TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_function_logs_invocation ON forge.function_logs (invocation_id);
CREATE INDEX idx_function_logs_function   ON forge.function_logs (function_id);
CREATE INDEX idx_function_logs_tenant     ON forge.function_logs (tenant_id);
CREATE INDEX idx_function_logs_timestamp  ON forge.function_logs (timestamp DESC);

ALTER TABLE forge.function_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY function_logs_select_tenant ON forge.function_logs
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY function_logs_insert_tenant ON forge.function_logs
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ── Log Cleanup Function ────────────────────────────────────
CREATE OR REPLACE FUNCTION forge.clean_expired_logs(retention_days INTEGER DEFAULT 30)
RETURNS BIGINT AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM forge.function_logs
  WHERE timestamp < now() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── pg_notify for invocations ───────────────────────────────
CREATE TRIGGER trg_invocations_notify
  AFTER INSERT OR UPDATE ON forge.function_invocations
  FOR EACH ROW EXECUTE FUNCTION forge.notify_change('forge:invocations');
