-- PR 1: Production Orders — schema foundation
--
-- Decouples production from quotes.status = 'en_produccion' by introducing
-- a first-class production_orders entity and an append-only event log.
-- This PR establishes the table-level foundation only. Write RPCs
-- (start_production_order, transition_production_order_state), read RPCs,
-- deduction FK linkage, and frontend work follow in PRs 2-9.
--
-- What's in this migration:
--   1. production_order_state enum (7 values)
--   2. production_orders table with full column set, unique
--      (workshop_id, production_number), and updated_at trigger
--   3. production_order_events table (append-only for non-service roles)
--   4. RLS: production_orders and production_order_events expose ONLY a
--      SELECT policy scoped by get_current_workshop_id(). There is no
--      INSERT/UPDATE/DELETE policy for authenticated users. Direct mutations
--      are rejected at the RLS layer (default deny). The PR-2 RPCs are the
--      only sanctioned writer (they run SECURITY DEFINER and use the
--      transaction-local internal guard described in section 5).
--   5. Defense-in-depth triggers with positive internal guard: BEFORE
--      INSERT/UPDATE/DELETE on each table raises 42501 with TG_OP-aware
--      messages naming the PR-2 RPCs, UNLESS the transaction-local GUC
--      `app.production_order_write_context = 'rpc'` is set. The PR-2
--      SECURITY DEFINER RPCs SET LOCAL this guard after performing their
--      own role and workshop checks. This is the bridge between RLS
--      (which denies direct authenticated writes) and the RPC-only
--      mutation path (which the trigger must allow). A future migration
--      that re-introduces a permissive policy is still caught: the
--      trigger fires BEFORE the absence-of-policy gate, so a permissive
--      policy added by mistake cannot bypass the auth gate.
--   6. Same-workshop FK integrity triggers: production_orders.quote_id
--      and production_order_events.production_order_id must belong to
--      the same workshop_id as the child row. The plain UUID FK only
--      guarantees the parent exists; the trigger guarantees the tenant
--      matches. Without it, an authenticated user can insert a row in
--      their own workshop pointing at a foreign-workshop parent,
--      corrupting cross-tenant data. The same-workshop check is
--      INVARIANT for every writer (no auth.uid() IS NULL bypass), so
--      service_role backfill also must use consistent workshop_id
--      pairs. Real workshop-merge operations need to explicitly
--      disable the trigger with proper audit.
--
-- Internal guard contract (PR 1 → PR 2):
--   - GUC name: `app.production_order_write_context`
--   - Required value: the literal string `rpc`
--   - Setting mechanism in PR-2 RPCs: `SET LOCAL app.production_order_write_context = 'rpc'`
--      AFTER role + workshop checks have passed
--   - Scope: transaction-local (auto-reverts on COMMIT/ROLLBACK)
--   - The trigger accepts the write ONLY when auth.uid() IS NULL OR
--     current_setting('app.production_order_write_context', true) = 'rpc'.
--     The second arg `true` to current_setting returns NULL on missing
--     setting instead of raising. NULL and any value other than 'rpc'
--     cause the trigger to raise 42501.
--   - SECURITY DEFINER RPCs called via PostgREST keep auth.uid() set from
--     the user's JWT. The guard is the bridge: it tells the trigger
--     "this authenticated write came from a trusted RPC body, not from
--     a direct client mutation".
--
-- Depends on:
--   - public.profiles (for get_current_workshop_id())
--   - public.workshops (FK target)
--   - public.quotes (FK target for production_orders.quote_id)
--   - public.set_updated_at() (trigger function from 0001_init.sql)
--   - public.get_current_workshop_id() (from 0020_tenant_rls_security.sql)
--
-- Rollback notes:
--   - DROP TYPE production_order_state CASCADE removes both tables
--     and their policies. Safe to drop before production data exists.
--   - If production data exists, leave the migration in place and
--     forward-fix instead of rolling back.

-- ═════════════════════════════════════════════════════════════════════
-- 1. Enum
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'production_order_state') THEN
    CREATE TYPE public.production_order_state AS ENUM (
      'planned',
      'in_progress',
      'paused',
      'quality_check',
      'ready',
      'delivered',
      'cancelled'
    );
  END IF;
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- 2. production_orders table
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.production_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id         uuid NOT NULL REFERENCES public.workshops(id),
  quote_id            uuid NOT NULL REFERENCES public.quotes(id) ON DELETE RESTRICT,
  production_number   text NOT NULL,
  state               public.production_order_state NOT NULL DEFAULT 'planned',
  planned_start_date  date,
  planned_end_date    date,
  actual_start_date   timestamptz,
  actual_end_date     timestamptz,
  assigned_to         uuid,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_orders_workshop_id_production_number_key
    UNIQUE (workshop_id, production_number)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_workshop_state
  ON public.production_orders (workshop_id, state);

