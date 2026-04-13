# Fase 3 — Presupuestos + Contratos + Plantillas

**Fecha:** 2026-04-13  
**Estado:** Aprobado  
**Objetivo:** Motor de cálculo puro con tests, formulario de presupuesto en página única, plantillas editables de contrato, exportar a WhatsApp/PDF con branding del taller, pantalla de ajustes del taller.

---

## Decisiones de diseño

| Decisión | Elección |
|----------|----------|
| Clientes | Tabla `clients` mínima en esta fase (Fase 4 la expande con Kanban) |
| Fuente de cliente | Campo `source` en `clients` (por cliente, no por presupuesto) |
| Margen | Dual: `on_cost` (costo × (1 + %)) o `on_price` (costo / (1 − %)), el carpintero elige por presupuesto |
| Extras | Field array con flag `show_in_quote` — cubre tanto extras visibles como costos internos |
| Export | WhatsApp (texto + link `wa.me`) + PDF con branding (jspdf + jspdf-autotable) |
| Ajustes del taller | Pantalla `/settings` con nombre, logo, teléfono, email, dirección |
| Formulario | Página única con secciones + live preview del total (igual que MuebleForm) |
| N° de orden | Auto-incremental por taller: `P-0001`, `P-0002`, ... generado en SQL |

---

## Base de datos — `0003_quotes.sql`

### Enum: `client_source`
```sql
CREATE TYPE client_source AS ENUM (
  'mercadolibre', 'tiendanube', 'instagram', 'facebook', 'otro'
);
```

### Enum: `quote_status`
```sql
CREATE TYPE quote_status AS ENUM (
  'presupuesto', 'enviado', 'aprobado',
  'en_produccion', 'entregado', 'cancelado'
);
```

### Enum: `margin_mode`
```sql
CREATE TYPE margin_mode AS ENUM ('on_cost', 'on_price');
```

### Tabla: `clients`
```sql
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
```
_Fase 4 agrega historial de presupuestos y vista de detalle del cliente._

### Tabla: `quotes`
```sql
CREATE TABLE quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id           uuid NOT NULL,
  quote_number          TEXT NOT NULL,         -- "P-0001", generado por función SQL
  client_id             uuid REFERENCES clients(id) ON DELETE SET NULL,
  furniture_template_id uuid REFERENCES furniture_templates(id) ON DELETE SET NULL,
  furniture_name        TEXT NOT NULL,         -- snapshot del nombre (por si cambia la receta)
  recipe_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- snapshot del costo base
  status                quote_status NOT NULL DEFAULT 'presupuesto',
  margin_mode           margin_mode NOT NULL DEFAULT 'on_cost',
  margin_pct            NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (margin_pct >= 0),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, quote_number)
);
```

**Función para generar `quote_number`:**
```sql
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
```

### Tabla: `quote_extras`
```sql
CREATE TABLE quote_extras (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  show_in_quote  BOOLEAN NOT NULL DEFAULT true,  -- true = visible al cliente
  sort_order     INT NOT NULL DEFAULT 0
);
```

### Tabla: `contract_templates`
```sql
CREATE TABLE contract_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id     uuid NOT NULL,
  name            TEXT NOT NULL,
  body_markdown   TEXT NOT NULL DEFAULT '',
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
_Restricción: solo un `is_default = true` por `workshop_id` (manejado en app)._

### Tabla: `workshop_settings`
```sql
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
```

---

## Motor de cálculo — `src/features/quotes/lib/calculator.ts`

Funciones puras, sin React, sin Supabase. Desarrolladas con TDD estricto.

### Tipos de entrada
```typescript
interface QuoteExtra {
  amount: number
  show_in_quote: boolean
}

interface CalcInput {
  recipeCost: number
  extras: QuoteExtra[]
  marginMode: 'on_cost' | 'on_price'
  marginPct: number  // 0-100
}
```

### Lógica
```
totalExtras   = sum(extras.map(e => e.amount))
visibleExtras = sum(extras.filter(e => e.show_in_quote).map(e => e.amount))
costBase      = recipeCost + totalExtras

on_cost:  salePrice = costBase * (1 + marginPct / 100)
on_price: salePrice = costBase / (1 - marginPct / 100)  // marginPct < 100

marginAmount  = salePrice - costBase
```

### Output
```typescript
interface CalcResult {
  costBase: number        // recipeCost + totalExtras
  visibleExtras: number   // solo los show_in_quote=true (para PDF/WA)
  marginAmount: number
  salePrice: number
}
```

**Nota de naming:** En el calculador `costBase = recipeCost + totalExtras`. En la UI el label "Costo base" muestra solo el `recipeCost`; la suma de extras visibles aparece como líneas separadas; el "Subtotal" de la UI equivale al `costBase` del calculador.

**Mueble libre (sin plantilla):** Si el usuario escribe el nombre a mano sin seleccionar `furniture_template`, entonces `recipe_cost = 0` y `furniture_template_id = null`. El precio final sale enteramente de los extras + margen.

**Lo que ve el cliente** en PDF/WhatsApp: nombre del mueble, extras visibles, total. El margen y los extras internos nunca se exponen.

---

## Renderer de contratos — `src/features/quotes/lib/contractRenderer.ts`

Reemplaza variables `{{variable}}` en el markdown de la plantilla.

### Variables disponibles
| Variable | Valor |
|----------|-------|
| `{{client_name}}` | Nombre del cliente |
| `{{quote_number}}` | N° de orden (ej: P-0001) |
| `{{total}}` | Precio final formateado |
| `{{furniture_name}}` | Nombre del mueble |
| `{{workshop_name}}` | Nombre del taller (de workshop_settings) |
| `{{date}}` | Fecha de hoy formateada |

---

## Estructura de archivos

```
src/features/quotes/
  api/
    quotes.ts           # CRUD quotes + quote_extras
    clients.ts          # CRUD clients
    contractTemplates.ts
  hooks/
    useQuotes.ts
    useClients.ts
    useContractTemplates.ts
  lib/
    calculator.ts       # Motor puro (TDD)
    contractRenderer.ts # Reemplazo de variables (TDD)
    pdf.ts              # Generación PDF con jspdf
  components/
    QuoteList.tsx
    QuoteForm.tsx
    QuoteExtrasFieldArray.tsx
    QuoteLivePreview.tsx
    ContractPreview.tsx
    TemplateEditor.tsx
    ClientDialog.tsx    # Dialog inline para crear cliente rápido
  types.ts
  routes.tsx

