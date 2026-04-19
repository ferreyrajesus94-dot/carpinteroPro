import type { Database } from '@/shared/types/database'
import type { Material } from '@/features/inventory/types'
import { computeWoodUsage } from './lib/computeWoodUsage'
import { safeEvalFormula } from './lib/evalFormula'

export type FurnitureTemplate = Database['public']['Tables']['furniture_templates']['Row']
export type FurnitureTemplateInsert = Database['public']['Tables']['furniture_templates']['Insert']
export type FurnitureTemplateUpdate = Database['public']['Tables']['furniture_templates']['Update']
export type RecipeItem = Database['public']['Tables']['recipe_items']['Row']
export type RecipeItemInsert = Database['public']['Tables']['recipe_items']['Insert']
export type LaborItem = Database['public']['Tables']['labor_items']['Row']
export type LaborItemInsert = Database['public']['Tables']['labor_items']['Insert']

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
}

export interface RecipeCost {
  woodsTotal: number
  extrasTotal: number
  laborTotal: number
  total: number
}

/** Aplica merma a la cantidad: qty * (1 + waste_pct/100). */
function applyWaste(qty: number, wastePct: number | null | undefined): number {
  const w = wastePct ?? 0
  return qty * (1 + w / 100)
}

/**
 * Calcula el costo estimado de un mueble a partir de sus items.
 * Nunca se persiste — siempre se recalcula en tiempo de lectura.
 */
/** Cantidad efectiva: si hay fórmula evaluable con los params, la usa; si no, `quantity`. */
export function resolveItemQuantity(
  item: Pick<RecipeItemWithMaterial, 'quantity' | 'quantity_formula'>,
  paramValues: Record<string, number> = {}
): number {
  return safeEvalFormula(item.quantity_formula, paramValues, item.quantity)
}

export function computeRecipeCost(
  items: RecipeItemWithMaterial[],
  laborItems: Pick<LaborItem, 'hours' | 'rate'>[] = [],
  paramValues: Record<string, number> = {}
): RecipeCost {
  let woodsTotal = 0
  let extrasTotal = 0
  for (const item of items) {
    const baseQty = resolveItemQuantity(item, paramValues)
    const qty = applyWaste(baseQty, item.waste_pct)
    if (item.material.category === 'madera') {
      woodsTotal += computeWoodUsage(item.material, qty).subtotal
    } else {
      extrasTotal += qty * item.material.price_per_unit
    }
  }
  const laborTotal = laborItems.reduce((s, l) => s + l.hours * l.rate, 0)
  return { woodsTotal, extrasTotal, laborTotal, total: woodsTotal + extrasTotal + laborTotal }
}