CREATE INDEX IF NOT EXISTS idx_production_orders_workshop_quote
  ON public.production_orders (workshop_id, quote_id);

CREATE INDEX IF NOT EXISTS idx_production_orders_workshop_planned_start
  ON public.production_orders (workshop_id, planned_start_date)
  WHERE planned_start_date IS NOT NULL;

-- updated_at trigger (reuses the shared set_updated_at function)
DROP TRIGGER IF EXISTS production_orders_set_updated_at ON public.production_orders;
CREATE TRIGGER production_orders_set_updated_at
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_orders_select ON public.production_orders;
CREATE POLICY production_orders_select
  ON public.production_orders
  FOR SELECT
  TO authenticated
  USING (workshop_id = public.get_current_workshop_id());

-- Intentional: NO production_orders_insert / production_orders_update /
-- production_orders_delete policy. The state machine is RPC-owned and
-- gated through PR 2 (start_production_order, transition_production_order_state),
-- which run as SECURITY DEFINER and set the transaction-local guard
-- `app.production_order_write_context = 'rpc'` after role and workshop
-- checks. Without INSERT/UPDATE/DELETE policies, direct mutation by an
-- authenticated user is rejected at the RLS layer (default deny -> 42501
-- for INSERT, 0 rows affected for UPDATE/DELETE). A defense-in-depth
-- trigger below raises 42501 even if a future migration re-introduces
-- a permissive policy — UNLESS the guard is set, in which case the
-- trigger allows the write (defense-in-depth for the RPC path, not a
-- client policy). Service-role seeding (tests, migrations, backfill)
-- bypasses RLS by virtue of BYPASSRLS on the postgres role; the
-- same-workshop FK check trigger still fires for service-role inserts
-- and enforces tenant integrity (see T25.1 in the test file).
DROP POLICY IF EXISTS production_orders_insert ON public.production_orders;
DROP POLICY IF EXISTS production_orders_update ON public.production_orders;
DROP POLICY IF EXISTS production_orders_delete ON public.production_orders;

COMMENT ON TABLE  public.production_orders IS
  'First-class production orders. State machine is owned by SQL (RPCs land in PR 2). '
  'Direct INSERT/UPDATE/DELETE is denied for authenticated users: no RLS mutation '
  'policies exist, plus defense-in-depth triggers reject authenticated mutations '
  'with SQLSTATE 42501 UNLESS the transaction-local guard '
  '`app.production_order_write_context = ''rpc''` is set by a PR-2 '
  'SECURITY DEFINER RPC. All state changes must flow through PR-2 RPCs.';
COMMENT ON COLUMN public.production_orders.production_number IS
  'Human-readable identifier (e.g. OP-2026-0001). Unique per workshop.';