src/features/settings/
  api/
    workshopSettings.ts
  hooks/
    useWorkshopSettings.ts
  components/
    WorkshopSettings.tsx
  routes.tsx
```

---

## Rutas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/quotes` | `QuoteList` | Listado con filtros por estado |
| `/quotes/new` | `QuoteForm` | Crear presupuesto |
| `/quotes/:id` | `QuoteForm` | Editar presupuesto |
| `/quotes/:id/contract` | `ContractPreview` | Vista previa + export |
| `/settings` | `WorkshopSettings` | Ajustes del taller |

Settings se agrega al sidebar/bottom-tabs como ítem con ícono de engranaje.

---

## UI — QuoteForm

Página única con secciones y **live preview** del total al costado derecho (desktop) o abajo (mobile).

**Secciones del formulario (izquierda):**
1. **Cliente** — `Combobox` con búsqueda por nombre/teléfono + botón "Nuevo cliente" que abre `ClientDialog`
2. **Mueble** — selector de `furniture_template` que carga el `recipe_cost` automáticamente. Campo libre para nombre si no usa plantilla
3. **Extras** — field array con: descripción (texto), monto (número), toggle "Visible al cliente"
4. **Margen** — radio group (`Sobre el costo` / `Sobre el precio de venta`) + input `%`
5. **Estado** — select con los 6 estados (badge de color)
6. **Notas** — textarea

**Live preview (derecha/abajo):**
```
Costo base:        $85.000
+ Instalación:     $10.000   (visible)
─────────────────────────
Subtotal:          $95.000
+ Margen (30%):    $28.500
═════════════════════════
TOTAL:            $123.500
```

---

## UI — ContractPreview

- Dropdown selector de plantilla (incluye "Sin contrato")
- Preview renderizado (markdown → HTML básico con variables reemplazadas)
- Dos botones primarios: **"Compartir por WhatsApp"** y **"Descargar PDF"**
- Botón secundario: "Copiar texto"

---

## UI — TemplateEditor

- Layout 50/50: editor textarea (markdown) a la izquierda, preview a la derecha
- Chips de variables disponibles arriba del editor — click inserta `{{variable}}` en el cursor
- Botones: Guardar, Establecer como predeterminada

---

## UI — WorkshopSettings

Formulario simple:
- Nombre del taller (texto)
- Teléfono, email, dirección
- Upload de logo (imagen → Supabase Storage → guarda URL)
- Botón Guardar

---

## Export

### WhatsApp
```
*Presupuesto P-0001 — Taller Madera & Arte*
Cliente: Juan Pérez

🪵 Mesa de roble: $85.000
🔧 Instalación:   $10.000
──────────────────────────
*Total: $123.500*

[primeras 2 líneas del contrato predeterminado]
```
- Botón "Compartir por WhatsApp" → abre `https://wa.me/?text=<encoded>`
- Botón "Copiar texto" → `navigator.clipboard.writeText()`

### PDF (jspdf + jspdf-autotable)
- **Header:** logo del taller (si existe) + nombre + teléfono + dirección
- **Número y fecha:** `Presupuesto P-0001 — 13/04/2026`
- **Cliente:** nombre, teléfono, email
- **Tabla:** columna ítem (nombre mueble + extras visibles), precio
- **Total** en grande al pie de tabla
- **Contrato** (si tiene plantilla): texto debajo del total, tipografía más pequeña

---

## Testing

### TDD estricto (antes de implementar):
- `tests/features/quotes/calculator.test.ts` — casos: margen on_cost, margen on_price, extras internos excluidos del total visible, margen 0%, edge case on_price con 100%
- `tests/features/quotes/contractRenderer.test.ts` — casos: todas las variables reemplazadas, variable faltante deja `{{variable}}` intacta, template vacío

### Skills activas durante implementación:
- `superpowers:test-driven-development` — calculator.ts y contractRenderer.ts
- `frontend-design:frontend-design` — QuoteForm, ContractPreview
- `superpowers:verification-before-completion` — al cerrar la fase

---

## Checklist de cierre de fase

- [ ] `npm run test` — todos los tests pasan
- [ ] `npm run build` — build exitoso sin errores TS
- [ ] Flujo manual: crear cliente → presupuesto desde receta → agregar extras → generar contrato → copiar WhatsApp → descargar PDF
- [ ] Configurar ajustes del taller con logo y verificar que aparece en PDF
- [ ] Smoke test en mobile (responsive)
