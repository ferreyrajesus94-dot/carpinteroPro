-- PR 2: Production Order write RPCs
--
-- Implements the two SECURITY DEFINER write RPCs that own the
-- production_orders state machine:
--   1. start_production_order
--   2. transition_production_order_state
-- Plus a defense-in-depth trigger on `quotes` that rejects direct
-- authenticated writes of `status = 'en_produccion'`. The new flow
-- projects en_produccion from production_orders at read time
-- (PR 3 read RPCs), so direct writes are forbidden.
--
-- Critical contract (from PR 1 verify):
--   - RPCs run as SECURITY DEFINER.
--   - RPCs perform their own role + workshop checks BEFORE setting
--     the transaction-local guard `app.production_order_write_context = 'rpc'`.
--     The guard is the bridge between RLS (no INSERT/UPDATE/DELETE policy)
--     and the PR-1 defense-in-depth triggers.
--   - Guard is set via SET LOCAL (transaction-local) — NEVER
--     set_config(..., false) (session-local would leak across transactions).
--   - Direct writes of `quotes.status = 'en_produccion'` are rejected
--     for authenticated users. Service role (auth.uid() IS NULL) bypasses
--     for backfill / migration / test seeding. The internal guard path
--     is also allowed (a future RPC that legitimately needs to set
--     en_produccion can set the guard after its own role/workshop checks).
--
-- Allowed state-machine transitions (PR 2 contract):
--   planned          -> in_progress | cancelled
--   in_progress      -> paused | quality_check | cancelled
--   paused           -> in_progress | cancelled
--   quality_check    -> ready | in_progress
--   ready            -> delivered | cancelled
--   delivered        -> (terminal — no transitions allowed)
--   cancelled        -> (terminal — no transitions allowed)
--
-- Idempotency:
--   Both RPCs accept p_request_id (uuid). On retry with the same
--   request_id, the RPC returns the existing order without writing
--   a duplicate event. The request_id is stored in
--   production_order_events.metadata->>'request_id'.
--
-- Depends on:
--   - PR 1 migration (20260630_production_orders.sql): tables, RLS,
--     defense-in-depth triggers with positive internal guard, and
--     same-workshop FK check triggers.
--   - public.profiles (workshop_id, workshop_role).
--   - public.quotes (FK target for production_orders.quote_id).
--   - public.set_updated_at() (trigger function from 0001_init.sql).
--
-- Rollback notes:
--   - DROP FUNCTION public.start_production_order;
--   - DROP FUNCTION public.transition_production_order_state;
--   - DROP TRIGGER reject_direct_en_produccion_writes ON public.quotes;
--   - DROP FUNCTION public.prevent_direct_en_produccion_writes();
--   - Leave tables in place; the new RPCs are the only sanctioned
--     writer. After dropping the RPCs, no further writes are possible
--     until they are restored.

