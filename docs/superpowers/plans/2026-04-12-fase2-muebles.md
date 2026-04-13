# Fase 2 — Muebles (BOM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de muebles como biblioteca de BOM reutilizables — cada mueble lista materiales del inventario con cantidades; el costo se calcula en vivo desde los precios actuales.

**Architecture:** Misma feature-slice que inventario. Dos tablas nuevas (`furniture_templates` + `recipe_items`). Las secciones Maderas/Extras se derivan de `material.category` en cliente — sin columna extra en BD. El costo nunca se persiste: `quantity × price_per_unit` al momento de lectura. `MuebleForm` usa dos `useFieldArray` (one per section); `RecipeCostPreview` recibe los drafts + la lista de materiales y computa en vivo.

**Tech Stack:** Supabase (Postgres + PostgREST), React Hook Form + Zod (`useFieldArray`), TanStack Query, TypeScript, Tailwind, shadcn/ui.

---

## File Map

| Acción | Archivo |
|--------|---------|
| Create | `supabase/migrations/0002_recipes.sql` |
| Modify | `src/shared/types/database.ts` |
| Modify | `src/shared/lib/utils.ts` |
| Create | `src/features/recipes/types.ts` |
| Create | `src/features/recipes/api/recipes.ts` |
| Create | `src/features/recipes/hooks/useRecipes.ts` |
| Create | `src/features/recipes/components/RecipeCostPreview.tsx` |
| Create | `src/features/recipes/components/MuebleForm.tsx` |
| Create | `src/features/recipes/components/MuebleList.tsx` |
| Replace | `src/features/recipes/routes.tsx` |
| Modify | `src/app/layouts/AppLayout.tsx` |
| Modify | `docs/superpowers/plans/2026-04-12-carpinteropro.md` |

---

## Task 1: SQL Migration

**Files:**
- Create: `supabase/migrations/0002_recipes.sql`

- [ ] **Step 1: Crear el archivo de migración**

Crear `supabase/migrations/0002_recipes.sql` con el siguiente contenido exacto:

```sql
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
```

- [ ] **Step 2: Aplicar la migración en Supabase**

