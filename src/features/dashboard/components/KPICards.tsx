import type { ReactNode } from 'react'
import { TrendingUp, FileText, Calculator, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/features/quotes/types'
import type { DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  stats: DashboardStats
}

interface CardConfig {
  label: string
  value: string
  icon: ReactNode
}

export function KPICards({ stats }: Props) {
  const cards: CardConfig[] = [
    {
      label: 'Total facturado',
      value: formatCurrency(stats.totalRevenue),
      icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
    },
    {
      label: 'Presupuestos emitidos',
      value: stats.quoteCount.toString(),
      icon: <FileText className="h-5 w-5 text-blue-600" />,
    },
    {
      label: 'Ticket promedio',
      value: formatCurrency(stats.averageTicket),
      icon: <Calculator className="h-5 w-5 text-purple-600" />,
    },
    {
      label: 'Tasa de conversión',
      value: `${stats.conversionRate.toFixed(1)}%`,
      icon: <CheckCircle className="h-5 w-5 text-orange-600" />,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            {card.icon}
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
