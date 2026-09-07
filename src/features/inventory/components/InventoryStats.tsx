import { useMemo } from 'react'
import { Skeleton } from '@/shared/ui/skeleton'
import { formatCurrency } from '@/shared/lib/formatters'
import { useMaterials } from '../hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { computeInventoryStats } from '../lib/computeInventoryStats'

interface CardConfig {
  label: string
  value: string
  icon: string
  iconBg: string
  iconColor: string
  accentBg: string
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
      iconBg: 'bg-cp-success/10',
      iconColor: 'text-cp-success',
      accentBg: 'bg-cp-success',
    },
    {
      label: 'Items con stock bajo',
      value: stats.lowStockCount.toString(),
      icon: 'fi-rr-triangle-warning',
      iconBg: 'bg-cp-danger/10',
      iconColor: 'text-cp-danger',
      accentBg: 'bg-cp-danger',
    },
    {
      label: 'Total de materiales',
      value: stats.totalMaterials.toString(),
      icon: 'fi-rr-layers',
      iconBg: 'bg-cp-info/10',
      iconColor: 'text-cp-info',
      accentBg: 'bg-cp-info',
    },
    {
      label: 'Categoría con más valor',
      value: stats.topCategory,
      icon: 'fi-rr-star',
      iconBg: 'bg-cp-accent-soft',
      iconColor: 'text-cp-accent',
      accentBg: 'bg-cp-accent',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon, iconBg, iconColor, accentBg }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-lg border border-line bg-cp-surface p-5 shadow-sm"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${accentBg}`}
          />
          <div className="flex items-start justify-between pl-2">
            <p className="text-sm font-medium text-ink3 leading-snug">{label}</p>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
              <i className={`fi ${icon} text-base leading-none ${iconColor}`} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight pl-2">{value}</p>
        </div>
      ))}
    </div>
  )
}
