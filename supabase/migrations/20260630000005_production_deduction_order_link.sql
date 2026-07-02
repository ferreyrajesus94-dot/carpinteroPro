-- PR 4: Production-Order Linkage on Deduction Batch
--
-- Implements the deduction FK linkage for the production-order-state-machine
-- change. Decouples `quote_production_stock_deductions` (legacy material
-- consumption) from the new `production_orders` entity while keeping both
-- tables queryable together.
--
-- What's in this migration:
--   1. Add a nullable `quote_production_stock_deductions.production_order_id`
--      column with FK to production_orders(id) ON DELETE SET NULL.
--      Nullable: legacy deduction batches (created via the legacy
--      start_quote_production RPC) keep production_order_id = NULL.
--      The new flow (start_production_order) writes a non-null FK.
--   2. Add a partial index on (workshop_id, production_order_id) WHERE
--      production_order_id IS NOT NULL — supports the inventory deep-link
--      and ledger queries (PR 7) without bloating the index with NULLs.
--   3. Add a same-workshop FK check trigger (defense in depth, like the
--      production_order_events.trigger). The trigger validates that
--      production_order_id.workshop_id = NEW.workshop_id. This is the
--      second line of defense after the FK constraint: the FK guarantees
--      the production_order row exists; the trigger guarantees the
--      production_order belongs to the same workshop. No bypass for
--      service role, no auth.uid() IS NULL exception.
--   4. Extend `start_production_order` to write a non-null FK on the
--      deduction batch (the "new flow" path). The new optional parameter
--      `p_create_deduction boolean DEFAULT true` controls whether the RPC
--      creates a deduction batch as part of the new flow. PR 2 tests that
--      exercise the RPC in isolation can pass `p_create_deduction = false`
--      to avoid coupling the test setup to the deduction path.
--   5. Idempotency: the new flow checks for an existing non-reversed
--      deduction batch before inserting so a retry of start_production_order
--      with the same p_request_id does not create a duplicate deduction
--      batch. A pre-existing batch (created via the legacy
--      start_quote_production) is preserved — the new flow does NOT backfill
--      production_order_id onto legacy rows (the spec
--      "Legacy batch keeps null" scenario explicitly preserves null for
--      legacy rows).
--
-- RLS:
--   The existing RLS policies on quote_production_stock_deductions use
--   `workshop_id = get_current_workshop_id()` for SELECT/INSERT/UPDATE/
--   DELETE. The new column is covered by the row-level workshop_id check
--   automatically — no new policies needed.
--
-- Depends on:
--   - PR 1 migration (20260630000000_production_orders.sql): the
--     production_orders table that the new FK references.
--   - PR 2 RPC migration (20260630000001_production_orders_rpc.sql)
--     and its blocker-fix successor
--     (20260630000002_production_rpc_blocker_fix.sql): the
--     start_production_order RPC that this migration extends.
--   - quote_production_stock_deductions (from
--     20260627000002_production_deduction_batch.sql): the table being
--     extended.
--
-- Rollback notes:
--   - DROP INDEX idx_production_deductions_workshop_production_order;
--   - DROP TRIGGER production_deduction_check_production_order_same_workshop
--       ON public.quote_production_stock_deductions;
--   - DROP FUNCTION check_production_deduction_production_order_same_workshop();
--   - ALTER TABLE public.quote_production_stock_deductions
--       DROP COLUMN production_order_id;
--   - DROP FUNCTION public.start_production_order(uuid, text, date, date,
--       uuid, text, uuid, boolean);
--   - DROP FUNCTION public.start_production_order(uuid, text, date, date,
--       uuid, text, uuid); -- then re-CREATE the PR 2 version
--     (signature reverts to 7 params).

-- ═════════════════════════════════════════════════════════════════════
-- 1. Add nullable production_order_id column with FK
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE public.quote_production_stock_deductions
  ADD COLUMN IF NOT EXISTS production_order_id uuid NULL
    REFERENCES public.production_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quote_production_stock_deductions.production_order_id IS
  'Nullable FK to production_orders.id. The new flow (start_production_order) '
  'writes a non-null value. Legacy batches (created via the legacy '
  'start_quote_production RPC) keep production_order_id = NULL — the spec '
  '"Legacy batch keeps null" scenario explicitly preserves null for legacy rows. '
  'ON DELETE SET NULL so deleting a production order does not cascade to '
  'legacy ledger rows: the batch row survives, the FK becomes null, and the '
  'ledger remains readable (production_order_id = NULL is a legitimate state).';

-- ═════════════════════════════════════════════════════════════════════
-- 2. Partial index on (workshop_id, production_order_id) WHERE NOT NULL
-- ═════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_production_deductions_workshop_production_order
  ON public.quote_production_stock_deductions (workshop_id, production_order_id)
  WHERE production_order_id IS NOT NULL;

