import { useQuery } from '@tanstack/react-query'
import { fetchFurnitureTemplates, fetchFurnitureTemplate } from '@/shared/api/furnitureTemplates'

export function useFurnitureTemplates(workshopId: string) {
  return useQuery({
    queryKey: ['furniture_templates', workshopId],
    queryFn: () => fetchFurnitureTemplates(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useFurnitureTemplate(id: string | null) {
  return useQuery({
    queryKey: ['furniture_template', id],
    queryFn: () => fetchFurnitureTemplate(id!),
    enabled: Boolean(id),
  })
}
