# Fase 3 — Presupuestos + Contratos + Plantillas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor de cálculo puro con TDD, formulario de presupuesto con live preview, plantillas de contrato editables, export a WhatsApp/PDF con branding del taller, pantalla de ajustes del taller.

**Architecture:** Feature-sliced bajo `src/features/quotes/` y `src/features/settings/`. Lógica pura en `lib/` (calculator, contractRenderer, pdf) sin dependencias React. API Supabase en `api/`, hooks TanStack Query en `hooks/`, componentes en `components/`. El `QuoteForm` es página única con secciones y live preview lateral igual al patrón de `MuebleForm`.

**Tech Stack:** React 18, TypeScript, Supabase (Postgres), TanStack Query, React Hook Form + Zod, shadcn/ui, jsPDF v4, date-fns, Vitest.

---

## File Map

**Crear:**
- `supabase/migrations/0003_quotes.sql`
- `src/shared/types/database.ts` (modificar — agregar tablas y enums nuevos)
- `src/shared/ui/switch.tsx` (via shadcn)
- `src/shared/ui/radio-group.tsx` (via shadcn)
- `src/features/quotes/types.ts`
- `src/features/quotes/lib/calculator.ts`
- `src/features/quotes/lib/contractRenderer.ts`
- `src/features/quotes/lib/pdf.ts`
- `src/features/quotes/api/clients.ts`
- `src/features/quotes/api/quotes.ts`
- `src/features/quotes/api/contractTemplates.ts`
- `src/features/quotes/hooks/useClients.ts`
- `src/features/quotes/hooks/useQuotes.ts`
- `src/features/quotes/hooks/useContractTemplates.ts`
- `src/features/quotes/components/QuoteList.tsx`
- `src/features/quotes/components/ClientDialog.tsx`
- `src/features/quotes/components/QuoteExtrasFieldArray.tsx`
- `src/features/quotes/components/QuoteLivePreview.tsx`
- `src/features/quotes/components/QuoteForm.tsx`
- `src/features/quotes/components/ContractPreview.tsx`
- `src/features/quotes/components/TemplateEditor.tsx`
- `src/features/settings/api/workshopSettings.ts`
- `src/features/settings/hooks/useWorkshopSettings.ts`
- `src/features/settings/components/WorkshopSettings.tsx`
- `src/features/settings/routes.tsx`
- `tests/features/quotes/calculator.test.ts`
- `tests/features/quotes/contractRenderer.test.ts`

**Modificar:**
- `src/features/quotes/routes.tsx` (reemplazar placeholder con sub-rutas)
- `src/app/router.tsx` (agregar ruta `/settings`)
- `src/app/layouts/AppLayout.tsx` (agregar Settings al nav)

---

## Task 1: SQL migration

**Files:**
- Create: `supabase/migrations/0003_quotes.sql`

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/0003_quotes.sql` con el siguiente contenido:

```sql
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
```

- [ ] **Step 2: Aplicar la migración en Supabase**

```bash
npx supabase db push --db-url "postgresql://postgres:<password>@db.revbbzqjglqnphjrasvv.supabase.co:5432/postgres"
```

Si no tenés la URL directa, aplicar desde el dashboard de Supabase en SQL Editor pegando el contenido del archivo.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_quotes.sql
git commit -m "feat(db): add quotes, clients, contract_templates, workshop_settings migration"
```

---

## Task 2: Actualizar database.ts manualmente

**Files:**
- Modify: `src/shared/types/database.ts`

> No hay token personal disponible para `supabase gen types`. Actualizar manualmente.

- [ ] **Step 1: Agregar los nuevos tipos**

Abrir `src/shared/types/database.ts`. Reemplazar el contenido completo con:

```typescript
// Auto-generated from supabase/migrations — updated manually for Fase 3
// Re-generate with: SUPABASE_ACCESS_TOKEN=<sbp_token> npx supabase gen types typescript --project-id revbbzqjglqnphjrasvv > src/shared/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      materials: {
        Row: {
          id: string
          workshop_id: string
          name: string
          category: Database['public']['Enums']['material_category']
          unit: Database['public']['Enums']['unit_of_measure']
          price_per_unit: number
          stock: number
          min_stock: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          category?: Database['public']['Enums']['material_category']
          unit?: Database['public']['Enums']['unit_of_measure']
          price_per_unit?: number
          stock?: number
          min_stock?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          category?: Database['public']['Enums']['material_category']
          unit?: Database['public']['Enums']['unit_of_measure']
          price_per_unit?: number
          stock?: number
          min_stock?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          id: string
          material_id: string
          workshop_id: string
          old_price: number
          new_price: number
          changed_at: string
        }
        Insert: {
          id?: string
          material_id: string
          workshop_id: string
          old_price: number
          new_price: number
          changed_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          workshop_id?: string
          old_price?: number
          new_price?: number
          changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_history_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          }
        ]
      }
      furniture_templates: {
        Row: {
          id: string
          workshop_id: string
          name: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          id: string
          furniture_template_id: string
          material_id: string
          quantity: number
        }
        Insert: {
          id?: string
          furniture_template_id: string
          material_id: string
          quantity: number
        }
        Update: {
          id?: string
          furniture_template_id?: string
          material_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_items_furniture_template_id_fkey'
            columns: ['furniture_template_id']
            isOneToOne: false
            referencedRelation: 'furniture_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_items_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          }
        ]
      }
      clients: {
        Row: {
          id: string
          workshop_id: string
          name: string
          phone: string | null
          email: string | null
          source: Database['public']['Enums']['client_source']
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          phone?: string | null
          email?: string | null
          source?: Database['public']['Enums']['client_source']
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          source?: Database['public']['Enums']['client_source']
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          workshop_id: string
          quote_number: string
          client_id: string | null
          furniture_template_id: string | null
          furniture_name: string
          recipe_cost: number
          status: Database['public']['Enums']['quote_status']
          margin_mode: Database['public']['Enums']['margin_mode']
          margin_pct: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          quote_number: string
          client_id?: string | null
          furniture_template_id?: string | null
          furniture_name: string
          recipe_cost?: number
          status?: Database['public']['Enums']['quote_status']
          margin_mode?: Database['public']['Enums']['margin_mode']
          margin_pct?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          quote_number?: string
          client_id?: string | null
          furniture_template_id?: string | null
          furniture_name?: string
          recipe_cost?: number
          status?: Database['public']['Enums']['quote_status']
          margin_mode?: Database['public']['Enums']['margin_mode']
          margin_pct?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quotes_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotes_furniture_template_id_fkey'
            columns: ['furniture_template_id']
            isOneToOne: false
            referencedRelation: 'furniture_templates'
            referencedColumns: ['id']
          }
        ]
      }
      quote_extras: {
        Row: {
          id: string
          quote_id: string
          description: string
          amount: number
          show_in_quote: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          amount?: number
          show_in_quote?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          quote_id?: string
          description?: string
          amount?: number
          show_in_quote?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'quote_extras_quote_id_fkey'
            columns: ['quote_id']
            isOneToOne: false
            referencedRelation: 'quotes'
            referencedColumns: ['id']
          }
        ]
      }
      contract_templates: {
        Row: {
          id: string
          workshop_id: string
          name: string
          body_markdown: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workshop_id: string
          name: string
          body_markdown?: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workshop_id?: string
          name?: string
          body_markdown?: string
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
      workshop_settings: {
        Row: {
          workshop_id: string
          name: string
          logo_url: string | null
          phone: string | null
          email: string | null
          address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          workshop_id: string
          name?: string
          logo_url?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workshop_id?: string
          name?: string
          logo_url?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_number: {
        Args: { p_workshop_id: string }
        Returns: string
      }
    }
    Enums: {
      material_category:
        | 'madera'
        | 'herraje'
        | 'pintura'
        | 'adhesivo'
        | 'vidrio'
        | 'tela'
        | 'otro'
      unit_of_measure:
        | 'ml'
        | 'l'
        | 'g'
        | 'kg'
        | 'cm'
        | 'm'
        | 'cm2'
        | 'm2'
        | 'cm3'
        | 'm3'
        | 'un'
      client_source:
        | 'mercadolibre'
        | 'tiendanube'
        | 'instagram'
        | 'facebook'
        | 'otro'
      quote_status:
        | 'presupuesto'
        | 'enviado'
        | 'aprobado'
        | 'en_produccion'
        | 'entregado'
        | 'cancelado'
      margin_mode:
        | 'on_cost'
        | 'on_price'
    }
  }
}
```

