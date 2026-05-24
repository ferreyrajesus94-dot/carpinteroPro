-- ============================================================
-- Triggers BEFORE INSERT para auto-rellenar workshop_id
-- en tablas hijo desde su tabla padre.
-- Permite que el código existente inserte sin proveer workshop_id;
-- el trigger lo llena antes del NOT NULL check.
-- ============================================================

-- ── recipe_items → furniture_templates ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fill_recipe_item_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id
    FROM furniture_templates WHERE id = NEW.furniture_template_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_items_fill_workshop_id ON recipe_items;
CREATE TRIGGER recipe_items_fill_workshop_id
  BEFORE INSERT ON recipe_items
  FOR EACH ROW EXECUTE FUNCTION fill_recipe_item_workshop_id();

-- ── labor_items → furniture_templates ────────────────────────────────────────
CREATE OR REPLACE FUNCTION fill_labor_item_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id
    FROM furniture_templates WHERE id = NEW.furniture_template_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS labor_items_fill_workshop_id ON labor_items;
CREATE TRIGGER labor_items_fill_workshop_id
  BEFORE INSERT ON labor_items
  FOR EACH ROW EXECUTE FUNCTION fill_labor_item_workshop_id();

-- ── quote_extras → quotes ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fill_quote_extra_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_extras_fill_workshop_id ON quote_extras;
CREATE TRIGGER quote_extras_fill_workshop_id
  BEFORE INSERT ON quote_extras
  FOR EACH ROW EXECUTE FUNCTION fill_quote_extra_workshop_id();

-- ── quote_recipe_snapshots → quotes ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fill_quote_recipe_snapshot_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_recipe_snapshots_fill_workshop_id ON quote_recipe_snapshots;
CREATE TRIGGER quote_recipe_snapshots_fill_workshop_id
  BEFORE INSERT ON quote_recipe_snapshots
  FOR EACH ROW EXECUTE FUNCTION fill_quote_recipe_snapshot_workshop_id();

-- ── quote_labor_snapshots → quotes ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fill_quote_labor_snapshot_workshop_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workshop_id IS NULL THEN
    SELECT workshop_id INTO NEW.workshop_id FROM quotes WHERE id = NEW.quote_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_labor_snapshots_fill_workshop_id ON quote_labor_snapshots;
CREATE TRIGGER quote_labor_snapshots_fill_workshop_id
  BEFORE INSERT ON quote_labor_snapshots
  FOR EACH ROW EXECUTE FUNCTION fill_quote_labor_snapshot_workshop_id();
