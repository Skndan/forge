-- DB-004: Webhooks + pgmq Queue
-- ============================================================

-- ── Webhook Subscriptions ─────────────────────────────────────
CREATE TABLE forge.webhook_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES forge.tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  secret       TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events       TEXT[] NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  retry_count  INTEGER NOT NULL DEFAULT 3,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_sub_tenant ON forge.webhook_subscriptions (tenant_id);
CREATE INDEX idx_webhook_sub_active ON forge.webhook_subscriptions (tenant_id, is_active);
CREATE INDEX idx_webhook_sub_events ON forge.webhook_subscriptions USING GIN (events);

ALTER TABLE forge.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_sub_select_tenant ON forge.webhook_subscriptions
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY webhook_sub_insert_tenant ON forge.webhook_subscriptions
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY webhook_sub_update_tenant ON forge.webhook_subscriptions
  FOR UPDATE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY webhook_sub_delete_tenant ON forge.webhook_subscriptions
  FOR DELETE
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE TRIGGER trg_webhook_sub_updated_at
  BEFORE UPDATE ON forge.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION forge.trigger_set_updated_at();

-- ── Webhook Deliveries ────────────────────────────────────────
CREATE TABLE forge.webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id  UUID NOT NULL REFERENCES forge.webhook_subscriptions(id) ON DELETE CASCADE,
  event            TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_status_code INTEGER,
  next_retry_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_delivery_sub ON forge.webhook_deliveries (subscription_id);
CREATE INDEX idx_webhook_delivery_status ON forge.webhook_deliveries (status);
CREATE INDEX idx_webhook_delivery_pending ON forge.webhook_deliveries (status, next_retry_at)
  WHERE status = 'pending';

ALTER TABLE forge.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_delivery_select_tenant ON forge.webhook_deliveries
  FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM forge.webhook_subscriptions
      WHERE tenant_id::text = current_setting('app.current_tenant_id', true)
    )
  );

-- ── pgmq Queue for Webhook Delivery ───────────────────────────
SELECT pgmq.create('forge_webhook_delivery');

-- ── pg_notify for webhook events ───────────────────────────────
CREATE TRIGGER trg_webhook_sub_notify
  AFTER INSERT OR UPDATE OR DELETE ON forge.webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION forge.notify_change('forge:webhooks');
