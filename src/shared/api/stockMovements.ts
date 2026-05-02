import { supabase } from '@/shared/lib/supabase'
import type { Database } from '@/shared/types/database'

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
