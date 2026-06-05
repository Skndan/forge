-- DB-002: RLS Policies for Tenants and Users
-- ============================================================

-- ── Enable RLS ────────────────────────────────────────────────
ALTER TABLE forge.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge.users   ENABLE ROW LEVEL SECURITY;

-- ── Tenants RLS ───────────────────────────────────────────────
-- Users can see their own tenant
CREATE POLICY tenants_select_own ON forge.tenants
  FOR SELECT
  USING (id::text = current_setting('app.current_tenant_id', true));

-- Admins can update their own tenant
CREATE POLICY tenants_update_own ON forge.tenants
  FOR UPDATE
  USING (id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (
    current_setting('app.current_roles', true) LIKE '%admin%'
  );

-- ── Users RLS ─────────────────────────────────────────────────
-- Users can see users in their tenant
CREATE POLICY users_select_tenant ON forge.users
  FOR SELECT
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Users can update their own record
CREATE POLICY users_update_self ON forge.users
  FOR UPDATE
  USING (id::text = current_setting('app.current_user_id', true));

-- Admins can update any user in their tenant
CREATE POLICY users_admin_update ON forge.users
  FOR UPDATE
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
    AND current_setting('app.current_roles', true) LIKE '%admin%'
  );

-- Users can insert in their own tenant (registration)
CREATE POLICY users_insert_tenant ON forge.users
  FOR INSERT
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
