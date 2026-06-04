import { supabase } from '@/shared/lib/supabase'
import type { WorkshopSettings } from '@/shared/types/workshopSettings'

export type { WorkshopSettings } from '@/shared/types/workshopSettings'

export async function fetchWorkshopSettings(workshopId: string): Promise<WorkshopSettings | null> {
  const { data, error } = await supabase
    .from('workshop_settings')
    .select('*')
    .eq('workshop_id', workshopId)
    .maybeSingle()
  if (error) throw error
  return data
}