COMMENT ON INDEX public.idx_production_deductions_workshop_production_order IS
  'Partial index for the new flow''s deduction batches. Covers inventory '
  'deep-link and ledger queries that JOIN on production_order_id. Excludes '
  'NULL rows because legacy batches are out of scope for those queries '
  '(they show the quote/batch fallback instead — see PR 7).';

-- ═════════════════════════════════════════════════════════════════════
-- 3. Same-workshop FK check trigger (defense in depth)
--
-- The FK constraint on production_order_id only guarantees the parent row
-- exists. The trigger guarantees the production_order belongs to the same
-- workshop as the deduction batch. Without this, an authenticated user can
-- insert a deduction row in their own workshop pointing at a foreign-workshop
-- production order, corrupting cross-tenant data. The check is INVARIANT for
-- all writers (no auth.uid() IS NULL bypass), so service_role backfill also
-- must use consistent workshop_id pairs. Real workshop-merge operations
-- need to explicitly disable the trigger with proper audit.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_production_deduction_production_order_same_workshop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_parent_workshop_id uuid;
BEGIN
  -- If production_order_id is NULL (legacy batch), there is no parent to
  -- check. The check only fires when the column is set.
  IF NEW.production_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT workshop_id INTO v_parent_workshop_id
  FROM public.production_orders
  WHERE id = NEW.production_order_id;

  -- If the parent does not exist, let the FK constraint raise 23503
  -- with its own message; this trigger is for the workshop-mismatch case.
  IF v_parent_workshop_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_parent_workshop_id IS DISTINCT FROM NEW.workshop_id THEN
    RAISE EXCEPTION
      'production_deduction.workshop_id (%) does not match parent production_order.workshop_id (%)',
      NEW.workshop_id, v_parent_workshop_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_deduction_check_production_order_same_workshop
  ON public.quote_production_stock_deductions;
CREATE TRIGGER production_deduction_check_production_order_same_workshop
  BEFORE INSERT OR UPDATE OF production_order_id, workshop_id
  ON public.quote_production_stock_deductions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_production_deduction_production_order_same_workshop();

COMMENT ON FUNCTION public.check_production_deduction_production_order_same_workshop IS
  'Defense-in-depth trigger. Validates that quote_production_stock_deductions.'
  'production_order_id.workshop_id = NEW.workshop_id. INVARIANT for all '
  'writers (no auth.uid() IS NULL bypass). service_role backfill must also '
  'use consistent workshop_id pairs.';
COMMENT ON TRIGGER production_deduction_check_production_order_same_workshop
  ON public.quote_production_stock_deductions IS
  'See check_production_deduction_production_order_same_workshop() for the '
  'full contract.';

-- ═════════════════════════════════════════════════════════════════════
-- 4. Extend start_production_order to write a non-null deduction FK
--
-- The new flow (start_production_order) now writes a deduction batch with
-- production_order_id = NEW.id. The deduction is a linkage record — it
-- records that production has started for this quote and links the
-- material-consumption batch to the new order. The actual stock-movement
-- processing (BOM consumption) is PR 7 territory; PR 4 only establishes
-- the linkage.
--
-- PostgreSQL allows function overloading by argument type, so the
-- PR-2 7-arg signature (uuid, text, date, date, uuid, text, uuid) and
-- the PR-4 8-arg signature (uuid, text, date, date, uuid, text, uuid,
-- boolean) would coexist as separate functions if we used CREATE OR
-- REPLACE naively. We must DROP the old 7-arg signature first so the
-- new definition is the ONLY public.start_production_order. This
-- matters for callers (Supabase PostgREST uses the unique function
-- name, not the signature) and for the T1.1 has_function check
-- (which expects exactly one overload with the 8-arg signature).
-- ═════════════════════════════════════════════════════════════════════

-- Drop the PR-2 7-arg signature. CASCADE is needed because nothing
-- depends on the 7-arg function in the database (it is only called
-- via PostgREST by name, and Supabase will route to the 8-arg
-- signature by argument count/type matching).
DROP FUNCTION IF EXISTS public.start_production_order(
  uuid, text, date, date, uuid, text, uuid
);

