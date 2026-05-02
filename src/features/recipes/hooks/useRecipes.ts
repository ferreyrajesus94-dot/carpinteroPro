import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createFurnitureTemplate,
  updateFurnitureTemplate,
  deleteFurnitureTemplate,
  duplicateFurnitureTemplate,
  fetchTemplateUsageCounts,
  type RecipePieceDraft,
} from '../api/recipes'
import type { FurnitureTemplateInsert, FurnitureTemplateUpdate, RecipeItemInsert, LaborItemInsert } from '../types'
export { useFurnitureTemplates, useFurnitureTemplate } from '@/shared/hooks/useFurnitureTemplates'

const TEMPLATES_KEY = 'furniture_templates'

interface CreatePayload {
  template: Omit<FurnitureTemplateInsert, 'id' | 'created_at' | 'updated_at'>
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
  laborItems?: Omit<LaborItemInsert, 'id' | 'furniture_template_id' | 'created_at'>[]
  pieces?: RecipePieceDraft[]
}

export function useCreateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ template, items, laborItems, pieces }: CreatePayload) =>
      createFurnitureTemplate(template, items, laborItems, pieces),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] })
      toast.success('Mueble guardado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

interface UpdatePayload {
  id: string
  template: FurnitureTemplateUpdate
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
  laborItems?: Omit<LaborItemInsert, 'id' | 'furniture_template_id' | 'created_at'>[]
  pieces?: RecipePieceDraft[]
}

export function useUpdateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, template, items, laborItems, pieces }: UpdatePayload) =>
      updateFurnitureTemplate(id, template, items, laborItems, pieces),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, variables.id] })
      toast.success('Mueble actualizado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDuplicateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => duplicateFurnitureTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] })
      toast.success('Mueble duplicado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useTemplateUsageCounts(workshopId: string) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, 'usage', workshopId],
    queryFn: () => fetchTemplateUsageCounts(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useDeleteFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFurnitureTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] })
      toast.success('Mueble eliminado')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
