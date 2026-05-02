import { supabase } from '@/shared/lib/supabase'
import type { Material } from '@/shared/types/material'
import type { Database } from '@/shared/types/database'

type FurnitureTemplate = Database['public']['Tables']['furniture_templates']['Row']
type RecipeItem = Database['public']['Tables']['recipe_items']['Row']
type LaborItem = Database['public']['Tables']['labor_items']['Row']
type RecipePiece = Database['public']['Tables']['recipe_pieces']['Row']

export type RecipeItemWithMaterial = RecipeItem & {
  material: Pick<Material, 'id' | 'name' | 'category' | 'unit' | 'price_per_unit' | 'wood_subtype' | 'length_cm' | 'width_cm' | 'thickness_cm'>
}

export type RecipePieceWithMaterial = RecipePiece & {
  material: Pick<Material, 'id' | 'name' | 'category' | 'unit'> | null
}

export type FurnitureTemplateWithItems = FurnitureTemplate & {
  recipe_items: RecipeItemWithMaterial[]
  labor_items: LaborItem[]
  recipe_pieces: RecipePieceWithMaterial[]
}

const RECIPE_SELECT = `
  *,
  recipe_items (
    id, furniture_template_id, material_id, quantity, waste_pct, quantity_formula,
    material:materials ( id, name, category, unit, price_per_unit, wood_subtype, length_cm, width_cm, thickness_cm )
  ),
  labor_items ( id, furniture_template_id, description, hours, rate, created_at ),
  recipe_pieces (
    id, workshop_id, furniture_template_id, material_id,
    piece_name, length_cm, width_cm, thickness_mm, quantity,
    notes, sort_order, created_at, updated_at,
    material:materials ( id, name, category, unit )
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
