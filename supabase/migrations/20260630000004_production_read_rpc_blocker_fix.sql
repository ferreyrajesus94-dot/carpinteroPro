-- PR 3 Blocker Fix — read RPCs
--
-- Resolves four CRITICAL/WARNING/SUGGESTION review blockers for PR 3
-- (read RPCs). This is an additive migration that supersedes the
-- definitions in 20260630000003_production_read_rpcs.sql via
-- CREATE OR REPLACE FUNCTION. It runs after the PR 3 read-RPC
-- migration so the new definitions win on `supabase db reset`.
--
--   1. CRITICAL: get_production_order_events timeline order is
--      non-deterministic for tied created_at.
--      The PR 3 implementation orders only by `created_at ASC`. Two
--      events inserted in the same transaction can share a timestamp
--      (PostgreSQL's `now()` resolution is microsecond, but the
--      `production_order_events` row's `created_at` can be set
--      explicitly to any value, and a same-transaction batch can
--      produce identical timestamps). When `created_at` is tied,
--      PostgreSQL is free to return the events in any order — and the
--      order is NOT guaranteed to be stable across calls.
--
--      Fix: add `e.id ASC` as a stable tie-breaker. `id` is a
--      `gen_random_uuid()` (uuid v4, random) so the secondary sort is
--      a deterministic total order, not insertion order. Any other
--      stable secondary key would also work, but `id` is the simplest.
--      The existing index covers `(production_order_id, created_at)`;
--      `id` provides deterministic ordering within tied timestamps.
--
--      The COMMENT block on the function is updated to document the
--      stable ordering.
--
--   2. WARNING: get_quotes_with_production_status mixed delivered +
--      cancelled projection is ambiguous / over-permissive.
--      The PR 3 implementation projects 'entregado' when
--      `delivered_count > 0 AND non_terminal_count = 0`, where
--      `non_terminal_count` excludes both `delivered` and `cancelled`
--      (so a cancelled order does NOT contribute to `non_terminal_count`).
--      This means a quote with 1 delivered + 1 cancelled order
--      projects to 'entregado' — but the spec says "all orders
--      delivered" (spec.md line 91: "GIVEN a quote whose only order
--      is delivered"). A cancelled order alongside a delivered one is
--      NOT "all orders delivered".
--
--      Fix: tighten the projection. 'entregado' is projected only
--      when EVERY order is in 'delivered' state (no active, no
--      cancelled, no other). A quote with a mix of delivered and
--      cancelled (or any other state) falls through to the stored
--      status.
--
--      The new logic is equivalent to: at least one order exists AND
--      every order is in 'delivered' state. We implement it as
--      `delivered_count = total_count AND total_count > 0` to keep the
--      CASE expression simple and self-documenting.
--
--   3. WARNING: return-shape comments inconsistent with the actual
--      RETURNS TABLE.
--      - get_production_order's file header says "20 columns" and
--        "the 16 from list_production_orders, plus quote_status,
--         quote_client_id, quote_client_name". The actual RETURNS
--         TABLE has 19 columns: the 16 from list plus 3 = 19, not 20.
--        PR 5's database.ts copy will misread this and add 1 phantom
--        column. Fix: correct the comment to 19.
--      - get_quotes_with_production_status's file header says
--        "11 columns". The actual RETURNS TABLE has 10 columns
--        (id, workshop_id, quote_number, furniture_name, client_id,
--        client_name, stored_status, production_status,
--        has_active_production, last_event_at). Fix: correct to 10.
--
--   4. SUGGESTION: list_production_orders NULL p_limit / p_offset
--      handling is implementation-dependent.
--      The PR 3 implementation uses `LIMIT GREATEST(p_limit, 0)
--      OFFSET GREATEST(p_offset, 0)`. `GREATEST(NULL, 0)` returns
--      NULL, and PostgreSQL's behaviour for `LIMIT NULL` is
--      "no limit" (but `OFFSET NULL` is treated as 0). This works
--      for OFFSET (because the default is 0) but the behavior is
--      fragile and not documented.
--
--      Fix: add COALESCE so NULL p_limit is treated as the
--      documented default (100) and NULL p_offset is treated as the
--      documented default (0). The GREATEST(., 0) clamp for
--      negatives is preserved.
--
-- Depends on:
--   - PR 3 migration (20260630000003_production_read_rpcs.sql):
--     the original definitions that this migration supersedes.
--
-- Rollback notes:
--   - DROP FUNCTION public.get_production_order_events;
--   - DROP FUNCTION public.get_quotes_with_production_status;
--   - DROP FUNCTION public.list_production_orders;
--   - Re-apply 20260630000003_production_read_rpcs.sql to restore
--     the original definitions. Or run a DOWN migration that
--     re-creates the original functions.

