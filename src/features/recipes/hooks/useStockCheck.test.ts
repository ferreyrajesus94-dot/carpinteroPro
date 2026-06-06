import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStockCheck } from './useStockCheck'
import type { Material } from '@/shared/types/material'

describe('useStockCheck with explicit materials and stockAlertEnabled', () => {
  function mat(overrides: Partial<Material>): Material {
    return {
      id: 'mat-1',
      workshop_id: 'w-1',
      name: 'Material',
      category: 'madera' as const,
      unit: 'un' as const,
      price_per_unit: 100,
      stock: 10,
      min_stock: 0,
      notes: null,
      volume_ml: null,
      pack_size: null,
      wood_subtype: null,
      length_cm: null,
      width_cm: null,
      thickness_cm: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...overrides,
    } as Material
  }

  const testMaterials = [
    mat({ id: 'mat-1', name: 'MDF', unit: 'm2' as const, stock: 10 }),
    mat({ id: 'mat-2', name: 'Bisagra', stock: 5, category: 'herraje' as const }),
  ]

  it('returns enabled:true with shortages when stock is insufficient and alert enabled', () => {
    const items = [{ material_id: 'mat-1', quantity: 15 }]
    const { result } = renderHook(() => useStockCheck(items, testMaterials, true))
    expect(result.current.enabled).toBe(true)
    expect(result.current.hasShortage).toBe(true)
    expect(result.current.shortages).toHaveLength(1)
    expect(result.current.shortages[0].materialId).toBe('mat-1')
    expect(result.current.shortages[0].missing).toBeCloseTo(5)
  })

  it('returns enabled:true with no shortages when stock is sufficient', () => {
    const items = [{ material_id: 'mat-1', quantity: 3 }]
    const { result } = renderHook(() => useStockCheck(items, testMaterials, true))
    expect(result.current.enabled).toBe(true)
    expect(result.current.hasShortage).toBe(false)
    expect(result.current.shortages).toHaveLength(0)
  })

  it('returns enabled:false and no shortages when alert is disabled', () => {
    const items = [{ material_id: 'mat-1', quantity: 15 }]
    const { result } = renderHook(() => useStockCheck(items, testMaterials, false))
    expect(result.current.enabled).toBe(false)
    expect(result.current.hasShortage).toBe(false)
    expect(result.current.shortages).toHaveLength(0)
  })

  it('returns enabled:true and no shortages for empty items', () => {
    const { result } = renderHook(() => useStockCheck([], testMaterials, true))
    expect(result.current.enabled).toBe(true)
    expect(result.current.hasShortage).toBe(false)
    expect(result.current.shortages).toHaveLength(0)
  })

  it('returns enabled:true and no shortages for undefined items', () => {
    const { result } = renderHook(() => useStockCheck(undefined, testMaterials, true))
    expect(result.current.enabled).toBe(true)
    expect(result.current.hasShortage).toBe(false)
    expect(result.current.shortages).toHaveLength(0)
  })
})
