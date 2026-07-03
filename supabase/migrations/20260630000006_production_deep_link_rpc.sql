-- PR 7: Inventory deep-link surface for production-origin movements
--
-- Implements the inventory deep-link contract from the
-- `production-order-state-machine` change. The deduction batch already
-- carries a nullable `production_order_id` (added in PR 4). The
-- `get_stock_movement_detail` RPC now JOINs through that column so the
-- inventory detail surface can render a "Ver orden de producción" link
-- back to `/production/:id` without a second round-trip.
--
-- What's in this migration:
--   1. Extend `get_stock_movement_detail` to return
--      `production_order_id` (uuid NULL) by JOINing through
--      `quote_production_stock_deductions.production_order_id`. The
--      column is NULL when:
--        - the movement is not a production-origin movement (no
--          `production_deduction_id`), OR
--        - the deduction batch was created via the legacy
--          `start_quote_production` flow (no production order existed
--          yet at deduction time), OR
--        - the production order has been deleted (ON DELETE SET NULL
--          on the deduction FK preserves the deduction history).
--   2. The RPC is still SECURITY INVOKER and the existing
--      workshop-scoped RLS policies remain the single source of tenant
--      isolation. The new column is filtered by RLS automatically
--      because the existing `LEFT JOIN quote_production_stock_deductions
--      ON batch.workshop_id = sm.workshop_id` predicate prevents
--      cross-workshop batches from leaking via the join.
--
-- This is a pure read-side change. No table is created, no column is
-- added, no policy is added. Existing tests that consume the RPC are
-- unaffected because the new column is appended at the end of the
-- return shape.
--
-- Depends on:
--   - PR 4 migration (20260630000005_production_deduction_order_link.sql):
--     the `quote_production_stock_deductions.production_order_id` column.
--   - PR 2 migration (20260627000003_production_deduction_ledger_columns.sql):
--     the predecessor version of `get_stock_movement_detail` that
--     JOINs with the deduction batch.

-- ──────────────────────────────────────────────────────────────────
-- get_stock_movement_detail — extended with production_order_id
-- ──────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_stock_movement_detail(uuid);

CREATE OR REPLACE FUNCTION public.get_stock_movement_detail(p_movement_id uuid)
RETURNS TABLE (
  id                        uuid,
  workshop_id               uuid,
  material_id               uuid,
  material_name             text,
  material_unit             unit_of_measure,
  delta                     numeric,
  reason                    public.stock_movement_reason,
  note                      text,
  quote_id                  uuid,
  quote_number              text,
  created_at                timestamptz,
  created_by                uuid,
  creator_name              text,
  reversal_of_movement_id   uuid,
  reversal_reason           text,
  reversed_original_reason  public.stock_movement_reason,
  reversal_request_id       uuid,
  is_reversal               boolean,
  reversed_by_movement_id   uuid,
  can_reverse               boolean,
  production_deduction_id   uuid,
  is_production_deduction   boolean,
  production_deduction_status text,
  -- PR 7: production-order deep-link target. NULL for non-production
  -- movements and for legacy deduction batches that pre-date the
  -- production_orders table. The inventory detail surface uses this
  -- to render a "Ver orden de producción" link back to /production/:id.
  production_order_id       uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_current_workshop_id uuid;
  v_current_role public.workshop_user_role;
BEGIN
  SELECT p.workshop_id, p.workshop_role
  INTO v_current_workshop_id, v_current_role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF v_current_workshop_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sm.id,
    sm.workshop_id,
    sm.material_id,
    m.name AS material_name,
    m.unit AS material_unit,
    sm.delta,
    sm.reason,
    sm.note,
    sm.quote_id,
    q.quote_number,
    sm.created_at,
    sm.created_by,
    pr.display_name AS creator_name,
    sm.reversal_of_movement_id,
    sm.reversal_reason,
    sm.reversed_original_reason,
    sm.reversal_request_id,
    sm.reversal_of_movement_id IS NOT NULL AS is_reversal,
    rev.id AS reversed_by_movement_id,
    sm.reversal_of_movement_id IS NULL
      AND rev.id IS NULL
      AND v_current_role IN ('admin', 'operational') AS can_reverse,
    sm.production_deduction_id,
    sm.reason = 'consumo_produccion' AS is_production_deduction,
    batch.status AS production_deduction_status,
    -- PR 7: surface the production_order_id from the deduction batch
    -- JOIN. The batch is already filtered by workshop_id, so a
    -- cross-workshop link can never leak via this column.
    batch.production_order_id
  FROM public.stock_movements AS sm
  LEFT JOIN public.materials AS m
    ON m.id = sm.material_id
   AND m.workshop_id = sm.workshop_id
  LEFT JOIN public.quotes AS q
    ON q.id = sm.quote_id
   AND q.workshop_id = sm.workshop_id
  LEFT JOIN public.profiles AS pr
    ON pr.id = sm.created_by
   AND pr.workshop_id = sm.workshop_id
  LEFT JOIN public.stock_movements AS rev
    ON rev.reversal_of_movement_id = sm.id
   AND rev.workshop_id = sm.workshop_id
  LEFT JOIN public.quote_production_stock_deductions AS batch
    ON batch.id = sm.production_deduction_id
   AND batch.workshop_id = sm.workshop_id
  WHERE sm.id = p_movement_id
    AND sm.workshop_id = v_current_workshop_id;
END;
$$;

COMMENT ON FUNCTION public.get_stock_movement_detail(uuid) IS
  'Returns one workshop-scoped stock movement with reversal linkage, authorization-derived can_reverse flag, production-deduction context, and the PR 7 production_order_id deep-link target. The production_order_id is the FK on quote_production_stock_deductions that the inventory detail surface uses to render a "Ver orden de producción" link back to /production/:id. NULL for non-production movements and for legacy deduction batches.';
