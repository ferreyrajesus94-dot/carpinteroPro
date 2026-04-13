import { describe, it, expect } from 'vitest'
import { calculateQuote } from '@/features/quotes/lib/calculator'

describe('calculateQuote', () => {
  it('on_cost: salePrice = costBase * (1 + pct/100)', () => {
    const result = calculateQuote({
      recipeCost: 100,
      extras: [],
      marginMode: 'on_cost',
      marginPct: 30,
    })
    expect(result.costBase).toBe(100)
    expect(result.salePrice).toBeCloseTo(130)
    expect(result.marginAmount).toBeCloseTo(30)
  })

  it('on_price: salePrice = costBase / (1 - pct/100)', () => {
    const result = calculateQuote({
      recipeCost: 100,
      extras: [],
      marginMode: 'on_price',
      marginPct: 30,
    })
    expect(result.costBase).toBe(100)
    expect(result.salePrice).toBeCloseTo(142.86, 1)
    expect(result.marginAmount).toBeCloseTo(42.86, 1)
  })

  it('suma todos los extras al costBase independientemente de show_in_quote', () => {
    const result = calculateQuote({
      recipeCost: 100,
      extras: [
        { amount: 20, show_in_quote: true },
        { amount: 15, show_in_quote: false },
      ],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.costBase).toBe(135)
    expect(result.salePrice).toBe(135)
  })

  it('visibleExtras solo incluye extras con show_in_quote=true', () => {
    const result = calculateQuote({
      recipeCost: 80,
      extras: [
        { amount: 10, show_in_quote: true },
        { amount: 25, show_in_quote: false },
      ],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.visibleExtras).toBe(10)
  })

  it('margen 0%: salePrice === costBase', () => {
    const result = calculateQuote({
      recipeCost: 500,
      extras: [],
      marginMode: 'on_cost',
      marginPct: 0,
    })
    expect(result.salePrice).toBe(500)
    expect(result.marginAmount).toBe(0)
  })

  it('sin extras: costBase === recipeCost', () => {
    const result = calculateQuote({
      recipeCost: 200,
      extras: [],
      marginMode: 'on_price',
      marginPct: 25,
    })
    expect(result.costBase).toBe(200)
  })

  it('recipeCost=0 con solo extras', () => {
    const result = calculateQuote({
      recipeCost: 0,
      extras: [{ amount: 50, show_in_quote: true }],
      marginMode: 'on_cost',
      marginPct: 10,
    })
    expect(result.costBase).toBe(50)
    expect(result.salePrice).toBeCloseTo(55)
  })
})
