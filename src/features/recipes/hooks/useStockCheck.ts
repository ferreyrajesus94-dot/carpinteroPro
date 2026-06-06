import { computeStockShortages, type StockCheckItem, type StockShortage } from '../lib/stockCheck'
import type { Material } from '@/shared/types/material'

export type { StockCheckItem, StockShortage }

export interface StockCheckResult {
  enabled: boolean
  shortages: StockShortage[]
  hasShortage: boolean
}

/**
 * Hook that computes stock shortages for given items.
 * Accepts materials and stockAlertEnabled as explicit arguments
 * instead of calling inventory/settings hooks internally.
 */
export function useStockCheck(
  items: StockCheckItem[] | undefined,
  materials: Material[] = [],
  stockAlertEnabled: boolean = false,
): StockCheckResult {
  const enabled = Boolean(stockAlertEnabled)
  if (!enabled || !items || items.length === 0) {
    return { enabled, shortages: [], hasShortage: false }
  }
  const shortages = computeStockShortages(items, materials)
  return { enabled, shortages, hasShortage: shortages.length > 0 }
}