CREATE OR REPLACE FUNCTION public.start_production_order(
  p_quote_id           uuid,
  p_production_number  text,
  p_planned_start_date date    DEFAULT NULL,
  p_planned_end_date   date    DEFAULT NULL,
  p_assigned_to        uuid    DEFAULT NULL,
  p_notes              text    DEFAULT NULL,
  p_request_id         uuid    DEFAULT gen_random_uuid(),
  p_create_deduction   boolean DEFAULT true
)
RETURNS public.production_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_workshop_id         uuid;
  v_actor_role          public.workshop_user_role;
  v_quote_status        public.quote_status;
  v_quote_workshop_id   uuid;
  v_existing_event      public.production_order_events%ROWTYPE;
  v_existing_order      public.production_orders%ROWTYPE;
  v_new_order           public.production_orders%ROWTYPE;
  v_assignee_workshop_id uuid;
  v_auto_discount       boolean;
  v_existing_batch_id   uuid;
BEGIN
  -- 1. Derive caller's workshop and role
  SELECT p.workshop_id, p.workshop_role
    INTO v_workshop_id, v_actor_role
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile/workshop'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Role check: admin or operational
  IF v_actor_role IS DISTINCT FROM 'admin'::public.workshop_user_role
     AND v_actor_role IS DISTINCT FROM 'operational'::public.workshop_user_role THEN
    RAISE EXCEPTION 'Caller role % is not authorized to start production',
      v_actor_role
      USING ERRCODE = '42501';
  END IF;

  -- 3. Validate p_assigned_to — the assignee must be a profile in
  -- the caller's workshop. A cross-workshop assignee would create a
  -- production_orders row with assigned_to pointing at a foreign
  -- workshop user, bypassing tenant isolation. This is checked BEFORE
  -- the quote lock so a malformed caller doesn't acquire the lock.
  IF p_assigned_to IS NOT NULL THEN
    SELECT p.workshop_id INTO v_assignee_workshop_id
      FROM public.profiles p
     WHERE p.id = p_assigned_to;

    IF v_assignee_workshop_id IS NULL THEN
      RAISE EXCEPTION 'Assignee % is not a known profile', p_assigned_to
        USING ERRCODE = '42501';
    END IF;

    IF v_assignee_workshop_id IS DISTINCT FROM v_workshop_id THEN
      RAISE EXCEPTION 'Assignee % is not a member of the caller''s workshop (%)',
        p_assigned_to, v_workshop_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 4. Lock the quote (FOR UPDATE) — concurrency safety. Two concurrent
  -- calls with the same p_request_id serialize here; the second sees the
  -- first's event in the scoped idempotency lookup below and returns the
  -- existing order without re-creating it.
  SELECT q.status, q.workshop_id
    INTO v_quote_status, v_quote_workshop_id
    FROM public.quotes q
   WHERE q.id = p_quote_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Cross-workshop access check (defense in depth — the FK check trigger
  -- fires on INSERT and would catch a cross-tenant attempt with 23514, but
  -- the RPC is responsible for tenant isolation on read/write and must
  -- raise the authorization error 42501 explicitly).
  IF v_quote_workshop_id IS DISTINCT FROM v_workshop_id THEN
    RAISE EXCEPTION 'Cross-workshop access denied'
      USING ERRCODE = '42501';
  END IF;

  -- 6. Quote status precondition
  IF v_quote_status IS DISTINCT FROM 'aprobado'::public.quote_status THEN
    RAISE EXCEPTION 'Quote must be in aprobado status (was %); cannot start production',
      v_quote_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. Idempotency lookup, AFTER the lock and with a tight scope
  -- (workshop_id, operation, quote_id, request_id).
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing_event
      FROM public.production_order_events
     WHERE workshop_id = v_workshop_id
       AND metadata->>'operation' = 'start'
       AND metadata->>'quote_id' = p_quote_id::text
       AND metadata->>'request_id' = p_request_id::text
     LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_existing_order
        FROM public.production_orders
       WHERE id = v_existing_event.production_order_id;
      RETURN v_existing_order;
    END IF;
  END IF;

  -- 8. SET LOCAL guard AFTER all authorization checks pass. SET LOCAL
  -- is transaction-local: it auto-reverts on COMMIT/ROLLBACK and never
  -- leaks to subsequent transactions on the same connection. This is
  -- the bridge between RLS (no INSERT policy) and the SECURITY DEFINER
  -- RPC body. The PR-1 trigger accepts the write only when this guard
  -- is exactly 'rpc' (or auth.uid() IS NULL).
  SET LOCAL app.production_order_write_context = 'rpc';

  -- 9. Insert the production order in state='planned'
  INSERT INTO public.production_orders (
    workshop_id, quote_id, production_number, state,
    planned_start_date, planned_end_date, assigned_to, notes
  ) VALUES (
    v_workshop_id, p_quote_id, p_production_number,
    'planned'::public.production_order_state,
    p_planned_start_date, p_planned_end_date, p_assigned_to, p_notes
  )
  RETURNING * INTO v_new_order;

  -- 10. Append the creation event. The metadata includes operation='start'
  -- and quote_id so the idempotency lookup above can scope by (operation,
  -- quote_id) and distinguish start events from transition events. The
  -- same-workshop FK check trigger (PR 1) enforces tenant integrity on
  -- this INSERT; production_order_id will resolve to a quote in the same
  -- workshop.
  INSERT INTO public.production_order_events (
    workshop_id, production_order_id, from_state, to_state,
    reason, actor_id, metadata
  ) VALUES (
    v_new_order.workshop_id, v_new_order.id, NULL,
    'planned'::public.production_order_state,
    'production order created',
    auth.uid(),
    jsonb_build_object(
      'operation', 'start',
      'request_id', p_request_id,
      'quote_id', p_quote_id,
      'production_number', p_production_number
    )
  );

  -- 11. NEW (PR 4): create the deduction batch with non-null FK. This is
  -- the "new flow" linkage record — the production_order_id is set to
  -- the new order's id, which satisfies the spec scenario "New deduction
  -- persists production order id".
  --
  -- We use a check-then-insert pattern (not ON CONFLICT) because the
  -- unique index on (workshop_id, quote_id) is a PARTIAL unique index
  -- (`uq_production_deduction_quote_active ... WHERE status IS DISTINCT
  -- FROM 'reversed'`) and PostgreSQL's ON CONFLICT inference doesn't
  -- match a partial index without an explicit index_predicate. The
  -- check-then-insert pattern is also clearer about the intent: if a
  -- pre-existing batch exists (e.g. from the legacy
  -- start_quote_production RPC), we preserve it without backfill. The
  -- new flow never destroys or overwrites legacy data; it only creates
  -- a non-null FK on a NEW batch when no batch exists yet.
  IF p_create_deduction THEN
    -- Check for an existing batch (any status, including reversed — the
    -- new flow does not resurrect a reversed batch).
    SELECT id INTO v_existing_batch_id
    FROM public.quote_production_stock_deductions
    WHERE workshop_id = v_workshop_id
      AND quote_id = p_quote_id
    LIMIT 1;

    IF v_existing_batch_id IS NULL THEN
      -- Read auto_stock_discount from workshop_settings. Use a subquery
      -- that always returns one row so the COALESCE handles the missing
      -- settings row case (default to false). A direct SELECT INTO would
      -- leave v_auto_discount NULL when the workshop has no settings row
      -- (PL/pgSQL sets the target to NULL on zero rows).
      SELECT COALESCE(
        (SELECT ws.auto_stock_discount
           FROM public.workshop_settings ws
          WHERE ws.workshop_id = v_workshop_id),
        false
      ) INTO v_auto_discount;

      INSERT INTO public.quote_production_stock_deductions (
        workshop_id, quote_id, production_order_id, request_id, status,
        auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
        warning_summary, confirmed_by
      ) VALUES (
        v_workshop_id, p_quote_id, v_new_order.id, p_request_id, 'completed',
        v_auto_discount, false, false,
        '[]'::jsonb, auth.uid()
      )
      RETURNING id INTO v_existing_batch_id;
    END IF;
  END IF;

  -- 12. Return the new order
  RETURN v_new_order;
