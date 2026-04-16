import { describe, it, expect } from 'vitest'
import { calculateQuote } from './calculator'

describe('calculateQuote — on_cost margin', () => {
  it('salePrice = costBase × (1 + pct/100)', () => {
    const result = calculateQuote({
      recipeCost: 10_000,
      extras: [],
      marginMode: 'on_cost',
      marginPct: 30,
    })
    expect(result.salePrice).toBe(13_000)
    expect(result.costBase).toBe(10_000)
    expect(result.marginAmount).toBe(3_000)
  })

  it('margin 0% → salePrice equals costBase', () => {
    const result = calculateQuote({
      recipeCost: 5_000,
      extras: [],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.salePrice).toBe(5_000)
    expect(result.marginAmount).toBe(0)
  })

  it('costBase includes all extras regardless of show_in_quote', () => {
    const result = calculateQuote({
      recipeCost: 10_000,
      extras: [
        { amount: 1_000, show_in_quote: true },
        { amount: 500,   show_in_quote: false },
      ],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.costBase).toBe(11_500)
  })

  it('visibleExtras sums only show_in_quote=true extras', () => {
    const result = calculateQuote({
      recipeCost: 10_000,
      extras: [
        { amount: 2_000, show_in_quote: true },
        { amount: 800,   show_in_quote: false },
      ],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.visibleExtras).toBe(2_000)
  })
})

describe('calculateQuote — on_price margin', () => {
  it('salePrice = costBase / (1 − pct/100)', () => {
    const result = calculateQuote({
      recipeCost: 10_000,
      extras: [],
      marginMode: 'on_price',
      marginPct: 50,
    })
    expect(result.salePrice).toBe(20_000)
    expect(result.marginAmount).toBe(10_000)
  })

  it('margin 0% → salePrice equals costBase', () => {
    const result = calculateQuote({
      recipeCost: 8_000,
      extras: [],
      marginMode: 'on_price',
      marginPct: 0,
    })
    expect(result.salePrice).toBe(8_000)
  })

  it('margin 100% → salePrice equals costBase (guarded division by zero)', () => {
    const result = calculateQuote({
      recipeCost: 5_000,
      extras: [],
      marginMode: 'on_price',
      marginPct: 100,
    })
    // divisor = 0 → fallback: costBase
    expect(result.salePrice).toBe(5_000)
  })
})

describe('calculateQuote — extras + margin combined', () => {
  it('applies margin over costBase that already includes extras', () => {
    // costBase = 10_000 + 2_000 = 12_000 ; on_cost 25% → 15_000
    const result = calculateQuote({
      recipeCost: 10_000,
      extras: [{ amount: 2_000, show_in_quote: true }],
      marginMode: 'on_cost',
      marginPct: 25,
    })
    expect(result.costBase).toBe(12_000)
    expect(result.salePrice).toBe(15_000)
  })

  it('zero-cost quote with extras still calculates correctly', () => {
    const result = calculateQuote({
      recipeCost: 0,
      extras: [{ amount: 3_000, show_in_quote: true }],
      marginMode: 'on_cost',
      marginPct: 10,
    })
    expect(result.costBase).toBe(3_000)
    expect(result.salePrice).toBeCloseTo(3_300)
  })
})