- [ ] **Step 2: Verificar que el build TS no rompe lo existente**

```bash
npm run build
```

Expected: sin errores de tipo. Si hay errores en archivos existentes relacionados a tipos nuevos, son falsos positivos — la migración aún no corrió localmente.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/database.ts
git commit -m "feat(types): add Fase 3 DB types (clients, quotes, contract_templates, workshop_settings)"
```

---

## Task 3: Instalar componentes shadcn faltantes

**Files:**
- Create: `src/shared/ui/switch.tsx`
- Create: `src/shared/ui/radio-group.tsx`

- [ ] **Step 1: Instalar Switch**

```bash
npx shadcn add switch
```

Si el archivo se creó en `@/shared/ui/switch.tsx` (bug conocido):
```bash
cp @/shared/ui/switch.tsx src/shared/ui/switch.tsx && rm -rf @/
```

- [ ] **Step 2: Instalar RadioGroup**

```bash
npx shadcn add radio-group
```

Si el archivo se creó en `@/shared/ui/radio-group.tsx`:
```bash
cp @/shared/ui/radio-group.tsx src/shared/ui/radio-group.tsx && rm -rf @/
```

- [ ] **Step 3: Verificar que compilan**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/shared/ui/switch.tsx src/shared/ui/radio-group.tsx
git commit -m "feat(ui): add Switch and RadioGroup shadcn components"
```

---

## Task 4: Types para el feature quotes

**Files:**
- Create: `src/features/quotes/types.ts`

- [ ] **Step 1: Crear el archivo de tipos**

Crear `src/features/quotes/types.ts`:

```typescript
import type { Database } from '@/shared/types/database'

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']
export type ClientSource = Database['public']['Enums']['client_source']

export type Quote = Database['public']['Tables']['quotes']['Row']
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update']
export type QuoteStatus = Database['public']['Enums']['quote_status']
export type MarginMode = Database['public']['Enums']['margin_mode']

export type QuoteExtra = Database['public']['Tables']['quote_extras']['Row']
export type QuoteExtraInsert = Database['public']['Tables']['quote_extras']['Insert']

export type ContractTemplate = Database['public']['Tables']['contract_templates']['Row']
export type ContractTemplateInsert = Database['public']['Tables']['contract_templates']['Insert']
export type ContractTemplateUpdate = Database['public']['Tables']['contract_templates']['Update']

export type WorkshopSettings = Database['public']['Tables']['workshop_settings']['Row']
export type WorkshopSettingsInsert = Database['public']['Tables']['workshop_settings']['Insert']
export type WorkshopSettingsUpdate = Database['public']['Tables']['workshop_settings']['Update']

// Quote completo con cliente y extras (viene del JOIN en la API)
export type QuoteWithExtras = Quote & {
  extras: QuoteExtra[]
  client: Client | null
}

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  mercadolibre: 'MercadoLibre',
  tiendanube: 'TiendaNube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  otro: 'Otro',
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  presupuesto: 'Presupuesto',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  en_produccion: 'En producción',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  presupuesto: 'bg-gray-100 text-gray-700',
  enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  en_produccion: 'bg-yellow-100 text-yellow-700',
  entregado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-red-100 text-red-700',
}

// Formatea números al estilo argentino: 1234567.89 → "$1.234.567,89"
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/types.ts
git commit -m "feat(quotes): add feature types and constants"
```

---

## Task 5: TDD — calculator.ts

**Files:**
- Create: `tests/features/quotes/calculator.test.ts`
- Create: `src/features/quotes/lib/calculator.ts`

- [ ] **Step 1: Escribir los tests (primero — TDD)**

Crear `tests/features/quotes/calculator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateQuote } from '@/features/quotes/lib/calculator'

describe('calculateQuote', () => {
  it('on_cost: salePrice = costBase * (1 + pct/100)', () => {
    const result = calculateQuote({
      recipeCost: 100,
      extras: [],
      marginMode: 'on_cost',
      marginPct: 30,
    })
    expect(result.costBase).toBe(100)
    expect(result.salePrice).toBeCloseTo(130)
    expect(result.marginAmount).toBeCloseTo(30)
  })

  it('on_price: salePrice = costBase / (1 - pct/100)', () => {
    const result = calculateQuote({
      recipeCost: 100,
      extras: [],
      marginMode: 'on_price',
      marginPct: 30,
    })
    expect(result.costBase).toBe(100)
    expect(result.salePrice).toBeCloseTo(142.86, 1)
    expect(result.marginAmount).toBeCloseTo(42.86, 1)
  })

  it('suma todos los extras al costBase independientemente de show_in_quote', () => {
    const result = calculateQuote({
      recipeCost: 100,
      extras: [
        { amount: 20, show_in_quote: true },
        { amount: 15, show_in_quote: false },
      ],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.costBase).toBe(135)
    expect(result.salePrice).toBe(135)
  })

  it('visibleExtras solo incluye extras con show_in_quote=true', () => {
    const result = calculateQuote({
      recipeCost: 80,
      extras: [
        { amount: 10, show_in_quote: true },
        { amount: 25, show_in_quote: false },
      ],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.visibleExtras).toBe(10)
  })

  it('margen 0%: salePrice === costBase', () => {
    const result = calculateQuote({
      recipeCost: 500,
      extras: [],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.salePrice).toBe(500)
    expect(result.marginAmount).toBe(0)
  })

  it('sin extras: costBase === recipeCost', () => {
    const result = calculateQuote({
      recipeCost: 200,
      extras: [],
      marginMode: 'on_price',
      marginPct: 25,
    })
    expect(result.costBase).toBe(200)
  })

  it('recipeCost=0 con solo extras', () => {
    const result = calculateQuote({
      recipeCost: 0,
      extras: [{ amount: 50, show_in_quote: true }],
      marginMode: 'on_cost',
      marginPct: 10,
    })
    expect(result.costBase).toBe(50)
    expect(result.salePrice).toBeCloseTo(55)
  })
})
```

- [ ] **Step 2: Ejecutar el test — debe FALLAR**

```bash
npx vitest run tests/features/quotes/calculator.test.ts
```

Expected: FAIL — "Cannot find module '@/features/quotes/lib/calculator'"

- [ ] **Step 3: Implementar calculator.ts**

Crear `src/features/quotes/lib/calculator.ts`:

```typescript
export interface CalcExtra {
  amount: number
  show_in_quote: boolean
}

export interface CalcInput {
  recipeCost: number
  extras: CalcExtra[]
  marginMode: 'on_cost' | 'on_price'
  marginPct: number // 0-100
}

export interface CalcResult {
  costBase: number      // recipeCost + totalExtras (todos)
  visibleExtras: number // sum de extras con show_in_quote=true
  marginAmount: number
  salePrice: number
}

export function calculateQuote(input: CalcInput): CalcResult {
  const { recipeCost, extras, marginMode, marginPct } = input

  const totalExtras = extras.reduce((acc, e) => acc + e.amount, 0)
  const visibleExtras = extras
    .filter((e) => e.show_in_quote)
    .reduce((acc, e) => acc + e.amount, 0)

  const costBase = recipeCost + totalExtras

  let salePrice: number
  if (marginMode === 'on_cost') {
    salePrice = costBase * (1 + marginPct / 100)
  } else {
    // on_price: marginPct must be < 100 to avoid division by zero
    const divisor = 1 - marginPct / 100
    salePrice = divisor > 0 ? costBase / divisor : costBase
  }

  return {
    costBase,
    visibleExtras,
    marginAmount: salePrice - costBase,
    salePrice,
  }
}
```

