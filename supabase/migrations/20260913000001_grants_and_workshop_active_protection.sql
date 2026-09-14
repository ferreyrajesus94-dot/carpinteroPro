-- ============================================================
-- W3: Missing GRANTs, workshops.is_active self-reactivation guard,
--     and profile admin-field escalation guards
-- ============================================================
-- This migration closes the W3 gap surfaced by the
-- 2026-09-13 production-readiness audit:
--
--   1. The local pgTAP suite aborts with `permission denied for table
--      materials/profiles/quotes/stock_movements/...` because every
--      RLS-protected table except `public.subscriptions` was created
--      without an explicit GRANT to the `authenticated` role. RLS
--      hides rows from the role, but a role without any table-level
--      privilege is denied before RLS is even evaluated. The
--      Supabase hosted stack auto-grants these privileges; the local
--      `supabase test db --local` runner does NOT honor that
--      provisioning, so the local suite is not reproducible without
--      this forward-only fix.
--
--   2. The `workshops.is_active` column added in
--      20260613000000_workshop_active_flag.sql is not protected by
--      RLS or a trigger. `workshops_update_own` (in
--      0020_tenant_rls_security.sql:31) uses USING/WITH CHECK on
--      `id = get_current_workshop_id()` but does not restrict which
--      columns the owner may SET. A workshop member can therefore
--      self-reactivate via PostgREST without going through the
--      admin-toggle-workshop Edge Function. The trigger below
--      mirrors the pattern of `prevent_platform_admin_self_promotion`
--      (20260612000000_admin_platform_flag.sql:23-36) so that
--      service_role (auth.uid() IS NULL) keeps working while every
--      authenticated UPDATE of `is_active` is rejected with SQLSTATE
--      42501.
--
--   3. The `profiles.workshop_role` column already has a guard
--      trigger installed by 20260625183000_stock_movement_reversals.sql
--      (`prevent_profile_workshop_role_change`). The W3 test suite
--      locks that guard's contract into a behavior-first assertion
--      so it cannot be silently weakened. No new trigger is required
--      for `workshop_role` — the existing guard is sufficient and is
--      already exercised by the stock-movement reversal tests; this
--      migration only documents that contract in the W3 AC-4 test.
--
-- Idempotency:
--   - GRANTs are naturally idempotent in Postgres. Re-running this
--     migration is a no-op for table privileges.
--   - CREATE OR REPLACE FUNCTION replaces an existing function
--     definition unconditionally. DROP TRIGGER IF EXISTS +
--     CREATE TRIGGER ensures a single trigger instance per table.
--   - No assertions block a re-run.
--
-- Out of scope:
--   - Platform-global tables (youtubers, referral_codes,
--     referral_commissions, workshop_referrals, payout_runs,
--     billing_webhook_events) intentionally remain service_role-only.
--     The W3 audit notes they are accessed only via SECURITY DEFINER
--     RPCs and admin Edge Functions; adding authenticated grants
--     would weaken that boundary.
--   - subscriptions retains its existing SELECT-only GRANT
--     (0022_billing_schema.sql:39). We deliberately do NOT widen
--     this to UPDATE in W3: the billing lifecycle is still owned by
--     the mercadopago-webhook EF (which runs service_role), and the
--     free launch does not need an authenticated UPDATE path.
-- ============================================================


-- ════════════════════════════════════════════════════════════════════
-- 1. Grants for the `authenticated` role
-- ════════════════════════════════════════════════════════════════════
-- Workshop-scoped tables with full CRUD policies. The RLS policies
-- continue to scope row access; the GRANT only opens the gate at the
-- table-privilege layer.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.materials,
  public.price_history,
  public.furniture_templates,
  public.recipe_items,
  public.clients,
  public.quotes,
  public.quote_extras,
  public.contract_templates,
  public.workshop_settings,
  public.stock_movements,
  public.tasks,
  public.cut_pieces,
  public.recipe_pieces,
  public.quote_piece_snapshots,
  public.quote_recipe_snapshots,
  public.quote_labor_snapshots,
  public.labor_items,
  public.quote_approved_bom_lines,
  public.quote_production_stock_deductions
TO authenticated;

-- Workshop-scoped tables with SELECT-only policies (intentional
-- RPC-only mutation path; see production_orders.sql:115-125).
--
-- DEVIATION FROM THE "READ-ONLY" DESIGN INTENT: the existing
-- pgTAP suite (production_orders_schema.test.sql, production_orders_rpc.test.sql)
-- assumes authenticated has INSERT/UPDATE/DELETE on these tables
-- so it can exercise the defense-in-depth triggers and the
-- internal-guard SET LOCAL path with `set local role authenticated`.
-- Without the CRUD GRANT, those tests fail with `permission denied
-- for table production_orders` before RLS / trigger logic is reached.
--
-- Granting CRUD preserves the original RLS isolation contract: the
-- policies are still SELECT-only for authenticated, so direct
-- mutations are rejected at the RLS WITH CHECK layer (42501 with
-- the original "new row violates row-level security policy"
-- message), not at the GRANT layer. The defense-in-depth trigger
-- still fires for authenticated writes that try to bypass RLS via a
-- permissive policy. The PR-2 RPC path uses SET LOCAL
-- `app.production_order_write_context = 'rpc'` to authorize the
-- write after the RPC's own role/workshop checks, exactly as before.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.production_orders,
  public.production_order_events
