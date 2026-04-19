import { useMaterials } from '@/features/inventory/hooks/useMaterials'
import { useWorkshopSettings } from '@/features/settings/hooks/useWorkshopSettings'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { computeStockShortages, type StockCheckItem, type StockShortage } from '../lib/stockCheck'

export type { StockCheckItem, StockShortage }

export interface StockCheckResult {
  enabled: boolean
  shortages: StockShortage[]
  hasShortage: boolean
}

export function useStockCheck(items: StockCheckItem[] | undefined): StockCheckResult {
  const workshopId = useWorkshopId()
  const { data: settings } = useWorkshopSettings(workshopId)
  const { data: materials = [] } = useMaterials(workshopId)

  const enabled = Boolean(settings?.stock_alert_enabled)
  if (!enabled || !items || items.length === 0) {
    return { enabled, shortages: [], hasShortage: false }
  }
  const shortages = computeStockShortages(items, materials)
  return { enabled, shortages, hasShortage: shortages.length > 0 }
}
