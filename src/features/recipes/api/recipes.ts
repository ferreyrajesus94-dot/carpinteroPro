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
