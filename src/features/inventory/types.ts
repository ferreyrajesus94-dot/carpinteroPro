import type { Database } from '@/shared/types/database'

export type Material = Database['public']['Tables']['materials']['Row']
export type MaterialInsert = Database['public']['Tables']['materials']['Insert']
export type MaterialUpdate = Database['public']['Tables']['materials']['Update']
export type PriceHistory = Database['public']['Tables']['price_history']['Row']
export type MaterialCategory = Database['public']['Enums']['material_category']
export type UnitOfMeasure = Database['public']['Enums']['unit_of_measure']

export const MATERIAL_CATEGORIES: { value: MaterialCategory; label: string }[] = [
  { value: 'madera', label: 'Madera' },
  { value: 'herraje', label: 'Herraje' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'adhesivo', label: 'Adhesivo' },
  { value: 'vidrio', label: 'Vidrio' },
  { value: 'tela', label: 'Tela' },
  { value: 'otro', label: 'Otro' },
]

export const UNITS_OF_MEASURE: { value: UnitOfMeasure; label: string }[] = [
  { value: 'un', label: 'Unidades' },
  { value: 'm', label: 'm (metro)' },
  { value: 'cm', label: 'cm' },
  { value: 'm2', label: 'm² (metro cuadrado)' },
  { value: 'cm2', label: 'cm²' },
  { value: 'm3', label: 'm³' },
  { value: 'cm3', label: 'cm³' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g (gramo)' },
  { value: 'l', label: 'L (litro)' },
  { value: 'ml', label: 'ml' },
]
