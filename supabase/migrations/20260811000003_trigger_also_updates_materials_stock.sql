-- Migration: Trigger should also update materials.stock after inserting
-- stock_movements.
--
-- The trigger installed in 20260811000001 / 20260811000002 inserts one
-- stock_movement per approved BOM line but does NOT update
-- materials.stock. Result: the audit ledger is correct, but the
-- "current stock" snapshot in materials.stock is out of sync.
--
-- The original apply_stock_movement RPC (migration 0007) does both
-- atomically (UPDATE materials + INSERT stock_movements in a single tx).
-- This migration extends the trigger with the equivalent UPDATE via a
-- CTE so both writes happen together inside the trigger context.
--
-- Why a trigger instead of calling apply_stock_movement:
--   - apply_stock_movement is SECURITY INVOKER and would re-fetch
--     workshop_id from materials and check RLS — extra round trips
--     for no benefit here.
--   - The trigger is SECURITY DEFINER and runs in the same transaction
--     as the deduction batch INSERT, so atomicity is preserved.
--
-- Negative stock: the table-level check was dropped in PR7
-- (20260627000007_allow_controlled_negative_stock.sql). Negative
-- values are allowed for the controlled production-start path. The
-- trigger does NOT re-introduce a >= 0 check.

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

  WITH inserted_movements AS (
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
      AND abl.deduction_quantity IS NOT NULL
    RETURNING material_id, delta
  )
  UPDATE public.materials m
  SET stock = m.stock + COALESCE(sub.net_delta, 0),
      updated_at = now()
  FROM (
    SELECT material_id, SUM(delta) AS net_delta
    FROM inserted_movements
    GROUP BY material_id
  ) sub
  WHERE m.id = sub.material_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_apply_production_deduction_to_stock IS
  'Triggered AFTER INSERT on quote_production_stock_deductions. Inserts '
  'one stock_movement per approved BOM line for new-flow batches (those '
  'with production_order_id IS NOT NULL) when auto_stock_discount_enabled '
  'is true, AND applies the same delta to materials.stock so the current '
  'snapshot stays in sync with the ledger. Skips legacy batches '
  '(production_order_id IS NULL) because the legacy start_quote_production '
  'function inserts stock_movements directly. Casts reason to '
  '::public.stock_movement_reason enum explicitly.';