- [ ] **Step 4: Ejecutar el test — debe PASAR**

```bash
npx vitest run tests/features/quotes/calculator.test.ts
```

Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add tests/features/quotes/calculator.test.ts src/features/quotes/lib/calculator.ts
git commit -m "feat(quotes): add calculator pure function with TDD"
```

---

## Task 6: TDD — contractRenderer.ts

**Files:**
- Create: `tests/features/quotes/contractRenderer.test.ts`
- Create: `src/features/quotes/lib/contractRenderer.ts`

- [ ] **Step 1: Escribir los tests**

Crear `tests/features/quotes/contractRenderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderContract } from '@/features/quotes/lib/contractRenderer'

describe('renderContract', () => {
  it('reemplaza todas las variables conocidas', () => {
    const template = 'Hola {{client_name}}, tu presupuesto es {{quote_number}} por {{total}}.'
    const result = renderContract(template, {
      client_name: 'Juan',
      quote_number: 'P-0001',
      total: '$130.000',
      furniture_name: 'Mesa',
      workshop_name: 'Taller X',
      date: '13/04/2026',
    })
    expect(result).toBe('Hola Juan, tu presupuesto es P-0001 por $130.000.')
  })

  it('deja variable desconocida intacta', () => {
    const result = renderContract('Hola {{nombre_raro}}', {
      client_name: 'Ana',
      quote_number: 'P-0002',
      total: '$50.000',
      furniture_name: 'Silla',
      workshop_name: 'Taller Y',
      date: '13/04/2026',
    })
    expect(result).toBe('Hola {{nombre_raro}}')
  })

  it('template vacío devuelve string vacío', () => {
    const result = renderContract('', {
      client_name: 'Ana',
      quote_number: 'P-0003',
      total: '$0',
      furniture_name: '',
      workshop_name: '',
      date: '',
    })
    expect(result).toBe('')
  })

  it('reemplaza múltiples ocurrencias de la misma variable', () => {
    const result = renderContract('{{workshop_name}} - {{workshop_name}}', {
      client_name: '',
      quote_number: '',
      total: '',
      furniture_name: '',
      workshop_name: 'Taller ABC',
      date: '',
    })
    expect(result).toBe('Taller ABC - Taller ABC')
  })

  it('reemplaza {{furniture_name}} y {{date}}', () => {
    const result = renderContract('Mueble: {{furniture_name}} — Fecha: {{date}}', {
      client_name: '',
      quote_number: '',
      total: '',
      furniture_name: 'Ropero 2 puertas',
      workshop_name: '',
      date: '13/04/2026',
    })
    expect(result).toBe('Mueble: Ropero 2 puertas — Fecha: 13/04/2026')
  })
})
```

- [ ] **Step 2: Ejecutar el test — debe FALLAR**

```bash
npx vitest run tests/features/quotes/contractRenderer.test.ts
```

Expected: FAIL — "Cannot find module '@/features/quotes/lib/contractRenderer'"

- [ ] **Step 3: Implementar contractRenderer.ts**

Crear `src/features/quotes/lib/contractRenderer.ts`:

```typescript
export interface ContractVariables {
  client_name: string
  quote_number: string
  total: string
  furniture_name: string
  workshop_name: string
  date: string
}

export function renderContract(template: string, vars: ContractVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? vars[key as keyof ContractVariables] : match
  })
}
```

- [ ] **Step 4: Ejecutar los tests — deben PASAR**

```bash
npx vitest run tests/features/quotes/contractRenderer.test.ts
```

Expected: PASS — 5 tests passed.

- [ ] **Step 5: Ejecutar todos los tests**

```bash
npm run test
```

Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add tests/features/quotes/contractRenderer.test.ts src/features/quotes/lib/contractRenderer.ts
git commit -m "feat(quotes): add contractRenderer pure function with TDD"
```

---

## Task 7: Settings feature

**Files:**
- Create: `src/features/settings/api/workshopSettings.ts`
- Create: `src/features/settings/hooks/useWorkshopSettings.ts`
- Create: `src/features/settings/components/WorkshopSettings.tsx`
- Create: `src/features/settings/routes.tsx`

- [ ] **Step 1: API layer**

Crear `src/features/settings/api/workshopSettings.ts`:

```typescript
import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database'

type WorkshopSettings = Database['public']['Tables']['workshop_settings']['Row']
type WorkshopSettingsInsert = Database['public']['Tables']['workshop_settings']['Insert']
type WorkshopSettingsUpdate = Database['public']['Tables']['workshop_settings']['Update']

export type { WorkshopSettings }

export async function fetchWorkshopSettings(workshopId: string): Promise<WorkshopSettings | null> {
  const { data, error } = await supabase
    .from('workshop_settings')
    .select('*')
    .eq('workshop_id', workshopId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertWorkshopSettings(
  settings: WorkshopSettingsInsert | WorkshopSettingsUpdate & { workshop_id: string }
): Promise<void> {
  const { error } = await supabase
    .from('workshop_settings')
    .upsert(settings, { onConflict: 'workshop_id' })
  if (error) throw error
}
```

- [ ] **Step 2: Hook**

Crear `src/features/settings/hooks/useWorkshopSettings.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchWorkshopSettings, upsertWorkshopSettings } from '../api/workshopSettings'
import type { WorkshopSettingsInsert } from '@/features/quotes/types'

const SETTINGS_KEY = 'workshop_settings'

export function useWorkshopSettings(workshopId: string) {
  return useQuery({
    queryKey: [SETTINGS_KEY, workshopId],
    queryFn: () => fetchWorkshopSettings(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useUpsertWorkshopSettings(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Omit<WorkshopSettingsInsert, 'workshop_id'>) =>
      upsertWorkshopSettings({ ...settings, workshop_id: workshopId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY, workshopId] }),
  })
}
```

- [ ] **Step 3: Componente WorkshopSettings**

Crear `src/features/settings/components/WorkshopSettings.tsx`:

```typescript
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useWorkshopSettings, useUpsertWorkshopSettings } from '../hooks/useWorkshopSettings'

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  logo_url: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function WorkshopSettings() {
  const workshopId = useWorkshopId()
  const { data: settings, isLoading } = useWorkshopSettings(workshopId)
  const upsertMutation = useUpsertWorkshopSettings(workshopId)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '', address: '', logo_url: '' },
  })

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name,
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        address: settings.address ?? '',
        logo_url: settings.logo_url ?? '',
      })
    }
  }, [settings, reset])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setValue('logo_url', reader.result as string)
    reader.readAsDataURL(file)
  }

  async function onSubmit(values: FormValues) {
    await upsertMutation.mutateAsync({
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      logo_url: values.logo_url || null,
    })
  }

  if (isLoading) return <div className="p-4 text-muted-foreground">Cargando...</div>

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Ajustes del taller</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del taller</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nombre del taller</Label>
              <Input id="name" {...register('name')} placeholder="Ej: Carpintería San Martín" />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...register('phone')} placeholder="+54 11 1234-5678" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} placeholder="taller@ejemplo.com" />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" {...register('address')} placeholder="Calle 123, Ciudad" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="logo">Logo del taller</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                La imagen se guarda en el dispositivo y aparece en el PDF.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Routes**

Crear `src/features/settings/routes.tsx`:

```typescript
import { WorkshopSettings } from './components/WorkshopSettings'

