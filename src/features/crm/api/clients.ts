import { supabase } from '@/shared/lib/supabase'
import type { Client, ClientInsert, ClientUpdate } from '@/features/crm/types'

export async function fetchClients(workshopId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export const PAGE_SIZE = 20

export async function fetchClientsPaginated(
  workshopId: string,
  page: number
): Promise<{ data: Client[]; count: number }> {
  const from = page * PAGE_SIZE
  const { data, error, count } = await supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('workshop_id', workshopId)
    .order('name')
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function createClient(
  client: Omit<ClientInsert, 'id' | 'created_at'>
): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClient(id: string, client: ClientUpdate): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update(client)
    .eq('id', id)
  if (error) throw error
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}
