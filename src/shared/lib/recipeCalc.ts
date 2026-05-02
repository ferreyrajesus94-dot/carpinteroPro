import type { Material } from '@/shared/types/material'
import { computeWoodUsage } from '@/shared/lib/computeWoodUsage'
import { safeEvalFormula } from '@/shared/lib/evalFormula'
import type { Database } from '@/shared/types/database'

type LaborItemRow = Database['public']['Tables']['labor_items']['Row']

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

export interface RecipeCost {
  woodsTotal: number
  extrasTotal: number
  laborTotal: number
  total: number
}

function applyWaste(qty: number, wastePct: number | null | undefined): number {
  return qty * (1 + (wastePct ?? 0) / 100)
}

export function resolveItemQuantity(
  item: Pick<RecipeItemWithMaterial, 'quantity' | 'quantity_formula'>,
  paramValues: Record<string, number> = {}
): number {
  return safeEvalFormula(item.quantity_formula, paramValues, item.quantity)
}

export function computeRecipeCost(
  items: RecipeItemWithMaterial[],
  laborItems: Pick<LaborItemRow, 'hours' | 'rate'>[] = [],
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