En el dashboard de Supabase (https://supabase.com/dashboard/project/revbbzqjglqnphjrasvv → SQL Editor), copiar y ejecutar el contenido del archivo. Verificar que no hay errores.

Alternativamente con la CLI (si hay token disponible):
```bash
npx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_recipes.sql
git commit -m "chore(db): add furniture_templates and recipe_items migration"
```

---

## Task 2: Actualizar tipos TypeScript

**Files:**
- Modify: `src/shared/types/database.ts`
- Modify: `src/shared/lib/utils.ts`

- [ ] **Step 1: Agregar tablas en database.ts**

En `src/shared/types/database.ts`, dentro del objeto `Tables` (después del bloque `price_history`), agregar:

```typescript
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
```

- [ ] **Step 2: Agregar formatARS en utils.ts**

En `src/shared/lib/utils.ts`, agregar al final del archivo:

```typescript
export function formatARS(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(amount)
}
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npm run build 2>&1 | head -30
```

Esperado: sin errores de tipos nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/database.ts src/shared/lib/utils.ts
git commit -m "chore(types): add furniture_templates and recipe_items types + formatARS helper"
```

---

## Task 3: Tipos del feature recipes

**Files:**
- Create: `src/features/recipes/types.ts`

- [ ] **Step 1: Crear el archivo de tipos**

Crear `src/features/recipes/types.ts`:

```typescript
import type { Database } from '@/shared/types/database'
import type { Material } from '@/features/inventory/types'

export type FurnitureTemplate = Database['public']['Tables']['furniture_templates']['Row']
export type FurnitureTemplateInsert = Database['public']['Tables']['furniture_templates']['Insert']
export type FurnitureTemplateUpdate = Database['public']['Tables']['furniture_templates']['Update']
export type RecipeItem = Database['public']['Tables']['recipe_items']['Row']
export type RecipeItemInsert = Database['public']['Tables']['recipe_items']['Insert']

// RecipeItem enriquecido con datos del material (viene del JOIN en la API)
export type RecipeItemWithMaterial = {
  id: string
  furniture_template_id: string
  material_id: string
  quantity: number
  material: Pick<Material, 'id' | 'name' | 'category' | 'unit' | 'price_per_unit'>
}

// Template completo con todos sus items
export type FurnitureTemplateWithItems = FurnitureTemplate & {
  recipe_items: RecipeItemWithMaterial[]
}

export interface RecipeCost {
  woodsTotal: number
  extrasTotal: number
  total: number
}

/**
 * Calcula el costo estimado de un mueble a partir de sus items.
 * Nunca se persiste — siempre se recalcula en tiempo de lectura.
 */
export function computeRecipeCost(items: RecipeItemWithMaterial[]): RecipeCost {
  let woodsTotal = 0
  let extrasTotal = 0
  for (const item of items) {
    const subtotal = item.quantity * item.material.price_per_unit
    if (item.material.category === 'madera') {
      woodsTotal += subtotal
    } else {
      extrasTotal += subtotal
    }
  }
  return { woodsTotal, extrasTotal, total: woodsTotal + extrasTotal }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/recipes/types.ts
git commit -m "feat(recipes): add types and computeRecipeCost helper"
```

---

## Task 4: API layer

**Files:**
- Create: `src/features/recipes/api/recipes.ts`

- [ ] **Step 1: Crear el archivo de API**

Crear `src/features/recipes/api/recipes.ts`:

```typescript
import { supabase } from '@/shared/lib/supabase'
import type {
  FurnitureTemplateInsert,
  FurnitureTemplateUpdate,
  FurnitureTemplateWithItems,
  RecipeItemInsert,
} from '../types'

// Selección con JOIN: template + items + material de cada item
const RECIPE_SELECT = `
  *,
  recipe_items (
    id,
    furniture_template_id,
    material_id,
    quantity,
    material:materials (
      id, name, category, unit, price_per_unit
    )
  )
` as const

export async function fetchFurnitureTemplates(workshopId: string): Promise<FurnitureTemplateWithItems[]> {
  const { data, error } = await supabase
    .from('furniture_templates')
    .select(RECIPE_SELECT)
    .eq('workshop_id', workshopId)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as FurnitureTemplateWithItems[]
}

export async function fetchFurnitureTemplate(id: string): Promise<FurnitureTemplateWithItems> {
  const { data, error } = await supabase
    .from('furniture_templates')
    .select(RECIPE_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as FurnitureTemplateWithItems
}

export async function createFurnitureTemplate(
  template: Omit<FurnitureTemplateInsert, 'id' | 'created_at' | 'updated_at'>,
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
): Promise<string> {
  const { data, error } = await supabase
    .from('furniture_templates')
    .insert(template)
    .select('id')
    .single()
  if (error) throw error

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('recipe_items')
      .insert(items.map((item) => ({ ...item, furniture_template_id: data.id })))
    if (itemsError) throw itemsError
  }

  return data.id
}

export async function updateFurnitureTemplate(
  id: string,
  template: FurnitureTemplateUpdate,
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
): Promise<void> {
  const { error } = await supabase
    .from('furniture_templates')
    .update(template)
    .eq('id', id)
  if (error) throw error

  // Reemplazar todos los items: borrar los existentes e insertar los nuevos
  const { error: deleteError } = await supabase
    .from('recipe_items')
    .delete()
    .eq('furniture_template_id', id)
  if (deleteError) throw deleteError

  if (items.length > 0) {
    const { error: insertError } = await supabase
      .from('recipe_items')
      .insert(items.map((item) => ({ ...item, furniture_template_id: id })))
    if (insertError) throw insertError
  }
}

export async function deleteFurnitureTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('furniture_templates')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/recipes/api/recipes.ts
git commit -m "feat(recipes): add Supabase API layer for furniture templates"
```

---

## Task 5: Hooks TanStack Query

**Files:**
- Create: `src/features/recipes/hooks/useRecipes.ts`

- [ ] **Step 1: Crear el archivo de hooks**

Crear `src/features/recipes/hooks/useRecipes.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchFurnitureTemplates,
  fetchFurnitureTemplate,
  createFurnitureTemplate,
  updateFurnitureTemplate,
  deleteFurnitureTemplate,
} from '../api/recipes'
import type { FurnitureTemplateInsert, FurnitureTemplateUpdate, RecipeItemInsert } from '../types'

const TEMPLATES_KEY = 'furniture_templates'

export function useFurnitureTemplates(workshopId: string) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, workshopId],
    queryFn: () => fetchFurnitureTemplates(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useFurnitureTemplate(id: string | null) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, id],
    queryFn: () => fetchFurnitureTemplate(id!),
    enabled: Boolean(id),
  })
}

interface CreatePayload {
  template: Omit<FurnitureTemplateInsert, 'id' | 'created_at' | 'updated_at'>
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
}

export function useCreateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ template, items }: CreatePayload) =>
      createFurnitureTemplate(template, items),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}

