import { supabase } from '@/shared/lib/supabase'
import { computeNesting } from '@/shared/lib/computeNesting'

/**
 * Descuenta materiales del stock cuando un presupuesto pasa a "aprobado".
 * Solo actúa si `auto_stock_discount` está habilitado en la configuración del taller.
 * Para materiales de tipo placa con piezas definidas, usa el nesting para
 * descontar placas enteras en lugar del área en m².
 */
export async function maybeAutoDiscountStock(
  workshopId: string,
  quoteId: string,
  newStatus: string | null | undefined,
): Promise<{ ok: number; errors: string[] }> {
  if (newStatus !== 'aprobado') return { ok: 0, errors: [] }

  const { data: prev } = await supabase
    .from('quotes')
    .select('status, furniture_template_id, quote_number')
    .eq('id', quoteId)
    .maybeSingle()
  if (!prev || prev.status === 'aprobado' || !prev.furniture_template_id) return { ok: 0, errors: [] }

  const { data: settings } = await supabase
    .from('workshop_settings')
    .select('auto_stock_discount')
    .eq('workshop_id', workshopId)
    .maybeSingle()
  if (!settings?.auto_stock_discount) return { ok: 0, errors: [] }

  const { data: items } = await supabase
    .from('recipe_items')
    .select(`
      material_id,
      quantity,
      material:materials (
        wood_subtype, unit, length_cm, width_cm
      ),
      cut_pieces (
        length_cm, width_cm, quantity
      )
    `)
    .eq('furniture_template_id', prev.furniture_template_id)
  if (!items || items.length === 0) return { ok: 0, errors: [] }

  const note = `Aprobación presupuesto ${prev.quote_number ?? ''}`.trim()
  let ok = 0
  const errors: string[] = []

  for (const it of items) {
    try {
      const mat = it.material as {
        wood_subtype: string | null
        unit: string
        length_cm: number | null
        width_cm: number | null
      } | null
      const pieces = (it.cut_pieces ?? []) as { length_cm: number; width_cm: number; quantity: number }[]

      let delta: number
      if (
        mat?.wood_subtype === 'placa' &&
        mat?.unit === 'un' &&
        pieces.length > 0 &&
        mat.length_cm != null &&
        mat.width_cm != null
      ) {
        const nesting = computeNesting(pieces, mat.length_cm, mat.width_cm)
        delta = -nesting.boardsNeeded
      } else {
        delta = -Number(it.quantity)
      }

      const { error } = await supabase.rpc('apply_stock_movement', {
        p_material_id: it.material_id,
        p_delta: delta,
        p_reason: 'descuento_presupuesto',
        p_note: note,
        p_quote_id: quoteId,
      })
      if (error) throw error
      ok++
    } catch (e) {
      errors.push((e as Error).message)
    }
  }

  return { ok, errors }
}
