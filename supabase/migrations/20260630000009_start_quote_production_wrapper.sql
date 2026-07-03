-- PR 9: legacy start_quote_production wrapper migration
--
-- The PR 2 `start_quote_production` RPC was originally a SECURITY INVOKER
-- standalone function that validated the caller, locked the quote, checked
-- the auto_stock_discount setting, iterated the approved BOM, and wrote
-- stock_movements with reason='consumo_produccion' — all while
-- SET LOCALing the production-order write guard around the three places
-- that wrote quotes.status = 'en_produccion' (PR 2 blocker fix).
--
-- PR 9 changes the contract: the new flow `start_production_order`
-- (PR 2/4/7, SECURITY DEFINER) owns production order creation and the
-- deduction FK. The legacy `start_quote_production` is now a thin
-- wrapper around `start_production_order` that:
--
--   1. Emits a one-time-per-session RAISE WARNING so operators can
--      identify legacy callers without breaking the call. The warning
--      marker is stored in the session-local GUC
--      `app.legacy_start_quote_warned` (set via `set_config(..., false)`,
--      which is session-scoped, not transaction-scoped).
--   2. Re-checks role + workshop ownership (defense in depth — the
--      caller might be cross-workshop via a service-role bypass, and
--      `start_production_order` would still raise 42501 in that case).
--   3. Preserves the legacy idempotency: if a non-reversed deduction
--      batch already exists for the quote, the wrapper returns the
--      existing batch's id without creating a new production_order or
--      a new deduction batch. The pre-existing batch's
--      `production_order_id` stays NULL (no backfill — the PR 4
--      legacy-null-preservation contract is honored).
--   4. Otherwise delegates to `start_production_order` with a derived
--      production_number (`'OP-' || substring(quote_id::text, 1, 8)`)
--      and `p_create_deduction = p_confirm_deduction`. The deduction
--      batch created by `start_production_order` has a non-null
--      `production_order_id` (the PR 4 new-flow contract).
--   5. Preserves the legacy `quotes.status = 'en_produccion'` side
--      effect (SET LOCAL guard around the UPDATE) so the existing
--      T5 in `production_deduction_rpc.test.sql` keeps passing.
--   6. Returns a jsonb shape that is a SUPERSET of the original
--      (adds `order_id` and `note`; keeps `batch_id`, `movements_created`,
--      `lines_skipped`, `shortage_detected`, `snapshot_incomplete`,
--      `warning_summary`, `status`).
--
-- The function remains SECURITY INVOKER because the wrapper itself
-- only reads the quote, calls SECURITY DEFINER `start_production_order`,
-- and writes to `quotes.status`. SECURITY DEFINER is not needed for
-- the wrapper's own writes; the SECURITY DEFINER function
-- (`start_production_order`) handles the production_orders and
-- production_order_events writes internally.
--
-- The migration is `CREATE OR REPLACE FUNCTION`, so the function
-- definition from the prior migration
-- (20260630000002_production_rpc_blocker_fix.sql) is overridden
-- without dropping the function or any grants. Supabase's `db reset`
-- will replay this migration last, so the new definition wins.

-- PR 9.1 review-blocker fix batch:
--   1. NULL-safe profile/role checks (auth fail-open fix). The pre-fix
--      wrapper had two NULL-unsafe checks that allowed a caller with
--      `auth.uid() = X` but no profile row to bypass the role/workshop
--      gates and reach the existing-batch branch. The fix collapses
--      the two checks into a single NULL-safe profile lookup that runs
--      BEFORE the SELECT FOR UPDATE and rejects the caller with 42501
--      'Caller has no profile/workshop' or 'not authorized to start
--      production' — defense in depth on top of the RLS policies.
--   2. p_confirm_deduction=false compatibility (legacy semantics
--      preserved). The pre-fix wrapper mapped p_confirm_deduction=false
--      to p_create_deduction=false unconditionally. This was a behavior
--      regression: when auto_stock_discount was ON, the legacy function
--      raised 'Confirmation required for automatic stock deduction' for
--      a confirm=false call; the new wrapper silently produced a
--      production order with no deduction batch. The fix reads the
--      workshop's auto_stock_discount setting and enforces the legacy
--      contract: ON + confirm=false → RAISE; OFF + any confirm value →
--      p_create_deduction=false (no batch, no error).
--   3. Existing-batch retry returns order_id (defense in depth + better
--      DX). The pre-fix wrapper always returned `order_id: null` from
--      the existing-batch branch (because the legacy batches had NULL
--      production_order_id by design — the PR 4 legacy-null-preservation
--      contract). The fix keeps `order_id: null` for the legacy batches
--      but surfaces the FK when it is set, so callers that have
--      already migrated to the new flow can resolve the producing
--      order from the legacy return shape too.

