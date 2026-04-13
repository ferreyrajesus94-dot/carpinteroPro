import { supabase } from '@/shared/lib/supabase'
import type { ContractTemplate, ContractTemplateInsert, ContractTemplateUpdate } from '../types'

export async function fetchContractTemplates(workshopId: string): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createContractTemplate(
  template: Omit<ContractTemplateInsert, 'id' | 'created_at'>
): Promise<ContractTemplate> {
  const { data, error } = await supabase
    .from('contract_templates')
    .insert(template)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateContractTemplate(
  id: string,
  template: ContractTemplateUpdate
): Promise<void> {
  const { error } = await supabase
    .from('contract_templates')
    .update(template)
    .eq('id', id)
  if (error) throw error
}

export async function deleteContractTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('contract_templates').delete().eq('id', id)
  if (error) throw error
}
