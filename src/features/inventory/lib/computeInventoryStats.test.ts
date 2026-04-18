import { describe, it, expect } from 'vitest'
import type { Material } from '../types'
import { computeInventoryStats } from './computeInventoryStats'

function mat(partial: Partial<Material>): Material {
  return {
    id: partial.id ?? 'm',
    workshop_id: 'w',
    name: partial.name ?? 'X',
    category: partial.category ?? 'madera',
    unit: partial.unit ?? 'un',
    price_per_unit: partial.price_per_unit ?? 0,
    stock: partial.stock ?? 0,
    min_stock: partial.min_stock ?? 0,
    notes: null,
    wood_subtype: null,
    length_cm: null,
    width_cm: null,
    thickness_cm: null,
    volume_ml: null,
    pack_size: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('computeInventoryStats', () => {
  it('array vacío → ceros y topCategory "—"', () => {
    expect(computeInventoryStats([])).toEqual({
      totalValue: 0,
      lowStockCount: 0,
      totalMaterials: 0,
      topCategory: '—',
    })
  })

  it('suma stock × price_per_unit para totalValue', () => {
    const materials = [
      mat({ stock: 10, price_per_unit: 100 }),
      mat({ stock: 2, price_per_unit: 50 }),
    ]
    expect(computeInventoryStats(materials).totalValue).toBe(1100)
  })

  it('cuenta items donde stock <= min_stock', () => {
    const materials = [
      mat({ stock: 5, min_stock: 10 }), // bajo
      mat({ stock: 10, min_stock: 10 }), // bajo (igual)
      mat({ stock: 20, min_stock: 10 }), // no
    ]
    expect(computeInventoryStats(materials).lowStockCount).toBe(2)
  })

  it('topCategory devuelve el label de la categoría con más valor', () => {
    const materials = [
      mat({ category: 'madera', stock: 10, price_per_unit: 500 }), // 5000
      mat({ category: 'herraje', stock: 100, price_per_unit: 80 }), // 8000
      mat({ category: 'madera', stock: 1, price_per_unit: 100 }), // 100
    ]
    expect(computeInventoryStats(materials).topCategory).toBe('Herraje')
  })
})
