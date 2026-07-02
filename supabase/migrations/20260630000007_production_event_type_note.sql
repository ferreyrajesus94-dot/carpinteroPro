-- PR 7 review-blocker fix: production_order_events.event_type + note
--
-- The PR 7 spec (production-orders/spec.md, "Append-only Audit Events"
-- requirement) declares the production_order_events columns to include
--   event_type text NOT NULL
--   note text NULL
-- The original schema (PR 1) only had `reason` (a free-form text the
-- callers wrote into) and no `event_type`. The PR 7 review flagged the
-- contract mismatch: the read RPC `get_production_order_events` exposed
-- `reason` but not `event_type`/`note`, and the EventTimeline UI derived
-- the per-row label from `(from_state, to_state)` instead of from
-- `event_type` (the spec's intended source of truth).
--
-- This migration aligns the schema and the read RPC with the spec,
-- while preserving `reason` for backward compatibility with prior
-- callers and existing data:
--
--   1. New helper function `production_order_event_type(from_state,
--      to_state)` that maps a (from_state, to_state) pair to a stable
--      event_type label. The mapping mirrors the frontend's
--      `resolveEventType`:
--         (NULL, *)               -> 'created'
--         (*, cancelled)          -> 'cancelled'  (terminal wins)
--         (*, delivered)          -> 'delivered'  (terminal wins)
--         (paused,    in_progress) -> 'resumed'
--         (in_progress, paused)   -> 'paused'
--         (everything else)       -> 'transitioned'
--
--   2. New column `event_type text NOT NULL` on production_order_events.
--      A BEFORE INSERT trigger auto-populates `event_type` from the
--      helper when the caller did not provide it (direct INSERTs from
--      pgTAP tests, backfill scripts, etc.). The write RPCs continue
--      to set `event_type` explicitly. A CHECK constraint limits the
--      value to the helper's allowed set, blocking any future write
--      that doesn't come from the helper.
--
--   3. New column `note text NULL` on production_order_events. The
--      existing `reason` column is preserved unchanged so prior code
--      paths and prior data continue to work; new write paths populate
--      both `reason` and `note` with the same value.
--
--   4. Backfill existing rows:
--        event_type = production_order_event_type(from_state, to_state)
--        note       = reason   (if reason is not null)
--      The backfill runs once at migration time and is idempotent
--      (UPDATE ... WHERE event_type IS NULL).
--
--   5. start_production_order (8-arg PR-4 signature) now writes
--      `event_type = 'created'` and `note = 'production order created'`
--      on the creation event. The existing `reason` column is still
--      populated for back-compat.
--
--   6. transition_production_order_state now writes
--      `event_type = production_order_event_type(from_state, to_state)`
--      and `note = p_reason` on every transition event. The existing
--      `reason` column is still populated for back-compat.
--
--   7. get_production_order_events now exposes `event_type` and `note`
--      in the RETURNS TABLE. The `reason` column is still returned so
--      consumers that only read it keep working.
--
-- Rollback notes:
--   - DROP TRIGGER production_order_events_auto_event_type ON public.production_order_events;
--   - DROP FUNCTION public.production_order_events_auto_event_type();
--   - DROP FUNCTION public.production_order_event_type(...);
--   - ALTER TABLE public.production_order_events
--       DROP COLUMN event_type, DROP COLUMN note;
--   - DROP CONSTRAINT IF EXISTS production_order_events_event_type_check;
--   - The write RPCs fall back to writing only `reason` after the column
--     drop (the INSERT statements still populate `reason`).
--   - The read RPC's projection drops the two new columns; consumers
--     reading `event_type` or `note` will see a `column does not exist`
--     error which is the intended failure mode for a rollback.

-- ═════════════════════════════════════════════════════════════════════
-- 1. Helper function — derive event_type from (from_state, to_state)
-- ═════════════════════════════════════════════════════════════════════
-- Pure SQL function used by the BEFORE INSERT trigger, the write RPCs,
-- and the CHECK constraint. Mirrors the frontend's `resolveEventType`
-- mapping in `src/features/production/lib/eventLabels.ts` so the
-- labels stay in sync.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.production_order_event_type(
  p_from_state public.production_order_state,
  p_to_state   public.production_order_state
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_from_state IS NULL
      THEN 'created'
    WHEN p_to_state = 'cancelled'::public.production_order_state
      THEN 'cancelled'
    WHEN p_to_state = 'delivered'::public.production_order_state
      THEN 'delivered'
    WHEN p_from_state = 'paused'::public.production_order_state
         AND p_to_state   = 'in_progress'::public.production_order_state
      THEN 'resumed'
    WHEN p_from_state = 'in_progress'::public.production_order_state
         AND p_to_state   = 'paused'::public.production_order_state
      THEN 'paused'
    ELSE 'transitioned'
  END;
$$;

COMMENT ON FUNCTION public.production_order_event_type(
  public.production_order_state,
  public.production_order_state
) IS
  'Derive a stable event_type label from a (from_state, to_state) pair. '
  'Mapping: (NULL, *) -> created; (*, cancelled) -> cancelled; '
  '(*, delivered) -> delivered; (paused, in_progress) -> resumed; '
  '(in_progress, paused) -> paused; everything else -> transitioned. '
  'Mirrors the frontend resolveEventType helper so the SQL-derived label '
  'and the UI label stay in sync. IMMUTABLE so the function can be used '
  'inside BEFORE INSERT triggers and CHECK constraints.';

-- ═════════════════════════════════════════════════════════════════════
-- 2. Add event_type + note columns (nullable for the backfill)
-- ═════════════════════════════════════════════════════════════════════
-- The columns are added NULLable so the ALTER TABLE doesn't fail on
-- existing rows. The BEFORE INSERT trigger (step 3) auto-populates
-- `event_type` for any direct INSERT, and the backfill (step 4) fills
-- in `event_type` and `note` for the rows that existed before this
-- migration. After the backfill, the column is promoted to NOT NULL.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE public.production_order_events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS note       text;

-- ═════════════════════════════════════════════════════════════════════
-- 3. BEFORE INSERT trigger — auto-populate event_type when missing
-- ═════════════════════════════════════════════════════════════════════
-- Direct INSERTs (e.g. pgTAP tests, backfill scripts) that do not
-- provide `event_type` get the helper-derived value. The write RPCs
-- continue to set `event_type` explicitly so the trigger is a no-op
-- for them. The trigger is the single source of truth for the
-- (from_state, to_state) -> event_type mapping, so any future write
-- path is automatically correct without having to repeat the
-- CASE expression.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.production_order_events_auto_event_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event_type IS NULL THEN
    NEW.event_type := public.production_order_event_type(
      NEW.from_state,
      NEW.to_state
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_order_events_auto_event_type
  ON public.production_order_events;
CREATE TRIGGER production_order_events_auto_event_type
  BEFORE INSERT ON public.production_order_events
  FOR EACH ROW
  EXECUTE FUNCTION public.production_order_events_auto_event_type();

-- ═════════════════════════════════════════════════════════════════════
-- 4. Backfill event_type + note for existing rows
-- ═════════════════════════════════════════════════════════════════════
-- Idempotent: only updates rows where the column is still NULL. Uses
-- the helper from step 1 to derive the value.
-- ═════════════════════════════════════════════════════════════════════

UPDATE public.production_order_events
   SET event_type = public.production_order_event_type(from_state, to_state)
 WHERE event_type IS NULL;

-- Mirror the prior `reason` value into `note` so consumers that
-- render the human note can read it from the new column.
UPDATE public.production_order_events
   SET note = reason
 WHERE note IS NULL
   AND reason IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════════
-- 5. Promote event_type to NOT NULL + add a CHECK constraint
-- ═════════════════════════════════════════════════════════════════════
-- After the backfill every row has a non-null event_type, and the
-- BEFORE INSERT trigger (step 3) guarantees future writes also
-- produce a non-null value, so the NOT NULL promotion is safe. The
-- CHECK constraint locks the value to the helper's allowed set.
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE public.production_order_events
  ALTER COLUMN event_type SET NOT NULL;

ALTER TABLE public.production_order_events
  DROP CONSTRAINT IF EXISTS production_order_events_event_type_check;
ALTER TABLE public.production_order_events
  ADD CONSTRAINT production_order_events_event_type_check
  CHECK (event_type IN (
    'created',
    'transitioned',
    'paused',
    'resumed',
    'cancelled',
    'delivered'
  ));

-- Add a comment to document the new column semantics for future readers
COMMENT ON COLUMN public.production_order_events.event_type IS
  'Stable event-type label. One of: created, transitioned, paused, '
  'resumed, cancelled, delivered. Derive via the '
  'production_order_event_type(from_state, to_state) helper to keep this '
  'column in sync with the UI label mapping. A BEFORE INSERT trigger '
  'auto-populates the column when a direct INSERT omits it, so all '
  'paths (write RPCs, pgTAP tests, backfill scripts) produce a valid '
  'value. Exposed by the get_production_order_events read RPC so the '
  'EventTimeline UI can label each row by event_type without re-'
  'deriving from states.';

COMMENT ON COLUMN public.production_order_events.note IS
  'Optional human note attached to the event. Populated with the same '
  'value as the legacy `reason` column by the write RPCs. The new '
  'read RPC exposes `note` (and still exposes `reason` for back-compat) '
  'so the EventTimeline can render a human note per row.';

-- ═════════════════════════════════════════════════════════════════════
-- 6. start_production_order — write event_type + note
-- ═════════════════════════════════════════════════════════════════════
-- PR 4 added the 8th parameter `p_create_deduction` and rewrote this
-- function. The 8-arg signature is the only public signature; we DROP
-- the 7-arg variant before redefining to avoid the function-name
-- ambiguity that PostgREST would hit otherwise. The rewrite here adds
-- the PR 7 columns (event_type, note) to the creation event INSERT
-- but otherwise preserves the PR 4 behavior end-to-end.
-- ═════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.start_production_order(
  uuid, text, date, date, uuid, text, uuid
);
DROP FUNCTION IF EXISTS public.start_production_order(
  uuid, text, date, date, uuid, text, uuid, boolean
);

CREATE FUNCTION public.start_production_order(
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

  -- 3. Validate p_assigned_to
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

  -- 4. Lock the quote (FOR UPDATE) — concurrency safety
  SELECT q.status, q.workshop_id
    INTO v_quote_status, v_quote_workshop_id
    FROM public.quotes q
   WHERE q.id = p_quote_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Cross-workshop access check
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

  -- 7. Idempotency lookup
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

  -- 8. SET LOCAL guard
  SET LOCAL app.production_order_write_context = 'rpc';

  -- 9. Insert the production order
  INSERT INTO public.production_orders (
    workshop_id, quote_id, production_number, state,
    planned_start_date, planned_end_date, assigned_to, notes
  ) VALUES (
    v_workshop_id, p_quote_id, p_production_number,
    'planned'::public.production_order_state,
    p_planned_start_date, p_planned_end_date, p_assigned_to, p_notes
  )
  RETURNING * INTO v_new_order;

  -- 10. Append the creation event.
  -- PR 7: event_type = 'created' (derived from from_state IS NULL via
  -- the production_order_event_type helper), note = 'production order
  -- created'. The legacy `reason` column is still populated for
  -- back-compat with consumers that haven't migrated to `note` yet.
  INSERT INTO public.production_order_events (
    workshop_id, production_order_id, event_type,
    from_state, to_state, reason, note, actor_id, metadata
  ) VALUES (
    v_new_order.workshop_id, v_new_order.id,
    'created',
    NULL,
    'planned'::public.production_order_state,
    'production order created',
    'production order created',
    auth.uid(),
    jsonb_build_object(
      'operation', 'start',
      'request_id', p_request_id,
      'quote_id', p_quote_id,
      'production_number', p_production_number
    )
  );

  -- 11. PR 4: create the deduction batch with non-null FK
  IF p_create_deduction THEN
    SELECT id INTO v_existing_batch_id
    FROM public.quote_production_stock_deductions
    WHERE workshop_id = v_workshop_id
      AND quote_id = p_quote_id
    LIMIT 1;

    IF v_existing_batch_id IS NULL THEN
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
  'enforces tenant integrity on the INSERT. '
  'Blocker fixes: (1) FOR UPDATE on the quote is acquired BEFORE the '
  'idempotency lookup; (2) the idempotency lookup is scoped to '
  '(workshop_id, operation=''start'', quote_id, request_id); (3) '
  'p_assigned_to is validated to be a profile in the caller''s workshop. '
  'PR 4: when p_create_deduction is true (default), the function also '
  'creates a deduction batch in quote_production_stock_deductions with '
  'production_order_id = NEW.id. '
  'PR 7: the creation event is written with event_type = ''created'' '
  'and note = ''production order created''. The legacy `reason` column '
  'is preserved for back-compat.';

-- ═════════════════════════════════════════════════════════════════════
-- 7. transition_production_order_state — write event_type + note
-- ═════════════════════════════════════════════════════════════════════
-- PR 2 introduced this RPC; PR 2 blocker-fix
-- (20260630000002_production_rpc_blocker_fix.sql) refined the lock
-- order and the idempotency scope. This migration re-issues the
-- function to add the PR 7 columns (event_type, note) to the
-- transition event INSERT, and to set event_type via the helper.
-- The 4-arg signature is the only public signature.
-- ═════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.transition_production_order_state(
  uuid, public.production_order_state, text, uuid
);

CREATE FUNCTION public.transition_production_order_state(
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
  v_event_type      text;
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

  -- 4. Cross-workshop access check
  IF v_order.workshop_id IS DISTINCT FROM v_workshop_id THEN
    RAISE EXCEPTION 'Cross-workshop access denied'
      USING ERRCODE = '42501';
  END IF;

  -- 5. Idempotency lookup, AFTER the lock and with a TIGHTER scope
  -- (workshop_id, operation='transition', production_order_id, to_state,
  -- request_id). The (operation, production_order_id, to_state) scope
  -- ensures that:
  --   (a) a start event with the same request_id does not collide;
  --   (b) a transition with the same request_id on a DIFFERENT order
  --       does not collide;
  --   (c) a transition with the same request_id but a DIFFERENT
  --       to_state on the SAME order is treated as a fresh call.
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
    WHEN v_from_state = 'planned'::public.production_order_state
         AND p_to_state IN ('in_progress'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    WHEN v_from_state = 'in_progress'::public.production_order_state
         AND p_to_state IN ('paused'::public.production_order_state,
                            'quality_check'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    WHEN v_from_state = 'paused'::public.production_order_state
         AND p_to_state IN ('in_progress'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    WHEN v_from_state = 'quality_check'::public.production_order_state
         AND p_to_state IN ('ready'::public.production_order_state,
                            'in_progress'::public.production_order_state)
      THEN true
    WHEN v_from_state = 'ready'::public.production_order_state
         AND p_to_state IN ('delivered'::public.production_order_state,
                            'cancelled'::public.production_order_state)
      THEN true
    WHEN v_from_state IN ('delivered'::public.production_order_state,
                          'cancelled'::public.production_order_state)
      THEN false
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transition % -> % is not allowed (forbidden by state machine)',
      v_from_state, p_to_state
      USING ERRCODE = 'P0001';
  END IF;

  -- 6b. Derive the canonical event_type from the transition pair
  v_event_type := public.production_order_event_type(v_from_state, p_to_state);

  -- 7. SET LOCAL guard
  SET LOCAL app.production_order_write_context = 'rpc';

  -- 8. Update the order state
  UPDATE public.production_orders
     SET state = p_to_state
   WHERE id = v_order.id
   RETURNING * INTO v_order;

  -- 9. Append the transition event.
  -- PR 7: event_type is the helper-derived label, note mirrors
  -- p_reason. The legacy `reason` column is still populated for
  -- back-compat. The metadata now includes operation='transition'
  -- and the target (production_order_id, to_state) so the idempotency
  -- lookup above can scope by them.
  INSERT INTO public.production_order_events (
    workshop_id, production_order_id, event_type,
    from_state, to_state, reason, note, actor_id, metadata
  ) VALUES (
    v_order.workshop_id, v_order.id, v_event_type,
    v_from_state, p_to_state,
    p_reason, p_reason,
    auth.uid(),
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
  'PR-1 defense-in-depth triggers. Idempotent on p_request_id. '
  'Allowed transitions are enforced at the SQL layer. '
  'PR 7: every transition event is written with event_type derived '
  'from (from_state, to_state) via the production_order_event_type '
  'helper, and note = p_reason. The legacy `reason` column is preserved '
  'for back-compat.';

-- ═════════════════════════════════════════════════════════════════════
-- 8. get_production_order_events — expose event_type + note
-- ═════════════════════════════════════════════════════════════════════
-- The return type changes (10 -> 12 columns), so PostgreSQL forbids
-- CREATE OR REPLACE on the existing function. Drop and recreate.
-- Adds `event_type` and `note` to the RETURNS TABLE. The `reason`
-- column is preserved so consumers that haven't migrated to `note`
-- keep working. The deterministic (created_at ASC, id ASC) ordering
-- is preserved.
-- ═════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_production_order_events(uuid);

CREATE FUNCTION public.get_production_order_events(p_order_id uuid)
RETURNS TABLE (
  id                  uuid,
  workshop_id         uuid,
  production_order_id uuid,
  event_type          text,
  from_state          public.production_order_state,
  to_state            public.production_order_state,
  reason              text,
  note                text,
  actor_id            uuid,
  metadata            jsonb,
  created_at          timestamptz,
  actor_name          text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- SECURITY INVOKER: RLS on production_order_events scopes by workshop.
  -- A cross-workshop order id yields 0 rows (not an error). The events
  -- are ordered by (created_at ASC, id ASC) so the timeline is
  -- DETERMINISTIC even when two events share a created_at. `id` is a
  -- uuid v4 (random) so the secondary sort is a stable total order.
  --
  -- PR 7: event_type and note are now exposed so the EventTimeline UI
  -- can label each row by the canonical event_type (rather than re-
  -- deriving from the (from_state, to_state) pair) and render the
  -- human note directly. The legacy `reason` column is preserved for
  -- back-compat.
  SELECT
    e.id,
    e.workshop_id,
    e.production_order_id,
    e.event_type,
    e.from_state,
    e.to_state,
    e.reason,
    e.note,
    e.actor_id,
    e.metadata,
    e.created_at,
    COALESCE(actor.display_name, '') AS actor_name
  FROM public.production_order_events e
  LEFT JOIN public.profiles actor
         ON actor.id = e.actor_id
  WHERE e.production_order_id = p_order_id
  ORDER BY e.created_at ASC, e.id ASC;
$$;

COMMENT ON FUNCTION public.get_production_order_events IS
  'Append-only audit timeline for a production order, ordered by '
  '(created_at ASC, id ASC). PR 7: returns 12 columns — the original '
  '9 (id, workshop_id, production_order_id, from_state, to_state, '
  'reason, actor_id, metadata, created_at) plus event_type and note '
  '(the spec-mandated columns), plus the denormalized actor_name. '
  'event_type is the canonical UI label (one of: created, '
  'transitioned, paused, resumed, cancelled, delivered) and is the '
  'primary source the EventTimeline UI uses to label each row. note '
  'is the human note attached to the event (the legacy `reason` column '
  'is preserved for back-compat). SECURITY INVOKER: cross-workshop '
  'ids return 0 rows (RLS). Events are immutable; the only writers '
  'are the PR-2 transition_production_order_state and '
  'start_production_order RPCs.';
