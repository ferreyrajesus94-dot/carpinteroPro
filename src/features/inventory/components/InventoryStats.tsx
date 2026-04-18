import { useMemo } from 'react'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrency } from '@/features/quotes/types'
import { useMaterials } from '../hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { computeInventoryStats } from '../lib/computeInventoryStats'

interface CardConfig {
  label: string
  value: string
  icon: string
  iconBg: string
  iconColor: string
  accentColor: string
}

export function InventoryStats() {
  const workshopId = useWorkshopId()
  const { data: materials = [], isLoading } = useMaterials(workshopId)

  const stats = useMemo(() => computeInventoryStats(materials), [materials])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-lg" />
        ))}
      </div>
    )
  }

  const cards: CardConfig[] = [
    {
      label: 'Valor total de inventario',
      value: formatCurrency(stats.totalValue),
      icon: 'fi-rr-box',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600',
      accentColor: 'border-t-emerald-500',
    },
    {
      label: 'Items con stock bajo',
      value: stats.lowStockCount.toString(),
      icon: 'fi-rr-triangle-warning',
      iconBg: 'bg-red-50 dark:bg-red-950/40',
      iconColor: 'text-red-600',
      accentColor: 'border-t-red-500',
    },
    {
      label: 'Total de materiales',
      value: stats.totalMaterials.toString(),
      icon: 'fi-rr-layers',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      iconColor: 'text-blue-600',
      accentColor: 'border-t-blue-500',
    },
    {
      label: 'Categoría con más valor',
      value: stats.topCategory,
      icon: 'fi-rr-star',
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
      iconColor: 'text-violet-600',
      accentColor: 'border-t-violet-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon, iconBg, iconColor, accentColor }) => (
        <div
          key={label}
          className={`rounded-lg border border-t-2 ${accentColor} bg-card p-5 shadow-sm`}
        >
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
