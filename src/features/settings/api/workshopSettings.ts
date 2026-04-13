import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database'

type WorkshopSettings = Database['public']['Tables']['workshop_settings']['Row']
type WorkshopSettingsInsert = Database['public']['Tables']['workshop_settings']['Insert']
type WorkshopSettingsUpdate = Database['public']['Tables']['workshop_settings']['Update']

export type { WorkshopSettings, WorkshopSettingsInsert, WorkshopSettingsUpdate }

export async function fetchWorkshopSettings(workshopId: string): Promise<WorkshopSettings | null> {
  const { data, error } = await supabase
    .from('workshop_settings')
    .select('*')
    .eq('workshop_id', workshopId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertWorkshopSettings(
  settings: WorkshopSettingsInsert | (WorkshopSettingsUpdate & { workshop_id: string })
): Promise<void> {
  const { error } = await supabase
    .from('workshop_settings')
    .upsert(settings, { onConflict: 'workshop_id' })
  if (error) throw error
}
