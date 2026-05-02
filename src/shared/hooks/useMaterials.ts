import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchMaterials, createMaterial } from '@/shared/api/materials'
import type { MaterialCategory, MaterialInsert } from '@/shared/types/material'

export function useMaterials(
  workshopId: string,
  filters?: { category?: MaterialCategory; lowStockOnly?: boolean }
) {
  return useQuery({
    queryKey: ['materials', workshopId, filters],
    queryFn: () => fetchMaterials(workshopId, filters),
    enabled: Boolean(workshopId),
  })
}

export function useCreateMaterial(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<MaterialInsert, 'workshop_id'>) =>
      createMaterial({ ...data, workshop_id: workshopId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', workshopId] })
      toast.success('Material guardado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
