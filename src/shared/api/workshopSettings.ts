import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database'

export type WorkshopSettings = Database['public']['Tables']['workshop_settings']['Row']

export async function fetchWorkshopSettings(workshopId: string): Promise<WorkshopSettings | null> {
  const { data, error } = await supabase
    .from('workshop_settings')
    .select('*')
    .eq('workshop_id', workshopId)
    .maybeSingle()
  if (error) throw error
  return data
}
