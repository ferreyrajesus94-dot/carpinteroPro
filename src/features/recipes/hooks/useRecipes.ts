import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchFurnitureTemplates,
  fetchFurnitureTemplate,
  createFurnitureTemplate,
  updateFurnitureTemplate,
  deleteFurnitureTemplate,
} from '../api/recipes'
import type { FurnitureTemplateInsert, FurnitureTemplateUpdate, RecipeItemInsert } from '../types'

const TEMPLATES_KEY = 'furniture_templates'

export function useFurnitureTemplates(workshopId: string) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, workshopId],
    queryFn: () => fetchFurnitureTemplates(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useFurnitureTemplate(id: string | null) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, id],
    queryFn: () => fetchFurnitureTemplate(id!),
    enabled: Boolean(id),
  })
}

interface CreatePayload {
  template: Omit<FurnitureTemplateInsert, 'id' | 'created_at' | 'updated_at'>
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
}

export function useCreateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ template, items }: CreatePayload) =>
      createFurnitureTemplate(template, items),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}

interface UpdatePayload {
  id: string
  template: FurnitureTemplateUpdate
  items: Omit<RecipeItemInsert, 'id' | 'furniture_template_id'>[]
}

export function useUpdateFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, template, items }: UpdatePayload) =>
      updateFurnitureTemplate(id, template, items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] })
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, variables.id] })
    },
  })
}

export function useDeleteFurnitureTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFurnitureTemplate(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}
