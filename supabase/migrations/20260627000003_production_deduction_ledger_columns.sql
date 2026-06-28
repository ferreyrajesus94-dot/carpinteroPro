-- Migration: extend get_stock_movement_ledger and get_stock_movement_detail
-- to return production_deduction_id, is_production_deduction, and
-- production_deduction_status from quote_production_stock_deductions.

-- ──────────────────────────────────────────────────────────────────
-- get_stock_movement_ledger
-- ──────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_stock_movement_ledger(
  public.stock_movement_reason,
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer
);

CREATE OR REPLACE FUNCTION public.get_stock_movement_ledger(
  p_reason      public.stock_movement_reason DEFAULT NULL,
  p_material_id uuid DEFAULT NULL,
  p_creator_id  uuid DEFAULT NULL,
  p_from        timestamptz DEFAULT NULL,
  p_to          timestamptz DEFAULT NULL,
  p_search      text DEFAULT NULL,
  p_limit       integer DEFAULT 50,
  p_offset      integer DEFAULT 0
)
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
  is_reversal               boolean,
  reversed_by_movement_id   uuid,
  production_deduction_id   uuid,
  is_production_deduction   boolean,
  production_deduction_status text
)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_current_workshop_id uuid;
  v_limit  integer;
  v_offset integer;
BEGIN
  SELECT p.workshop_id INTO v_current_workshop_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  IF v_current_workshop_id IS NULL THEN
    RETURN;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

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
    sm.reversal_of_movement_id IS NOT NULL AS is_reversal,
    rev.id AS reversed_by_movement_id,
    sm.production_deduction_id,
    sm.reason = 'consumo_produccion' AS is_production_deduction,
    batch.status AS production_deduction_status
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
  WHERE sm.workshop_id = v_current_workshop_id
    AND (p_reason IS NULL OR sm.reason = p_reason)
    AND (p_material_id IS NULL OR sm.material_id = p_material_id)
    AND (p_creator_id IS NULL OR sm.created_by = p_creator_id)
    AND (p_from IS NULL OR sm.created_at >= p_from)
    AND (p_to IS NULL OR sm.created_at < p_to)
    AND (p_search IS NULL OR length(p_search) < 3 OR m.name ILIKE '%' || p_search || '%')
  ORDER BY sm.created_at DESC, sm.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_stock_movement_ledger IS
  'Returns a workshop-scoped, filtered, paginated view of stock movements with reversal linkage and production-deduction context for ledger and CSV presentation.';

-- ──────────────────────────────────────────────────────────────────
-- get_stock_movement_detail
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
  production_deduction_status text
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
    batch.status AS production_deduction_status
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
  'Returns one workshop-scoped stock movement with reversal linkage, authorization-derived can_reverse flag, and production-deduction context.';
