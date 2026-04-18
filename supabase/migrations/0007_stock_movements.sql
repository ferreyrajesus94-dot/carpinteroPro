-- 0007: Movimientos de stock con motivo + toggle de descuento automático en settings.
--
-- Permite registrar entradas (compras) y salidas (consumo/merma/ajuste) con
-- trazabilidad. El frontend llama `apply_stock_movement` para mantener la
-- tabla `materials.stock` en sync dentro de una transacción.

CREATE TYPE stock_movement_reason AS ENUM (
  'compra',
  'consumo',
  'merma',
  'ajuste',
  'descuento_presupuesto'
);

CREATE TABLE stock_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  material_id  uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  delta        NUMERIC(12, 2) NOT NULL CHECK (delta <> 0),
  reason       stock_movement_reason NOT NULL,
  note         TEXT,
  quote_id     uuid REFERENCES quotes(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid
);

CREATE INDEX stock_movements_material_idx ON stock_movements (material_id, created_at DESC);
CREATE INDEX stock_movements_workshop_idx ON stock_movements (workshop_id, created_at DESC);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_movements_select ON stock_movements
  FOR SELECT USING (workshop_id = get_current_workshop_id());
CREATE POLICY stock_movements_insert ON stock_movements
  FOR INSERT WITH CHECK (workshop_id = get_current_workshop_id());
CREATE POLICY stock_movements_update ON stock_movements
  FOR UPDATE USING (workshop_id = get_current_workshop_id());
CREATE POLICY stock_movements_delete ON stock_movements
  FOR DELETE USING (workshop_id = get_current_workshop_id());

-- ============================================================
-- RPC: aplica un movimiento de stock + actualiza materials.stock atómicamente.
-- Devuelve el nuevo stock del material.
-- ============================================================
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
  v_new_stock   NUMERIC;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta cannot be zero';
  END IF;

  SELECT workshop_id INTO v_workshop_id
  FROM materials
  WHERE id = p_material_id;

  IF v_workshop_id IS NULL THEN
    RAISE EXCEPTION 'material % not found', p_material_id;
  END IF;

  UPDATE materials
  SET stock = stock + p_delta,
      updated_at = now()
  WHERE id = p_material_id
  RETURNING stock INTO v_new_stock;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'stock cannot be negative (would result in %)', v_new_stock;
  END IF;

  INSERT INTO stock_movements (workshop_id, material_id, delta, reason, note, quote_id)
  VALUES (v_workshop_id, p_material_id, p_delta, p_reason, p_note, p_quote_id);

  RETURN v_new_stock;
END;
$$;

-- ============================================================
-- Toggle: descuento automático de stock al aprobar presupuesto
-- ============================================================
ALTER TABLE workshop_settings
  ADD COLUMN auto_stock_discount BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN workshop_settings.auto_stock_discount IS
  'Si es true, al aprobar un presupuesto se descuenta del stock los materiales de su BOM.';