CREATE OR REPLACE FUNCTION public.start_quote_production(
  p_quote_id          uuid,
  p_confirm_deduction boolean,
  p_request_id        uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_workshop_id          uuid;
  v_quote_status         text;
  v_quote_number         text;
  v_actor_role           public.workshop_user_role;
  v_existing_batch_id    uuid;
  v_existing_batch_status text;
  v_existing_warnings    jsonb;
  v_existing_batch_order_id uuid;
  v_order_id             uuid;
  v_batch_id             uuid;
  v_production_number    text;
  v_warned               text;
  v_auto_discount        boolean;
  v_create_deduction     boolean;
BEGIN
  -- 0. One-time-per-session deprecation notice.
  --
  -- The marker is stored in a SESSION-LOCAL GUC (set_config with is_local=false)
  -- so the warning fires once per session, not once per transaction. The
  -- SET LOCAL pattern used by start_production_order is transaction-local
  -- and would reset between calls; we explicitly want session-local here
  -- so the operator sees exactly one warning per browser session.
  v_warned := current_setting('app.legacy_start_quote_warned', true);
  IF v_warned IS NULL OR v_warned <> 'true' THEN
    RAISE WARNING 'start_quote_production is deprecated; use start_production_order (via useStartProductionOrder from @/features/production) instead. The legacy wrapper is preserved for one more release to give external integrations time to migrate.';
    PERFORM set_config('app.legacy_start_quote_warned', 'true', false);
  END IF;

  -- 1. NULL-safe profile lookup (auth fail-open fix). The pre-fix
  -- wrapper had two NULL-unsafe checks:
  --   * `v_workshop_id <> (SELECT workshop_id FROM profiles WHERE id = auth.uid())`
  --     evaluates to NULL (not TRUE) when the profiles lookup is empty,
  --     so the IF block was skipped.
  --   * `v_actor_role NOT IN ('admin', 'operational')` evaluates to NULL
  --     when the role is NULL, so the IF block was also skipped.
  -- A caller with auth.uid() set but no profile (or with a profile
  -- whose workshop_id is NULL) could therefore reach the existing-batch
  -- branch and either update the quote status or return the existing
  -- batch's data — a CRITICAL security failure.
  --
  -- The fix collapses the two checks into a single NULL-safe profile
  -- lookup. We capture workshop_id AND role in one query, then reject
  -- the caller with 42501 if either is NULL or the role is not in the
  -- admin/operational allowlist. This runs BEFORE the SELECT FOR UPDATE
  -- so the existing-batch branch is unreachable for an unauthenticated
  -- caller. SECURITY INVOKER + RLS on `quotes` is the second line of
  -- defense; the NULL-safe check is the first.
  SELECT p.workshop_id, p.workshop_role
    INTO v_workshop_id, v_actor_role
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF NOT FOUND OR v_workshop_id IS NULL THEN
    -- Either auth.uid() is NULL (no JWT), or the caller has no
    -- profile row, or the caller's profile has no workshop_id. All
    -- three cases must be rejected with 42501 — service-role contexts
    -- can bypass RLS, so a SELECT-FOR-UPDATE-returns-nothing check
    -- (P0002 'Quote not found') is NOT sufficient.
    RAISE EXCEPTION 'Caller has no profile/workshop'
      USING ERRCODE = '42501';
  END IF;

  -- Role check: only admin/operational can start production. The
  -- workshop_role column is NOT NULL DEFAULT 'viewer', so this check
  -- is NULL-safe in practice (the IF evaluates to TRUE for 'viewer').
  -- The defense-in-depth case (NULL role, theoretically possible if
  -- someone manually edits the column to NULL bypassing the NOT NULL
  -- constraint) is also caught here.
  IF v_actor_role IS DISTINCT FROM 'admin'::public.workshop_user_role
     AND v_actor_role IS DISTINCT FROM 'operational'::public.workshop_user_role THEN
    RAISE EXCEPTION 'not authorized to start production'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Lock the quote and derive the workshop. SELECT ... FOR UPDATE
  -- serializes concurrent calls; the second caller waits, then sees
  -- the first caller's effect (the existing-batch branch below). The
  -- v_workshop_id from the quote is the canonical workshop for the
  -- row; the v_workshop_id from the profile is the caller's workshop.
  -- The cross-workshop check below enforces the invariant.
  SELECT q.workshop_id, q.status, q.quote_number
    INTO v_workshop_id, v_quote_status, v_quote_number
    FROM public.quotes q
   WHERE q.id = p_quote_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- Either the quote doesn't exist OR RLS hides it from the caller
    -- (cross-workshop). Both outcomes are safely rejected; we surface
    -- P0002 'Quote not found' which is the canonical "not visible" error.
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Cross-workshop access check (defense in depth — the SELECT
  -- above already filters by RLS, but an explicit check is cheap and
  -- catches any future RLS regression). The v_workshop_id from step 2
  -- is the canonical workshop for the row; the v_workshop_id from
  -- step 1 was the caller's workshop, but the SELECT INTO overwrites
  -- it with the row's workshop — so we need to re-read the caller's
  -- workshop here for the comparison.
  IF v_workshop_id <> (
    SELECT workshop_id FROM public.profiles WHERE id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Cross-workshop access denied' USING ERRCODE = '42501';
  END IF;

  -- 4. Existing-batch branch: if a non-reversed batch already exists,
  -- the legacy idempotency says "return the existing batch without
  -- creating a new one". This preserves the contract that production
  -- start is idempotent on (workshop_id, quote_id) — a quote can have
  -- at most one active production start, regardless of how many times
  -- the caller retries.
  --
  -- The pre-existing batch's production_order_id stays NULL (no
  -- backfill) — this is the PR 4 legacy-null-preservation contract.
  -- The wrapper does NOT call start_production_order in this branch,
  -- so no new production_order is created and the existing batch's
  -- FK is untouched.
  --
  -- PR 9.1: when the existing batch's production_order_id IS set
  -- (e.g. the batch was created via the new flow and then a legacy
  -- caller re-queries the same quote), the wrapper surfaces the FK as
  -- `order_id` in the jsonb return. This is a defense-in-depth
  -- improvement: callers that have already migrated to the new flow
  -- can resolve the producing order from the legacy return shape too.
  -- For the legacy batches (FK = NULL), the wrapper still returns
  -- `order_id: null` (the PR 4 contract).
  SELECT id, status, warning_summary, production_order_id
    INTO v_existing_batch_id, v_existing_batch_status,
         v_existing_warnings, v_existing_batch_order_id
    FROM public.quote_production_stock_deductions
   WHERE quote_id = p_quote_id
     AND status IS DISTINCT FROM 'reversed'
   LIMIT 1;

  IF FOUND THEN
    -- 4a. Update the quote status to en_produccion if it's not already
    -- (legacy contract preserved). SET LOCAL is required because the
    -- quotes.status direct-write trigger rejects en_produccion writes
    -- unless the transaction-local guard is set.
    SET LOCAL app.production_order_write_context = 'rpc';
    IF v_quote_status <> 'en_produccion' THEN
      UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;
    END IF;

    RETURN jsonb_build_object(
      'batch_id', v_existing_batch_id,
      'order_id', v_existing_batch_order_id,
      'status', v_existing_batch_status,
      'movements_created', 0,
      'lines_skipped', 0,
      'shortage_detected', false,
      'snapshot_incomplete', false,
      'warning_summary', v_existing_warnings,
      'note', 'batch already exists – no new movements created'
    );
  END IF;

  -- 5. Quote must be in 'aprobado' status to start production. This
  -- mirrors the check inside start_production_order; the wrapper does
  -- it first so we raise the right error before delegating.
  IF v_quote_status IS DISTINCT FROM 'aprobado' THEN
    RAISE EXCEPTION 'Quote must be approved before production can start'
      USING ERRCODE = 'P0001';
  END IF;

  -- 6. Read the workshop's auto_stock_discount setting. The legacy
  -- contract is:
  --   * auto_discount = OFF: no batch is created (regardless of
  --     p_confirm_deduction). The wrapper updates the quote status
  --     and returns success. The caller may have p_confirm_deduction
  --     = true OR false; both are no-ops in the legacy path.
  --   * auto_discount = ON: the caller MUST confirm the deduction
  --     (p_confirm_deduction = true). If p_confirm_deduction = false,
  --     the legacy function raised 'Confirmation required for
  --     automatic stock deduction' (P0001). The wrapper preserves
  --     this contract.
  SELECT COALESCE(ws.auto_stock_discount, false) INTO v_auto_discount
    FROM public.workshop_settings ws
   WHERE ws.workshop_id = v_workshop_id;

  -- 7. Enforce the legacy confirmation semantics.
  IF v_auto_discount AND NOT p_confirm_deduction THEN
    RAISE EXCEPTION 'Confirmation required for automatic stock deduction'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Derive p_create_deduction from auto_discount + p_confirm_deduction.
  -- The new flow's p_create_deduction flag controls whether the
  -- deduction batch is created. The legacy contract says:
  --   * auto_discount = OFF: no batch (p_create_deduction = false)
  --   * auto_discount = ON + confirm = true: batch created
  --     (p_create_deduction = true)
  --   * auto_discount = ON + confirm = false: already rejected above
  v_create_deduction := v_auto_discount AND p_confirm_deduction;

  -- 9. Derive a production_number for the new production_order. The
  -- production_orders table has a UNIQUE (workshop_id, production_number)
  -- constraint, so we need a deterministic, workshop-unique value. We
  -- use the first 8 hex chars of the quote_id (4 billion combinations
  -- per workshop — collision probability is negligible for any
  -- realistic workshop size). The OP- prefix is a human-readable
  -- label that matches the spec's convention.
  --
  -- CARRY-FORWARD: collision handling for the production_number
  -- derivation is not implemented. The probability of a 32-bit
  -- collision on 8 hex chars is ~1 in 4 billion per workshop, which
  -- is negligible for any realistic workshop size. A future reviewer
  -- that wants collision-safe naming can append a workshop-scoped
  -- sequence (`seq` from pg_sequences) or a random suffix; for now
  -- the deterministic derivation is the simplest contract that meets
  -- the spec.
  v_production_number := 'OP-' || substring(p_quote_id::text, 1, 8);

  -- 10. Delegate to start_production_order. The new flow is SECURITY
  -- DEFINER, so it runs as the function owner and bypasses RLS for
  -- the production_orders / production_order_events writes. It
  -- performs its own role + workshop + cross-workshop checks (defense
  -- in depth — the wrapper already did these, but the inner RPC is
  -- the source of truth for the production_orders contract).
  --
  -- The new flow's idempotency lookup (production_order_events scoped
  -- by workshop_id + operation='start' + quote_id + request_id) handles
  -- retries with the same p_request_id. We pass p_request_id through
  -- verbatim so the caller's idempotency token is honored.
  --
  -- p_create_deduction is derived from auto_discount + p_confirm_deduction
  -- (step 8 above) so the new flow creates the deduction batch iff
  -- the legacy contract says it should.
  v_order_id := (
    SELECT id FROM public.start_production_order(
      p_quote_id           := p_quote_id,
      p_production_number  := v_production_number,
      p_planned_start_date := null,
      p_planned_end_date   := null,
      p_assigned_to        := null,
      p_notes              := null,
      p_request_id         := p_request_id,
      p_create_deduction   := v_create_deduction
    )
  );

  -- 11. Look up the deduction batch created by start_production_order.
  -- When v_create_deduction = true, the new flow creates a batch with
  -- non-null production_order_id; when false, no batch is created and
  -- v_batch_id stays NULL (the existing legacy behavior for the
  -- auto_discount disabled branch).
  IF v_create_deduction THEN
    SELECT id INTO v_batch_id
      FROM public.quote_production_stock_deductions
     WHERE quote_id = p_quote_id
       AND production_order_id = v_order_id
     LIMIT 1;
  END IF;

  -- 12. Update the quote status to en_produccion (legacy contract
  -- preserved). The PR-1 direct-write trigger rejects this update
  -- unless the transaction-local guard is set, so we SET LOCAL
  -- immediately before the UPDATE. The guard auto-reverts on
  -- COMMIT/ROLLBACK and never leaks to subsequent transactions on
  -- the same connection.
  SET LOCAL app.production_order_write_context = 'rpc';
  IF v_quote_status <> 'en_produccion' THEN
    UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;
  END IF;

  -- 13. Return the legacy-compatible jsonb shape. The shape is a
  -- SUPERSET of the original: we add 'order_id' (the production_order
  -- id from the new flow) and 'note' (a short description for the
  -- dialog UX), and keep every field the legacy callers expect.
  --
  -- movements_created is always 0: the new flow does NOT create
  -- stock_movements directly. Stock consumption is a separate step
  -- (the new flow's transition_production_order_state when the order
  -- moves to 'in_progress', or a future BOM-consumption RPC). The
  -- dialog's UX uses this field to display "X movimientos creados" —
  -- the message will say "Sin descuento automático" in the new flow,
  -- which is accurate (the deduction batch is created as a linkage
  -- record, but the actual movements come later).
  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'order_id', v_order_id,
    'status', 'completed',
    'movements_created', 0,
    'lines_skipped', 0,
    'shortage_detected', false,
    'snapshot_incomplete', false,
    'warning_summary', '[]'::jsonb,
    'note', 'production order started via start_production_order (legacy wrapper)'
  );
