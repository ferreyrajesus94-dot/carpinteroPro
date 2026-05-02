import type { Database } from './database'

export type WorkshopSettings = Database['public']['Tables']['workshop_settings']['Row']
export type WorkshopSettingsInsert = Database['public']['Tables']['workshop_settings']['Insert']
export type WorkshopSettingsUpdate = Database['public']['Tables']['workshop_settings']['Update']
