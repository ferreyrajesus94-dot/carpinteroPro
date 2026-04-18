import { describe, it, expect } from 'vitest'
import { computeWoodUsage, type WoodMaterial } from './computeWoodUsage'

const baseWood: WoodMaterial = {
  id: 'm',
  name: 'M',
  category: 'madera',
  unit: 'un',
  price_per_unit: 0,
  wood_subtype: null,
  length_cm: null,
  width_cm: null,
  thickness_cm: null,
}

describe('computeWoodUsage', () => {
  it('placa con unidad un + medidas → calcula placas con ceil', () => {
    // Placa 260×183 cm = 4.758 m². Pido 6 m² → 2 placas (5×$5000=$10000)
    const r = computeWoodUsage(
      { ...baseWood, unit: 'un', wood_subtype: 'placa', length_cm: 260, width_cm: 183, price_per_unit: 5000 },
      6
    )
    expect(r.mode).toBe('placa-pieces')
    expect(r.piecesNeeded).toBe(2)
    expect(r.subtotal).toBe(10_000)
    expect(r.inputUnitLabel).toBe('m²')
  })

  it('placa con unidad m² → multiplica directo sin redondeo', () => {
    const r = computeWoodUsage(
      { ...baseWood, unit: 'm2', wood_subtype: 'placa', length_cm: 260, width_cm: 183, price_per_unit: 2800 },
      4.5
    )
    expect(r.mode).toBe('placa-area')
    expect(r.piecesNeeded).toBeNull()
    expect(r.subtotal).toBe(12_600)
  })

  it('listón con unidad un + largo → calcula tiras con ceil', () => {
    // Tira de 320 cm = 3.2 m. Pido 7 m → 3 tiras (3×$1500=$4500)
    const r = computeWoodUsage(
      { ...baseWood, unit: 'un', wood_subtype: 'liston', length_cm: 320, price_per_unit: 1500 },
      7
    )
    expect(r.mode).toBe('lineal-pieces')
    expect(r.piecesNeeded).toBe(3)
    expect(r.subtotal).toBe(4_500)
  })

  it('tirante con unidad m → multiplica metros × precio', () => {
    const r = computeWoodUsage(
      { ...baseWood, unit: 'm', wood_subtype: 'tirante', length_cm: 320, price_per_unit: 800 },
      5
    )
    expect(r.mode).toBe('lineal-meters')
    expect(r.piecesNeeded).toBeNull()
    expect(r.subtotal).toBe(4_000)
  })

  it('sin subtype → fallback plano (qty × precio)', () => {
    const r = computeWoodUsage(
      { ...baseWood, unit: 'm2', price_per_unit: 2500 },
      4
    )
    expect(r.mode).toBe('flat')
    expect(r.subtotal).toBe(10_000)
  })

  it('placa con unit=un pero sin medidas → fallback plano', () => {
    const r = computeWoodUsage(
      { ...baseWood, unit: 'un', wood_subtype: 'placa', price_per_unit: 5000 },
      3
    )
    expect(r.mode).toBe('flat')
    expect(r.subtotal).toBe(15_000)
  })

  it('quantity 0 con placa-pieces → 0 piezas, 0 costo', () => {
    const r = computeWoodUsage(
      { ...baseWood, unit: 'un', wood_subtype: 'placa', length_cm: 260, width_cm: 183, price_per_unit: 5000 },
      0
    )
    expect(r.piecesNeeded).toBe(0)
    expect(r.subtotal).toBe(0)
  })
})
