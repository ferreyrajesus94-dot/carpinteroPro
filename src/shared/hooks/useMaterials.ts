import { useQuery } from '@tanstack/react-query'
import { fetchMaterials } from '@/shared/api/materials'
import type { MaterialCategory } from '@/shared/types/material'

export function useMaterials(
  workshopId: string,
  filters?: { category?: MaterialCategory; lowStockOnly?: boolean },
) {
  return useQuery({
    queryKey: ['materials', workshopId, filters],
    queryFn: () => fetchMaterials(workshopId, filters),
    enabled: Boolean(workshopId),
  })
}
