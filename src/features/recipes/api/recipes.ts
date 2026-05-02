import { supabase } from '@/shared/lib/supabase'
import { fetchFurnitureTemplate } from '@/shared/api/furnitureTemplates'
import type {
  FurnitureTemplateInsert,
  FurnitureTemplateUpdate,
  FurnitureTemplateWithItems,
  RecipeItemInsert,
  LaborItemInsert,
  RecipePieceInsert,
} from '../types'

export type RecipeItemDraft = Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>
export type LaborItemDraft = Omit<LaborItemInsert, 'id' | 'furniture_template_id' | 'created_at'>
export type RecipePieceDraft = Omit<
  RecipePieceInsert,
  'id' | 'furniture_template_id' | 'workshop_id' | 'created_at' | 'updated_at'
>

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

async function replaceRecipePieces(templateId: string, pieces: RecipePieceDraft[]) {
  const { error: deleteError } = await supabase
    .from('recipe_pieces')
    .delete()
    .eq('furniture_template_id', templateId)
  if (deleteError) throw deleteError

  if (pieces.length > 0) {
    const { error } = await supabase
      .from('recipe_pieces')
      .insert(
        pieces.map((p, idx) => ({
          ...p,
          furniture_template_id: templateId,
          sort_order: p.sort_order ?? idx,
        }))
      )
    if (error) throw error
  }
}

export async function createFurnitureTemplate(
  template: Omit<FurnitureTemplateInsert, 'id' | 'created_at' | 'updated_at'>,
  items: RecipeItemDraft[],
  laborItems: LaborItemDraft[] = [],
  pieces: RecipePieceDraft[] = []
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

  if (laborItems.length > 0) {
    await replaceLaborItems(data.id, laborItems)
  }

  await replaceRecipePieces(data.id, pieces)

  return data.id
}

export async function updateFurnitureTemplate(
  id: string,
  template: FurnitureTemplateUpdate,
  items: RecipeItemDraft[],
  laborItems: LaborItemDraft[] = [],
  pieces: RecipePieceDraft[] = []
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
    const { error: insertError } = await supabase
      .from('recipe_items')
      .insert(items.map((item) => ({ ...item, furniture_template_id: id })))
    if (insertError) throw insertError
  }

  await replaceLaborItems(id, laborItems)
  await replaceRecipePieces(id, pieces)
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
    recipe_pieces,
    ...rest
  } = original
  return createFurnitureTemplate(
    { ...rest, name: `${original.name} (copia)` },
    recipe_items.map((it) => ({
      material_id: it.material_id,
      quantity: it.quantity,
      waste_pct: it.waste_pct,
      quantity_formula: it.quantity_formula ?? null,
    })),
    (labor_items ?? []).map((l) => ({
      description: l.description,
      hours: l.hours,
      rate: l.rate,
    })),
    (recipe_pieces ?? []).map((p) => ({
      material_id: p.material_id,
      piece_name: p.piece_name,
      length_cm: p.length_cm,
      width_cm: p.width_cm,
      thickness_mm: p.thickness_mm,
      quantity: p.quantity,
      notes: p.notes,
      sort_order: p.sort_order,
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
