import type { Database } from './database'

export type Material = Database['public']['Tables']['materials']['Row']
export type MaterialInsert = Database['public']['Tables']['materials']['Insert']
export type MaterialUpdate = Database['public']['Tables']['materials']['Update']
export type PriceHistory = Database['public']['Tables']['price_history']['Row']
export type MaterialCategory = Database['public']['Enums']['material_category']
export type UnitOfMeasure = Database['public']['Enums']['unit_of_measure']
export type WoodSubtype = Database['public']['Enums']['wood_subtype']
