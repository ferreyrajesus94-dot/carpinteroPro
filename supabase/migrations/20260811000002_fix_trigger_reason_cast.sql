-- Migration: Fix the cast in trg_apply_production_deduction_to_stock.
--
-- The previous migration (20260811000001) installed the trigger with a
-- wrong cast: 'consumo_produccion'::text on a column that is the
-- stock_movement_reason enum. PostgreSQL rejected the INSERT with 42804.
-- This migration replaces the trigger function body with the explicit
-- enum cast.
-- -- This migration depends on 20260811000001 having been applied.

CREATE OR REPLACE FUNCTION public.trg_apply_production_deduction_to_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_quote_number text;
BEGIN
  -- Skip legacy batches: production_order_id IS NULL means the row came
  -- from the legacy start_quote_production function body, which already
  -- inserts stock_movements directly.
  IF NEW.production_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip when auto_stock_discount is off: the function only records the
  -- audit batch in that case (no actual movement).
  IF NEW.auto_stock_discount_enabled = false THEN
    RETURN NEW;
  END IF;

  SELECT quote_number INTO v_quote_number
  FROM public.quotes
  WHERE id = NEW.quote_id;

  INSERT INTO public.stock_movements (
    workshop_id, material_id, delta, reason, note,
    quote_id, production_deduction_id, created_by
  )
  SELECT
    NEW.workshop_id,
    abl.material_id,
    -abl.deduction_quantity,
    'consumo_produccion'::public.stock_movement_reason,
    format('Inicio de producción presupuesto %s', v_quote_number),
    NEW.quote_id,
    NEW.id,
    NEW.confirmed_by
  FROM public.quote_approved_bom_lines abl
  WHERE abl.quote_id = NEW.quote_id
    AND abl.is_complete = true
    AND abl.material_id IS NOT NULL
    AND abl.deduction_quantity IS NOT NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_apply_production_deduction_to_stock IS
  'Triggered AFTER INSERT on quote_production_stock_deductions. Inserts '
  'one stock_movement per approved BOM line for new-flow batches (those '
  'with production_order_id IS NOT NULL) when auto_stock_discount_enabled '
  'is true. Skips legacy batches (production_order_id IS NULL) because the '
  'legacy start_quote_production function inserts stock_movements directly. '
  'Cast reason to ::public.stock_movement_reason enum explicitly.';