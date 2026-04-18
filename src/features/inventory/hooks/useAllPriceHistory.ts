import { useQuery } from '@tanstack/react-query'
import { fetchAllPriceHistory } from '../api/priceHistory'

export function useAllPriceHistory(workshopId: string, days = 90) {
  return useQuery({
    queryKey: ['price_history_all', workshopId, days],
    queryFn: () => fetchAllPriceHistory(workshopId, days),
    enabled: Boolean(workshopId),
    staleTime: 1000 * 60 * 5,
  })
}
