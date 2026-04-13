import { supabase } from '@/shared/lib/supabase'
import type { MaterialInsert, MaterialUpdate, MaterialCategory } from '../types'

export async function fetchMaterials(
  workshopId: string,
  filters?: { category?: MaterialCategory; lowStockOnly?: boolean }
) {
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

export async function fetchMaterialById(id: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createMaterial(material: MaterialInsert) {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMaterial(id: string, updates: MaterialUpdate) {
  const { data, error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMaterial(id: string) {
  const { error } = await supabase.from('materials').delete().eq('id', id)
  if (error) throw error
}

export async function fetchPriceHistory(materialId: string) {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('material_id', materialId)
    .order('changed_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