export function SettingsRoutes() {
  return <WorkshopSettings />
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/
git commit -m "feat(settings): add WorkshopSettings feature (api, hook, component, routes)"
```

---

## Task 8: Clients API + Hook

**Files:**
- Create: `src/features/quotes/api/clients.ts`
- Create: `src/features/quotes/hooks/useClients.ts`

- [ ] **Step 1: API**

Crear `src/features/quotes/api/clients.ts`:

```typescript
import { supabase } from '@/shared/lib/supabase'
import type { Client, ClientInsert, ClientUpdate } from '../types'

export async function fetchClients(workshopId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createClient(
  client: Omit<ClientInsert, 'id' | 'created_at'>
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClient(id: string, client: ClientUpdate): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update(client)
    .eq('id', id)
  if (error) throw error
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Hook**

Crear `src/features/quotes/hooks/useClients.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClients, createClient, updateClient, deleteClient } from '../api/clients'
import type { ClientInsert, ClientUpdate } from '../types'

const CLIENTS_KEY = 'clients'

export function useClients(workshopId: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, workshopId],
    queryFn: () => fetchClients(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useCreateClient(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (client: Omit<ClientInsert, 'id' | 'created_at'>) => createClient(client),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, workshopId] }),
  })
}

export function useUpdateClient(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientUpdate }) => updateClient(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, workshopId] }),
  })
}

export function useDeleteClient(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, workshopId] }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/api/clients.ts src/features/quotes/hooks/useClients.ts
git commit -m "feat(quotes): add clients API and hooks"
```

---

## Task 9: Quotes API + Hook

**Files:**
- Create: `src/features/quotes/api/quotes.ts`
- Create: `src/features/quotes/hooks/useQuotes.ts`

- [ ] **Step 1: API**

Crear `src/features/quotes/api/quotes.ts`:

```typescript
import { supabase } from '@/shared/lib/supabase'
import type { Quote, QuoteInsert, QuoteUpdate, QuoteExtra, QuoteExtraInsert, QuoteWithExtras } from '../types'

const QUOTE_SELECT = `
  *,
  client:clients (*),
  extras:quote_extras (*)
` as const

export async function fetchQuotes(workshopId: string): Promise<QuoteWithExtras[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as QuoteWithExtras[]
}

export async function fetchQuote(id: string): Promise<QuoteWithExtras> {
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as QuoteWithExtras
}

export async function generateQuoteNumber(workshopId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_quote_number', {
    p_workshop_id: workshopId,
  })
  if (error) throw error
  return data as string
}

export async function createQuote(
  quote: Omit<QuoteInsert, 'id' | 'created_at' | 'updated_at'>,
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
): Promise<string> {
  const { data, error } = await supabase
    .from('quotes')
    .insert(quote)
    .select('id')
    .single()
  if (error) throw error

  if (extras.length > 0) {
    const { error: extrasError } = await supabase
      .from('quote_extras')
      .insert(extras.map((e, i) => ({ ...e, quote_id: data.id, sort_order: i })))
    if (extrasError) throw extrasError
  }

  return data.id
}

export async function updateQuote(
  id: string,
  quote: QuoteUpdate,
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
): Promise<void> {
  const { error } = await supabase.from('quotes').update(quote).eq('id', id)
  if (error) throw error

  const { error: deleteError } = await supabase
    .from('quote_extras')
    .delete()
    .eq('quote_id', id)
  if (deleteError) throw deleteError

  if (extras.length > 0) {
    const { error: insertError } = await supabase
      .from('quote_extras')
      .insert(extras.map((e, i) => ({ ...e, quote_id: id, sort_order: i })))
    if (insertError) throw insertError
  }
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Hook**

Crear `src/features/quotes/hooks/useQuotes.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchQuotes,
  fetchQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  generateQuoteNumber,
} from '../api/quotes'
import type { QuoteInsert, QuoteUpdate, QuoteExtraInsert } from '../types'

const QUOTES_KEY = 'quotes'

export function useQuotes(workshopId: string) {
  return useQuery({
    queryKey: [QUOTES_KEY, workshopId],
    queryFn: () => fetchQuotes(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useQuote(id: string | null) {
  return useQuery({
    queryKey: [QUOTES_KEY, id],
    queryFn: () => fetchQuote(id!),
    enabled: Boolean(id),
  })
}

export function useGenerateQuoteNumber(workshopId: string) {
  return useQuery({
    queryKey: [QUOTES_KEY, 'next_number', workshopId],
    queryFn: () => generateQuoteNumber(workshopId),
    enabled: Boolean(workshopId),
    staleTime: 0,
  })
}

interface CreatePayload {
  quote: Omit<QuoteInsert, 'id' | 'created_at' | 'updated_at'>
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
}

export function useCreateQuote(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ quote, extras }: CreatePayload) => createQuote(quote, extras),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, 'next_number', workshopId] })
    },
  })
}

interface UpdatePayload {
  id: string
  quote: QuoteUpdate
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
}

export function useUpdateQuote(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, quote, extras }: UpdatePayload) => updateQuote(id, quote, extras),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, variables.id] })
    },
  })
}

export function useDeleteQuote(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUOTES_KEY, workshopId] }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/api/quotes.ts src/features/quotes/hooks/useQuotes.ts
git commit -m "feat(quotes): add quotes API and hooks"
```

---

## Task 10: ContractTemplates API + Hook

**Files:**
- Create: `src/features/quotes/api/contractTemplates.ts`
- Create: `src/features/quotes/hooks/useContractTemplates.ts`

- [ ] **Step 1: API**

Crear `src/features/quotes/api/contractTemplates.ts`:

```typescript
import { supabase } from '@/shared/lib/supabase'
import type { ContractTemplate, ContractTemplateInsert, ContractTemplateUpdate } from '../types'

