import { describe, it, expect } from 'vitest'
import { computeDashboardStats } from './useDashboardStats'
import type { DashboardQuote } from '../types'

function makeQuote(overrides: Partial<DashboardQuote> = {}): DashboardQuote {
  return {
    id: 'q1',
    quote_number: 'P-001',
    furniture_name: 'Mesa',
    recipe_cost: 1000,
    margin_mode: 'on_cost',
    margin_pct: 0,
    status: 'presupuesto',
    created_at: new Date().toISOString(),
    extras: [],
    client: null,
    ...overrides,
  }
}

describe('computeDashboardStats', () => {
  it('totalRevenue suma salePrice de aprobado y entregado en el período', () => {
    const now = new Date()
    const quotes: DashboardQuote[] = [
      makeQuote({ id: 'q1', status: 'aprobado', recipe_cost: 1000, margin_pct: 0, created_at: now.toISOString() }),
      makeQuote({ id: 'q2', status: 'entregado', recipe_cost: 2000, margin_pct: 0, created_at: now.toISOString() }),
      makeQuote({ id: 'q3', status: 'cancelado', recipe_cost: 500, margin_pct: 0, created_at: now.toISOString() }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.totalRevenue).toBe(3000)
  })

  it('quoteCount cuenta todos los quotes en el período, sin importar estado', () => {
    const now = new Date()
    const quotes: DashboardQuote[] = [
      makeQuote({ id: 'q1', status: 'aprobado', created_at: now.toISOString() }),
      makeQuote({ id: 'q2', status: 'cancelado', created_at: now.toISOString() }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.quoteCount).toBe(2)
  })

  it('conversionRate es aprobados+entregados sobre total, en %', () => {
    const now = new Date()
    const quotes: DashboardQuote[] = [
      makeQuote({ id: 'q1', status: 'aprobado', created_at: now.toISOString() }),
      makeQuote({ id: 'q2', status: 'cancelado', created_at: now.toISOString() }),
      makeQuote({ id: 'q3', status: 'presupuesto', created_at: now.toISOString() }),
      makeQuote({ id: 'q4', status: 'entregado', created_at: now.toISOString() }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.conversionRate).toBe(50)
  })

  it('averageTicket es 0 cuando no hay aprobados/entregados', () => {
    const quotes: DashboardQuote[] = [
      makeQuote({ id: 'q1', status: 'presupuesto', created_at: new Date().toISOString() }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.averageTicket).toBe(0)
  })

  it('excluye quotes fuera del período en KPIs', () => {
    const oldDate = new Date(2020, 0, 1).toISOString()
    const quotes: DashboardQuote[] = [
      makeQuote({ id: 'q1', status: 'aprobado', recipe_cost: 5000, created_at: oldDate }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.totalRevenue).toBe(0)
    expect(stats.quoteCount).toBe(0)
  })

  it('activeQuotes incluye solo enviado y en_produccion, sin filtro de período', () => {
    const oldDate = new Date(2020, 0, 1).toISOString()
    const quotes: DashboardQuote[] = [
      makeQuote({ id: 'q1', status: 'enviado', created_at: oldDate }),
      makeQuote({ id: 'q2', status: 'en_produccion', created_at: oldDate }),
      makeQuote({ id: 'q3', status: 'aprobado', created_at: oldDate }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.activeQuotes).toHaveLength(2)
    expect(stats.activeQuotes.map(q => q.id)).toEqual(expect.arrayContaining(['q1', 'q2']))
  })

  it('revenueByMonth tiene exactamente 12 entradas', () => {
    const stats = computeDashboardStats([], 'current_month')
    expect(stats.revenueByMonth).toHaveLength(12)
  })

  it('incluye extras en el cálculo de salePrice', () => {
    const now = new Date()
    const quotes: DashboardQuote[] = [
      makeQuote({
        id: 'q1',
        status: 'aprobado',
        recipe_cost: 1000,
        margin_pct: 0,
        extras: [{ amount: 500, show_in_quote: true }],
        created_at: now.toISOString(),
      }),
    ]
    const stats = computeDashboardStats(quotes, 'current_month')
    expect(stats.totalRevenue).toBe(1500)
  })
})
