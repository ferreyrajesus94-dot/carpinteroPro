-- ============================================================
-- FASE 2: RLS real por workshop_id
-- ============================================================
-- Estrategia pre-auth:
--   El cliente envía el header "x-workshop-id" en cada request.
--   La función get_current_workshop_id() lo lee desde los headers
--   de PostgREST. Cuando se implemente Supabase Auth, esta función
--   se reemplazará por auth.uid() con claims del JWT.
-- ============================================================

-- Función que lee el workshop_id desde el header HTTP o JWT claims
CREATE OR REPLACE FUNCTION get_current_workshop_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  header_value text;
BEGIN
  -- Fase pre-auth: leer desde header custom enviado por el cliente
  BEGIN
    header_value := (current_setting('request.headers', true)::json)->>'x-workshop-id';
  EXCEPTION WHEN OTHERS THEN
    header_value := NULL;
  END;

  IF header_value IS NOT NULL AND header_value <> '' THEN
    RETURN header_value::uuid;
  END IF;

  -- TODO (Fase 5 - Auth real): reemplazar por:
  -- RETURN (auth.jwt()->'app_metadata'->>'workshop_id')::uuid;
  RETURN NULL;
END;
$$;

-- ============================================================
-- Reemplazar policies permisivas en todas las tablas
-- ============================================================

-- materials
DROP POLICY IF EXISTS "workshop_members_materials" ON materials;
CREATE POLICY "workshop_isolation_materials" ON materials
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- price_history
DROP POLICY IF EXISTS "workshop_members_price_history" ON price_history;
CREATE POLICY "workshop_isolation_price_history" ON price_history
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- furniture_templates
DROP POLICY IF EXISTS "workshop_members_furniture_templates" ON furniture_templates;
CREATE POLICY "workshop_isolation_furniture_templates" ON furniture_templates
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- recipe_items (sin workshop_id propio — hereda por furniture_template_id)
DROP POLICY IF EXISTS "workshop_members_recipe_items" ON recipe_items;
CREATE POLICY "workshop_isolation_recipe_items" ON recipe_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM furniture_templates ft
      WHERE ft.id = recipe_items.furniture_template_id
        AND ft.workshop_id = get_current_workshop_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM furniture_templates ft
      WHERE ft.id = recipe_items.furniture_template_id
        AND ft.workshop_id = get_current_workshop_id()
    )
  );

-- clients
DROP POLICY IF EXISTS "workshop_members_clients" ON clients;
CREATE POLICY "workshop_isolation_clients" ON clients
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- quotes
DROP POLICY IF EXISTS "workshop_members_quotes" ON quotes;
CREATE POLICY "workshop_isolation_quotes" ON quotes
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- quote_extras (hereda por quote_id)
DROP POLICY IF EXISTS "workshop_members_quote_extras" ON quote_extras;
CREATE POLICY "workshop_isolation_quote_extras" ON quote_extras
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_extras.quote_id
        AND q.workshop_id = get_current_workshop_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_extras.quote_id
        AND q.workshop_id = get_current_workshop_id()
    )
  );

-- contract_templates
DROP POLICY IF EXISTS "workshop_members_contract_templates" ON contract_templates;
CREATE POLICY "workshop_isolation_contract_templates" ON contract_templates
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());

-- workshop_settings
DROP POLICY IF EXISTS "workshop_members_workshop_settings" ON workshop_settings;
CREATE POLICY "workshop_isolation_workshop_settings" ON workshop_settings
  FOR ALL
  USING (workshop_id = get_current_workshop_id())
  WITH CHECK (workshop_id = get_current_workshop_id());