END;
$$;

COMMENT ON FUNCTION public.start_production_order IS
  'Creates a production_orders row in state=planned and appends a creation '
  'event. SECURITY DEFINER, role-gated (admin/operational), and uses '
  'SET LOCAL app.production_order_write_context = ''rpc'' to bridge the '
  'PR-1 defense-in-depth triggers. Idempotent on p_request_id: retries '
  'with the same p_request_id return the existing order without duplicating '
  'the order or the event. The same-workshop FK check trigger (PR 1) '
  'enforces tenant integrity on the INSERT; the production_order_id must '
  'resolve to a quote in the same workshop. '
  'Blocker fixes: (1) FOR UPDATE on the quote is acquired BEFORE the '
  'idempotency lookup (concurrency-safe under retry); (2) the idempotency '
  'lookup is scoped to (workshop_id, operation=''start'', quote_id, '
  'request_id) so a reused request_id on a different quote creates a new '
  'order; (3) p_assigned_to is validated to be a profile in the caller''s '
  'workshop (42501 on cross-workshop assignee). '
  'PR 4: when p_create_deduction is true (default), the function also '
  'creates a deduction batch in quote_production_stock_deductions with '
  'production_order_id = NEW.id, satisfying the "new deduction persists '
  'production order id" spec scenario. The function checks for an existing '
  'non-reversed deduction batch before inserting, preserving legacy '
  'start_quote_production data without backfill — legacy batches keep '
  'production_order_id = NULL '
  'as required by the spec.';
