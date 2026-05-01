import { useQuery } from '@tanstack/react-query'
import { fetchWorkshopSettings } from '@/shared/api/workshopSettings'

export function useWorkshopSettings(workshopId: string) {
  return useQuery({
    queryKey: ['workshop_settings', workshopId],
    queryFn: () => fetchWorkshopSettings(workshopId),
    enabled: Boolean(workshopId),
  })
}
