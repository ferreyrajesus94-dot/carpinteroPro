-- PR 3: Production Order read RPCs
--
-- Implements the five read RPCs that power the production board, the
-- production order detail page, the quote-status projection, and the
-- dashboard pipeline counts. All RPCs run as SECURITY INVOKER so the
-- existing SELECT-only RLS policies on production_orders,
-- production_order_events, quotes, and clients (scoped by
-- get_current_workshop_id()) are the single source of tenant isolation.
-- No cross-workshop rows are ever returned: a foreign-workshop id
-- simply yields 0 rows, which the frontend treats as "not visible".
--
-- Read RPCs (all SECURITY INVOKER, all STABLE, all SQL-language):
--   1. list_production_orders(p_states, p_assigned_to, p_quote_id,
--                              p_search, p_limit, p_offset)
--      Paginated list of orders in the caller's workshop. Filters by
--      state array, assigned_to, quote_id, and an ILIKE search on
--      production_number + notes. Returns denormalized quote info and
--      the assignee's display name so the board can render rows
--      without an N+1 query.
--
--   2. get_production_order(p_order_id)
--      Single order by id, with the same denormalized fields as the
--      list, plus quote_status, quote_client_id, and quote_client_name
--      for the detail page. Cross-workshop returns 0 rows (RLS).
--
--   3. get_production_order_events(p_order_id)
--      Append-only audit timeline for an order, ordered by created_at
--      ASC, with the actor's display name denormalized. Cross-workshop
--      returns 0 rows (RLS).
--
--   4. get_quotes_with_production_status(p_limit, p_offset)
--      Projects the effective production status onto every quote in
--      the caller's workshop. Projection rules (per spec):
--        - Any active order (planned/in_progress/paused/quality_check/
--          ready) -> 'en_produccion' (overlays the stored status).
--        - All orders delivered (and at least one exists) -> 'entregado'.
--        - Otherwise -> the stored quotes.status.
--      Also exposes has_active_production (bool) and last_event_at
--      (timestamptz) so the frontend can render active-state badges
--      without a separate query.
--
--   5. get_production_pipeline_stats()
--      Count of production_orders per state for the caller's workshop.
--      Always returns 7 rows (one per enum value), with zero counts
--      included, so the dashboard does not need a 7-way UNION of
--      missing states. Cross-workshop orders are filtered by RLS.
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
-- Depends on:
--   - PR 1 migration (20260630000000_production_orders.sql): tables,
--     SELECT-only RLS, defense-in-depth triggers.
--   - PR 2 migration (20260630000001_production_orders_rpc.sql):
--     start_production_order + transition_production_order_state for
--     test seeding.
--   - public.profiles (display_name for actor/assignee denormalization).
--   - public.quotes (status, client_id, furniture_name).
--   - public.clients (name for quote_client_name).
--
-- Rollback notes:
--   - DROP FUNCTION public.list_production_orders;
--   - DROP FUNCTION public.get_production_order;
--   - DROP FUNCTION public.get_production_order_events;
--   - DROP FUNCTION public.get_quotes_with_production_status;
--   - DROP FUNCTION public.get_production_pipeline_stats;
--   - Leave tables in place; only read paths are removed.

-- ═════════════════════════════════════════════════════════════════════
-- 1. list_production_orders
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
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

COMMENT ON FUNCTION public.list_production_orders IS
  'List production orders for the caller''s workshop, with optional state / '
  'assignee / quote / search filters and limit/offset pagination. Returns '
  'denormalized quote_number, quote_furniture_name, and assigned_to_name so '
  'the production board can render rows without an N+1 query. SECURITY '
  'INVOKER: the caller''s RLS context applies (workshop_id = '
  'get_current_workshop_id()). Cross-workshop rows are filtered by RLS and '
  'never appear in the result. Default ordering: planned_start_date ASC '
  'NULLS LAST, created_at DESC (most-recent-first within the same date).';

-- ═════════════════════════════════════════════════════════════════════
-- 2. get_production_order
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_production_order(p_order_id uuid)
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
  quote_status          public.quote_status,
  quote_client_id       uuid,
  quote_client_name     text,
  assigned_to_name      text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- SECURITY INVOKER: RLS on production_orders scopes by workshop. A
  -- cross-workshop id yields 0 rows (not an error). The frontend
  -- distinguishes "not found" from "no access" by treating 0 rows
  -- uniformly as "not visible".
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
    q.status AS quote_status,
    q.client_id AS quote_client_id,
    COALESCE(client.name, '') AS quote_client_name,
    COALESCE(assignee.display_name, '') AS assigned_to_name
  FROM public.production_orders po
  LEFT JOIN public.quotes q
         ON q.id = po.quote_id
  LEFT JOIN public.clients client
         ON client.id = q.client_id
  LEFT JOIN public.profiles assignee
         ON assignee.id = po.assigned_to
  WHERE po.id = p_order_id;
$$;

