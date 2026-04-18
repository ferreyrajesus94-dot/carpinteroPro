import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database'

export type StockMovement = Database['public']['Tables']['stock_movements']['Row']
export type StockMovementReason = Database['public']['Enums']['stock_movement_reason']

export interface ApplyStockMovementInput {
  materialId: string
  delta: number
  reason: StockMovementReason
  note?: string | null
  quoteId?: string | null
}

export async function applyStockMovement(input: ApplyStockMovementInput): Promise<number> {
  const { data, error } = await supabase.rpc('apply_stock_movement', {
    p_material_id: input.materialId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note ?? null,
    p_quote_id: input.quoteId ?? null,
  })
  if (error) throw error
  return data as number
}

export async function fetchStockMovements(materialId: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('material_id', materialId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
