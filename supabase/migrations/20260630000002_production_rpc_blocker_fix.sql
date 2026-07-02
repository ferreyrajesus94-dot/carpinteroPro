-- PR 2 Blocker Fix — write RPCs
--
-- Resolves four CRITICAL/WARNING review blockers for PR 2 (write RPCs):
--
--   1. CRITICAL: Idempotency not concurrency-safe.
--      The first version of start_production_order checked
--      metadata->>'request_id' BEFORE acquiring FOR UPDATE on the quote.
--      Two concurrent calls with the same p_request_id could both pass
--      the idempotency check (no row exists yet) and both proceed to
--      INSERT, producing duplicate orders. Same pattern in
--      transition_production_order_state. The fix acquires the FOR UPDATE
--      lock FIRST; the second concurrent call blocks until the first
--      commits, then sees the existing event in the idempotency lookup
--      and returns the existing order without re-creating it.
--
--   2. WARNING/CRITICAL: Idempotency key scope too broad.
--      The first version looked up events by (workshop_id, request_id)
--      only. A request_id reused on a DIFFERENT quote (start) or
--      DIFFERENT order (transition) would silently return the wrong
--      result. The fix scopes the lookup by (workshop_id, operation,
--      target_id, request_id) so the same request_id on a different
--      target is treated as a fresh call.
--
--   3. CRITICAL: New reject_direct_en_produccion_writes trigger would
--      break existing start_quote_production.
--      start_quote_production is SECURITY INVOKER and writes
--      en_produccion to quotes.status as the caller. The new trigger
--      (added in the PR 2 RPC migration) blocks this unless the
--      transaction-local guard app.production_order_write_context = 'rpc'
--      is set. The fix adds SET LOCAL of the guard inside
--      start_quote_production, around its three status writes (manual
--      mode, idempotent branch, and the final happy-path write). The
--      function already does its own role + cross-workshop checks, so
--      setting the guard is safe.
--
--   4. CRITICAL: p_assigned_to not same-workshop validated.
--      A caller could pass a foreign-workshop profile id, which would
--      create a production_orders row with assigned_to pointing at a
--      non-member of the caller's workshop, corrupting tenant isolation.
--      The fix adds an explicit same-workshop check: the assignee must
--      exist in public.profiles with workshop_id matching the caller's
--      workshop. Cross-workshop assignees raise 42501.
--
-- Implementation strategy:
--   - Both write RPCs use CREATE OR REPLACE FUNCTION, so this migration
--     supersedes the PR 2 RPC migration's versions cleanly via
--     supabase db reset (the new definition wins because it runs later).
--   - start_quote_production lives in an earlier migration
--     (20260627000006_fix_start_quote_production_v_warnings.sql) and
--     is replaced here in-place. The earlier migration is not modified
--     (its changes are frozen in git history).
--   - Structural assertions (lock-before-idempotency) are encoded in
--     the test file (T13, T14) by checking that the function body's
--     'FOR UPDATE' position is less than its 'metadata->>' position.
--     pgTAP cannot do real concurrent transaction testing, so the
--     structural check is the deterministic evidence.
--
-- Depends on:
--   - PR 1 schema (20260630000000_production_orders.sql)
--   - PR 2 RPCs (20260630000001_production_orders_rpc.sql)
--   - public.profiles (workshop_id, workshop_role)
--   - public.quotes
--   - public.production_orders
--   - public.production_order_events
--   - public.set_updated_at() (shared trigger)
--   - The PR 2 trigger prevent_direct_en_produccion_writes on quotes
--     (this is the trigger that motivates blocker 3)
--
-- Rollback notes:
--   - DROP FUNCTION public.start_production_order;
--   - DROP FUNCTION public.transition_production_order_state;
--   - DROP FUNCTION public.start_quote_production; -- then re-CREATE
--     the prior version from 20260627000006_fix_*_v_warnings.sql.

