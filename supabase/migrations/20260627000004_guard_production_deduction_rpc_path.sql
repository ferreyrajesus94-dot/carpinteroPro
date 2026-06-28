-- Guard the generic apply_stock_movement RPC against the production-only reason.
--
-- Production consumption must go through start_quote_production, not through
-- the generic manual movement RPC. This prevents users from injecting forged
-- 'consumo_produccion' movements that would appear as production-origin rows
-- in the ledger UI.

-- ═════════════════════════════════════════════════════════════════════
-- 1. Guard apply_stock_movement against direct 'consumo_produccion'
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_material_id uuid,
  p_delta       NUMERIC,
  p_reason      stock_movement_reason,
  p_note        TEXT DEFAULT NULL,
  p_quote_id    uuid DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_workshop_id uuid;
  v_current_workshop_id uuid;
  v_new_stock   NUMERIC;
BEGIN
  -- Production consumption must go through the controlled RPC path
  IF p_reason = 'consumo_produccion' THEN
    RAISE EXCEPTION 'Use start_quote_production for production stock deductions'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta cannot be zero';
  END IF;

  SELECT p.workshop_id INTO v_current_workshop_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid();

  SELECT workshop_id INTO v_workshop_id
  FROM materials
  WHERE id = p_material_id;

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'material % not found', p_material_id;
  END IF;

  IF v_current_workshop_id IS NULL OR v_workshop_id <> v_current_workshop_id THEN
    RAISE EXCEPTION 'material % not found', p_material_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE materials
  SET stock = stock + p_delta,
      updated_at = now()
  WHERE id = p_material_id
    AND workshop_id = v_current_workshop_id
  RETURNING stock INTO v_new_stock;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'stock cannot be negative (would result in %)', v_new_stock;
  END IF;

  INSERT INTO stock_movements (workshop_id, material_id, delta, reason, note, quote_id, created_by)
  VALUES (v_workshop_id, p_material_id, p_delta, p_reason, p_note, p_quote_id, auth.uid());

  RETURN v_new_stock;
END;
$$;