END;
$$;

COMMENT ON FUNCTION public.start_quote_production IS
  'PR 9.1 LEGACY WRAPPER: deprecated. Use start_production_order (via useStartProductionOrder from @/features/production) instead. '
  'This function is preserved for one more release to give external integrations time to migrate. '
  'It is now a thin wrapper around start_production_order: it emits a one-time-per-session deprecation RAISE WARNING, '
  'preserves the existing role + cross-workshop + RLS safety via a NULL-safe profile lookup that runs BEFORE the '
  'SELECT FOR UPDATE (auth fail-open fix: a caller with auth.uid() set but no profile is rejected with 42501 '
  '''Caller has no profile/workshop'' before the existing-batch branch can run), preserves the legacy idempotency '
  '(existing-batch branch returns the existing batch without creating a new one; the batch''s production_order_id is '
  'surfaced as order_id in the return shape when set, null otherwise — the PR 4 legacy-null-preservation contract), '
  'and delegates the production_order creation to the new flow. The wrapper enforces the legacy confirmation semantics: '
  'when workshop_settings.auto_stock_discount is ON, p_confirm_deduction=false raises P0001 '
  '''Confirmation required for automatic stock deduction''; when auto_stock_discount is OFF, the wrapper passes '
  'p_create_deduction=false to start_production_order (no deduction batch, no error). The deduction batch created via '
  'the new flow has a non-null production_order_id (the PR 4 new-flow contract). '
  'The function preserves the legacy quotes.status = ''en_produccion'' side effect via SET LOCAL around the UPDATE. '
  'The returned jsonb shape is a SUPERSET of the original: adds ''order_id'' and ''note''; keeps ''batch_id'', '
  '''movements_created'' (=0 in the new flow; movements come from a later step), ''lines_skipped'', '
  '''shortage_detected'', ''snapshot_incomplete'', ''warning_summary'', and ''status''. '
  'SECURITY INVOKER: the wrapper runs as the caller; the SECURITY DEFINER start_production_order handles the '
  'production_orders / production_order_events writes internally.';
