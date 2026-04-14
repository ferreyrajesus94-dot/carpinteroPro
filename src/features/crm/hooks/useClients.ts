import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchClients, createClient, updateClient, deleteClient } from '@/features/crm/api/clients'
import type { ClientInsert, ClientUpdate } from '@/features/crm/types'

const CLIENTS_KEY = 'clients'

export function useClients(workshopId: string) {
  return useQuery({
    queryKey: [CLIENTS_KEY, workshopId],
    queryFn: () => fetchClients(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useCreateClient(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (client: Omit<ClientInsert, 'id' | 'created_at'>) => createClient(client),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, workshopId] }),
  })
}

export function useUpdateClient(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientUpdate }) => updateClient(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, workshopId] }),
  })
}

export function useDeleteClient(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY, workshopId] }),
  })
}
