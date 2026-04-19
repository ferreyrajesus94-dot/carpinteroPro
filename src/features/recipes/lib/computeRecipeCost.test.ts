import { describe, it, expect } from 'vitest'
import { computeRecipeCost } from '../types'
import type { RecipeItemWithMaterial } from '../types'
import type { Material } from '@/features/inventory/types'

type Category = Material['category']

function makeItem(
  overrides: Partial<RecipeItemWithMaterial> & { category: Category; price_per_unit: number; quantity: number }
): RecipeItemWithMaterial {
  return {
    id: 'ri-1',
    furniture_template_id: 'tmpl-1',
    material_id: 'mat-1',
    waste_pct: 0,
    material: {
      id: 'mat-1',
      name: 'Material',
      unit: 'un',
      category: overrides.category,
      price_per_unit: overrides.price_per_unit,
      wood_subtype: null,
      length_cm: null,
      width_cm: null,
      thickness_cm: null,
    },
    ...overrides,
  }
}

describe('computeRecipeCost', () => {
  it('returns zeros for empty items list', () => {
    const result = computeRecipeCost([])
    expect(result).toEqual({ woodsTotal: 0, extrasTotal: 0, laborTotal: 0, total: 0 })
  })

  it('applies waste_pct to quantity', () => {
    const items = [
      makeItem({ category: 'madera', price_per_unit: 1_000, quantity: 10, waste_pct: 10 }),
    ]
    const result = computeRecipeCost(items)
    expect(result.woodsTotal).toBe(11_000)
  })

  it('accumulates labor hours × rate into laborTotal', () => {
    const result = computeRecipeCost([], [{ hours: 4, rate: 2_500 }])
    expect(result.laborTotal).toBe(10_000)
    expect(result.total).toBe(10_000)
  })

  it('accumulates madera items into woodsTotal', () => {
    const items = [
      makeItem({ category: 'madera', price_per_unit: 2_500, quantity: 4 }),
      makeItem({ id: 'ri-2', material_id: 'mat-2', category: 'madera', price_per_unit: 1_000, quantity: 2 }),
    ]
    const result = computeRecipeCost(items)
    expect(result.woodsTotal).toBe(12_000)   // 4×2500 + 2×1000
    expect(result.extrasTotal).toBe(0)
    expect(result.total).toBe(12_000)
  })

  it('accumulates non-madera items into extrasTotal', () => {
    const items = [
      makeItem({ category: 'herraje', price_per_unit: 150, quantity: 10 }),
      makeItem({ id: 'ri-2', material_id: 'mat-2', category: 'otro', price_per_unit: 500, quantity: 3 }),
    ]
    const result = computeRecipeCost(items)
    expect(result.woodsTotal).toBe(0)
    expect(result.extrasTotal).toBe(3_000)   // 10×150 + 3×500
    expect(result.total).toBe(3_000)
  })

  it('splits mixed items correctly between woodsTotal and extrasTotal', () => {
    const items = [
      makeItem({ category: 'madera',  price_per_unit: 2_500, quantity: 4 }),
      makeItem({ id: 'ri-2', material_id: 'mat-2', category: 'herraje', price_per_unit: 150, quantity: 8 }),
    ]
    const result = computeRecipeCost(items)
    expect(result.woodsTotal).toBe(10_000)
    expect(result.extrasTotal).toBe(1_200)
    expect(result.total).toBe(11_200)
  })

  it('total = woodsTotal + extrasTotal', () => {
    const items = [
      makeItem({ category: 'madera',  price_per_unit: 3_000, quantity: 2 }),
      makeItem({ id: 'ri-2', material_id: 'mat-2', category: 'pintura', price_per_unit: 400,   quantity: 5 }),
    ]
    const { woodsTotal, extrasTotal, total } = computeRecipeCost(items)
    expect(total).toBe(woodsTotal + extrasTotal)
  })
})
