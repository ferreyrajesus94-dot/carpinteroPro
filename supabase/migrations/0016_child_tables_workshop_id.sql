-- ============================================================
-- Multi-tenant hardening: workshop_id directo en tablas hijo
-- ============================================================
-- Agrega workshop_id a las 5 tablas que lo obtenían vía JOIN al padre.
-- Backfill desde la tabla padre, luego NOT NULL + índice + RLS directo.
-- ============================================================

-- ── recipe_items (padre: furniture_templates) ─────────────────────────────
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS workshop_id uuid;

UPDATE recipe_items ri
SET    workshop_id = ft.workshop_id
FROM   furniture_templates ft
WHERE  ft.id = ri.furniture_template_id
  AND  ri.workshop_id IS NULL;

ALTER TABLE recipe_items ALTER COLUMN workshop_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS recipe_items_workshop_id_idx ON recipe_items (workshop_id);

DROP POLICY IF EXISTS "workshop_members_recipe_items" ON recipe_items;
CREATE POLICY "workshop_isolation_recipe_items" ON recipe_items
  FOR ALL
  USING  (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- ── labor_items (padre: furniture_templates) ──────────────────────────────
ALTER TABLE labor_items ADD COLUMN IF NOT EXISTS workshop_id uuid;

UPDATE labor_items li
SET    workshop_id = ft.workshop_id
FROM   furniture_templates ft
WHERE  ft.id = li.furniture_template_id
  AND  li.workshop_id IS NULL;

ALTER TABLE labor_items ALTER COLUMN workshop_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS labor_items_workshop_id_idx ON labor_items (workshop_id);

DROP POLICY IF EXISTS "labor_items by workshop" ON labor_items;
CREATE POLICY "workshop_isolation_labor_items" ON labor_items
  FOR ALL
  USING  (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- ── quote_extras (padre: quotes) ──────────────────────────────────────────
ALTER TABLE quote_extras ADD COLUMN IF NOT EXISTS workshop_id uuid;

UPDATE quote_extras qe
SET    workshop_id = q.workshop_id
FROM   quotes q
WHERE  q.id = qe.quote_id
  AND  qe.workshop_id IS NULL;

ALTER TABLE quote_extras ALTER COLUMN workshop_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS quote_extras_workshop_id_idx ON quote_extras (workshop_id);

-- quote_extras no tenía RLS — la habilitamos con política directa
ALTER TABLE quote_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workshop_isolation_quote_extras" ON quote_extras
  FOR ALL
  USING  (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- ── quote_recipe_snapshots (padre: quotes) ────────────────────────────────
ALTER TABLE quote_recipe_snapshots ADD COLUMN IF NOT EXISTS workshop_id uuid;

UPDATE quote_recipe_snapshots qrs
SET    workshop_id = q.workshop_id
FROM   quotes q
WHERE  q.id = qrs.quote_id
  AND  qrs.workshop_id IS NULL;

ALTER TABLE quote_recipe_snapshots ALTER COLUMN workshop_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS quote_recipe_snapshots_workshop_id_idx ON quote_recipe_snapshots (workshop_id);

DROP POLICY IF EXISTS "workshop_isolation_quote_recipe_snapshots" ON quote_recipe_snapshots;
CREATE POLICY "workshop_isolation_quote_recipe_snapshots" ON quote_recipe_snapshots
  FOR ALL
  USING  (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- ── quote_labor_snapshots (padre: quotes) ─────────────────────────────────
ALTER TABLE quote_labor_snapshots ADD COLUMN IF NOT EXISTS workshop_id uuid;

UPDATE quote_labor_snapshots qls
SET    workshop_id = q.workshop_id
FROM   quotes q
WHERE  q.id = qls.quote_id
  AND  qls.workshop_id IS NULL;

ALTER TABLE quote_labor_snapshots ALTER COLUMN workshop_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS quote_labor_snapshots_workshop_id_idx ON quote_labor_snapshots (workshop_id);

DROP POLICY IF EXISTS "workshop_isolation_quote_labor_snapshots" ON quote_labor_snapshots;
CREATE POLICY "workshop_isolation_quote_labor_snapshots" ON quote_labor_snapshots
  FOR ALL
  USING  (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());