-- ═════════════════════════════════════════════════════════════════════
-- 1. start_production_order RPC
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
  v_caller_workshop_id  uuid;
  v_existing_event      public.production_order_events%ROWTYPE;
  v_existing_order      public.production_orders%ROWTYPE;
  v_new_order           public.production_orders%ROWTYPE;
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

  -- 3. Idempotency check FIRST: if an event already exists for this
  -- request_id, return the existing order without re-creating anything.
  -- This is the safe-by-default path: a network retry with the same
  -- request_id never produces a duplicate order or event.
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing_event
      FROM public.production_order_events
     WHERE workshop_id = v_workshop_id
       AND metadata->>'request_id' = p_request_id::text
     LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_existing_order
        FROM public.production_orders
       WHERE id = v_existing_event.production_order_id;
      RETURN v_existing_order;
    END IF;
  END IF;

  -- 4. Lock the quote and verify it's 'aprobado' + same workshop
  SELECT q.status, q.workshop_id
    INTO v_quote_status, v_quote_workshop_id
    FROM public.quotes q
   WHERE q.id = p_quote_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_quote_status IS DISTINCT FROM 'aprobado'::public.quote_status THEN
    RAISE EXCEPTION 'Quote must be in aprobado status (was %); cannot start production',
      v_quote_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4b. Cross-workshop access check (defense in depth — the FK check
  -- trigger fires on INSERT and would catch a cross-tenant attempt
  -- with 23514, but the RPC is responsible for tenant isolation on
  -- read/write and must raise the authorization error 42501 explicitly
  -- so the caller can distinguish "you cannot access this quote" from
  -- "the quote's tenant integrity is broken").
  -- Re-derive the caller's workshop from auth.uid() (cheap; uses the
  -- same profile lookup as step 1) and compare to the quote's
  -- workshop.
  SELECT p.workshop_id INTO v_caller_workshop_id
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF v_caller_workshop_id IS DISTINCT FROM v_quote_workshop_id THEN
    RAISE EXCEPTION 'Cross-workshop access denied'
      USING ERRCODE = '42501';
  END IF;

  -- The same-workshop FK check trigger
  -- (check_production_order_quote_same_workshop) handles the tenant
  -- integrity on the INSERT below. We don't need an explicit
  -- workshop check there: the trigger fires on INSERT and rejects
  -- cross-tenant attempts with 23514.

  -- 5. SET LOCAL guard AFTER role/workshop/quote checks pass
  -- SET LOCAL is transaction-local: it auto-reverts on COMMIT/ROLLBACK
  -- and never leaks to subsequent transactions on the same connection.
  -- This is the bridge between RLS (no INSERT policy) and the
  -- SECURITY DEFINER RPC body. The PR-1 trigger accepts the write
  -- only when this guard is exactly 'rpc' (or auth.uid() IS NULL).
  SET LOCAL app.production_order_write_context = 'rpc';

  -- 6. Insert the production order in state='planned'
  INSERT INTO public.production_orders (
    workshop_id, quote_id, production_number, state,
    planned_start_date, planned_end_date, assigned_to, notes
  ) VALUES (
    v_workshop_id, p_quote_id, p_production_number,
    'planned'::public.production_order_state,
    p_planned_start_date, p_planned_end_date, p_assigned_to, p_notes
  )
  RETURNING * INTO v_new_order;

  -- 7. Append the creation event (also gated by the same SET LOCAL guard).
  -- from_state is NULL because the order is being created (not transitioned).
  INSERT INTO public.production_order_events (
    workshop_id, production_order_id, from_state, to_state,
    reason, actor_id, metadata
  ) VALUES (
    v_new_order.workshop_id, v_new_order.id, NULL,
    'planned'::public.production_order_state,
    'production order created',
    auth.uid(),
    jsonb_build_object(
      'request_id', p_request_id,
      'production_number', p_production_number
    )
  );

  -- 8. Return the new order
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
  'resolve to a quote in the same workshop.';

