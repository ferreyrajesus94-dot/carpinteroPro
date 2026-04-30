import { supabase } from '@/shared/lib/supabase'
import type {
  FurnitureTemplateInsert,
  FurnitureTemplateUpdate,
  FurnitureTemplateWithItems,
  RecipeItemInsert,
  LaborItemInsert,
} from '../types'

type CutPieceDraft = {
  name?: string | null
  length_cm: number
  width_cm: number
  quantity: number
}

// Selección con JOIN: template + items de material + piezas de corte + items de mano de obra
const RECIPE_SELECT = `
  *,
  recipe_items (
    id,
    furniture_template_id,
    material_id,
    quantity,
    waste_pct,
    quantity_formula,
    material:materials (
      id, name, category, unit, price_per_unit,
      wood_subtype, length_cm, width_cm, thickness_cm
    ),
    cut_pieces (
      id, name, length_cm, width_cm, quantity
    )
  ),
  labor_items (
    id, furniture_template_id, description, hours, rate, created_at
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

export type RecipeItemDraft = Omit<RecipeItemInsert, 'id' | 'furniture_template_id'> & {
  cut_pieces?: CutPieceDraft[]
}
export type LaborItemDraft = Omit<LaborItemInsert, 'id' | 'furniture_template_id' | 'created_at'>

async function replaceCutPieces(recipeItemId: string, pieces: CutPieceDraft[]) {
  const { error: delErr } = await supabase
    .from('cut_pieces')
    .delete()
    .eq('recipe_item_id', recipeItemId)
  if (delErr) throw delErr

  if (pieces.length > 0) {
    const { error } = await supabase
      .from('cut_pieces')
      .insert(pieces.map((p) => ({ ...p, recipe_item_id: recipeItemId })))
    if (error) throw error
  }
}

async function replaceLaborItems(templateId: string, laborItems: LaborItemDraft[]) {
  const { error: deleteError } = await supabase
    .from('labor_items')
    .delete()
    .eq('furniture_template_id', templateId)
  if (deleteError) throw deleteError

  if (laborItems.length > 0) {
    const { error } = await supabase
      .from('labor_items')
      .insert(laborItems.map((l) => ({ ...l, furniture_template_id: templateId })))
    if (error) throw error
  }
}

export async function createFurnitureTemplate(
  template: Omit<FurnitureTemplateInsert, 'id' | 'created_at' | 'updated_at'>,
  items: RecipeItemDraft[],
  laborItems: LaborItemDraft[] = []
): Promise<string> {
  const { data, error } = await supabase
    .from('furniture_templates')
    .insert(template)
    .select('id')
    .single()
  if (error) throw error

  if (items.length > 0) {
    const { data: insertedItems, error: itemsError } = await supabase
      .from('recipe_items')
      .insert(items.map(({ cut_pieces: _cp, ...item }) => ({ ...item, furniture_template_id: data.id })))
      .select('id')
    if (itemsError) throw itemsError

    for (let i = 0; i < (insertedItems ?? []).length; i++) {
      const cp = items[i].cut_pieces
      if (cp && cp.length > 0) {
        await replaceCutPieces(insertedItems![i].id, cp)
      }
    }
  }

  if (laborItems.length > 0) {
    await replaceLaborItems(data.id, laborItems)
  }

  return data.id
}

export async function updateFurnitureTemplate(
  id: string,
  template: FurnitureTemplateUpdate,
  items: RecipeItemDraft[],
  laborItems: LaborItemDraft[] = []
): Promise<void> {
  const { error } = await supabase
    .from('furniture_templates')
    .update(template)
    .eq('id', id)
  if (error) throw error

  const { error: deleteError } = await supabase
    .from('recipe_items')
    .delete()
    .eq('furniture_template_id', id)
  if (deleteError) throw deleteError

  if (items.length > 0) {
    const { data: insertedItems, error: insertError } = await supabase
      .from('recipe_items')
      .insert(items.map(({ cut_pieces: _cp, ...item }) => ({ ...item, furniture_template_id: id })))
      .select('id')
    if (insertError) throw insertError

    for (let i = 0; i < (insertedItems ?? []).length; i++) {
      const cp = items[i].cut_pieces
      if (cp && cp.length > 0) {
        await replaceCutPieces(insertedItems![i].id, cp)
      }
    }
  }

  await replaceLaborItems(id, laborItems)
}

export async function deleteFurnitureTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('furniture_templates')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function duplicateFurnitureTemplate(id: string): Promise<string> {
  const original = await fetchFurnitureTemplate(id)
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    recipe_items,
    labor_items,
    ...rest
  } = original
  return createFurnitureTemplate(
    { ...rest, name: `${original.name} (copia)` },
    recipe_items.map((it) => ({
      material_id: it.material_id,
      quantity: it.quantity,
      waste_pct: it.waste_pct,
      quantity_formula: it.quantity_formula ?? null,
      cut_pieces: (it.cut_pieces ?? []).map((cp) => ({
        name: cp.name,
        length_cm: cp.length_cm,
        width_cm: cp.width_cm,
        quantity: cp.quantity,
      })),
    })),
    (labor_items ?? []).map((l) => ({
      description: l.description,
      hours: l.hours,
      rate: l.rate,
    }))
  )
}

export async function fetchTemplateUsageCounts(
  workshopId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('quotes')
    .select('furniture_template_id')
    .eq('workshop_id', workshopId)
    .not('furniture_template_id', 'is', null)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const tid = (row as { furniture_template_id: string | null }).furniture_template_id
    if (tid) counts[tid] = (counts[tid] ?? 0) + 1
  }
  return counts
}
