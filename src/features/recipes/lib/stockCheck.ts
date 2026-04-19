import type { Material } from '@/features/inventory/types'

export interface StockCheckItem {
  material_id: string
  quantity: number
  waste_pct?: number | null
}

export interface StockShortage {
  materialId: string
  name: string
  unit: string
  required: number
  available: number
  missing: number
}

/**
 * Pure helper: dado items (con merma) y un mapa de materiales, devuelve faltantes.
 * La lógica del toggle `stock_alert_enabled` queda afuera; este helper siempre calcula.
 */
export function computeStockShortages(
  items: StockCheckItem[],
  materials: Pick<Material, 'id' | 'name' | 'unit' | 'stock'>[]
): StockShortage[] {
  const byId = new Map(materials.map((m) => [m.id, m]))
  const agg = new Map<string, number>()
  for (const it of items) {
    if (!it.material_id || !(it.quantity > 0)) continue
    const required = it.quantity * (1 + (it.waste_pct ?? 0) / 100)
    agg.set(it.material_id, (agg.get(it.material_id) ?? 0) + required)
  }
  const out: StockShortage[] = []
  for (const [materialId, required] of agg) {
    const mat = byId.get(materialId)
    if (!mat) continue
    const available = mat.stock ?? 0
    if (required > available) {
      out.push({
        materialId,
        name: mat.name,
        unit: mat.unit,
        required,
        available,
        missing: required - available,
      })
    }
  }
  return out
}
