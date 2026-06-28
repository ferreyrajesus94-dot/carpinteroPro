-- Allow re-starting production after a batch has been reversed.
--
-- After reversing a production stock deduction batch, operators may need to
-- start production again for the same quote. The original unique constraint
-- (workshop_id, quote_id) prevented this permanently. This migration changes
-- the constraint to only enforce one *active* (non-reversed) batch per quote,
-- and updates the relevant RPCs to treat reversed batches as non-blocking.

-- ═════════════════════════════════════════════════════════════════════
-- 1. Replace full unique with partial unique for active batches only
-- ═════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS public.uq_production_deduction_quote;

CREATE UNIQUE INDEX IF NOT EXISTS uq_production_deduction_quote_active
  ON public.quote_production_stock_deductions (workshop_id, quote_id)
  WHERE status IS DISTINCT FROM 'reversed';

COMMENT ON INDEX public.uq_production_deduction_quote_active IS
  'At most one non-reversed production batch per quote. Reversed batches do not block a new production start.';

-- ═════════════════════════════════════════════════════════════════════
-- 2. Update get_quote_production_deduction_preview to return latest batch
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_quote_production_deduction_preview(
  p_quote_id uuid
)
RETURNS TABLE (
  line_number           integer,
  material_id           uuid,
  material_name         text,
  material_unit         text,
  material_category     text,
  deduction_quantity    numeric,
  current_stock         numeric,
  projected_stock       numeric,
  shortage_amount       numeric,
  is_complete           boolean,
  warning_code          text,
  existing_batch_id     uuid,
  existing_batch_status text
)
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_workshop_id         uuid;
  v_current_status      text;
  v_existing_batch_id   uuid;
  v_existing_status     text;
  v_auto_discount       boolean;
  v_row                 record;
