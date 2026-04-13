-- ============================================================
-- FASE 1: Inventario + Historial de Precios
-- ============================================================

-- Tipos de unidad de medida
CREATE TYPE unit_of_measure AS ENUM (
  'ml', 'l',        -- líquidos
  'g', 'kg',        -- peso
  'cm', 'm',        -- longitud
  'cm2', 'm2',      -- área
  'cm3', 'm3',      -- volumen
  'un'              -- unidades
);

-- Categorías de material
CREATE TYPE material_category AS ENUM (
  'madera',
  'herraje',
  'pintura',
  'adhesivo',
  'vidrio',
  'tela',
  'otro'
);

-- ============================================================
-- Tabla: materials
-- ============================================================
CREATE TABLE materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id     uuid NOT NULL,
  name            TEXT NOT NULL,
  category        material_category NOT NULL DEFAULT 'otro',
  unit            unit_of_measure NOT NULL DEFAULT 'un',
  price_per_unit  NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (price_per_unit >= 0),
  stock           NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock       NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices útiles para filtros frecuentes
CREATE INDEX materials_workshop_id_idx ON materials (workshop_id);
CREATE INDEX materials_category_idx    ON materials (workshop_id, category);
CREATE INDEX materials_low_stock_idx   ON materials (workshop_id) WHERE stock <= min_stock;

-- ============================================================
-- Tabla: price_history
-- ============================================================
CREATE TABLE price_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id  uuid NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
  workshop_id  uuid NOT NULL,
  old_price    NUMERIC(12, 4) NOT NULL,
  new_price    NUMERIC(12, 4) NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX price_history_material_idx ON price_history (material_id, changed_at DESC);

-- ============================================================
-- Trigger: registrar cambios de precio automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registra si el precio realmente cambió
  IF OLD.price_per_unit IS DISTINCT FROM NEW.price_per_unit THEN
    INSERT INTO price_history (material_id, workshop_id, old_price, new_price)
    VALUES (NEW.id, NEW.workshop_id, OLD.price_per_unit, NEW.price_per_unit);
  END IF;
  -- Actualiza updated_at siempre
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER materials_price_change_trigger
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();

-- Trigger para updated_at en inserts también
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS (Row Level Security) — preparado para multi-tenant
-- ============================================================
ALTER TABLE materials     ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas mientras no haya auth real (se refinan en prod)
-- Por ahora permite acceso por workshop_id igual al de la sesión o al placeholder
CREATE POLICY "workshop_members_materials" ON materials
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "workshop_members_price_history" ON price_history
  FOR ALL USING (true) WITH CHECK (true);
