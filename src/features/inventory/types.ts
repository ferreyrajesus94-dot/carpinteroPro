import type { Database } from '@/shared/types/database'
import type { MaterialCategory, UnitOfMeasure, WoodSubtype } from '@/shared/types/material'

export type { Material, MaterialInsert, MaterialUpdate, MaterialCategory, UnitOfMeasure, WoodSubtype } from '@/shared/types/material'
export type PriceHistory = Database['public']['Tables']['price_history']['Row']

export const WOOD_SUBTYPES: { value: WoodSubtype; label: string }[] = [
  { value: 'placa', label: 'Placa' },
  { value: 'liston', label: 'Listón' },
  { value: 'tirante', label: 'Tirante' },
  { value: 'columna', label: 'Columna' },
]

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
