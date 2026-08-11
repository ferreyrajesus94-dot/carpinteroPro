-- Migration: Trigger-based stock_movement creation for production deductions
--
-- Issue: PR 4 introduced start_production_order which creates the
-- production_order and an audit row in quote_production_stock_deductions,
-- but does NOT insert into stock_movements. Result: stock never
-- decrements when production starts via the new flow.
--
-- Fix: AFTER INSERT trigger on quote_production_stock_deductions that
-- creates one stock_movement per approved BOM line.
--
-- The trigger distinguishes:
--   - New-flow batches (production_order_id IS NOT NULL): create movements.
--     These are inserted by start_production_order (and the post-PR-9
--     start_quote_production wrapper).
--   - Legacy batches (production_order_id IS NULL): skip. The pre-PR-9
--     start_quote_production body inserts stock_movements directly, and
--     the table's PARTIAL unique index (uq_production_deduction_quote_active
--     WHERE status IS DISTINCT FROM 'reversed') prevents the new flow from
--     double-creating a batch for the same quote.
--
-- Only inserts when NEW.auto_stock_discount_enabled is true. When the
-- setting is off the function still records an audit batch row but does
-- NOT debit stock — matching the documented contract.

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
  'legacy start_quote_production function inserts stock_movements directly.';

DROP TRIGGER IF EXISTS trg_apply_deduction_to_stock
  ON public.quote_production_stock_deductions;

CREATE TRIGGER trg_apply_deduction_to_stock
AFTER INSERT ON public.quote_production_stock_deductions
FOR EACH ROW
EXECUTE FUNCTION public.trg_apply_production_deduction_to_stock();