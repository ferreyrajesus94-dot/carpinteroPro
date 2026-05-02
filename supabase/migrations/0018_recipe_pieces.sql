-- ============================================================
-- FASE: Despiece pieza por pieza (hoja de taller)
-- ============================================================
-- recipe_pieces: piezas físicas (cortes) de cada plantilla con
--   dimensiones, para que los empleados del taller sepan qué cortar.
-- quote_piece_snapshots: copia congelada del despiece al momento
--   de crear/editar un quote (mismo patrón que recipe/labor snapshots).
-- ============================================================

CREATE TABLE recipe_pieces (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id           uuid NOT NULL,
  furniture_template_id uuid NOT NULL REFERENCES furniture_templates (id) ON DELETE CASCADE,
  material_id           uuid REFERENCES materials (id) ON DELETE SET NULL,
  piece_name            TEXT NOT NULL,
  length_cm             NUMERIC(10, 2) NOT NULL CHECK (length_cm > 0),
  width_cm              NUMERIC(10, 2) NOT NULL CHECK (width_cm > 0),
  thickness_mm          NUMERIC(10, 2),
  quantity              INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes                 TEXT,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX recipe_pieces_template_idx ON recipe_pieces (furniture_template_id);
CREATE INDEX recipe_pieces_workshop_idx ON recipe_pieces (workshop_id);

CREATE TRIGGER recipe_pieces_updated_at
  BEFORE UPDATE ON recipe_pieces
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE recipe_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workshop_isolation_recipe_pieces" ON recipe_pieces;
CREATE POLICY "workshop_isolation_recipe_pieces" ON recipe_pieces
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- Autofill workshop_id desde furniture_templates (mismo patrón que 0017)
CREATE OR REPLACE FUNCTION fill_recipe_piece_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id
    FROM furniture_templates WHERE id = NEW.furniture_template_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_pieces_fill_workshop_id ON recipe_pieces;
CREATE TRIGGER recipe_pieces_fill_workshop_id
  BEFORE INSERT ON recipe_pieces
  FOR EACH ROW EXECUTE FUNCTION fill_recipe_piece_workshop_id();

-- ============================================================
-- quote_piece_snapshots
-- ============================================================
CREATE TABLE quote_piece_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   uuid NOT NULL,
  quote_id      uuid NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
  piece_name    TEXT NOT NULL,
  length_cm     NUMERIC(10, 2) NOT NULL,
  width_cm      NUMERIC(10, 2) NOT NULL,
  thickness_mm  NUMERIC(10, 2),
  material_name TEXT,
  quantity      INT NOT NULL DEFAULT 1,
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quote_piece_snapshots_quote_id_idx ON quote_piece_snapshots (quote_id);

ALTER TABLE quote_piece_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workshop_isolation_quote_piece_snapshots" ON quote_piece_snapshots;
CREATE POLICY "workshop_isolation_quote_piece_snapshots" ON quote_piece_snapshots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_piece_snapshots.quote_id
        AND q.workshop_id = get_current_workshop_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_piece_snapshots.quote_id
        AND q.workshop_id = get_current_workshop_id()
    )
  );

CREATE OR REPLACE FUNCTION fill_quote_piece_snapshot_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_piece_snapshots_fill_workshop_id ON quote_piece_snapshots;
CREATE TRIGGER quote_piece_snapshots_fill_workshop_id
  BEFORE INSERT ON quote_piece_snapshots
  FOR EACH ROW EXECUTE FUNCTION fill_quote_piece_snapshot_workshop_id();
