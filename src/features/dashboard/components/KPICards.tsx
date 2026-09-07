import { Link } from 'react-router-dom'
import { formatCurrency } from '@/shared/lib/formatters'
import type { DashboardStats } from '../hooks/useDashboardStats'
import { Eyebrow } from '@/shared/ui/eyebrow'

interface Props {
  stats: DashboardStats
}

interface CardConfig {
  label: string
  value: string
  isCurrency: boolean
}

export function KPICards({ stats }: Props) {
  const cards: CardConfig[] = [
    { label: 'Presupuestos', value: stats.quoteCount.toString(), isCurrency: false },
    { label: 'Conversión', value: `${stats.conversionRate.toFixed(1)}%`, isCurrency: false },
    { label: 'Ticket promedio', value: formatCurrency(stats.averageTicket), isCurrency: true },
    { label: 'Facturado total', value: formatCurrency(stats.totalRevenue), isCurrency: true },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map(({ label, value, isCurrency }) => (
        <Link
          key={label}
          to="/quotes"
          aria-label={`Ver detalle de ${label}`}
          className="block bg-cp-surface border border-line rounded-xl p-3.5 min-w-0 cursor-pointer transition-colors hover:border-line2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cp-bg"
        >
          <Eyebrow as="div" variant="mono" className="text-[10.5px] truncate">{label}</Eyebrow>
          <div className={`mt-2 ${isCurrency ? 'font-mono' : 'font-display'} text-[22px] leading-[1.05] font-semibold text-ink truncate`}>{value}</div>
        </Link>
      ))}
    </div>
  )
}
