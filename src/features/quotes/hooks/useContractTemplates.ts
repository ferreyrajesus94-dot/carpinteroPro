import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchContractTemplates,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
} from '../api/contractTemplates'
import type { ContractTemplateInsert, ContractTemplateUpdate } from '../types'

const TEMPLATES_KEY = 'contract_templates'

export function useContractTemplates(workshopId: string) {
  return useQuery({
    queryKey: [TEMPLATES_KEY, workshopId],
    queryFn: () => fetchContractTemplates(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useCreateContractTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (t: Omit<ContractTemplateInsert, 'id' | 'created_at'>) =>
      createContractTemplate(t),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}

export function useUpdateContractTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContractTemplateUpdate }) =>
      updateContractTemplate(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}

export function useDeleteContractTemplate(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteContractTemplate(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY, workshopId] }),
  })
}
