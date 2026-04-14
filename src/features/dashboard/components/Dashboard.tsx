import { useState } from 'react'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { useDashboardStats, type Period } from '../hooks/useDashboardStats'
import { KPICards } from './KPICards'
import { RevenueChart } from './RevenueChart'
import { StatusPieChart } from './StatusPieChart'
import { ActiveQuotesPanel } from './ActiveQuotesPanel'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'current_month', label: 'Mes actual' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
]

export function Dashboard() {
  const workshopId = useWorkshopId()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)
  const [period, setPeriod] = useState<Period>('current_month')
  const stats = useDashboardStats(quotes, period)

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header + Period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex rounded-lg border bg-muted p-1 gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <KPICards stats={stats} />

      {/* Row 2: Revenue Chart + Status Pie */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={stats.revenueByMonth} />
        </div>
        <div>
          <StatusPieChart data={stats.byStatus} />
        </div>
      </div>

      {/* Row 3: Active Quotes Panel */}
      <ActiveQuotesPanel quotes={stats.activeQuotes} />
    </div>
  )
}