COMMENT ON FUNCTION public.get_production_order IS
  'Fetch a single production order by id, with the same denormalized fields '
  'as list_production_orders plus quote_status, quote_client_id, and '
  'quote_client_name for the detail page. SECURITY INVOKER: cross-workshop '
  'ids return 0 rows (RLS), not an error. Callers MUST treat 0 rows as '
  '"not visible" — the RPC does not distinguish 404 from 403.';

-- ═════════════════════════════════════════════════════════════════════
-- 3. get_production_order_events
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
  -- are ordered by created_at ASC so the frontend can render a timeline
  -- without re-sorting.
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
  ORDER BY e.created_at ASC;
$$;

COMMENT ON FUNCTION public.get_production_order_events IS
  'Append-only audit timeline for a production order, ordered by created_at '
  'ASC. Returns the denormalized actor display_name so the detail page can '
  'render the timeline without a second query. SECURITY INVOKER: cross-'
  'workshop ids return 0 rows (RLS). Events are immutable; the only writer '
  'is the PR-2 transition_production_order_state RPC.';

-- ═════════════════════════════════════════════════════════════════════
-- 4. get_quotes_with_production_status
-- ═════════════════════════════════════════════════════════════════════
-- Projection rules (from the production-orders spec, "Quote Status
-- Derivation" requirement):
--   - Any order in an active state (planned / in_progress / paused /
--     quality_check / ready) -> 'en_produccion' overlays stored status.
--   - All orders delivered (and at least one exists) -> 'entregado'.
--   - No orders, OR only cancelled orders -> stored quote.status.
--
-- The projection lives ONLY in this RPC. The stored quotes.status is
-- never written by the new flow (direct writes of 'en_produccion' are
-- rejected by the PR-2 reject_direct_en_produccion_writes trigger),
-- so this RPC is the read-side source of truth for the production
-- state of a quote.
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
  -- Aggregate order stats per quote inside a CTE, then LEFT JOIN to
  -- quotes. Quotes with no orders get NULL aggregates, which COALESCE
  -- to false / NULL. SECURITY INVOKER: RLS on quotes + RLS on
  -- production_orders both filter by workshop. The aggregation runs
  -- on the RLS-filtered set, so cross-workshop orders are never
  -- counted.
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
      count(*) FILTER (
        WHERE po.state NOT IN (
          'delivered'::public.production_order_state,
          'cancelled'::public.production_order_state
        )
      ) AS non_terminal_count,
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
      WHEN s.delivered_count IS NOT NULL
           AND s.delivered_count > 0
           AND s.non_terminal_count = 0
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
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

COMMENT ON FUNCTION public.get_quotes_with_production_status IS
  'Project the effective production status onto every quote in the caller''s '
  'workshop. The projection overlays the stored quotes.status: any active '
  'order (planned / in_progress / paused / quality_check / ready) yields '
  'en_produccion; all-delivered (and at least one order exists) yields '
  'entregado; otherwise the stored status is returned. SECURITY INVOKER: '
  'RLS on both quotes and production_orders scopes by workshop. This is '
  'the read-side source of truth for the production state of a quote '
  'because the stored quotes.status is no longer written by the new flow '
  '(direct en_produccion writes are rejected by the PR-2 trigger).';

-- ═════════════════════════════════════════════════════════════════════
-- 5. get_production_pipeline_stats
-- ═════════════════════════════════════════════════════════════════════
-- The dashboard pipeline view needs counts per state for the caller's
-- workshop, INCLUDING zero-count states, so the rendered columns do
-- not flicker between data fetches. The CTE materializes the 7
-- production_order_state enum values via enum_range(), then LEFT JOIN
-- to the per-state count. The result is always exactly 7 rows.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_production_pipeline_stats()
RETURNS TABLE (
  state public.production_order_state,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  -- SECURITY INVOKER: RLS on production_orders scopes the count by
  -- workshop. Cross-workshop orders are never counted. Zero-count
  -- states are explicitly included via the enum_range() CTE so the
  -- dashboard does not need a 7-way UNION of missing states.
  WITH all_states AS (
    SELECT unnest(enum_range(NULL::public.production_order_state)) AS state
  ),
  counts AS (
    SELECT po.state, count(*)::bigint AS count
    FROM public.production_orders po
    GROUP BY po.state
  )
  SELECT s.state, COALESCE(c.count, 0) AS count
  FROM all_states s
  LEFT JOIN counts c
         ON c.state = s.state
  ORDER BY s.state;
$$;

COMMENT ON FUNCTION public.get_production_pipeline_stats IS
  'Count of production_orders grouped by state for the caller''s workshop. '
  'Returns exactly 7 rows (one per production_order_state enum value), '
  'with zero counts included for states with no orders, so the dashboard '
  'pipeline view does not flicker. SECURITY INVOKER: RLS scopes the count '
  'by workshop (cross-workshop orders are never counted). Default ordering '
  'is the enum declaration order (planned, in_progress, paused, '
  'quality_check, ready, delivered, cancelled).';
