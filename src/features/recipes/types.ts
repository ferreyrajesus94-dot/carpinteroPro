import type { Database } from '@/shared/types/database'
import type { Material } from '@/shared/types/material'

export type FurnitureTemplate = Database['public']['Tables']['furniture_templates']['Row']
export type FurnitureTemplateInsert = Database['public']['Tables']['furniture_templates']['Insert']
export type FurnitureTemplateUpdate = Database['public']['Tables']['furniture_templates']['Update']
export type RecipeItem = Database['public']['Tables']['recipe_items']['Row']
export type RecipeItemInsert = Database['public']['Tables']['recipe_items']['Insert']
export type LaborItem = Database['public']['Tables']['labor_items']['Row']
export type LaborItemInsert = Database['public']['Tables']['labor_items']['Insert']
export type RecipePiece = Database['public']['Tables']['recipe_pieces']['Row']
export type RecipePieceInsert = Database['public']['Tables']['recipe_pieces']['Insert']

// RecipePiece enriquecida con datos del material (viene del JOIN en la API).
// El material es opcional — una pieza puede declararse sin vincular material.
export type RecipePieceWithMaterial = RecipePiece & {
  material: Pick<Material, 'id' | 'name' | 'category' | 'unit'> | null
}

// RecipeItem enriquecido con datos del material (viene del JOIN en la API).
// Para madera se incluyen las medidas porque el cálculo de costo las usa
// (ver computeWoodUsage).
export type RecipeItemWithMaterial = {
  id: string
  furniture_template_id: string
  material_id: string
  quantity: number
  waste_pct: number
  quantity_formula?: string | null
  material: Pick<
    Material,
    | 'id'
    | 'name'
    | 'category'
    | 'unit'
    | 'price_per_unit'
    | 'wood_subtype'
    | 'length_cm'
    | 'width_cm'
    | 'thickness_cm'
  >
}

export interface FurnitureParam {
  name: string
  default: number
}

// Template completo con todos sus items
export type FurnitureTemplateWithItems = FurnitureTemplate & {
  recipe_items: RecipeItemWithMaterial[]
  labor_items: LaborItem[]
  recipe_pieces: RecipePieceWithMaterial[]
}

// Re-exported from shared for backward compatibility within the feature
export { computeRecipeCost, resolveItemQuantity } from '@/shared/lib/recipeCalc'
export type { RecipeCost } from '@/shared/lib/recipeCalc'