interface UpdatePayload {
  id: string
  template: FurnitureTemplateUpdate
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
}

export function useUpdateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, template, items }: UpdatePayload) =>
      updateFurnitureTemplate(id, template, items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, variables.id] })
    },
  })
}

export function useDeleteFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFurnitureTemplate(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/recipes/hooks/useRecipes.ts
git commit -m "feat(recipes): add TanStack Query hooks for furniture templates"
```

---

## Task 6: RecipeCostPreview

**Files:**
- Create: `src/features/recipes/components/RecipeCostPreview.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/recipes/components/RecipeCostPreview.tsx`:

```typescript
import { formatARS } from '@/shared/lib/utils'
import type { Material } from '@/features/inventory/types'

interface ItemDraft {
  material_id: string
  quantity: number
}

interface RecipeCostPreviewProps {
  woodItems: ItemDraft[]
  extraItems: ItemDraft[]
  materials: Material[]
}

export function RecipeCostPreview({ woodItems, extraItems, materials }: RecipeCostPreviewProps) {
  const materialMap = new Map(materials.map((m) => [m.id, m]))

  let woodsTotal = 0
  for (const item of woodItems) {
    const mat = materialMap.get(item.material_id)
    if (mat && item.quantity > 0) woodsTotal += item.quantity * mat.price_per_unit
  }

  let extrasTotal = 0
  for (const item of extraItems) {
    const mat = materialMap.get(item.material_id)
    if (mat && item.quantity > 0) extrasTotal += item.quantity * mat.price_per_unit
  }

  const total = woodsTotal + extrasTotal

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Costo estimado</h3>
      <div className="flex justify-between text-sm">
        <span>Maderas</span>
        <span>{formatARS(woodsTotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Gastos extras</span>
        <span>{formatARS(extrasTotal)}</span>
      </div>
      <div className="flex justify-between font-semibold border-t pt-2">
        <span>Total</span>
        <span>{formatARS(total)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/features/recipes/components/RecipeCostPreview.tsx
git commit -m "feat(recipes): add RecipeCostPreview component"
```

---

## Task 7: MuebleForm

**Files:**
- Create: `src/features/recipes/components/MuebleForm.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/recipes/components/MuebleForm.tsx`:

```typescript
import { useEffect } from 'react'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
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
import { useMaterials } from '@/features/inventory/hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateFurnitureTemplate, useUpdateFurnitureTemplate } from '../hooks/useRecipes'
import { RecipeCostPreview } from './RecipeCostPreview'
import type { FurnitureTemplateWithItems } from '../types'

const itemSchema = z.object({
  material_id: z.string().min(1, 'Seleccioná un material'),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
})

const muebleSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  notes: z.string().optional(),
  wood_items: z.array(itemSchema),
  extra_items: z.array(itemSchema),
})

type FormValues = z.infer<typeof muebleSchema>

interface MuebleFormProps {
  template?: FurnitureTemplateWithItems | null
  onSuccess: () => void
  onCancel: () => void
}

export function MuebleForm({ template, onSuccess, onCancel }: MuebleFormProps) {
  const workshopId = useWorkshopId()
  const isEditing = Boolean(template)

  const { data: allMaterials = [] } = useMaterials(workshopId)
  const woodMaterials = allMaterials.filter((m) => m.category === 'madera')
  const extraMaterials = allMaterials.filter((m) => m.category !== 'madera')

  const createMutation = useCreateFurnitureTemplate(workshopId)
  const updateMutation = useUpdateFurnitureTemplate(workshopId)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(muebleSchema) as Resolver<FormValues>,
    defaultValues: { name: '', notes: '', wood_items: [], extra_items: [] },
  })

  const { fields: woodFields, append: appendWood, remove: removeWood } = useFieldArray({
    control,
    name: 'wood_items',
  })
  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control,
    name: 'extra_items',
  })

  // Poblar el formulario cuando se edita
  useEffect(() => {
    if (template) {
      const woodItems = template.recipe_items
        .filter((i) => i.material.category === 'madera')
        .map((i) => ({ material_id: i.material_id, quantity: i.quantity }))
      const extraItems = template.recipe_items
        .filter((i) => i.material.category !== 'madera')
        .map((i) => ({ material_id: i.material_id, quantity: i.quantity }))

      reset({
        name: template.name,
        notes: template.notes ?? '',
        wood_items: woodItems,
        extra_items: extraItems,
      })
    }
  }, [template, reset])

  const woodItemsWatch = watch('wood_items')
  const extraItemsWatch = watch('extra_items')

  async function onSubmit(values: FormValues) {
    const items = [
      ...values.wood_items.map((i) => ({ material_id: i.material_id, quantity: i.quantity })),
      ...values.extra_items.map((i) => ({ material_id: i.material_id, quantity: i.quantity })),
    ]

    if (isEditing && template) {
      await updateMutation.mutateAsync({
        id: template.id,
        template: { name: values.name, notes: values.notes || null },
        items,
      })
    } else {
      await createMutation.mutateAsync({
        template: { name: values.name, notes: values.notes || null, workshop_id: workshopId },
        items,
      })
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Nombre */}
      <div className="space-y-1">
        <Label htmlFor="name">Nombre del mueble</Label>
        <Input id="name" {...register('name')} placeholder="Ej: Ropero 2 puertas" />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" {...register('notes')} placeholder="Medidas, variantes, etc." rows={2} />
      </div>

      {/* Sección Maderas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Maderas</h3>
        {woodFields.map((field, index) => {
          const mat = allMaterials.find((m) => m.id === woodItemsWatch[index]?.material_id)
          return (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Select
                  value={woodItemsWatch[index]?.material_id ?? ''}
                  onValueChange={(v) => setValue(`wood_items.${index}.material_id`, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná madera" />
                  </SelectTrigger>
                  <SelectContent>
                    {woodMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.wood_items?.[index]?.material_id && (
                  <p className="text-destructive text-xs">
                    {errors.wood_items[index]?.material_id?.message}
                  </p>
                )}
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Cantidad {mat ? `(${mat.unit})` : ''}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`wood_items.${index}.quantity`)}
                  placeholder="0"
                />
                {errors.wood_items?.[index]?.quantity && (
                  <p className="text-destructive text-xs">
                    {errors.wood_items[index]?.quantity?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeWood(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendWood({ material_id: '', quantity: 0 })}
          disabled={woodMaterials.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar madera
        </Button>
        {woodMaterials.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay maderas en el inventario. Agregá materiales de categoría "Madera" primero.
          </p>
        )}
      </div>

      {/* Sección Gastos extras */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Gastos extras</h3>
        {extraFields.map((field, index) => {
          const mat = allMaterials.find((m) => m.id === extraItemsWatch[index]?.material_id)
          return (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Select
                  value={extraItemsWatch[index]?.material_id ?? ''}
                  onValueChange={(v) => setValue(`extra_items.${index}.material_id`, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná extra" />
                  </SelectTrigger>
                  <SelectContent>
                    {extraMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.extra_items?.[index]?.material_id && (
                  <p className="text-destructive text-xs">
                    {errors.extra_items[index]?.material_id?.message}
                  </p>
                )}
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Cantidad {mat ? `(${mat.unit})` : ''}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`extra_items.${index}.quantity`)}
                  placeholder="0"
                />
                {errors.extra_items?.[index]?.quantity && (
                  <p className="text-destructive text-xs">
                    {errors.extra_items[index]?.quantity?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExtra(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendExtra({ material_id: '', quantity: 0 })}
          disabled={extraMaterials.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar gasto extra
        </Button>
        {extraMaterials.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay extras en el inventario. Agregá materiales de otra categoría primero.
          </p>
        )}
      </div>

      {/* Preview de costo */}
      <RecipeCostPreview
        woodItems={woodItemsWatch}
        extraItems={extraItemsWatch}
        materials={allMaterials}
      />

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear mueble'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build 2>&1 | head -30
```

Esperado: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add src/features/recipes/components/MuebleForm.tsx
git commit -m "feat(recipes): add MuebleForm with two-section field arrays and live cost preview"
```

---

## Task 8: MuebleList

**Files:**
- Create: `src/features/recipes/components/MuebleList.tsx`

- [ ] **Step 1: Crear el componente**

Crear `src/features/recipes/components/MuebleList.tsx`:

```typescript
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { useFurnitureTemplates, useDeleteFurnitureTemplate } from '../hooks/useRecipes'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { computeRecipeCost } from '../types'
import { formatARS } from '@/shared/lib/utils'
import type { FurnitureTemplateWithItems } from '../types'

interface MuebleListProps {
  onEdit: (template: FurnitureTemplateWithItems) => void
}

export function MuebleList({ onEdit }: MuebleListProps) {
  const workshopId = useWorkshopId()
  const { data: templates = [], isLoading } = useFurnitureTemplates(workshopId)
  const deleteMutation = useDeleteFurnitureTemplate(workshopId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Cargando muebles...
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay muebles. Creá el primero con el botón de arriba.
      </p>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Costo estimado</TableHead>
            <TableHead className="w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => {
            const { total } = computeRecipeCost(template.recipe_items)
            return (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {template.recipe_items.length} material{template.recipe_items.length !== 1 ? 'es' : ''}
                </TableCell>
                <TableCell className="font-semibold">{formatARS(total)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(template)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${template.name}"?`)) {
                          deleteMutation.mutate(template.id)
                        }
                      }}
                      title="Eliminar"
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
  )
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/features/recipes/components/MuebleList.tsx
git commit -m "feat(recipes): add MuebleList with cost column"
```

---

## Task 9: Conectar todo en RecipesRoutes

**Files:**
- Replace: `src/features/recipes/routes.tsx`

- [ ] **Step 1: Reemplazar el placeholder**

Reemplazar el contenido completo de `src/features/recipes/routes.tsx`:

```typescript
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MuebleList } from './components/MuebleList'
import { MuebleForm } from './components/MuebleForm'
import type { FurnitureTemplateWithItems } from './types'

export function RecipesRoutes() {
  const [formOpen, setFormOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<FurnitureTemplateWithItems | null>(null)

  function handleEdit(template: FurnitureTemplateWithItems) {
    setSelectedTemplate(template)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setSelectedTemplate(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Muebles</h1>
          <p className="text-muted-foreground text-sm">
            Plantillas de muebles con lista de materiales y costo estimado.
          </p>
        </div>
        <Button onClick={() => { setSelectedTemplate(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo mueble
        </Button>
      </div>

      <MuebleList onEdit={handleEdit} />

      <Dialog open={formOpen} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Editar mueble' : 'Nuevo mueble'}
            </DialogTitle>
          </DialogHeader>
          <MuebleForm
            template={selectedTemplate}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build completo**

```bash
npm run build
```

Esperado: build exitoso sin errores.

- [ ] **Step 3: Verificar en dev**

```bash
npm run dev
```

Abrir http://localhost:5173/recipes. Verificar:
- Página muestra "Muebles" con tabla vacía y botón "Nuevo mueble"
- Click "Nuevo mueble" → Dialog con formulario completo (secciones Maderas y Extras)
- Si hay materiales en inventario, los selectores los muestran filtrados por sección
- El preview de costo se actualiza al seleccionar materiales y cantidades
- Crear un mueble → aparece en la lista con costo calculado
- Editar → el formulario se pre-popula correctamente
- Eliminar → confirmation y desaparece de la lista

- [ ] **Step 4: Commit**

```bash
git add src/features/recipes/routes.tsx
git commit -m "feat(recipes): wire up RecipesRoutes with MuebleList and MuebleForm"
```

---

## Task 10: Actualizar navegación y progress tracker

**Files:**
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `docs/superpowers/plans/2026-04-12-carpinteropro.md`

- [ ] **Step 1: Cambiar label "Recetas" → "Muebles" en AppLayout**

En `src/app/layouts/AppLayout.tsx`, línea 7, cambiar:

```typescript
  { to: '/recipes', label: 'Recetas', icon: BookOpen },
```

por:

```typescript
  { to: '/recipes', label: 'Muebles', icon: BookOpen },
```

- [ ] **Step 2: Verificar en dev que el label cambió**

```bash
npm run dev
```

Verificar sidebar y bottom tabs en mobile muestran "Muebles".

- [ ] **Step 3: Marcar Fase 2 como completa en el plan maestro**

En `docs/superpowers/plans/2026-04-12-carpinteropro.md`, en la tabla Progress Tracker, cambiar la fila de Fase 2:

```markdown
| **Fase 2** — Recetas (BOM) | ✅ Completa | 2026-04-12 |
```

- [ ] **Step 4: Commit final de fase**

```bash
git add src/app/layouts/AppLayout.tsx docs/superpowers/plans/2026-04-12-carpinteropro.md
git commit -m "feat(recipes): rename nav label to Muebles, mark Fase 2 complete"
```

---

## Verificación final

- [ ] `npm run build` — sin errores
- [ ] `npm run lint` — sin warnings nuevos
- [ ] Probar el flujo completo en http://localhost:5173/recipes:
  1. Crear un mueble con maderas y extras
  2. Verificar que el costo se calcula en vivo
  3. Editar el mueble — los valores se pre-populan
  4. Actualizar el precio de un material en /inventory — volver a /recipes y verificar que el costo cambió
  5. Intentar borrar un material en uso desde /inventory — Supabase debe rechazarlo (FK RESTRICT)
  6. Borrar un mueble — desaparece de la lista