BEGIN
  -- Derive workshop and verify access
  SELECT p.workshop_id INTO v_workshop_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Read quote status and verify ownership
  SELECT q.status, q.workshop_id INTO v_current_status, v_workshop_id
  FROM public.quotes q
  WHERE q.id = p_quote_id;

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_workshop_id <> (SELECT workshop_id FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Cross-workshop access denied' USING ERRCODE = '42501';
  END IF;

  -- Check for existing batch (most recent first, regardless of status)
  SELECT id, status INTO v_existing_batch_id, v_existing_status
  FROM public.quote_production_stock_deductions
  WHERE quote_id = p_quote_id
  ORDER BY confirmed_at DESC
  LIMIT 1;

  -- Read auto_stock_discount setting
  SELECT auto_stock_discount INTO v_auto_discount
  FROM public.workshop_settings
  WHERE workshop_id = v_workshop_id;

  -- Return one row per approved BOM line with stock info
  FOR v_row IN
    SELECT
      abl.line_number,
      abl.material_id,
      abl.material_name,
      abl.material_unit,
      abl.material_category,
      abl.deduction_quantity,
      abl.is_complete,
      abl.warning_code,
      COALESCE(m.stock, 0) AS current_stock
    FROM public.quote_approved_bom_lines abl
    LEFT JOIN public.materials m ON m.id = abl.material_id AND m.workshop_id = v_workshop_id
    WHERE abl.quote_id = p_quote_id
    ORDER BY abl.line_number
  LOOP
    line_number := v_row.line_number;
    material_id := v_row.material_id;
    material_name := v_row.material_name;
    material_unit := v_row.material_unit;
    material_category := v_row.material_category;
    deduction_quantity := v_row.deduction_quantity;
    current_stock := v_row.current_stock;
    is_complete := v_row.is_complete;
    warning_code := v_row.warning_code;
    existing_batch_id := v_existing_batch_id;
    existing_batch_status := v_existing_status;

    IF v_row.deduction_quantity IS NOT NULL THEN
      projected_stock := v_row.current_stock - v_row.deduction_quantity;
      IF projected_stock < 0 THEN
        shortage_amount := -projected_stock;
      ELSE
        shortage_amount := 0;
      END IF;
    ELSE
      projected_stock := NULL;
      shortage_amount := NULL;
    END IF;

    RETURN NEXT;
  END LOOP;

  -- If no approved BOM lines, return a single warning row
  IF NOT FOUND THEN
    line_number := 0;
    material_id := NULL;
    material_name := '(sin BOM aprobado)';
    material_unit := '';
    material_category := '';
    deduction_quantity := NULL;
    current_stock := NULL;
    projected_stock := NULL;
    shortage_amount := NULL;
    is_complete := false;
    warning_code := 'no_approved_bom';
    existing_batch_id := v_existing_batch_id;
    existing_batch_status := v_existing_status;
    RETURN NEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_quote_production_deduction_preview IS
  'Returns per-line preview with current stock, projected stock, and shortages. '
  'Creates no movements and updates no status. Idempotent read RPC.';

-- ═════════════════════════════════════════════════════════════════════
-- 3. Update start_quote_production to skip reversed batches
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.start_quote_production(
  p_quote_id          uuid,
  p_confirm_deduction boolean,
  p_request_id        uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
AS $$
DECLARE
  v_workshop_id         uuid;
  v_quote_status        text;
  v_batch_status        text;
  v_quote_number        text;
  v_auto_discount       boolean;
  v_batch_id            uuid;
  v_shortage_detected   boolean := false;
  v_snapshot_incomplete boolean := false;
  v_warnings            jsonb := '[]'::jsonb;
  v_movement_count      integer := 0;
  v_skipped_count       integer := 0;
  v_bom_line            record;
  v_material_stock      numeric;
  v_result              jsonb;
BEGIN
  -- 1. Lock quote and derive workshop
  SELECT q.workshop_id, q.status, q.quote_number
    INTO v_workshop_id, v_quote_status, v_quote_number
  FROM public.quotes q
  WHERE q.id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_workshop_id <> (SELECT workshop_id FROM profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Cross-workshop access denied' USING ERRCODE = '42501';
  END IF;

  -- 1b. Role check: only admin/operational can start production
  IF (SELECT workshop_role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'operational') THEN
    RAISE EXCEPTION 'not authorized to start production' USING ERRCODE = '42501';
  END IF;
    
  -- 2. Check if a NON-REVERSED batch already exists
  --    Reversed batches do not block a new production start.
  SELECT id, status, warning_summary INTO v_batch_id, v_batch_status, v_warnings
  FROM public.quote_production_stock_deductions
  WHERE quote_id = p_quote_id AND status IS DISTINCT FROM 'reversed'
  LIMIT 1;

  IF FOUND THEN
    -- Idempotent return: active batch already exists
    SELECT jsonb_build_object(
      'batch_id', id,
      'status', status,
      'movements_created', 0,
      'lines_skipped', 0,
      'shortage_detected', shortage_detected,
      'snapshot_incomplete', snapshot_incomplete,
      'warning_summary', warning_summary,
      'note', 'batch already exists – no new movements created'
    ) INTO v_result
    FROM public.quote_production_stock_deductions
    WHERE id = v_batch_id;

    -- Also update quote status if not already en_produccion
    IF v_quote_status <> 'en_produccion' THEN
      UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;
    END IF;

    RETURN v_result;
  END IF;

  -- 3. Check existing request_id for idempotency (if provided and we find a match)
  IF p_request_id IS NOT NULL THEN
    SELECT id, status INTO v_batch_id, v_batch_status
    FROM public.quote_production_stock_deductions
    WHERE workshop_id = v_workshop_id AND request_id = p_request_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'batch_id', v_batch_id,
        'status', v_batch_status,
        'movements_created', 0,
        'lines_skipped', 0,
        'shortage_detected', false,
        'snapshot_incomplete', false,
        'warning_summary', '[]'::jsonb,
        'note', 'batch already exists for this request_id'
      );
    END IF;
  END IF;

  -- 4. Require aprobado status
  IF v_quote_status IS DISTINCT FROM 'aprobado' THEN
    RAISE EXCEPTION 'Quote must be approved before production can start'
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. Read auto_stock_discount setting
  SELECT COALESCE(auto_stock_discount, false) INTO v_auto_discount
  FROM public.workshop_settings
  WHERE workshop_id = v_workshop_id;

  -- 6. If setting is off: just update status, no batch/movements
  IF NOT v_auto_discount THEN
    UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;

    RETURN jsonb_build_object(
      'batch_id', NULL,
      'status', 'completed',
      'movements_created', 0,
      'lines_skipped', 0,
      'shortage_detected', false,
      'snapshot_incomplete', false,
      'warning_summary', '[]'::jsonb,
      'note', 'auto_discount disabled – no movements created'
    );
  END IF;

  -- 7. If setting is on, require confirmation
  IF NOT p_confirm_deduction THEN
    RAISE EXCEPTION 'Confirmation required for automatic stock deduction'
      USING ERRCODE = 'P0001';
  END IF;

  -- 8. Insert the production deduction batch first
  INSERT INTO public.quote_production_stock_deductions (
    workshop_id, quote_id, request_id, status,
    auto_stock_discount_enabled, snapshot_incomplete, shortage_detected,
    warning_summary, confirmed_by
  ) VALUES (
    v_workshop_id, p_quote_id, p_request_id, 'completed',
    v_auto_discount, false, false,
    '[]'::jsonb, auth.uid()
  )
  RETURNING id INTO v_batch_id;

  -- 9. Iterate over complete approved BOM lines with valid quantities
  FOR v_bom_line IN
    SELECT abl.*
    FROM public.quote_approved_bom_lines abl
    WHERE abl.quote_id = p_quote_id
    ORDER BY abl.line_number
  LOOP
    -- Check completeness
    IF NOT v_bom_line.is_complete
       OR v_bom_line.deduction_quantity IS NULL
       OR v_bom_line.material_id IS NULL
    THEN
      v_skipped_count := v_skipped_count + 1;
      v_snapshot_incomplete := true;

      -- Add warning to batch summary
      v_warnings := v_warnings || jsonb_build_object(
        'line_number', v_bom_line.line_number,
        'material_name', v_bom_line.material_name,
        'warning_code', COALESCE(v_bom_line.warning_code, 'incomplete_line'),
        'is_complete', v_bom_line.is_complete,
        'deduction_quantity', v_bom_line.deduction_quantity
      );

      CONTINUE;
    END IF;

    -- Lock material row and read current stock
    SELECT m.stock INTO v_material_stock
    FROM public.materials m
    WHERE m.id = v_bom_line.material_id
      AND m.workshop_id = v_workshop_id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_skipped_count := v_skipped_count + 1;
      v_warnings := v_warnings || jsonb_build_object(
        'line_number', v_bom_line.line_number,
        'material_name', v_bom_line.material_name,
        'warning_code', 'material_not_found'
      );
      CONTINUE;
    END IF;

    -- Check for shortage
    IF v_material_stock < v_bom_line.deduction_quantity THEN
      v_shortage_detected := true;
    END IF;

    -- Update stock (allows negative for this controlled path)
    UPDATE public.materials
    SET stock = stock - v_bom_line.deduction_quantity,
        updated_at = now()
    WHERE id = v_bom_line.material_id
      AND workshop_id = v_workshop_id;

    -- Insert stock movement
    INSERT INTO public.stock_movements (
      workshop_id, material_id, delta, reason, note,
      quote_id, production_deduction_id, created_by
    ) VALUES (
      v_workshop_id,
      v_bom_line.material_id,
      -v_bom_line.deduction_quantity,
      'consumo_produccion',
      format('Inicio de producción presupuesto %s', v_quote_number),
      p_quote_id,
      v_batch_id,
      auth.uid()
    );

    v_movement_count := v_movement_count + 1;
  END LOOP;

  -- 10. Update the batch with final warning/shortage info
  UPDATE public.quote_production_stock_deductions
  SET
    snapshot_incomplete = v_snapshot_incomplete,
    shortage_detected = v_shortage_detected,
    warning_summary = v_warnings
  WHERE id = v_batch_id;

  -- 11. Update quote status
  UPDATE public.quotes SET status = 'en_produccion' WHERE id = p_quote_id;

  -- 12. Return result
  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'status', 'completed',
    'movements_created', v_movement_count,
    'lines_skipped', v_skipped_count,
    'shortage_detected', v_shortage_detected,
    'snapshot_incomplete', v_snapshot_incomplete,
    'warning_summary', v_warnings
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Ensure atomic rollback: if any part fails, the transaction rolls back
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.start_quote_production IS
  'Atomically starts production: validates status, checks auto_discount, '
  'deducts confirmed complete BOM lines (allowing negative stock for this path), '
  'inserts consumo_produccion movements, and creates one batch per quote. '
  'Idempotent: existing non-reversed batch returns existing result without duplicates. '
  'Reversed batches do not block a new production start.';
