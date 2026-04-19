import type { PriceHistoryRow } from '@/features/inventory/api/priceHistory'
import type { RecipeItemWithMaterial } from '../types'

export interface CostHistoryPoint {
  date: string
  price: number
}

/**
 * Reconstruye la evolución del costo estimado de un mueble cruzando
 * los cambios históricos de precios de materiales con su receta actual.
 *
 * Aproximación: ignora el cálculo exacto de madera por volumen y usa
 * `qty*(1+waste)*price` para todos los items — suficiente como indicador
 * de tendencia para un sparkline.
 *
 * Devuelve puntos ordenados cronológicamente, uno por cada fecha de cambio
 * relevante, más el valor actual.
 */
export function computeCostHistory(
  items: RecipeItemWithMaterial[],
  priceHistory: PriceHistoryRow[]
): CostHistoryPoint[] {
  if (items.length === 0) return []

  const materialIds = new Set(items.map((i) => i.material_id))
  const relevant = priceHistory
    .filter((p) => materialIds.has(p.material_id))
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at))

  // precio actual de cada material (de la receta, ya trae price_per_unit)
  const currentPrice = new Map<string, number>()
  for (const it of items) currentPrice.set(it.material_id, it.material.price_per_unit)

  // precio "antes del primer cambio" conocido
  const firstChange = new Map<string, PriceHistoryRow>()
  for (const p of relevant) {
    if (!firstChange.has(p.material_id)) firstChange.set(p.material_id, p)
  }

  const qtyFactor = new Map<string, number>()
  for (const it of items) {
    const factor = it.quantity * (1 + (it.waste_pct ?? 0) / 100)
    qtyFactor.set(it.material_id, (qtyFactor.get(it.material_id) ?? 0) + factor)
  }

  function costAt(date: string): number {
    let total = 0
    for (const [matId, factor] of qtyFactor) {
      // precio = último new_price con changed_at <= date; si no hay, old_price del primero conocido; si no, precio actual
      let price: number | null = null
      for (const p of relevant) {
        if (p.material_id !== matId) continue
        if (p.changed_at <= date) price = p.new_price
        else break
      }
      if (price == null) {
        const fc = firstChange.get(matId)
        price = fc ? fc.old_price : (currentPrice.get(matId) ?? 0)
      }
      total += factor * price
    }
    return total
  }

  const dates = new Set<string>()
  for (const p of relevant) dates.add(p.changed_at)
  const sorted = Array.from(dates).sort()

  const now = new Date().toISOString()
  const points: CostHistoryPoint[] = sorted.map((d) => ({ date: d, price: costAt(d) }))

  // punto "hoy" con precios actuales
  let todayCost = 0
  for (const [matId, factor] of qtyFactor) {
    todayCost += factor * (currentPrice.get(matId) ?? 0)
  }
  points.push({ date: now, price: todayCost })

  // si sólo tenemos un punto (hoy), duplicar para que el sparkline lo pueda dibujar
  if (points.length < 2) {
    points.unshift({ date: now, price: todayCost })
  }
  return points
}