export async function fetchContractTemplates(workshopId: string): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createContractTemplate(
  template: Omit<ContractTemplateInsert, 'id' | 'created_at'>
): Promise<ContractTemplate> {
  const { data, error } = await supabase
    .from('contract_templates')
    .insert(template)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContractTemplate(
  id: string,
  template: ContractTemplateUpdate
): Promise<void> {
  const { error } = await supabase
    .from('contract_templates')
    .update(template)
    .eq('id', id)
  if (error) throw error
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('contract_templates').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Hook**

Crear `src/features/quotes/hooks/useContractTemplates.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchContractTemplates,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
} from '../api/contractTemplates'
import type { ContractTemplateInsert, ContractTemplateUpdate } from '../types'

const TEMPLATES_KEY = 'contract_templates'

export function useContractTemplates(workshopId: string) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, workshopId],
    queryFn: () => fetchContractTemplates(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useCreateContractTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (t: Omit<ContractTemplateInsert, 'id' | 'created_at'>) =>
      createContractTemplate(t),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}

export function useUpdateContractTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContractTemplateUpdate }) =>
      updateContractTemplate(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}

export function useDeleteContractTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteContractTemplate(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/api/contractTemplates.ts src/features/quotes/hooks/useContractTemplates.ts
git commit -m "feat(quotes): add contractTemplates API and hooks"
```

---

## Task 11: QuoteList

**Files:**
- Create: `src/features/quotes/components/QuoteList.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/quotes/components/QuoteList.tsx`:

```typescript
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useQuotes, useDeleteQuote } from '../hooks/useQuotes'
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, formatCurrency } from '../types'

export function QuoteList() {
  const workshopId = useWorkshopId()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)
  const deleteMutation = useDeleteQuote(workshopId)

  function handleDelete(id: string, quoteNumber: string) {
    if (confirm(`¿Eliminar el presupuesto ${quoteNumber}?`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) return <div className="p-4 text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Button asChild>
          <Link to="/quotes/new">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Link>
        </Button>
      </div>

      {quotes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No hay presupuestos aún. ¡Creá el primero!
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Mueble</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                // Calcular total desde recipe_cost + extras para mostrar en lista
                const totalExtras = q.extras.reduce((acc, e) => acc + e.amount, 0)
                const costBase = q.recipe_cost + totalExtras
                const salePrice =
                  q.margin_mode === 'on_cost'
                    ? costBase * (1 + q.margin_pct / 100)
                    : q.margin_pct < 100
                    ? costBase / (1 - q.margin_pct / 100)
                    : costBase

                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-medium">{q.quote_number}</TableCell>
                    <TableCell>{q.client?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{q.furniture_name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(salePrice)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[q.status]}`}>
                        {QUOTE_STATUS_LABELS[q.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/quotes/${q.id}/contract`}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/quotes/${q.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(q.id, q.quote_number)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/quotes/components/QuoteList.tsx
git commit -m "feat(quotes): add QuoteList component"
```

---

## Task 12: ClientDialog

**Files:**
- Create: `src/features/quotes/components/ClientDialog.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/quotes/components/ClientDialog.tsx`:

```typescript
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateClient } from '../hooks/useClients'
import { CLIENT_SOURCE_LABELS, type Client, type ClientSource } from '../types'

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  source: z.enum(['mercadolibre', 'tiendanube', 'instagram', 'facebook', 'otro']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: Client) => void
}

export function ClientDialog({ open, onOpenChange, onCreated }: ClientDialogProps) {
  const workshopId = useWorkshopId()
  const createMutation = useCreateClient(workshopId)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', phone: '', email: '', source: 'otro', notes: '' },
  })

  const sourceValue = watch('source')

  async function onSubmit(values: FormValues) {
    const client = await createMutation.mutateAsync({
      workshop_id: workshopId,
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      source: values.source as ClientSource,
      notes: values.notes || null,
    })
    reset()
    onCreated(client)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="client-name">Nombre *</Label>
            <Input id="client-name" {...register('name')} placeholder="Nombre completo" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-phone">Teléfono</Label>
            <Input id="client-phone" {...register('phone')} placeholder="+54 11 1234-5678" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" type="email" {...register('email')} placeholder="cliente@ejemplo.com" />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>¿Cómo llegó?</Label>
            <Select value={sourceValue} onValueChange={(v) => setValue('source', v as ClientSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CLIENT_SOURCE_LABELS) as [ClientSource, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/quotes/components/ClientDialog.tsx
git commit -m "feat(quotes): add ClientDialog component"
```

---

## Task 13: QuoteExtrasFieldArray + QuoteLivePreview

**Files:**
- Create: `src/features/quotes/components/QuoteExtrasFieldArray.tsx`
- Create: `src/features/quotes/components/QuoteLivePreview.tsx`

- [ ] **Step 1: QuoteExtrasFieldArray**

Crear `src/features/quotes/components/QuoteExtrasFieldArray.tsx`:

```typescript
import { type Control, type FieldErrors, useFieldArray } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import type { QuoteFormValues } from './QuoteForm'

interface QuoteExtrasFieldArrayProps {
  control: Control<QuoteFormValues>
  errors: FieldErrors<QuoteFormValues>
}

export function QuoteExtrasFieldArray({ control, errors }: QuoteExtrasFieldArrayProps) {
  const { fields, append, remove, update } = useFieldArray({ control, name: 'extras' })

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Extras</h3>
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Input
              value={field.description}
              onChange={(e) => update(index, { ...field, description: e.target.value })}
              placeholder="Ej: Mano de obra, traslado..."
            />
            {errors.extras?.[index]?.description && (
              <p className="text-destructive text-xs">{errors.extras[index]?.description?.message}</p>
            )}
          </div>
          <div className="w-28 space-y-1">
            <Label className="text-xs text-muted-foreground">Monto</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={field.amount}
              onChange={(e) => update(index, { ...field, amount: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
          </div>
          <div className="flex flex-col items-center gap-1 pb-1">
            <Label className="text-xs text-muted-foreground">Visible</Label>
            <Switch
              checked={field.show_in_quote}
              onCheckedChange={(v) => update(index, { ...field, show_in_quote: v })}
            />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ description: '', amount: 0, show_in_quote: true })}
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar extra
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: QuoteLivePreview**

Crear `src/features/quotes/components/QuoteLivePreview.tsx`:

```typescript
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { calculateQuote } from '../lib/calculator'
import { formatCurrency } from '../types'
import type { QuoteFormValues } from './QuoteForm'

interface QuoteLivePreviewProps {
  recipeCost: number
  extras: QuoteFormValues['extras']
  marginMode: 'on_cost' | 'on_price'
  marginPct: number
}

export function QuoteLivePreview({ recipeCost, extras, marginMode, marginPct }: QuoteLivePreviewProps) {
  const result = useMemo(
    () =>
      calculateQuote({
        recipeCost,
        extras: extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
        marginMode,
        marginPct,
      }),
    [recipeCost, extras, marginMode, marginPct]
  )

  const visibleExtras = extras.filter((e) => e.show_in_quote && e.amount > 0)

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Vista previa del precio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Costo del mueble</span>
          <span>{formatCurrency(recipeCost)}</span>
        </div>

        {visibleExtras.map((e, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground truncate max-w-[60%]">{e.description || 'Extra'}</span>
            <span>{formatCurrency(e.amount)}</span>
          </div>
        ))}

        <Separator />

        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(result.costBase)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Margen ({marginPct}%{marginMode === 'on_price' ? ' sobre precio' : ''})
          </span>
          <span>{formatCurrency(result.marginAmount)}</span>
        </div>

        <Separator />

        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(result.salePrice)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/components/QuoteExtrasFieldArray.tsx src/features/quotes/components/QuoteLivePreview.tsx
git commit -m "feat(quotes): add QuoteExtrasFieldArray and QuoteLivePreview components"
```

---

## Task 14: QuoteForm

**Files:**
- Create: `src/features/quotes/components/QuoteForm.tsx`

> Este es el componente principal. Exporta `QuoteFormValues` para ser importado por `QuoteExtrasFieldArray` y `QuoteLivePreview`. Si TypeScript se queja del import circular, mover el tipo a `types.ts`.

- [ ] **Step 1: Crear QuoteForm.tsx**

Crear `src/features/quotes/components/QuoteForm.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useFurnitureTemplates } from '@/features/recipes/hooks/useRecipes'
import { computeRecipeCost } from '@/features/recipes/types'
import { useClients } from '../hooks/useClients'
import { useQuote, useCreateQuote, useUpdateQuote, useGenerateQuoteNumber } from '../hooks/useQuotes'
import { QUOTE_STATUS_LABELS, type QuoteStatus, type MarginMode, type Client } from '../types'
import { QuoteExtrasFieldArray } from './QuoteExtrasFieldArray'
import { QuoteLivePreview } from './QuoteLivePreview'
import { ClientDialog } from './ClientDialog'

const extraSchema = z.object({
  description: z.string().min(1, 'La descripción es obligatoria'),
  amount: z.coerce.number().min(0),
  show_in_quote: z.boolean(),
})

const quoteSchema = z.object({
  client_id: z.string().optional(),
  furniture_template_id: z.string().optional(),
  furniture_name: z.string().min(1, 'El nombre del mueble es obligatorio'),
  recipe_cost: z.coerce.number().min(0),
  extras: z.array(extraSchema),
  margin_mode: z.enum(['on_cost', 'on_price']),
  margin_pct: z.coerce.number().min(0).max(99),
  status: z.enum(['presupuesto', 'enviado', 'aprobado', 'en_produccion', 'entregado', 'cancelado']),
  notes: z.string().optional(),
})

export type QuoteFormValues = z.infer<typeof quoteSchema>

export function QuoteForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const workshopId = useWorkshopId()
  const isEditing = Boolean(id)

  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  const { data: existingQuote } = useQuote(id ?? null)
  const { data: nextNumber } = useGenerateQuoteNumber(workshopId)
  const { data: clients = [] } = useClients(workshopId)
  const { data: templates = [] } = useFurnitureTemplates(workshopId)
  const createMutation = useCreateQuote(workshopId)
  const updateMutation = useUpdateQuote(workshopId)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema) as Resolver<QuoteFormValues>,
    defaultValues: {
      client_id: '',
      furniture_template_id: '',
      furniture_name: '',
      recipe_cost: 0,
      extras: [],
      margin_mode: 'on_cost',
      margin_pct: 30,
      status: 'presupuesto',
      notes: '',
    },
  })

  // Poblar al editar
  useEffect(() => {
    if (existingQuote) {
      reset({
        client_id: existingQuote.client_id ?? '',
        furniture_template_id: existingQuote.furniture_template_id ?? '',
        furniture_name: existingQuote.furniture_name,
        recipe_cost: existingQuote.recipe_cost,
        extras: existingQuote.extras.map((e) => ({
          description: e.description,
          amount: e.amount,
          show_in_quote: e.show_in_quote,
        })),
        margin_mode: existingQuote.margin_mode,
        margin_pct: existingQuote.margin_pct,
        status: existingQuote.status,
        notes: existingQuote.notes ?? '',
      })
    }
  }, [existingQuote, reset])

  // Cuando se selecciona una plantilla de mueble, cargar nombre y costo
  const templateIdWatch = watch('furniture_template_id')
  useEffect(() => {
    if (!templateIdWatch) return
    const tpl = templates.find((t) => t.id === templateIdWatch)
    if (!tpl) return
    setValue('furniture_name', tpl.name)
    const cost = computeRecipeCost(tpl.recipe_items)
    setValue('recipe_cost', cost.total)
  }, [templateIdWatch, templates, setValue])

  const recipeCostWatch = watch('recipe_cost')
  const extrasWatch = watch('extras')
  const marginModeWatch = watch('margin_mode')
  const marginPctWatch = watch('margin_pct')
  const clientIdWatch = watch('client_id')
  const statusWatch = watch('status')

  function handleClientCreated(client: Client) {
    setValue('client_id', client.id)
  }

  async function onSubmit(values: QuoteFormValues) {
    const quoteNumber = isEditing ? existingQuote!.quote_number : (nextNumber ?? 'P-0001')

    const quoteData = {
      workshop_id: workshopId,
      quote_number: quoteNumber,
      client_id: values.client_id || null,
      furniture_template_id: values.furniture_template_id || null,
      furniture_name: values.furniture_name,
      recipe_cost: values.recipe_cost,
      status: values.status as QuoteStatus,
      margin_mode: values.margin_mode as MarginMode,
      margin_pct: values.margin_pct,
      notes: values.notes || null,
    }

    const extrasData = values.extras.map((e) => ({
      description: e.description,
      amount: e.amount,
      show_in_quote: e.show_in_quote,
    }))

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, quote: quoteData, extras: extrasData })
    } else {
      await createMutation.mutateAsync({ quote: quoteData, extras: extrasData })
    }
    navigate('/quotes')
  }

  const quoteNumber = isEditing ? existingQuote?.quote_number : nextNumber

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? `Editar ${quoteNumber}` : `Nuevo presupuesto ${nextNumber ? `— ${nextNumber}` : ''}`}
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-6">

          {/* Sección: Cliente */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cliente</h2>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Seleccionar cliente</Label>
                <Select value={clientIdWatch} onValueChange={(v) => setValue('client_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin cliente</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.phone ? ` — ${c.phone}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="self-end"
                onClick={() => setClientDialogOpen(true)}
                title="Nuevo cliente"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </section>

          {/* Sección: Mueble */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mueble</h2>
            <div className="space-y-1">
              <Label>Plantilla de mueble (opcional)</Label>
              <Select
                value={templateIdWatch}
                onValueChange={(v) => setValue('furniture_template_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin plantilla — ingresá nombre y costo manualmente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin plantilla</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="furniture_name">Nombre del mueble *</Label>
              <Input
                id="furniture_name"
                {...register('furniture_name')}
                placeholder="Ej: Ropero 2 puertas"
              />
              {errors.furniture_name && (
                <p className="text-destructive text-xs">{errors.furniture_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="recipe_cost">Costo base ($)</Label>
              <Input
                id="recipe_cost"
                type="number"
                min="0"
                step="0.01"
                {...register('recipe_cost')}
                placeholder="0"
              />
            </div>
          </section>

          {/* Sección: Extras */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Extras
            </h2>
            <QuoteExtrasFieldArray control={control} errors={errors} />
          </section>

          {/* Sección: Margen */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Margen</h2>
            <RadioGroup
              value={marginModeWatch}
              onValueChange={(v) => setValue('margin_mode', v as MarginMode)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="on_cost" id="on_cost" />
                <Label htmlFor="on_cost">Sobre el costo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="on_price" id="on_price" />
                <Label htmlFor="on_price">Sobre el precio de venta</Label>
              </div>
            </RadioGroup>
            <div className="flex items-center gap-2">
              <div className="w-28 space-y-1">
                <Label htmlFor="margin_pct">Margen (%)</Label>
                <Input
                  id="margin_pct"
                  type="number"
                  min="0"
                  max="99"
                  step="0.1"
                  {...register('margin_pct')}
                />
                {errors.margin_pct && (
                  <p className="text-destructive text-xs">{errors.margin_pct.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Sección: Estado */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estado</h2>
            <Select value={statusWatch} onValueChange={(v) => setValue('status', v as QuoteStatus)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(QUOTE_STATUS_LABELS) as [QuoteStatus, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Sección: Notas */}
          <section className="space-y-2">
            <Label htmlFor="notes">Notas internas (opcional)</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              rows={3}
              placeholder="Medidas, aclaraciones, etc."
            />
          </section>

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/quotes')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear presupuesto'}
            </Button>
          </div>
        </form>

        {/* Live preview */}
        <div className="lg:w-72">
          <QuoteLivePreview
            recipeCost={recipeCostWatch}
            extras={extrasWatch}
            marginMode={marginModeWatch}
            marginPct={marginPctWatch}
          />
        </div>
      </div>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={handleClientCreated}
      />
    </div>
  )
}
```

> **Nota sobre import circular:** `QuoteExtrasFieldArray` importa `QuoteFormValues` de `QuoteForm`. Si TypeScript reporta error de import circular, mover `export type QuoteFormValues = z.infer<typeof quoteSchema>` al archivo `types.ts` y actualizar los imports en ambos componentes.

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: sin errores. Si hay import circular, ver nota arriba.

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/components/QuoteForm.tsx
git commit -m "feat(quotes): add QuoteForm component with live preview"
```

---

## Task 15: PDF generation

**Files:**
- Create: `src/features/quotes/lib/pdf.ts`

- [ ] **Step 1: Crear el módulo PDF**

Crear `src/features/quotes/lib/pdf.ts`:

```typescript
import jsPDF from 'jspdf'
import { formatCurrency } from '../types'
import { calculateQuote, type CalcExtra } from './calculator'
import type { QuoteWithExtras } from '../types'
import type { WorkshopSettings } from '../types'

export interface QuotePDFData {
  quote: QuoteWithExtras
  settings: WorkshopSettings | null
}

export function generateQuotePDF({ quote, settings }: QuotePDFData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  const pageWidth = 210
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Calcular totales
  const calcResult = calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map((e): CalcExtra => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  })

  // ---- HEADER ----
  // Logo (si existe y es data URL)
  if (settings?.logo_url?.startsWith('data:')) {
    try {
      const imgFormat = settings.logo_url.includes('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(settings.logo_url, imgFormat, margin, y, 20, 20)
    } catch (_) {
      // logo inválido, continuar sin él
    }
  }

  // Nombre del taller
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(settings?.name ?? 'CarpinteroPro', margin + 25, y + 7)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  if (settings?.phone) doc.text(settings.phone, margin + 25, y + 13)
  if (settings?.address) doc.text(settings.address, margin + 25, y + 18)
  if (settings?.email) doc.text(settings.email, margin + 25, y + 23)
  doc.setTextColor(0, 0, 0)

  y += 30

  // ---- LÍNEA SEPARADORA ----
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // ---- NÚMERO Y FECHA ----
  const dateStr = new Date(quote.created_at).toLocaleDateString('es-AR')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(`Presupuesto ${quote.quote_number}`, margin, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(dateStr, pageWidth - margin, y, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  y += 8

  // ---- DATOS DEL CLIENTE ----
  if (quote.client) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Cliente:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.client.name, margin + 18, y)
    y += 5
    if (quote.client.phone) {
      doc.text(`Tel: ${quote.client.phone}`, margin, y)
      y += 5
    }
    if (quote.client.email) {
      doc.text(`Email: ${quote.client.email}`, margin, y)
      y += 5
    }
    y += 3
  }

  // ---- TABLA DE ÍTEMS ----
  const rowH = 8
  const col1 = margin
  const col2 = pageWidth - margin - 35

  // Encabezado tabla
  doc.setFillColor(245, 245, 245)
  doc.rect(col1, y, contentWidth, rowH, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Descripción', col1 + 3, y + 5.5)
  doc.text('Precio', col2, y + 5.5, { align: 'right' })
  y += rowH

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  // Fila: mueble
  doc.text(quote.furniture_name, col1 + 3, y + 5.5)
  doc.text(formatCurrency(quote.recipe_cost), col2, y + 5.5, { align: 'right' })
  doc.setDrawColor(230, 230, 230)
  doc.line(col1, y + rowH, col1 + contentWidth, y + rowH)
  y += rowH

  // Extras visibles
  quote.extras
    .filter((e) => e.show_in_quote)
    .forEach((e) => {
      doc.text(e.description, col1 + 3, y + 5.5)
      doc.text(formatCurrency(e.amount), col2, y + 5.5, { align: 'right' })
      doc.line(col1, y + rowH, col1 + contentWidth, y + rowH)
      y += rowH
    })

  // Total
  y += 3
  doc.setDrawColor(0, 0, 0)
  doc.line(col1, y, col1 + contentWidth, y)
  y += 6
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total', col1 + 3, y)
  doc.text(formatCurrency(calcResult.salePrice), col2, y, { align: 'right' })

  doc.save(`presupuesto-${quote.quote_number}.pdf`)
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/lib/pdf.ts
git commit -m "feat(quotes): add PDF generation with jsPDF"
```

---

## Task 16: ContractPreview

**Files:**
- Create: `src/features/quotes/components/ContractPreview.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/quotes/components/ContractPreview.tsx`:

```typescript
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, Share2, Copy } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useQuote } from '../hooks/useQuotes'
import { useContractTemplates } from '../hooks/useContractTemplates'
import { useWorkshopSettings } from '@/features/settings/hooks/useWorkshopSettings'
import { renderContract } from '../lib/contractRenderer'
import { generateQuotePDF } from '../lib/pdf'
import { calculateQuote, type CalcExtra } from '../lib/calculator'
import { formatCurrency } from '../types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function ContractPreview() {
  const { id } = useParams<{ id: string }>()
  const workshopId = useWorkshopId()
  const { data: quote } = useQuote(id ?? null)
  const { data: templates = [] } = useContractTemplates(workshopId)
  const { data: settings } = useWorkshopSettings(workshopId)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const defaultTemplate = templates.find((t) => t.is_default)
  const activeTemplateId = selectedTemplateId || defaultTemplate?.id || ''
  const activeTemplate = templates.find((t) => t.id === activeTemplateId)

  if (!quote) return <div className="p-4 text-muted-foreground">Cargando...</div>

  const calcResult = calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map((e): CalcExtra => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  })

  const vars = {
    client_name: quote.client?.name ?? '',
    quote_number: quote.quote_number,
    total: formatCurrency(calcResult.salePrice),
    furniture_name: quote.furniture_name,
    workshop_name: settings?.name ?? 'CarpinteroPro',
    date: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es }),
  }

  const renderedContract = activeTemplate
    ? renderContract(activeTemplate.body_markdown, vars)
    : ''

  function buildWhatsAppText(): string {
    const lines: string[] = [
      `*Presupuesto ${quote!.quote_number} — ${settings?.name ?? 'CarpinteroPro'}*`,
    ]
    if (quote!.client) lines.push(`Cliente: ${quote!.client.name}`)
    lines.push('')
    lines.push(`🪵 ${quote!.furniture_name}: ${formatCurrency(quote!.recipe_cost)}`)
    quote!.extras
      .filter((e) => e.show_in_quote)
      .forEach((e) => lines.push(`🔧 ${e.description}: ${formatCurrency(e.amount)}`))
    lines.push('─────────────────────────')
    lines.push(`*Total: ${formatCurrency(calcResult.salePrice)}*`)
    if (renderedContract) {
      const first2Lines = renderedContract
        .split('\n')
        .filter((l) => l.trim())
        .slice(0, 2)
        .join('\n')
      lines.push('')
      lines.push(first2Lines)
    }
    return lines.join('\n')
  }

  function handleWhatsApp() {
    const text = buildWhatsAppText()
    const phone = quote?.client?.phone?.replace(/\D/g, '') ?? ''
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildWhatsAppText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadPDF() {
    generateQuotePDF({ quote, settings: settings ?? null })
  }

  // Markdown → HTML básico (negrita, saltos de línea)
  function markdownToHtml(md: string): string {
    return md
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />')
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/quotes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          Contrato — {quote.quote_number}
        </h1>
      </div>

      {/* Selector de plantilla */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Plantilla:</span>
        <Select value={activeTemplateId} onValueChange={setSelectedTemplateId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sin contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sin contrato</SelectItem>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (predeterminada)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleWhatsApp}>
          <Share2 className="h-4 w-4 mr-2" />
          Compartir por WhatsApp
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Descargar PDF
        </Button>
        <Button onClick={handleCopy} variant="outline">
          <Copy className="h-4 w-4 mr-2" />
          {copied ? '¡Copiado!' : 'Copiar texto'}
        </Button>
      </div>

      {/* Preview del contrato */}
      {renderedContract ? (
        <div className="rounded-lg border p-6 bg-white text-sm leading-relaxed">
          <div
            dangerouslySetInnerHTML={{ __html: markdownToHtml(renderedContract) }}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Seleccioná una plantilla para ver el contrato.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/quotes/components/ContractPreview.tsx
git commit -m "feat(quotes): add ContractPreview with WhatsApp and PDF export"
```

---

## Task 17: TemplateEditor

**Files:**
- Create: `src/features/quotes/components/TemplateEditor.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/quotes/components/TemplateEditor.tsx`:

```typescript
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import {
  useContractTemplates,
  useCreateContractTemplate,
  useUpdateContractTemplate,
  useDeleteContractTemplate,
} from '../hooks/useContractTemplates'
import type { ContractTemplate } from '../types'

const AVAILABLE_VARS = [
  '{{client_name}}',
  '{{quote_number}}',
  '{{total}}',
  '{{furniture_name}}',
  '{{workshop_name}}',
  '{{date}}',
]

export function TemplateEditor() {
  const workshopId = useWorkshopId()
  const { data: templates = [] } = useContractTemplates(workshopId)
  const createMutation = useCreateContractTemplate(workshopId)
  const updateMutation = useUpdateContractTemplate(workshopId)
  const deleteMutation = useDeleteContractTemplate(workshopId)

  const [selected, setSelected] = useState<ContractTemplate | null>(null)
  const [editName, setEditName] = useState('')
  const [editBody, setEditBody] = useState('')
  const [newName, setNewName] = useState('')

  function handleSelect(t: ContractTemplate) {
    setSelected(t)
    setEditName(t.name)
    setEditBody(t.body_markdown)
  }

  function insertVar(v: string) {
    setEditBody((prev) => prev + v)
  }

  async function handleSave() {
    if (!selected) return
    await updateMutation.mutateAsync({
      id: selected.id,
      data: { name: editName, body_markdown: editBody },
    })
  }

  async function handleSetDefault() {
    if (!selected) return
    // Quitar default de todas las demás y poner en la seleccionada
    await Promise.all(
      templates
        .filter((t) => t.is_default && t.id !== selected.id)
        .map((t) => updateMutation.mutateAsync({ id: t.id, data: { is_default: false } }))
    )
    await updateMutation.mutateAsync({
      id: selected.id,
      data: { is_default: true },
    })
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const t = await createMutation.mutateAsync({
      workshop_id: workshopId,
      name: newName.trim(),
      body_markdown: '',
      is_default: false,
    })
    setNewName('')
    handleSelect(t)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await deleteMutation.mutateAsync(id)
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Plantillas de contrato</h1>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Lista de plantillas */}
        <div className="lg:w-56 space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer text-sm ${selected?.id === t.id ? 'border-primary bg-accent' : 'hover:bg-muted'}`}
              onClick={() => handleSelect(t)}
            >
              <span className="truncate">{t.name}{t.is_default ? ' ★' : ''}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                className="text-destructive text-xs ml-2 opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex gap-1 mt-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva plantilla..."
              className="text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button size="icon" variant="outline" onClick={handleCreate}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Editor */}
        {selected ? (
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            {/* Variables disponibles */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Variables disponibles (click para insertar)</Label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARS.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    className="rounded-full border px-2 py-0.5 text-xs font-mono hover:bg-accent"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              {/* Markdown editor */}
              <div className="flex-1 space-y-1">
                <Label>Editar (Markdown)</Label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {/* Preview */}
              <div className="flex-1 space-y-1">
                <Label>Preview</Label>
                <div
                  className="rounded-md border bg-white p-3 text-sm leading-relaxed min-h-[200px]"
                  dangerouslySetInnerHTML={{
                    __html: editBody
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br />'),
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Guardar</Button>
              <Button variant="outline" onClick={handleSetDefault}>
                {selected.is_default ? '★ Predeterminada' : 'Establecer como predeterminada'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Seleccioná una plantilla para editarla.
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/quotes/components/TemplateEditor.tsx
git commit -m "feat(quotes): add TemplateEditor component"
```

---

## Task 18: Wiring — routes, router, AppLayout

**Files:**
- Modify: `src/features/quotes/routes.tsx`
- Modify: `src/features/settings/routes.tsx` (ya creado en Task 7)
- Modify: `src/app/router.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`

- [ ] **Step 1: Actualizar quotes/routes.tsx**

Reemplazar el contenido de `src/features/quotes/routes.tsx` con:

```typescript
import { Routes, Route } from 'react-router-dom'
import { QuoteList } from './components/QuoteList'
import { QuoteForm } from './components/QuoteForm'
import { ContractPreview } from './components/ContractPreview'
import { TemplateEditor } from './components/TemplateEditor'

export function QuotesRoutes() {
  return (
    <Routes>
      <Route index element={<QuoteList />} />
      <Route path="new" element={<QuoteForm />} />
      <Route path=":id" element={<QuoteForm />} />
      <Route path=":id/contract" element={<ContractPreview />} />
      <Route path="templates" element={<TemplateEditor />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Actualizar router.tsx — agregar `/settings`**

Abrir `src/app/router.tsx`. Agregar la ruta de settings dentro del array `children`:

```typescript
{
  path: 'settings',
  lazy: () => import('@/features/settings/routes').then(m => ({ Component: m.SettingsRoutes })),
},
```

El archivo completo queda:

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-lg font-medium text-destructive">Error al cargar la página</p>
        <button
          className="text-sm text-muted-foreground underline"
          onClick={() => window.location.reload()}
        >
          Recargar
        </button>
      </div>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        lazy: () => import('@/features/dashboard/routes').then(m => ({ Component: m.DashboardRoutes })),
      },
      {
        path: 'inventory',
        lazy: () => import('@/features/inventory/routes').then(m => ({ Component: m.InventoryRoutes })),
      },
      {
        path: 'recipes',
        lazy: () => import('@/features/recipes/routes').then(m => ({ Component: m.RecipesRoutes })),
      },
      {
        path: 'quotes',
        lazy: () => import('@/features/quotes/routes').then(m => ({ Component: m.QuotesRoutes })),
      },
      {
        path: 'crm',
        lazy: () => import('@/features/crm/routes').then(m => ({ Component: m.CrmRoutes })),
      },
      {
        path: 'settings',
        lazy: () => import('@/features/settings/routes').then(m => ({ Component: m.SettingsRoutes })),
      },
    ],
  },
])
```

- [ ] **Step 3: Actualizar AppLayout.tsx — agregar Settings al nav**

Abrir `src/app/layouts/AppLayout.tsx`. Agregar `Settings` al import de lucide-react y al array `navItems`:

```typescript
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, BookOpen, FileText, Users, Settings } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventario', icon: Package },
  { to: '/recipes', label: 'Muebles', icon: BookOpen },
  { to: '/quotes', label: 'Presupuestos', icon: FileText },
  { to: '/crm', label: 'Clientes', icon: Users },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]
```

El resto del componente permanece igual.

- [ ] **Step 4: Verificar build final**

```bash
npm run build
```

Expected: Build exitoso sin errores TypeScript.

- [ ] **Step 5: Ejecutar todos los tests**

```bash
npm run test
```

Expected: todos los tests pasan.

- [ ] **Step 6: Commit**

```bash
git add src/features/quotes/routes.tsx src/app/router.tsx src/app/layouts/AppLayout.tsx
git commit -m "feat(quotes): wire up routes, settings nav, and router"
```

---

## Verificación final

Flujo completo a probar manualmente en `npm run dev`:

1. **Ajustes:** `/settings` → completar nombre del taller, subir logo → Guardar
2. **Cliente:** ir a `/quotes/new` → botón "+" → crear cliente desde Instagram
3. **Presupuesto:** seleccionar mueble de plantilla → agregar extra "Instalación $5000" (visible) + extra "Combustible $800" (interno) → margen 30% sobre costo → Crear
4. **Ver lista:** `/quotes` muestra el presupuesto con número `P-0001`, cliente y total
5. **Contrato:** click en ícono de documento → seleccionar plantilla → botón "Descargar PDF" → verificar que tiene logo y datos del taller
6. **WhatsApp:** botón "Compartir por WhatsApp" → verificar que el texto formateado aparece con solo los extras visibles
7. **Templates:** `/quotes/templates` → editar plantilla, insertar variable `{{total}}`, guardar

```bash
npm run test     # todos pasan
npm run build    # build limpio
```
