import type { Database } from '@/shared/types/database'
import type { Client } from '@/features/crm/types'

export type { Client, ClientInsert, ClientUpdate, ClientSource } from '@/features/crm/types'
export { CLIENT_SOURCE_LABELS } from '@/features/crm/types'

export type Quote = Database['public']['Tables']['quotes']['Row']
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update']
export type QuoteStatus = Database['public']['Enums']['quote_status']
export type MarginMode = Database['public']['Enums']['margin_mode']

export type QuoteExtra = Database['public']['Tables']['quote_extras']['Row']
export type QuoteExtraInsert = Database['public']['Tables']['quote_extras']['Insert']

export type ContractTemplate = Database['public']['Tables']['contract_templates']['Row']
export type ContractTemplateInsert = Database['public']['Tables']['contract_templates']['Insert']
export type ContractTemplateUpdate = Database['public']['Tables']['contract_templates']['Update']

export type WorkshopSettings = Database['public']['Tables']['workshop_settings']['Row']
export type WorkshopSettingsInsert = Database['public']['Tables']['workshop_settings']['Insert']
export type WorkshopSettingsUpdate = Database['public']['Tables']['workshop_settings']['Update']

// Quote completo con cliente y extras (viene del JOIN en la API)
export type QuoteWithExtras = Quote & {
  extras: QuoteExtra[]
  client: Client | null
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  presupuesto: 'Presupuesto',
  enviado: 'Enviado',
  aprobado: 'Aprobado',
  en_produccion: 'En producción',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  presupuesto: 'bg-gray-100 text-gray-700',
  enviado: 'bg-blue-100 text-blue-700',
  aprobado: 'bg-green-100 text-green-700',
  en_produccion: 'bg-yellow-100 text-yellow-700',
  entregado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-red-100 text-red-700',
}

// Form shape for QuoteForm — used by QuoteExtrasFieldArray and QuoteLivePreview
export interface QuoteFormValues {
  client_id?: string
  furniture_template_id?: string
  furniture_name: string
  recipe_cost: number
  extras: { description: string; amount: number; show_in_quote: boolean }[]
  margin_mode: 'on_cost' | 'on_price'
  margin_pct: number
  status: 'presupuesto' | 'enviado' | 'aprobado' | 'en_produccion' | 'entregado' | 'cancelado'
  notes?: string
}

// Formatea números al estilo argentino: 1234567.89 → "$1.234.567,89"
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
