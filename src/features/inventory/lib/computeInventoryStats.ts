import { MATERIAL_CATEGORIES } from '../types'
import type { Material, MaterialCategory } from '../types'

export interface InventoryStats {
  totalValue: number
  lowStockCount: number
  totalMaterials: number
  topCategory: string
}

export function computeInventoryStats(materials: Material[]): InventoryStats {
  const totalValue = materials.reduce(
    (sum, m) => sum + m.stock * m.price_per_unit,
    0,
  )
  const lowStockCount = materials.filter((m) => m.stock <= m.min_stock).length
  const totalMaterials = materials.length

  let topCategory = '—'
  if (materials.length > 0) {
    const byCat = new Map<MaterialCategory, number>()
    for (const m of materials) {
      byCat.set(m.category, (byCat.get(m.category) ?? 0) + m.stock * m.price_per_unit)
    }
    let bestCat: MaterialCategory | null = null
    let bestVal = -Infinity
    for (const [cat, val] of byCat) {
      if (val > bestVal) {
        bestVal = val
        bestCat = cat
      }
    }
    if (bestCat) {
      topCategory = MATERIAL_CATEGORIES.find((c) => c.value === bestCat)?.label ?? bestCat
    }
  }

  return { totalValue, lowStockCount, totalMaterials, topCategory }
}
