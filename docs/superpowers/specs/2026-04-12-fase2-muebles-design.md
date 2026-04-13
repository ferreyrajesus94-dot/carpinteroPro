# Fase 2 — Muebles (BOM) — Design Spec

**Fecha:** 2026-04-12
**Estado:** Aprobado

---

## Objetivo

Crear una biblioteca de muebles reutilizables. Cada mueble es un BOM (Bill of Materials) con dos secciones: maderas y gastos extras. El costo estimado se calcula en vivo usando los precios actuales del inventario (Fase 1), de modo que si un material sube de precio, el costo del mueble se actualiza automáticamente al abrirlo. Esta biblioteca alimentará el motor de presupuestos en Fase 3.

---

## Base de Datos

### Migración: `supabase/migrations/0002_recipes.sql`

**`furniture_templates`** — cabecera del mueble
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
workshop_id    uuid NOT NULL
name           TEXT NOT NULL
notes          TEXT
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

**`recipe_items`** — cada material dentro del mueble
```sql
id                     uuid PRIMARY KEY DEFAULT gen_random_uuid()
furniture_template_id  uuid NOT NULL REFERENCES furniture_templates(id) ON DELETE CASCADE
material_id            uuid NOT NULL REFERENCES materials(id) ON DELETE RESTRICT
quantity               NUMERIC(12, 4) NOT NULL CHECK (quantity > 0)
```

**Decisiones clave:**
- `unit` no se almacena en `recipe_items` — se deriva de `materials.unit` en el JOIN
- `section` (madera vs extra) no se almacena — se deriva de `materials.category` en el cliente: `category = 'madera'` → sección Maderas, cualquier otra categoría → sección Gastos extras
- El costo estimado nunca se persiste — siempre es `quantity × material.price_per_unit` calculado en tiempo de lectura
- Índices: `furniture_templates(workshop_id)`, `recipe_items(furniture_template_id)`
- RLS habilitado con política permisiva (igual que Fase 1, se refina en producción)

---

## Tipos TypeScript

`src/features/recipes/types.ts`:
- `FurnitureTemplate` — Row de la tabla
- `FurnitureTemplateInsert` / `FurnitureTemplateUpdate`
- `RecipeItem` — Row de la tabla
- `RecipeItemInsert`
- `RecipeItemWithMaterial` — RecipeItem + Material (para renders y cálculos)
- `FurnitureTemplateWithItems` — FurnitureTemplate + RecipeItemWithMaterial[]

Helper derivado (calculado, no almacenado):
- `computeRecipeCost(items: RecipeItemWithMaterial[])` → `{ woodsTotal, extrasTotal, total }`

---

## API Layer

`src/features/recipes/api/recipes.ts` — queries Supabase:

| Función | Descripción |
|---------|-------------|
| `getFurnitureTemplates(workshopId)` | Lista con JOIN a recipe_items + materials para calcular costo en cliente |
| `getFurnitureTemplate(id)` | Detalle completo: cabecera + items con material |
| `createFurnitureTemplate(data)` | Inserta cabecera luego items (secuencial, sin transacción real en PostgREST) |
| `updateFurnitureTemplate(id, data)` | Actualiza cabecera + delete+insert de items |
| `deleteFurnitureTemplate(id)` | Cascade borra items automáticamente |

---

## Hooks (TanStack Query)

`src/features/recipes/hooks/useRecipes.ts`:

| Hook | Tipo | Descripción |
|------|------|-------------|
| `useFurnitureTemplates()` | Query | Lista completa del taller |
| `useFurnitureTemplate(id)` | Query | Detalle para edición |
| `useCreateFurnitureTemplate()` | Mutation | Invalida lista al completar |
| `useUpdateFurnitureTemplate()` | Mutation | Invalida lista + detalle |
| `useDeleteFurnitureTemplate()` | Mutation | Invalida lista |

---

## Componentes

### `MuebleList.tsx`
Pantalla principal de la sección Muebles:
- Tarjetas (o tabla responsive) con nombre y costo total estimado calculado en vivo
- Botón "Nuevo mueble" → abre `MuebleForm`
- Acciones por mueble: Editar / Eliminar (con confirmación)
- Estado vacío si no hay muebles cargados

### `MuebleForm.tsx`
Formulario crear/editar — controlado con React Hook Form + Zod:
- Campo: nombre del mueble
- **Sección Maderas** (items donde `material.category === 'madera'`):
  - Selector de material del inventario (filtrado por categoría madera)
  - Campo cantidad numérica
  - Unidad mostrada automáticamente desde `material.unit` (ej: "m", "m²")
  - Subtotal en vivo = `quantity × material.price_per_unit`
  - Botón "Agregar madera"
  - Botón eliminar por item
- **Sección Gastos extras** (items de cualquier otra categoría):
  - Misma estructura, selector filtra categorías no-madera
  - Botón "Agregar gasto extra"
- `RecipeCostPreview` embebido abajo del formulario

### `RecipeCostPreview.tsx`
Card de resumen de costos reactivo:
- Subtotal Maderas
- Subtotal Gastos extras
- **Total estimado**
- Se actualiza en tiempo real mientras el usuario modifica cantidades o selecciona materiales

---

## Flujo de datos

```
Inventario (materials) ──────────────────────────────────────────────┐
                                                                      ↓
MuebleForm: usuario elige material + cantidad → RecipeCostPreview (live)
                          ↓ submit
                  createFurnitureTemplate
                          ↓
               furniture_templates + recipe_items (Supabase)
                          ↓
MuebleList: getFurnitureTemplates → JOIN materials → computeRecipeCost → muestra total
```

**Actualización de precios:** Si un material sube de precio en inventario, no se toca ningún mueble. Al abrir cualquier mueble que use ese material, el JOIN trae `price_per_unit` actualizado y `computeRecipeCost` recalcula el total automáticamente.

---

## Tipos en `database.ts`

Se agregan manualmente (hasta tener token de Supabase) las tablas `furniture_templates` y `recipe_items` siguiendo el mismo patrón de Fase 1: Row, Insert, Update, Relationships. Recordar incluir `Relationships: []` o el FK real para evitar que las columnas resuelvan a `never`.

---

## Ruta y navegación

- La ruta `/muebles` ya existe en `src/features/recipes/routes.tsx` (scaffoldeada en Fase 0)
- El label en el sidebar/bottom tabs dice "Muebles"
- No se necesitan subrutas para esta fase (el formulario puede ser un Sheet/Dialog)

---

## Testing

No se requieren tests unitarios para esta fase (el plan original no los lista para Fase 2). Los hooks se pueden cubrir con tests de integración en Fase 6.

---

## Fuera de alcance (YAGNI)

- Variantes o versiones de un mueble (pendiente para versiones futuras)
- Foto o imagen del mueble
- Tiempo estimado de producción
- Historial de cambios en la receta
