import { supabase } from '@/shared/lib/supabase'
import type { QuoteInsert, QuoteUpdate, QuoteExtraInsert, QuoteWithExtras } from '../types'

const QUOTE_SELECT = `
  *,
  client:clients (*),
  extras:quote_extras (*)
` as const

export async function fetchQuotes(workshopId: string): Promise<QuoteWithExtras[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select<typeof QUOTE_SELECT, QuoteWithExtras>(QUOTE_SELECT)
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export const PAGE_SIZE = 20

export async function fetchQuotesPaginated(
  workshopId: string,
  page: number
): Promise<{ data: QuoteWithExtras[]; count: number }> {
  const from = page * PAGE_SIZE
  const { data, error, count } = await supabase
    .from('quotes')
    .select<typeof QUOTE_SELECT, QuoteWithExtras>(QUOTE_SELECT, { count: 'exact' })
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw error
  return { data: data ?? [], count: count ?? 0 }
}

export async function fetchQuote(id: string): Promise<QuoteWithExtras> {
  const { data, error } = await supabase
    .from('quotes')
    .select<typeof QUOTE_SELECT, QuoteWithExtras>(QUOTE_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function generateQuoteNumber(workshopId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_quote_number', {
    p_workshop_id: workshopId,
  })
  if (error) throw error
  return data as string
}

export async function createQuote(
  quote: Omit<QuoteInsert, 'id' | 'created_at' | 'updated_at'>,
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
): Promise<string> {
  const { data, error } = await supabase
    .from('quotes')
    .insert(quote)
    .select('id')
    .single()
  if (error) throw error

  if (extras.length > 0) {
    const { error: extrasError } = await supabase
      .from('quote_extras')
      .insert(extras.map((e, i) => ({ ...e, quote_id: data.id, sort_order: i })))
    if (extrasError) throw extrasError
  }

  return data.id
}

export async function updateQuote(
  id: string,
  quote: QuoteUpdate,
  extras: Omit<QuoteExtraInsert, 'id' | 'quote_id'>[]
): Promise<void> {
  const { error } = await supabase.from('quotes').update(quote).eq('id', id)
  if (error) throw error

  const { error: deleteError } = await supabase
    .from('quote_extras')
    .delete()
    .eq('quote_id', id)
  if (deleteError) throw deleteError

  if (extras.length > 0) {
    const { error: insertError } = await supabase
      .from('quote_extras')
      .insert(extras.map((e, i) => ({ ...e, quote_id: id, sort_order: i })))
    if (insertError) throw insertError
  }
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw error
}
