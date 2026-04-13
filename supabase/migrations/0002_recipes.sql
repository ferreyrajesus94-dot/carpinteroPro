-- ============================================================
-- FASE 2: Muebles (BOM — Bill of Materials)
-- ============================================================

CREATE TABLE furniture_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL,
  name         TEXT NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX furniture_templates_workshop_id_idx ON furniture_templates (workshop_id);

CREATE TABLE recipe_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  furniture_template_id uuid NOT NULL REFERENCES furniture_templates (id) ON DELETE CASCADE,
  material_id           uuid NOT NULL REFERENCES materials (id) ON DELETE RESTRICT,
  quantity              NUMERIC(12, 4) NOT NULL CHECK (quantity > 0)
);

CREATE INDEX recipe_items_template_idx ON recipe_items (furniture_template_id);

-- Reutilizar la función set_updated_at ya definida en 0001_init.sql
CREATE TRIGGER furniture_templates_updated_at
  BEFORE UPDATE ON furniture_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS (permisivo, igual que Fase 1)
ALTER TABLE furniture_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workshop_members_furniture_templates" ON furniture_templates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "workshop_members_recipe_items" ON recipe_items
  FOR ALL USING (true) WITH CHECK (true);