-- ═════════════════════════════════════════════════════════════════════
-- 1. start_production_order RPC (fixed)
--
-- Reordered: FOR UPDATE on the quote is acquired BEFORE the idempotency
-- lookup. Tighter idempotency scope: (workshop_id, operation='start',
-- quote_id, request_id). New assigned_to same-workshop check.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.start_production_order(
  p_quote_id           uuid,
  p_production_number  text,
  p_planned_start_date date    DEFAULT NULL,
  p_planned_end_date   date    DEFAULT NULL,
  p_assigned_to        uuid    DEFAULT NULL,
  p_notes              text    DEFAULT NULL,
  p_request_id         uuid    DEFAULT gen_random_uuid()
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

  -- 3. Validate p_assigned_to (NEW) — the assignee must be a profile in
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

  -- 4. Lock the quote (FOR UPDATE) FIRST — this is the concurrency
  -- safety fix. Two concurrent calls with the same p_request_id will
  -- serialize here: the second call blocks until the first commits,
  -- then sees the existing event in the scoped idempotency lookup
  -- below and returns the existing order without re-creating it.
  SELECT q.status, q.workshop_id
    INTO v_quote_status, v_quote_workshop_id
    FROM public.quotes q
   WHERE q.id = p_quote_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Cross-workshop check (defense in depth — the FK check trigger
  -- fires on INSERT and would catch a cross-tenant attempt with 23514,
  -- but the RPC is responsible for tenant isolation on read/write and
  -- must raise the authorization error 42501 explicitly so the caller
  -- can distinguish "you cannot access this quote" from "the quote's
  -- tenant integrity is broken").
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

  -- 7. Idempotency lookup, NOW AFTER the lock and with a TIGHTER scope
  -- (workshop_id, operation, quote_id, request_id). The 'operation'
  -- discriminator is included to make the lookup unambiguous in the
  -- shared production_order_events table: a transition event for the
  -- same workshop/request_id does not collide with a start event.
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

  -- 10. Append the creation event. The metadata now includes
  -- operation='start' and quote_id so the idempotency lookup above
  -- can scope by (operation, quote_id) and distinguish start events
  -- from transition events. The same-workshop FK check trigger (PR 1)
  -- enforces tenant integrity on this INSERT; production_order_id will
  -- resolve to a quote in the same workshop.
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

  -- 11. Return the new order
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
  'workshop (42501 on cross-workshop assignee).';

-- ═════════════════════════════════════════════════════════════════════
-- 2. transition_production_order_state RPC (fixed)
--
-- Reordered: FOR UPDATE on the order is acquired BEFORE the idempotency
-- lookup. Tighter idempotency scope: (workshop_id, operation='transition',
-- production_order_id, to_state, request_id).
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.transition_production_order_state(
  p_order_id   uuid,
  p_to_state   public.production_order_state,
  p_reason     text DEFAULT NULL,
  p_request_id uuid DEFAULT gen_random_uuid()
)
RETURNS public.production_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_workshop_id     uuid;
  v_actor_role      public.workshop_user_role;
  v_existing_event  public.production_order_events%ROWTYPE;
  v_existing_order  public.production_orders%ROWTYPE;
  v_order           public.production_orders%ROWTYPE;
  v_from_state      public.production_order_state;
  v_allowed         boolean;
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
    RAISE EXCEPTION 'Caller role % is not authorized to transition production orders',
      v_actor_role
      USING ERRCODE = '42501';
  END IF;

  -- 3. Lock the order (FOR UPDATE) FIRST — concurrency safety fix.
  -- Two concurrent calls with the same p_request_id will serialize
  -- here; the second call sees the first's event in the scoped
  -- idempotency lookup below and returns the existing order without
  -- re-applying the transition.
  SELECT * INTO v_order
    FROM public.production_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order % not found', p_order_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 4. Cross-workshop access check (defense in depth — the FK check
  -- trigger would not fire here because the parent is in the same
  -- workshop, but the RPC is responsible for tenant isolation on
  -- read/write).
  IF v_order.workshop_id IS DISTINCT FROM v_workshop_id THEN
    RAISE EXCEPTION 'Cross-workshop access denied'
      USING ERRCODE = '42501';
  END IF;

  -- 5. Idempotency lookup, NOW AFTER the lock and with a TIGHTER scope
  -- (workshop_id, operation='transition', production_order_id,
  -- to_state, request_id). The (operation, production_order_id,
  -- to_state) scope ensures that:
  --   (a) a start event with the same request_id does not collide;
  --   (b) a transition with the same request_id on a DIFFERENT order
  --       does not collide;
  --   (c) a transition with the same request_id but a DIFFERENT
  --       to_state on the SAME order is treated as a fresh call.
  -- Without the to_state discriminator, a retry that re-reads
  -- p_to_state from a stale payload would be silently short-circuited
  -- even if the order's state has since changed.
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing_event
      FROM public.production_order_events
     WHERE workshop_id = v_workshop_id
       AND metadata->>'operation' = 'transition'
       AND metadata->>'production_order_id' = p_order_id::text
       AND metadata->>'to_state' = p_to_state::text
       AND metadata->>'request_id' = p_request_id::text
     LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_existing_order
        FROM public.production_orders
       WHERE id = v_existing_event.production_order_id;
      RETURN v_existing_order;
    END IF;
  END IF;

  -- 6. Validate the transition against the allowed-transitions list
  v_from_state := v_order.state;
  v_allowed := CASE
    -- planned -> in_progress | cancelled
    WHEN v_from_state = 'planned'::public.production_order_state
         AND p_to_state IN ('in_progress'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    -- in_progress -> paused | quality_check | cancelled
    WHEN v_from_state = 'in_progress'::public.production_order_state
         AND p_to_state IN ('paused'::public.production_order_state,
                            'quality_check'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    -- paused -> in_progress | cancelled
    WHEN v_from_state = 'paused'::public.production_order_state
         AND p_to_state IN ('in_progress'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    -- quality_check -> ready | in_progress
    WHEN v_from_state = 'quality_check'::public.production_order_state
         AND p_to_state IN ('ready'::public.production_order_state,
                            'in_progress'::public.production_order_state)
      THEN true
    -- ready -> delivered | cancelled
    WHEN v_from_state = 'ready'::public.production_order_state
         AND p_to_state IN ('delivered'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    -- delivered and cancelled are terminal
    WHEN v_from_state IN ('delivered'::public.production_order_state,
                          'cancelled'::public.production_order_state)
      THEN false
    -- everything else (including same-state no-ops) is forbidden
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition % -> % is not allowed (forbidden by state machine)',
      v_from_state, p_to_state
      USING ERRCODE = 'P0001';
  END IF;

  -- 7. SET LOCAL guard AFTER role/workshop/transition checks pass
  SET LOCAL app.production_order_write_context = 'rpc';

  -- 8. Update the order state
  UPDATE public.production_orders
     SET state = p_to_state
   WHERE id = v_order.id
   RETURNING * INTO v_order;

  -- 9. Append the transition event. The metadata now includes
  -- operation='transition' and the target (production_order_id,
  -- to_state) so the idempotency lookup above can scope by them.
  INSERT INTO public.production_order_events (
    workshop_id, production_order_id, from_state, to_state,
    reason, actor_id, metadata
  ) VALUES (
    v_order.workshop_id, v_order.id, v_from_state, p_to_state,
    p_reason, auth.uid(),
    jsonb_build_object(
      'operation', 'transition',
      'request_id', p_request_id,
      'production_order_id', p_order_id,
      'to_state', p_to_state
    )
  );

  -- 10. Return the updated order
  RETURN v_order;
END;
$$;

COMMENT ON FUNCTION public.transition_production_order_state IS
  'Transitions a production_orders state and appends an audit event. '
  'SECURITY DEFINER, role-gated (admin/operational), and uses '
  'SET LOCAL app.production_order_write_context = ''rpc'' to bridge the '
  'PR-1 defense-in-depth triggers. Idempotent on p_request_id: retries '
  'with the same p_request_id return the current order without writing a '
  'duplicate event. The allowed-transitions list is enforced at the SQL '
  'layer: planned->in_progress|cancelled, in_progress->paused|quality_check|cancelled, '
  'paused->in_progress|cancelled, quality_check->ready|in_progress, '
  'ready->delivered|cancelled; delivered and cancelled are terminal. '
  'Blocker fixes: (1) FOR UPDATE on the order is acquired BEFORE the '
  'idempotency lookup (concurrency-safe under retry); (2) the idempotency '
  'lookup is scoped to (workshop_id, operation=''transition'', '
  'production_order_id, to_state, request_id) so a reused request_id on a '
  'different order (or with a different to_state on the same order) is '
  'treated as a fresh call.';

-- ═════════════════════════════════════════════════════════════════════
-- 3. start_quote_production RPC (blocker 3 fix)
--
-- The new reject_direct_en_produccion_writes trigger on
-- public.quotes.status (added in the PR 2 RPC migration) blocks any
-- authenticated write of status = 'en_produccion' UNLESS the
-- transaction-local guard app.production_order_write_context = 'rpc'
-- is set. start_quote_production is SECURITY INVOKER and writes
-- en_produccion as the caller.
--
-- The fix: SET LOCAL the guard around the three places that write
-- en_produccion to quotes.status:
--   (a) the idempotent batch-exists branch (returns existing batch
--       AND updates status if not already en_produccion),
--   (b) the auto_discount disabled branch (just updates status),
--   (c) the final happy-path write (after the batch + movements).
--
-- The function already does its own role + cross-workshop checks
-- before any of these writes, so setting the guard is safe — the
-- trigger's own guard contract is "this is a trusted mutation from a
-- function that has done its own authorization". Direct client writes
-- (without the guard) remain rejected with 42501.
--
-- The guard is set via SET LOCAL (transaction-local). It auto-reverts
-- on COMMIT/ROLLBACK and never leaks to subsequent transactions on
-- the same connection.
--
-- NOTE: this is a CREATE OR REPLACE of the function that lives in
-- 20260627000006_fix_start_quote_production_v_warnings.sql. The
-- earlier migration is NOT modified; the new definition wins on
-- supabase db reset because this migration runs later.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.start_quote_production(
  p_quote_id          uuid,
  p_confirm_deduction boolean,
  p_request_id        uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_workshop_id         uuid;
  v_quote_status        text;
  v_batch_status        text;
  v_quote_number        text;
  v_auto_discount       boolean;
  v_batch_id            uuid;
  v_shortage_detected   boolean := false;
  v_snapshot_incomplete boolean := false;
  v_warnings            jsonb := '[]'::jsonb;
  v_movement_count      integer := 0;
  v_skipped_count       integer := 0;
  v_bom_line            record;
  v_material_stock      numeric;
  v_result              jsonb;
BEGIN
  -- 1. Lock quote and derive workshop
  SELECT q.workshop_id, q.status, q.quote_number
    INTO v_workshop_id, v_quote_status, v_quote_number
  FROM public.quotes q
  WHERE q.id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_workshop_id <> (SELECT workshop_id FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Cross-workshop access denied' USING ERRCODE = '42501';
  END IF;

  -- 1b. Role check: only admin/operational can start production
  IF (SELECT workshop_role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'operational') THEN
    RAISE EXCEPTION 'not authorized to start production' USING ERRCODE = '42501';
  END IF;

  -- 2. Check if a NON-REVERSED batch already exists
  --    Reversed batches do not block a new production start.
  SELECT id, status, warning_summary INTO v_batch_id, v_batch_status, v_warnings
  FROM public.quote_production_stock_deductions
  WHERE quote_id = p_quote_id AND status IS DISTINCT FROM 'reversed'
  LIMIT 1;

  IF FOUND THEN
    -- Idempotent return: active batch already exists.
    --
    -- PR 2 BLOCKER FIX (3a): the status update below writes
    -- quotes.status = 'en_produccion'. The new PR-2 trigger
    -- reject_direct_en_produccion_writes blocks this UNLESS the
    -- transaction-local guard is set. We set it here, after the
    -- function's own role/workshop/cross-workshop checks, so the
    -- trigger accepts the write. The guard is SET LOCAL (transaction-
    -- local) — it auto-reverts on COMMIT/ROLLBACK.
    SET LOCAL app.production_order_write_context = 'rpc';

    SELECT jsonb_build_object(
      'batch_id', id,
      'status', status,
      'movements_created', 0,
      'lines_skipped', 0,
      'shortage_detected', shortage_detected,
      'snapshot_incomplete', snapshot_incomplete,
      'warning_summary', warning_summary,
      'note', 'batch already exists – no new movements created'
    ) INTO v_result
    FROM public.quote_production_stock_deductions
    WHERE id = v_batch_id;

    -- Also update quote status if not already en_produccion
    IF v_quote_status <> 'en_produccion' THEN
      UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;
    END IF;

    RETURN v_result;
  END IF;

  -- 2b. Re-initialize v_warnings for the no-batch branch (Bug 1 fix
  -- from the prior PR 6 fix; preserved here).
  v_warnings := '[]'::jsonb;

  -- 3. Check existing request_id for idempotency (if provided and we find a match)
  IF p_request_id IS NOT NULL THEN
    SELECT id, status INTO v_batch_id, v_batch_status
    FROM public.quote_production_stock_deductions
    WHERE workshop_id = v_workshop_id AND request_id = p_request_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'batch_id', v_batch_id,
        'status', v_batch_status,
        'movements_created', 0,
        'lines_skipped', 0,
        'shortage_detected', false,
        'snapshot_incomplete', false,
        'warning_summary', '[]'::jsonb,
        'note', 'batch already exists for this request_id'
      );
    END IF;
  END IF;

  -- 4. Require aprobado status
  IF v_quote_status IS DISTINCT FROM 'aprobado' THEN
    RAISE EXCEPTION 'Quote must be approved before production can start'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Read auto_stock_discount setting
  SELECT COALESCE(auto_stock_discount, false) INTO v_auto_discount
  FROM public.workshop_settings
  WHERE workshop_id = v_workshop_id;

  -- 6. If setting is off: just update status, no batch/movements.
  --
  -- PR 2 BLOCKER FIX (3b): this status update is one of the three
  -- en_produccion writes the new trigger guards. Setting the guard
  -- here (after the function's own authorization) lets the trigger
  -- accept the write. The guard is SET LOCAL — auto-reverts on
  -- COMMIT/ROLLBACK.
  IF NOT v_auto_discount THEN
    SET LOCAL app.production_order_write_context = 'rpc';
    UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;

    RETURN jsonb_build_object(
      'batch_id', NULL,
      'status', 'completed',
      'movements_created', 0,
      'lines_skipped', 0,
      'shortage_detected', false,
      'snapshot_incomplete', false,
      'warning_summary', '[]'::jsonb,
      'note', 'auto_discount disabled – no movements created'
    );
  END IF;

  -- 7. If setting is on, require confirmation
  IF NOT p_confirm_deduction THEN
    RAISE EXCEPTION 'Confirmation required for automatic stock deduction'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Insert the production deduction batch first
  INSERT INTO public.quote_production_stock_deductions (
    workshop_id, quote_id, request_id, status,
    auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
    warning_summary, confirmed_by
  ) VALUES (
    v_workshop_id, p_quote_id, p_request_id, 'completed',
    v_auto_discount, false, false,
    '[]'::jsonb, auth.uid()
  )
  RETURNING id INTO v_batch_id;

  -- 9. Iterate over complete approved BOM lines with valid quantities
  FOR v_bom_line IN
    SELECT abl.*
    FROM public.quote_approved_bom_lines abl
    WHERE abl.quote_id = p_quote_id
    ORDER BY abl.line_number
  LOOP
    -- Check completeness
    IF NOT v_bom_line.is_complete
       OR v_bom_line.deduction_quantity IS NULL
       OR v_bom_line.material_id IS NULL
    THEN
      v_skipped_count := v_skipped_count + 1;
      v_snapshot_incomplete := true;

      -- Add warning to batch summary
      v_warnings := v_warnings || jsonb_build_object(
        'line_number', v_bom_line.line_number,
        'material_name', v_bom_line.material_name,
        'warning_code', COALESCE(v_bom_line.warning_code, 'incomplete_line'),
        'is_complete', v_bom_line.is_complete,
        'deduction_quantity', v_bom_line.deduction_quantity
      );

      CONTINUE;
    END IF;

    -- Lock material row and read current stock
    SELECT m.stock INTO v_material_stock
    FROM public.materials m
    WHERE m.id = v_bom_line.material_id
      AND m.workshop_id = v_workshop_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_skipped_count := v_skipped_count + 1;
      v_warnings := v_warnings || jsonb_build_object(
        'line_number', v_bom_line.line_number,
        'material_name', v_bom_line.material_name,
        'warning_code', 'material_not_found'
      );
      CONTINUE;
    END IF;

    -- Check for shortage
    IF v_material_stock < v_bom_line.deduction_quantity THEN
      v_shortage_detected := true;
    END IF;

    -- Update stock (allows negative for this controlled path)
    UPDATE public.materials
    SET stock = stock - v_bom_line.deduction_quantity,
        updated_at = now()
    WHERE id = v_bom_line.material_id
      AND workshop_id = v_workshop_id;

    -- Insert stock movement
    INSERT INTO public.stock_movements (
      workshop_id, material_id, delta, reason, note,
      quote_id, production_deduction_id, created_by
    ) VALUES (
      v_workshop_id,
      v_bom_line.material_id,
      -v_bom_line.deduction_quantity,
      'consumo_produccion',
      format('Inicio de producción presupuesto %s', v_quote_number),
      p_quote_id,
      v_batch_id,
      auth.uid()
    );

    v_movement_count := v_movement_count + 1;
  END LOOP;

  -- 10. Update the batch with final warning/shortage info
  UPDATE public.quote_production_stock_deductions
  SET
    snapshot_incomplete = v_snapshot_incomplete,
    shortage_detected = v_shortage_detected,
    warning_summary = v_warnings
  WHERE id = v_batch_id;

  -- 11. Update quote status.
  --
  -- PR 2 BLOCKER FIX (3c): same as 3a/3b. Set the guard so the new
  -- trigger accepts this final en_produccion write. Function's own
  -- role/workshop/cross-workshop checks have already passed.
  SET LOCAL app.production_order_write_context = 'rpc';
  UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;

  -- 12. Return result
  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'status', 'completed',
    'movements_created', v_movement_count,
    'lines_skipped', v_skipped_count,
    'shortage_detected', v_shortage_detected,
    'snapshot_incomplete', v_snapshot_incomplete,
    'warning_summary', v_warnings
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Ensure atomic rollback: if any part fails, the transaction rolls back
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.start_quote_production IS
  'Atomically starts production: validates status, checks auto_discount, '
  'deducts confirmed complete BOM lines (allowing negative stock for this path), '
  'inserts consumo_produccion movements, and creates one batch per quote. '
  'Idempotent: existing non-reversed batch returns existing result without duplicates. '
  'Reversed batches do not block a new production start. '
  'PR 2 blocker fix: this function now SET LOCALs '
  'app.production_order_write_context = ''rpc'' around its three writes of '
  'quotes.status = ''en_produccion'' (idempotent branch, auto_discount-disabled '
  'branch, and the final happy-path write) so the new PR-2 trigger '
  'reject_direct_en_produccion_writes accepts them. The function''s own role, '
  'workshop, and cross-workshop authorization checks run first; the guard is '
  'the explicit, transaction-local, opt-in signal that this authenticated write '
  'came from a trusted function body. SET LOCAL is transaction-local — the '
  'guard auto-reverts on COMMIT/ROLLBACK and never leaks to subsequent '
  'transactions on the same connection.';
