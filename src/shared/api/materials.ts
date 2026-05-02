import { supabase } from '@/shared/lib/supabase'
import type { Material, MaterialInsert, MaterialCategory } from '@/shared/types/material'

export async function fetchMaterials(
  workshopId: string,
  filters?: { category?: MaterialCategory; lowStockOnly?: boolean }
): Promise<Material[]> {
  let query = supabase
    .from('materials')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('name')

  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  const { data, error } = await query
  if (error) throw error

  if (filters?.lowStockOnly) {
    return (data ?? []).filter((m) => m.stock <= m.min_stock)
  }
  return data ?? []
}

export async function createMaterial(material: MaterialInsert): Promise<Material> {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single()
  if (error) throw error
  return data
}
