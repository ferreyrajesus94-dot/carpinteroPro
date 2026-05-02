import { describe, it, expect } from 'vitest'
import { computePieceArea, computeAreaByMaterial } from './computePieceArea'

describe('computePieceArea', () => {
  it('convierte cm² a m² multiplicando por la cantidad', () => {
    expect(computePieceArea({ length_cm: 100, width_cm: 50, quantity: 2 })).toBeCloseTo(1)
  })

  it('devuelve 0 si alguna dimensión es 0 o negativa', () => {
    expect(computePieceArea({ length_cm: 0, width_cm: 50, quantity: 2 })).toBe(0)
    expect(computePieceArea({ length_cm: 100, width_cm: -1, quantity: 2 })).toBe(0)
    expect(computePieceArea({ length_cm: 100, width_cm: 50, quantity: 0 })).toBe(0)
  })

  it('tolera valores null/undefined', () => {
    expect(computePieceArea({ length_cm: null, width_cm: 50, quantity: 2 })).toBe(0)
    expect(computePieceArea({ length_cm: 100, width_cm: undefined, quantity: 2 })).toBe(0)
  })
})

describe('computeAreaByMaterial', () => {
  it('agrupa por material_id y suma áreas', () => {
    const result = computeAreaByMaterial([
      { length_cm: 100, width_cm: 50, quantity: 2, material_id: 'mdf' }, // 1 m²
      { length_cm: 100, width_cm: 50, quantity: 1, material_id: 'mdf' }, // 0.5 m²
      { length_cm: 200, width_cm: 50, quantity: 1, material_id: 'melamina' }, // 1 m²
    ])
    const mdf = result.find((r) => r.materialId === 'mdf')
    const mel = result.find((r) => r.materialId === 'melamina')
    expect(mdf?.totalM2).toBeCloseTo(1.5)
    expect(mdf?.pieces).toBe(3)
    expect(mel?.totalM2).toBeCloseTo(1)
  })

  it('agrupa piezas sin material como bucket null', () => {
    const result = computeAreaByMaterial([
      { length_cm: 100, width_cm: 50, quantity: 1 },
      { length_cm: 100, width_cm: 50, quantity: 1, material_id: null },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].materialId).toBeNull()
    expect(result[0].totalM2).toBeCloseTo(1)
  })

  it('devuelve array vacío si no hay piezas', () => {
    expect(computeAreaByMaterial([])).toEqual([])
  })
})
