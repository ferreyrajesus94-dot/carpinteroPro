import { useMemo } from 'react'
import { startOfMonth, subMonths, endOfMonth, isBefore, isAfter, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import type { QuoteWithExtras, QuoteStatus } from '@/features/quotes/types'

export type Period = 'current_month' | 'last_month' | 'last_3_months'

export interface DashboardStats {
  totalRevenue: number
  quoteCount: number
  averageTicket: number
  conversionRate: number
  revenueByMonth: { month: string; total: number }[]
  byStatus: { status: QuoteStatus; count: number; total: number }[]
  activeQuotes: QuoteWithExtras[]
}

export function getSalePrice(quote: QuoteWithExtras): number {
  return calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map(e => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  }).salePrice
}

function getDateRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'current_month':
      return { start: startOfMonth(now), end: now }
    case 'last_month': {
      const last = subMonths(now, 1)
      return { start: startOfMonth(last), end: endOfMonth(last) }
    }
    case 'last_3_months':
      return { start: startOfMonth(subMonths(now, 3)), end: now }
  }
}

function inRange(dateStr: string, start: Date, end: Date): boolean {
  const d = new Date(dateStr)
  return !isBefore(d, start) && !isAfter(d, end)
}

const REVENUE_STATUSES: QuoteStatus[] = ['aprobado', 'entregado']
const ALL_STATUSES: QuoteStatus[] = [
  'presupuesto', 'enviado', 'aprobado', 'en_produccion', 'entregado', 'cancelado',
]

export function computeDashboardStats(quotes: QuoteWithExtras[], period: Period): DashboardStats {
  const { start, end } = getDateRange(period)
  const periodQuotes = quotes.filter(q => inRange(q.created_at, start, end))

  const revenueQuotes = periodQuotes.filter(q => REVENUE_STATUSES.includes(q.status))
  const totalRevenue = revenueQuotes.reduce((sum, q) => sum + getSalePrice(q), 0)
  const quoteCount = periodQuotes.length
  const averageTicket = revenueQuotes.length > 0 ? totalRevenue / revenueQuotes.length : 0
  const conversionRate = quoteCount > 0 ? (revenueQuotes.length / quoteCount) * 100 : 0

  const now = new Date()
  const revenueByMonth = Array.from({ length: 12 }, (_, i) => {
    const monthDate = subMonths(now, 11 - i)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const total = quotes
      .filter(q => REVENUE_STATUSES.includes(q.status) && inRange(q.created_at, monthStart, monthEnd))
      .reduce((sum, q) => sum + getSalePrice(q), 0)
    return { month: format(monthDate, 'MMM', { locale: es }), total }
  })

  const byStatus = ALL_STATUSES
    .map(status => {
      const sq = periodQuotes.filter(q => q.status === status)
      return { status, count: sq.length, total: sq.reduce((sum, q) => sum + getSalePrice(q), 0) }
    })
    .filter(s => s.count > 0)

  const activeQuotes = quotes
    .filter(q => q.status === 'enviado' || q.status === 'en_produccion')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)

  return { totalRevenue, quoteCount, averageTicket, conversionRate, revenueByMonth, byStatus, activeQuotes }
}

export function useDashboardStats(quotes: QuoteWithExtras[], period: Period): DashboardStats {
  return useMemo(() => computeDashboardStats(quotes, period), [quotes, period])
}