-- ═════════════════════════════════════════════════════════════════════
-- Blocker 1 (CRITICAL): stable order in get_production_order_events
-- ═════════════════════════════════════════════════════════════════════
-- Add `e.id ASC` as a stable secondary key. `id` is a uuid (random)
-- so the sort is a deterministic total order, not insertion order.
-- The existing index
--   idx_production_order_events_order_created
--     ON public.production_order_events (production_order_id, created_at)
-- is still usable for the primary sort; the secondary `id` sort is
-- cheap and runs on the small per-order event set.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_production_order_events(p_order_id uuid)
RETURNS TABLE (
  id                  uuid,
  workshop_id         uuid,
  production_order_id uuid,
  from_state          public.production_order_state,
  to_state            public.production_order_state,
  reason              text,
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
  -- DETERMINISTIC even when two events share a created_at (which can
  -- happen when events are inserted in the same transaction or with
  -- explicit timestamps). `id` is a uuid v4 (random) so the secondary
  -- sort is a stable total order, not insertion order.
  SELECT
    e.id,
    e.workshop_id,
    e.production_order_id,
    e.from_state,
    e.to_state,
    e.reason,
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
  '(created_at ASC, id ASC). The secondary id sort is a stable '
  'tie-breaker for events that share a created_at (e.g. events '
  'inserted in the same transaction, or events with explicit '
  'timestamps). Returns the denormalized actor display_name so the '
  'detail page can render the timeline without a second query. '
  'SECURITY INVOKER: cross-workshop ids return 0 rows (RLS). Events '
  'are immutable; the only writer is the PR-2 '
  'transition_production_order_state RPC.';

-- ═════════════════════════════════════════════════════════════════════
-- Blocker 2 (WARNING): strict all-delivered projection in
-- get_quotes_with_production_status
-- ═════════════════════════════════════════════════════════════════════
-- The PR 3 projection projects 'entregado' when delivered_count > 0
-- AND non_terminal_count = 0 (cancelled excluded from non-terminal).
-- This over-projects 'entregado' for a quote that has any cancelled
-- order alongside a delivered one — but the spec says "all orders
-- delivered" (spec.md scenario line 91: "a quote whose only order
-- is delivered"). A cancelled order is NOT delivered.
--
-- New logic: project 'entregado' only when EVERY order is in
-- 'delivered' state (no active, no cancelled, no other state) AND at
-- least one order exists. Implementation: `delivered_count =
-- total_count AND total_count > 0`. This is equivalent to
-- "every order in this quote is delivered, and there is at least one".
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_quotes_with_production_status(
  p_limit  integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  workshop_id           uuid,
  quote_number          text,
  furniture_name        text,
  client_id             uuid,
  client_name           text,
  stored_status         public.quote_status,
  production_status     public.quote_status,
  has_active_production boolean,
  last_event_at         timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- SECURITY INVOKER: RLS on quotes + RLS on production_orders both
  -- filter by workshop. The aggregation runs on the RLS-filtered set,
  -- so cross-workshop orders are never counted.
  --
  -- Projection rules (strict "all orders delivered" semantic per
  -- spec.md scenario "All orders delivered reverts to entregado"):
  --   - Any active order (planned / in_progress / paused /
  --     quality_check / ready) -> 'en_produccion' overlays stored.
  --   - EVERY order is delivered (and at least one exists) ->
  --     'entregado' overlays stored. Mixed delivered + cancelled
  --     (or delivered + any other non-delivered state) does NOT
  --     project 'entregado'; it falls through to the stored status.
  --   - Otherwise (no orders, or only cancelled orders, or a mix of
  --     delivered and non-delivered non-active states) -> the stored
  --     quotes.status.
  WITH order_stats AS (
    SELECT
      po.quote_id,
      bool_or(po.state IN (
        'planned'::public.production_order_state,
        'in_progress'::public.production_order_state,
        'paused'::public.production_order_state,
        'quality_check'::public.production_order_state,
        'ready'::public.production_order_state
      )) AS has_active,
      count(*) FILTER (
        WHERE po.state = 'delivered'::public.production_order_state
      ) AS delivered_count,
      count(*) AS total_count,
      max(po.updated_at) AS last_event_at
    FROM public.production_orders po
    GROUP BY po.quote_id
  )
  SELECT
    q.id,
    q.workshop_id,
    q.quote_number,
    q.furniture_name,
    q.client_id,
    COALESCE(client.name, '') AS client_name,
    q.status AS stored_status,
    CASE
      WHEN s.has_active IS TRUE
        THEN 'en_produccion'::public.quote_status
      WHEN s.total_count IS NOT NULL
           AND s.total_count > 0
           AND s.delivered_count = s.total_count
        THEN 'entregado'::public.quote_status
      ELSE q.status
    END AS production_status,
    COALESCE(s.has_active, false) AS has_active_production,
    s.last_event_at
  FROM public.quotes q
  LEFT JOIN order_stats s
         ON s.quote_id = q.id
  LEFT JOIN public.clients client
         ON client.id = q.client_id
  ORDER BY q.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.get_quotes_with_production_status IS
  'Project the effective production status onto every quote in the '
  'caller''s workshop (strict "all orders delivered" semantic per '
  'spec.md). Active orders (planned / in_progress / paused / '
  'quality_check / ready) overlay en_produccion. EVERY order '
  'delivered (and at least one order exists) overlays entregado. '
  'Mixed delivered + cancelled (or delivered + any other non-'
  'delivered state) does NOT project entregado; it falls through '
  'to the stored status. Otherwise the stored quotes.status is '
  'returned. SECURITY INVOKER: RLS on both quotes and '
  'production_orders scopes by workshop. NULL p_limit is treated as '
  '100 (the documented default); NULL p_offset is treated as 0; '
  'negative values are clamped to 0 via GREATEST.';

-- ═════════════════════════════════════════════════════════════════════
-- Blocker 3 (WARNING): return-shape comments inconsistent with
-- RETURNS TABLE — corrected in both the original file and re-issued
-- here for clarity
-- ═════════════════════════════════════════════════════════════════════
-- The original file header (lines 48-93 of
-- 20260630000003_production_read_rpcs.sql) previously documented
-- get_production_order as 20 columns and
-- get_quotes_with_production_status as 11 columns. The actual RETURNS
-- TABLEs have 19 and 10 columns respectively. The original file's
-- header has been edited to reflect the correct counts (19 + 10).
-- The corrected column list is re-issued here as an authoritative
-- source of truth for PR 5's database.ts copy.
-- ═════════════════════════════════════════════════════════════════════
--
-- Return shape contract (PR 5 frontend data layer will mirror these):
--   list_production_orders returns 16 columns:
--     id, workshop_id, quote_id, production_number, state,
--     planned_start_date, planned_end_date, actual_start_date,
--     actual_end_date, assigned_to, notes, created_at, updated_at,
--     quote_number, quote_furniture_name, assigned_to_name
--
--   get_production_order returns 19 columns:
--     the 16 from list_production_orders, plus
--     quote_status, quote_client_id, quote_client_name
--
--   get_production_order_events returns 10 columns:
--     id, workshop_id, production_order_id, from_state, to_state,
--     reason, actor_id, metadata, created_at, actor_name
--
--   get_quotes_with_production_status returns 10 columns:
--     id, workshop_id, quote_number, furniture_name, client_id,
--     client_name, stored_status, production_status,
--     has_active_production, last_event_at
--
--   get_production_pipeline_stats returns 2 columns:
--     state, count
--
-- (No SQL is emitted by this blocker — the original file's header at
-- lines 48-93 has been edited to match the actual RETURNS TABLEs, and
-- the corrected column list is re-issued here as a second source of
-- truth. PR 5 work that copies these shapes into database.ts MUST use
-- the counts documented in BOTH places.)

-- ═════════════════════════════════════════════════════════════════════
-- Blocker 4 (SUGGESTION): NULL p_limit / p_offset handling in
-- list_production_orders
-- ═════════════════════════════════════════════════════════════════════
-- Add COALESCE so NULL p_limit is treated as the documented default
-- (100) and NULL p_offset is treated as the documented default (0).
-- Negative values are still clamped to 0 via GREATEST(., 0). The
-- same fix is applied to get_quotes_with_production_status above
-- (same pattern, single function rewritten end-to-end).
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.list_production_orders(
  p_states        public.production_order_state[] DEFAULT NULL,
  p_assigned_to   uuid                            DEFAULT NULL,
  p_quote_id      uuid                            DEFAULT NULL,
  p_search        text                            DEFAULT NULL,
  p_limit         integer                         DEFAULT 100,
  p_offset        integer                         DEFAULT 0
)
RETURNS TABLE (
  id                    uuid,
  workshop_id           uuid,
  quote_id              uuid,
  production_number     text,
  state                 public.production_order_state,
  planned_start_date    date,
  planned_end_date      date,
  actual_start_date     timestamptz,
  actual_end_date       timestamptz,
  assigned_to           uuid,
  notes                 text,
  created_at            timestamptz,
  updated_at            timestamptz,
  quote_number          text,
  quote_furniture_name  text,
  assigned_to_name      text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- SECURITY INVOKER: the caller's RLS context applies. The SELECT-only
  -- RLS policy on production_orders (workshop_id = get_current_workshop_id())
  -- is the single source of tenant isolation — no row from a foreign
  -- workshop can ever be returned.
  --
  -- Pagination: COALESCE makes NULL p_limit equivalent to the default
  -- (100) and NULL p_offset equivalent to the default (0). GREATEST
  -- clamps negative values to 0 (defense-in-depth). Combined, the
  -- pagination behaviour is fully deterministic for any combination
  -- of NULL, zero, or negative inputs.
  SELECT
    po.id,
    po.workshop_id,
    po.quote_id,
    po.production_number,
    po.state,
    po.planned_start_date,
    po.planned_end_date,
    po.actual_start_date,
    po.actual_end_date,
    po.assigned_to,
    po.notes,
    po.created_at,
    po.updated_at,
    q.quote_number,
    q.furniture_name AS quote_furniture_name,
    COALESCE(assignee.display_name, '') AS assigned_to_name
  FROM public.production_orders po
  LEFT JOIN public.quotes q
         ON q.id = po.quote_id
  LEFT JOIN public.profiles assignee
         ON assignee.id = po.assigned_to
  WHERE (p_states IS NULL OR po.state = ANY(p_states))
    AND (p_assigned_to IS NULL OR po.assigned_to = p_assigned_to)
    AND (p_quote_id IS NULL OR po.quote_id = p_quote_id)
    AND (
      p_search IS NULL
      OR p_search = ''
      OR po.production_number ILIKE '%' || p_search || '%'
      OR COALESCE(po.notes, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY po.planned_start_date ASC NULLS LAST,
           po.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMENT ON FUNCTION public.list_production_orders IS
  'List production orders for the caller''s workshop, with optional '
  'state / assignee / quote / search filters and limit/offset '
  'pagination. Returns denormalized quote_number, '
  'quote_furniture_name, and assigned_to_name so the production '
  'board can render rows without an N+1 query. SECURITY INVOKER: '
  'the caller''s RLS context applies (workshop_id = '
  'get_current_workshop_id()). Cross-workshop rows are filtered by '
  'RLS and never appear in the result. Pagination is deterministic '
  'for any input: NULL p_limit is treated as 100 (the default); '
  'NULL p_offset is treated as 0; negative values are clamped to 0 '
  'via GREATEST. Default ordering: planned_start_date ASC NULLS '
  'LAST, created_at DESC (most-recent-first within the same date).';
