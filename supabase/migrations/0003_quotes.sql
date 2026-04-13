-- ============================================================
-- FASE 3: Presupuestos + Contratos + Plantillas
-- ============================================================

CREATE TYPE client_source AS ENUM (
  'mercadolibre', 'tiendanube', 'instagram', 'facebook', 'otro'
);

CREATE TYPE quote_status AS ENUM (
  'presupuesto', 'enviado', 'aprobado',
  'en_produccion', 'entregado', 'cancelado'
);

CREATE TYPE margin_mode AS ENUM ('on_cost', 'on_price');

-- ============================================================
-- Tabla: clients (mínima — Fase 4 agrega vista detalle + Kanban)
-- ============================================================
CREATE TABLE clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  source       client_source NOT NULL DEFAULT 'otro',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX clients_workshop_id_idx ON clients (workshop_id);

-- ============================================================
-- Tabla: quotes
-- ============================================================
CREATE TABLE quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id           uuid NOT NULL,
  quote_number          TEXT NOT NULL,
  client_id             uuid REFERENCES clients(id) ON DELETE SET NULL,
  furniture_template_id uuid REFERENCES furniture_templates(id) ON DELETE SET NULL,
  furniture_name        TEXT NOT NULL,
  recipe_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                quote_status NOT NULL DEFAULT 'presupuesto',
  margin_mode           margin_mode NOT NULL DEFAULT 'on_cost',
  margin_pct            NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (margin_pct >= 0),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, quote_number)
);

CREATE INDEX quotes_workshop_id_idx ON quotes (workshop_id);
CREATE INDEX quotes_client_id_idx   ON quotes (client_id);
CREATE INDEX quotes_status_idx      ON quotes (workshop_id, status);

-- Función para generar número de orden auto-incremental por taller
CREATE OR REPLACE FUNCTION generate_quote_number(p_workshop_id uuid)
RETURNS TEXT AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 3) AS INT)), 0) + 1
  INTO next_num
  FROM quotes
  WHERE workshop_id = p_workshop_id;
  RETURN 'P-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Tabla: quote_extras
-- ============================================================
CREATE TABLE quote_extras (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  show_in_quote  BOOLEAN NOT NULL DEFAULT true,
  sort_order     INT NOT NULL DEFAULT 0
);

CREATE INDEX quote_extras_quote_id_idx ON quote_extras (quote_id, sort_order);

-- ============================================================
-- Tabla: contract_templates
-- ============================================================
CREATE TABLE contract_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id     uuid NOT NULL,
  name            TEXT NOT NULL,
  body_markdown   TEXT NOT NULL DEFAULT '',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contract_templates_workshop_id_idx ON contract_templates (workshop_id);

-- ============================================================
-- Tabla: workshop_settings (1 fila por taller)
-- ============================================================
CREATE TABLE workshop_settings (
  workshop_id  uuid PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  logo_url     TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers updated_at
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workshop_settings_updated_at
  BEFORE UPDATE ON workshop_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS (permisivo, igual que fases anteriores)
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_extras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_settings  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workshop_members_clients"            ON clients           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "workshop_members_quotes"             ON quotes             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "workshop_members_quote_extras"       ON quote_extras       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "workshop_members_contract_templates" ON contract_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "workshop_members_workshop_settings"  ON workshop_settings  FOR ALL USING (true) WITH CHECK (true);

-- Seed: plantilla de contrato por defecto
INSERT INTO contract_templates (workshop_id, name, body_markdown, is_default)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Contrato estándar',
  E'**Condiciones del presupuesto {{quote_number}}**\n\nFecha: {{date}}\nCliente: {{client_name}}\nTaller: {{workshop_name}}\n\n**Validez:** Este presupuesto tiene validez de 15 días a partir de la fecha de emisión.\n\n**Seña:** Se requiere un 50% de seña para comenzar los trabajos.\n\n**Entrega:** El plazo de entrega se acordará al momento de confirmar el pedido.\n\n**Total: {{total}}**',
  true
);

-- Seed: configuración del taller demo
INSERT INTO workshop_settings (workshop_id, name, phone, address)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Carpintería Demo',
  '+54 11 1234-5678',
  'Buenos Aires, Argentina'
);