TO authenticated;

-- Platform-wide settings: read-only for every authenticated user.
-- Only service_role writes (via admin Edge Functions).
GRANT SELECT ON public.platform_settings TO authenticated;

-- Profiles: RLS allows SELECT (own row) and UPDATE (own row), never
-- INSERT/DELETE. The GRANT mirrors the policy surface.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Workshops: RLS allows SELECT (own workshop) and UPDATE (own
-- workshop). INSERT/DELETE go through admin Edge Functions using
-- service_role. The GRANT mirrors the policy surface; the trigger
-- installed in section 2 below protects the `is_active` column from
-- authenticated mutation.
GRANT SELECT, UPDATE ON public.workshops TO authenticated;

-- subscriptions keeps its existing SELECT-only grant from
-- 0022_billing_schema.sql:39. We deliberately do NOT widen this to
-- UPDATE in W3: the billing lifecycle is still owned by the
-- mercadopago-webhook EF (which runs service_role), and the free
-- launch does not need an authenticated UPDATE path.


-- ════════════════════════════════════════════════════════════════════
-- 2. Grants for the `service_role` role (test-fixture compatibility)
-- ════════════════════════════════════════════════════════════════════
-- The local `supabase test db --local` runner does not provision the
-- same `service_role` CRUD grants the hosted stack applies by
-- default. production_deep_link_rpc.test.sql seeds test data with
-- `set local role service_role` and fails on `permission denied for
-- table quotes/production_orders/...` without these grants.
-- service_role has BYPASSRLS, so the RLS policies are skipped; only
-- the table-level GRANT is missing.
--
-- These GRANTs are intentionally narrow: only the tables the
-- existing pgTAP suite inserts into as service_role are widened.
-- `auth.users` is NOT granted (the suite inserts via the `postgres`
-- role, which has BYPASSRLS + full superuser grants).
--
-- This is a forward-only fix; it does not weaken any policy that
-- already exists. RLS continues to be the single source of tenant
-- isolation for the `authenticated` role.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.materials,
  public.clients,
  public.quotes,
  public.quote_extras,
  public.contract_templates,
  public.workshop_settings,
  public.stock_movements,
  public.furniture_templates,
  public.recipe_items,
  public.recipe_pieces,
  public.cut_pieces,
  public.labor_items,
  public.price_history,
  public.tasks,
  public.quote_recipe_snapshots,
  public.quote_labor_snapshots,
  public.quote_piece_snapshots,
  public.quote_approved_bom_lines,
  public.quote_production_stock_deductions,
  public.production_orders,
  public.production_order_events,
  public.workshops,
  public.platform_settings,
  public.profiles,
  public.subscriptions
TO service_role;


-- ════════════════════════════════════════════════════════════════════
-- 3. workshops.is_active self-reactivation guard
-- ════════════════════════════════════════════════════════════════════
-- Mirrors the pattern of prevent_platform_admin_self_promotion
-- (20260612000000_admin_platform_flag.sql:23-36). The trigger:
--
--   - Fires ONLY on BEFORE UPDATE OF is_active, so unrelated UPDATE
--     statements (e.g. renaming a workshop) are not blocked.
--
--   - Allows the change when auth.uid() IS NULL (service_role path,
--     i.e. admin-toggle-workshop Edge Function). This is the same
--     bypass the existing prevent_platform_admin_self_promotion
--     trigger uses, so the operational contract is consistent.
--
--   - Rejects with SQLSTATE 42501 (insufficient_privilege) when an
--     authenticated user attempts to flip the flag. The error
--     message references the admin Edge Function by name so future
--     developers find the right path.

CREATE OR REPLACE FUNCTION public.prevent_workshop_self_reactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION
      'workshops.is_active cannot be changed by authenticated users; use the admin-toggle-workshop edge function'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_workshop_self_reactivation ON public.workshops;
CREATE TRIGGER prevent_workshop_self_reactivation
  BEFORE UPDATE OF is_active ON public.workshops
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_workshop_self_reactivation();


-- ════════════════════════════════════════════════════════════════════
-- 4. profiles.workshop_role guard contract is already installed
-- ════════════════════════════════════════════════════════════════════
-- The prevent_profile_workshop_role_change trigger was added in
-- 20260625183000_stock_movement_reversals.sql as part of the stock
-- movement reversal feature. Its behavior matches AC-4: an
-- authenticated user cannot escalate or demote workshop_role
-- (view -> admin, admin -> viewer, etc.) via PostgREST; service_role
-- (auth.uid() IS NULL) keeps working so admin Edge Functions can
-- manage workshop membership.
--
-- We deliberately do NOT re-create the function or trigger here:
-- CREATE OR REPLACE FUNCTION would replace an identical definition
-- (a no-op semantically) and the existing trigger installation is
-- already covered by the stock-movement test files. The W3 test
-- `profile_admin_field_escalation.test.sql` adds a dedicated
-- behavior-first assertion for this contract so a future migration
-- that drops or weakens the trigger fails CI deterministically.
--
-- If a future audit removes the original trigger from
-- 20260625183000_stock_movement_reversals.sql, the W3 test will
-- start failing; the forward-only fix is to re-install the trigger
-- in a new migration. The contract lives in the test, not in this
-- migration file.
