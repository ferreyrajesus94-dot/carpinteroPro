import { useQuery } from '@tanstack/react-query'
import { fetchPriceHistory } from '../api/materials'

export function usePriceHistory(materialId: string | null) {
  return useQuery({
    queryKey: ['price_history', materialId],
    queryFn: () => fetchPriceHistory(materialId!),
    enabled: Boolean(materialId),
  })
}