-- ═════════════════════════════════════════════════════════════════════
-- 2. transition_production_order_state RPC
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

  -- 3. Idempotency check FIRST: if an event already exists for this
  -- request_id, return the current order without re-applying the
  -- transition. Safe by default for network retries.
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing_event
      FROM public.production_order_events
     WHERE workshop_id = v_workshop_id
       AND metadata->>'request_id' = p_request_id::text
     LIMIT 1;

    IF FOUND THEN
      SELECT * INTO v_existing_order
        FROM public.production_orders
       WHERE id = v_existing_event.production_order_id;
      RETURN v_existing_order;
    END IF;
  END IF;

  -- 4. Lock the order with FOR UPDATE
  SELECT * INTO v_order
    FROM public.production_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order % not found', p_order_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Cross-workshop access check (defense in depth — the FK check
  -- trigger would not fire here because the parent is in the same
  -- workshop, but the RPC is responsible for tenant isolation on
  -- read/write).
  IF v_order.workshop_id IS DISTINCT FROM v_workshop_id THEN
    RAISE EXCEPTION 'Cross-workshop access denied'
      USING ERRCODE = '42501';
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

  -- 9. Append the transition event
  INSERT INTO public.production_order_events (
    workshop_id, production_order_id, from_state, to_state,
    reason, actor_id, metadata
  ) VALUES (
    v_order.workshop_id, v_order.id, v_from_state, p_to_state,
    p_reason, auth.uid(),
    jsonb_build_object('request_id', p_request_id)
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
  'ready->delivered|cancelled; delivered and cancelled are terminal.';

-- ═════════════════════════════════════════════════════════════════════
-- 3. Direct-write rejection on quotes.status = 'en_produccion'
--
-- The new flow projects en_produccion from production_orders at read
-- time (PR 3 read RPC + projection). Direct writes of en_produccion to
-- quotes.status are forbidden for authenticated users. The trigger:
--   - Allows service role (auth.uid() IS NULL) for backfill/migration
--     and pgTAP test seeding.
--   - Allows the transaction-local guard path: a future RPC that
--     legitimately needs to set en_produccion can set
--     app.production_order_write_context = 'rpc' after its own
--     role/workshop checks (same pattern as the production_orders
--     guards).
--   - Rejects authenticated INSERT with status = 'en_produccion'.
--   - Rejects authenticated UPDATE that transitions TO en_produccion
--     from any other status (including NULL/presupuesto). Updates FROM
--     en_produccion to other statuses are allowed (the projection will
--     re-evaluate).
--
-- This trigger does NOT block other status transitions (presupuesto
-- -> enviado -> aprobado, aprobado -> entregado, etc.) — only the
-- INTO-en_produccion direction. The legacy start_quote_production
-- function (PR 3-4 batch) writes en_produccion to quotes.status; in
-- PR 9 it will be wrapped to use start_production_order instead and
-- will no longer touch quotes.status directly.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_direct_en_produccion_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_write_context text;
BEGIN
  -- Auth gate: authenticated (auth.uid() IS NOT NULL) writes of
  -- en_produccion are rejected UNLESS the transaction-local guard
  -- is exactly 'rpc'. Service role (auth.uid() IS NULL) bypasses.
  IF auth.uid() IS NOT NULL THEN
    v_write_context := current_setting('app.production_order_write_context', true);
    IF v_write_context IS DISTINCT FROM 'rpc' THEN
      IF TG_OP = 'INSERT' AND NEW.status = 'en_produccion'::public.quote_status THEN
        RAISE EXCEPTION 'Direct INSERT of quotes.status = en_produccion is rejected; the production status is derived from production_orders at read time' USING ERRCODE = '42501';
      END IF;
      IF TG_OP = 'UPDATE' AND NEW.status = 'en_produccion'::public.quote_status AND OLD.status IS DISTINCT FROM 'en_produccion'::public.quote_status THEN
        RAISE EXCEPTION 'Direct UPDATE of quotes.status to en_produccion is rejected; the production status is derived from production_orders at read time' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_direct_en_produccion_writes ON public.quotes;
CREATE TRIGGER reject_direct_en_produccion_writes
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_direct_en_produccion_writes();

COMMENT ON FUNCTION public.prevent_direct_en_produccion_writes IS
  'Defense-in-depth trigger on the quotes table. Rejects direct '
  'authenticated writes of status = en_produccion. The new production '
  'flow projects en_produccion from production_orders at read time '
  '(see production-order-state-machine spec, "Quote Status Derivation" '
  'requirement), so direct writes are forbidden. Service role '
  '(auth.uid() IS NULL) bypasses for migration/backfill/pgTAP test '
  'seeding. The transaction-local guard '
  'app.production_order_write_context = ''rpc'' allows future RPCs '
  'that legitimately need to set en_produccion. Other status transitions '
  '(presupuesto -> enviado -> aprobado -> entregado, etc.) are unaffected.';

COMMENT ON TRIGGER reject_direct_en_produccion_writes ON public.quotes IS
  'Rejects direct authenticated writes of quotes.status = en_produccion. '
  'See prevent_direct_en_produccion_writes() for the full contract.';
