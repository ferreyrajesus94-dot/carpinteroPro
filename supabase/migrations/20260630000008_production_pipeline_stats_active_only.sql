-- PR 8 review-blocker fix #2: get_production_pipeline_stats
-- active-only contract.
--
-- Resolves the CRITICAL contract mismatch flagged by the PR 8
-- reliability review. The spec
-- (openspec/changes/production-order-state-machine/specs/production-orders/spec.md,
-- "Production Pipeline Stats RPC" requirement) states:
--
--   "The system MUST provide a `get_production_pipeline_stats`
--    SECURITY INVOKER read RPC that returns one row per active
--    state (`planned`, `in_progress`, `paused`, `quality_check`,
--    `ready`) with the count of orders currently in that state for
--    the current workshop. Terminal states (`delivered`,
--    `cancelled`) MUST NOT be included in the pipeline."
--
-- The PR 3 implementation
-- (20260630000003_production_read_rpcs.sql +
-- 20260630000004_production_read_rpc_blocker_fix.sql) returns
-- exactly 7 rows (one per production_order_state enum value)
-- INCLUDING terminal states, with zero counts for empty
-- states. The dashboard widget was forced to filter terminal
-- states client-side to honor the spec, which is exactly the
-- "spec is one thing, code is another" anti-pattern the
-- review-blocker fix should eliminate.
--
-- Fix: rewrite the CTE to materialize the 5 active states
-- directly (via a literal `VALUES` list rather than
-- `enum_range(NULL::production_order_state)`) and LEFT JOIN the
-- per-state count filtered to the same active set. The result is
-- always exactly 5 rows in the active-state order, with terminal
-- states excluded at the SQL layer. The widget now consumes a
-- spec-honoring contract and does not need to filter terminal
-- states client-side (defense in depth keeps the filter on the
-- client too — see `PRODUCTION_ORDER_TERMINAL_STATES` in
-- `src/features/production/api/types.ts`).
--
-- The function is replaced via `CREATE OR REPLACE FUNCTION` so
-- the migration is additive on `supabase db reset`. No data is
-- touched; the change is contract-only.

-- ═════════════════════════════════════════════════════════════════════
-- get_production_pipeline_stats — active-only contract
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
  -- PR 8 review-blocker fix #2: active-only contract per the
  -- spec "Production Pipeline Stats RPC" requirement. Terminal
  -- states (delivered, cancelled) are EXCLUDED at the SQL layer
  -- so the dashboard widget consumes a spec-honoring contract.
  -- The CTE materializes the 5 active states in workflow order
  -- (the same order the production board uses for its columns)
  -- so the widget's `PRODUCTION_ORDER_ACTIVE_STATES` array and
  -- the RPC's result set line up positionally.
  WITH active_states AS (
    SELECT state FROM (VALUES
      ('planned'::public.production_order_state),
      ('in_progress'::public.production_order_state),
      ('paused'::public.production_order_state),
      ('quality_check'::public.production_order_state),
      ('ready'::public.production_order_state)
    ) AS s(state)
  ),
  counts AS (
    SELECT po.state, count(*)::bigint AS count
    FROM public.production_orders po
    WHERE po.state IN (
      'planned'::public.production_order_state,
      'in_progress'::public.production_order_state,
      'paused'::public.production_order_state,
      'quality_check'::public.production_order_state,
      'ready'::public.production_order_state
    )
    GROUP BY po.state
  )
  SELECT s.state, COALESCE(c.count, 0) AS count
  FROM active_states s
  LEFT JOIN counts c
         ON c.state = s.state
  ORDER BY s.state;
$$;

COMMENT ON FUNCTION public.get_production_pipeline_stats IS
  'Count of production_orders grouped by ACTIVE state for the caller''s '
  'workshop. Returns exactly 5 rows (one per active state: planned, '
  'in_progress, paused, quality_check, ready) in workflow order, with zero '
  'counts included for active states with no orders. Terminal states '
  '(delivered, cancelled) are EXCLUDED from the pipeline per the production-'
  'orders spec "Production Pipeline Stats RPC" requirement — the dashboard '
  'widget no longer needs to filter terminal states client-side. SECURITY '
  'INVOKER: RLS scopes the count by workshop (cross-workshop orders are '
  'never counted). The result set is a 1:1 positional match for the '
  'PRODUCTION_ORDER_ACTIVE_STATES array exported from the production '
  'feature barrel.';