-- ═════════════════════════════════════════════════════════════════════
-- 3. production_order_events table (append-only)
-- ═════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.production_order_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id           uuid NOT NULL REFERENCES public.workshops(id),
  production_order_id   uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  from_state            public.production_order_state,
  to_state              public.production_order_state NOT NULL,
  reason                text,
  actor_id              uuid,
  metadata              jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_order_events_order_created
  ON public.production_order_events (production_order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_production_order_events_workshop_created
  ON public.production_order_events (workshop_id, created_at DESC);

-- RLS: SELECT only. No INSERT/UPDATE/DELETE policies means authenticated
-- clients cannot append or mutate events directly. Events are written by
-- the PR-2 transition_production_order_state RPC, which runs as
-- SECURITY DEFINER, sets the transaction-local guard
-- `app.production_order_write_context = 'rpc'` after role/workshop
-- checks, and exercises all the validation: role gate, allowed
-- transitions, FOR UPDATE lock, and p_request_id idempotency.
ALTER TABLE public.production_order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_order_events_select ON public.production_order_events;
CREATE POLICY production_order_events_select
  ON public.production_order_events
  FOR SELECT
  TO authenticated
  USING (workshop_id = public.get_current_workshop_id());

-- Intentional: NO production_order_events_insert / _update / _delete policy.
-- Without an INSERT policy, direct event appends by authenticated users are
-- rejected (42501 default deny). UPDATE/DELETE are also denied. The
-- defense-in-depth triggers below raise 42501 with a TG_OP-aware message
-- if a future migration re-introduces a permissive policy — UNLESS the
-- internal guard is set, in which case the PR-2 RPC path is allowed.
DROP POLICY IF EXISTS production_order_events_insert ON public.production_order_events;
DROP POLICY IF EXISTS production_order_events_update ON public.production_order_events;
DROP POLICY IF EXISTS production_order_events_delete ON public.production_order_events;

COMMENT ON TABLE public.production_order_events IS
  'Append-only audit log of production_order state transitions. '
  'INSERT/UPDATE/DELETE is denied for authenticated users via RLS absence + triggers, '
  'UNLESS the transaction-local guard `app.production_order_write_context = ''rpc''` '
  'is set by a PR-2 SECURITY DEFINER RPC. '
  'The PR-2 transition_production_order_state RPC is the only sanctioned writer. '
  'Service role may truncate for GDPR-style erasure, never UPDATE/DELETE in place.';

-- ═════════════════════════════════════════════════════════════════════
-- 4. Defense-in-depth triggers with positive internal guard
--
-- Even though the absence of mutation RLS policies already blocks
-- authenticated writes, a future migration could accidentally
-- re-introduce a permissive policy. The triggers below are the second
-- line of defense: if any authenticated row touches INSERT/UPDATE/DELETE
-- WITHOUT the transaction-local guard `app.production_order_write_context
-- = 'rpc'`, the trigger raises 42501 before the row is changed. The
-- exception messages reference the PR-2 RPCs explicitly so that future
-- developers find the right path.
--
-- Why a positive guard (instead of blocking all auth.uid() IS NOT NULL):
--   Supabase RPCs called via PostgREST (e.g. .rpc('start_production_order', ...))
--   still have `auth.uid() IS NOT NULL` set from the user's JWT, even when
--   the RPC body is SECURITY DEFINER. A naive "block all authenticated
--   writes" trigger would therefore block the PR-2 RPCs. The guard bridges
--   this: a PR-2 SECURITY DEFINER RPC performs role + workshop checks,
--   then SET LOCALs `app.production_order_write_context = 'rpc'`. The
--   trigger sees the guard and allows the write. Direct client writes do
--   not set the guard, so they are still rejected.
--
-- Defense-in-depth ordering:
--   1. RLS absence (no INSERT/UPDATE/DELETE policy) -> default deny at
--      RLS WITH CHECK time, if the trigger ever allowed a row.
--   2. Defense-in-depth trigger (this section) -> raises 42501 unless
--      the guard is 'rpc'. Runs BEFORE RLS WITH CHECK, so a permissive
--      policy added by mistake is still caught.
--   3. Same-workshop FK check (section 5) -> invariant for all writers
--      (service_role included); raises 23514 on cross-tenant.
--
-- Service role (auth.uid() IS NULL) bypasses the auth gate but is still
-- subject to the same-workshop FK check trigger (section 5).
-- ═════════════════════════════════════════════════════════════════════

-- 4a. production_order_events triggers
CREATE OR REPLACE FUNCTION public.prevent_authenticated_production_order_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_write_context text;
BEGIN
  -- Auth gate: authenticated (auth.uid() IS NOT NULL) writes are
  -- rejected unless the transaction-local guard is exactly 'rpc'.
  -- The second argument `true` to current_setting returns NULL on
  -- a missing setting instead of raising. NULL and any value other
  -- than the literal 'rpc' cause the trigger to raise 42501.
  IF auth.uid() IS NOT NULL THEN
    v_write_context := current_setting('app.production_order_write_context', true);
    IF v_write_context IS DISTINCT FROM 'rpc' THEN
      RAISE EXCEPTION 'production_order_events are immutable via direct %; use transition_production_order_state RPC to record', TG_OP
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_authenticated_production_order_event_insert
  ON public.production_order_events;
CREATE TRIGGER prevent_authenticated_production_order_event_insert
  BEFORE INSERT ON public.production_order_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_production_order_event_mutation();

DROP TRIGGER IF EXISTS prevent_authenticated_production_order_event_update
  ON public.production_order_events;
CREATE TRIGGER prevent_authenticated_production_order_event_update
  BEFORE UPDATE ON public.production_order_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_production_order_event_mutation();

DROP TRIGGER IF EXISTS prevent_authenticated_production_order_event_delete
  ON public.production_order_events;
CREATE TRIGGER prevent_authenticated_production_order_event_delete
  BEFORE DELETE ON public.production_order_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_production_order_event_mutation();

-- 4b. production_orders triggers
CREATE OR REPLACE FUNCTION public.prevent_authenticated_production_order_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_write_context text;
BEGIN
  -- Auth gate: authenticated (auth.uid() IS NOT NULL) writes are
  -- rejected unless the transaction-local guard is exactly 'rpc'.
  -- The second argument `true` to current_setting returns NULL on
  -- a missing setting instead of raising. NULL and any value other
  -- than the literal 'rpc' cause the trigger to raise 42501.
  -- The guard is set by PR-2 SECURITY DEFINER RPCs AFTER their own
  -- role and workshop checks, not by clients. Direct client writes
  -- never set the guard, so they remain rejected.
  IF auth.uid() IS NOT NULL THEN
    v_write_context := current_setting('app.production_order_write_context', true);
    IF v_write_context IS DISTINCT FROM 'rpc' THEN
      RAISE EXCEPTION 'production_orders are immutable via direct %; use start_production_order / transition_production_order_state RPCs', TG_OP
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_authenticated_production_order_insert
  ON public.production_orders;
CREATE TRIGGER prevent_authenticated_production_order_insert
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_production_order_mutation();

DROP TRIGGER IF EXISTS prevent_authenticated_production_order_update
  ON public.production_orders;
CREATE TRIGGER prevent_authenticated_production_order_update
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_production_order_mutation();

DROP TRIGGER IF EXISTS prevent_authenticated_production_order_delete
  ON public.production_orders;
CREATE TRIGGER prevent_authenticated_production_order_delete
  BEFORE DELETE ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_authenticated_production_order_mutation();

-- ═════════════════════════════════════════════════════════════════════
-- 5. Same-workshop FK integrity triggers (INVARIANT for all writers,
--    INCLUDING the PR-2 RPC path).
--
-- The plain UUID FK on production_orders.quote_id guarantees the quote
-- exists; it does NOT guarantee that the quote belongs to the same
-- workshop as the production_order. RLS WITH CHECK on production_orders
-- only verifies the child row's own workshop_id. Without the trigger
-- below, an authenticated user can insert a row in their own workshop
-- pointing at a foreign-workshop quote, corrupting cross-tenant data
-- and making RLS-only coverage falsely reassuring.
--
-- The same applies to production_order_events.production_order_id.
--
-- The trigger raises 23514 (check_violation) so it reads as a
-- constraint failure, not an authorization failure. The check is
-- INVARIANT: there is no auth.uid() IS NULL bypass and no
-- app.production_order_write_context guard bypass. service_role
-- backfill must also use consistent workshop_id pairs, which is the
-- desired behavior — silent cross-tenant corruption via service role
-- is a worse failure mode than an explicit violation. Real
-- workshop-merge operations need to explicitly disable the trigger
-- with proper audit.
--
-- Interaction with the internal guard (section 4):
--   The auth-gate trigger fires FIRST (alphabetical order of trigger
--   names: `prevent_authenticated_*` comes before
--   `*_check_*_same_workshop`). With the guard set, the auth-gate
--   allows the write, and the FK-check trigger then validates the
--   tenant pair. With the guard NOT set, the auth-gate raises 42501
--   and the FK check is never reached. This ordering is correct: the
--   auth gate handles the obvious "client tried to write directly"
--   case, and the FK check handles the subtle "RPC body tried to
--   write across tenants" case.
-- ═════════════════════════════════════════════════════════════════════

-- 5a. production_orders.quote_id must belong to the same workshop
CREATE OR REPLACE FUNCTION public.check_production_order_quote_same_workshop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_parent_workshop_id uuid;
BEGIN
  SELECT workshop_id INTO v_parent_workshop_id
  FROM public.quotes
  WHERE id = NEW.quote_id;

  -- If the parent does not exist, let the FK constraint raise 23503
  -- with its own message; this trigger is for the workshop-mismatch case.
  IF v_parent_workshop_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_parent_workshop_id IS DISTINCT FROM NEW.workshop_id THEN
    RAISE EXCEPTION
      'production_order.workshop_id (%) does not match parent quote.workshop_id (%)',
      NEW.workshop_id, v_parent_workshop_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_orders_check_quote_same_workshop
  ON public.production_orders;
CREATE TRIGGER production_orders_check_quote_same_workshop
  BEFORE INSERT OR UPDATE OF quote_id, workshop_id ON public.production_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_production_order_quote_same_workshop();

-- 5b. production_order_events.production_order_id must belong to the
--     same workshop as the event row
CREATE OR REPLACE FUNCTION public.check_production_order_event_order_same_workshop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_parent_workshop_id uuid;
BEGIN
  SELECT workshop_id INTO v_parent_workshop_id
  FROM public.production_orders
  WHERE id = NEW.production_order_id;

  IF v_parent_workshop_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_parent_workshop_id IS DISTINCT FROM NEW.workshop_id THEN
    RAISE EXCEPTION
      'production_order_event.workshop_id (%) does not match parent production_order.workshop_id (%)',
      NEW.workshop_id, v_parent_workshop_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_order_events_check_order_same_workshop
  ON public.production_order_events;
CREATE TRIGGER production_order_events_check_order_same_workshop
  BEFORE INSERT OR UPDATE OF production_order_id, workshop_id ON public.production_order_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_production_order_event_order_same_workshop();
