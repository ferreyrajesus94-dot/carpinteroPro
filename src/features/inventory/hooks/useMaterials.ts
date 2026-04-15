import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../api/materials'
import type { MaterialCategory, MaterialInsert, MaterialUpdate } from '../types'

const MATERIALS_KEY = 'materials'

export function useMaterials(
  workshopId: string,
  filters?: { category?: MaterialCategory; lowStockOnly?: boolean }
) {
  return useQuery({
    queryKey: [MATERIALS_KEY, workshopId, filters],
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
      queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] })
      toast.success('Material guardado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateMaterial(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MaterialUpdate }) =>
      updateMaterial(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] })
      toast.success('Material actualizado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteMaterial(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] })
      toast.success('Material eliminado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
