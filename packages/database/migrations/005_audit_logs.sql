-- DB-005: Audit Logs
-- ============================================================

CREATE TABLE forge.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES forge.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON forge.audit_logs (tenant_id);
CREATE INDEX idx_audit_actor ON forge.audit_logs (actor_id);
CREATE INDEX idx_audit_action ON forge.audit_logs (tenant_id, action);
CREATE INDEX idx_audit_created ON forge.audit_logs (tenant_id, created_at DESC);

ALTER TABLE forge.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_select_tenant ON forge.audit_logs
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY audit_insert_tenant ON forge.audit_logs
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
