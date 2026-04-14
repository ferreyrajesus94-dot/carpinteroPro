import { formatCurrency } from '@/features/quotes/types'
import type { DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  stats: DashboardStats
}

interface CardConfig {
  label: string
  value: string
  icon: string
  iconBg: string
  iconColor: string
  accentColor: string
}

export function KPICards({ stats }: Props) {
  const cards: CardConfig[] = [
    {
      label: 'Total facturado',
      value: formatCurrency(stats.totalRevenue),
      icon: 'fi-rr-chart-line-up',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600',
      accentColor: 'border-t-emerald-500',
    },
    {
      label: 'Presupuestos emitidos',
      value: stats.quoteCount.toString(),
      icon: 'fi-rr-file-invoice',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      iconColor: 'text-blue-600',
      accentColor: 'border-t-blue-500',
    },
    {
      label: 'Ticket promedio',
      value: formatCurrency(stats.averageTicket),
      icon: 'fi-rr-calculator',
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
      iconColor: 'text-violet-600',
      accentColor: 'border-t-violet-500',
    },
    {
      label: 'Tasa de conversión',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: 'fi-rr-circle-check',
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      iconColor: 'text-amber-600',
      accentColor: 'border-t-amber-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon, iconBg, iconColor, accentColor }) => (
        <div key={label} className={`rounded-lg border border-t-2 ${accentColor} bg-card p-5 shadow-sm`}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-muted-foreground leading-snug">{label}</p>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
              <i className={`fi ${icon} text-base leading-none ${iconColor}`} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
        </div>
      ))}
    </div>
  )
}
