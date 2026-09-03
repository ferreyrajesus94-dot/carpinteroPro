import { formatCurrency } from '@/shared/lib/formatters'
import type { DashboardStats } from '../hooks/useDashboardStats'
import { Eyebrow } from '@/shared/ui/eyebrow'

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
          <Eyebrow as="div" variant="mono" className="text-[10.5px] truncate">{label}</Eyebrow>
          <div className="mt-2 font-display text-[22px] leading-[1.05] font-semibold text-ink truncate">{value}</div>
        </div>
      ))}
    </div>
  )
}
