import { formatCurrency } from '@/features/quotes/types'
import type { DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  stats: DashboardStats
}

interface CardConfig {
  label: string
  value: string
}

export function KPICards({ stats }: Props) {
  const cards: CardConfig[] = [
    { label: 'Presupuestos', value: stats.quoteCount.toString() },
    { label: 'Conversión', value: `${stats.conversionRate.toFixed(1)}%` },
    { label: 'Ticket promedio', value: formatCurrency(stats.averageTicket) },
    { label: 'Facturado total', value: formatCurrency(stats.totalRevenue) },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map(({ label, value }) => (
        <div key={label} className="bg-surface border border-line rounded-xl p-3.5 min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium truncate">{label}</div>
          <div className="mt-2 font-display text-[22px] leading-[1.05] font-semibold text-ink truncate">{value}</div>
        </div>
      ))}
    </div>
  )
}
