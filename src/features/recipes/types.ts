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
