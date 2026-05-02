import type { Database } from '@/shared/types/database'
import type { Client } from '@/shared/types/client'

export type { Client, ClientInsert, ClientUpdate, ClientSource } from '@/shared/types/client'
export { CLIENT_SOURCE_LABELS } from '@/shared/types/client'

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

export type { WorkshopSettings, WorkshopSettingsInsert, WorkshopSettingsUpdate } from '@/shared/types/workshop'

export type QuoteRecipeSnapshot = Database['public']['Tables']['quote_recipe_snapshots']['Row']
export type QuoteRecipeSnapshotInsert = Database['public']['Tables']['quote_recipe_snapshots']['Insert']
export type QuoteLaborSnapshot = Database['public']['Tables']['quote_labor_snapshots']['Row']
export type QuoteLaborSnapshotInsert = Database['public']['Tables']['quote_labor_snapshots']['Insert']
export type QuotePieceSnapshot = Database['public']['Tables']['quote_piece_snapshots']['Row']
export type QuotePieceSnapshotInsert = Database['public']['Tables']['quote_piece_snapshots']['Insert']

// Quote completo con cliente y extras (viene del JOIN en la API)
export type QuoteWithExtras = Quote & {
  extras: QuoteExtra[]
  client: Client | null
  recipe_snapshots?: QuoteRecipeSnapshot[]
  labor_snapshots?: QuoteLaborSnapshot[]
  piece_snapshots?: QuotePieceSnapshot[]
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

export const QUOTE_STATUS_HEX_COLORS: Record<QuoteStatus, string> = {
  presupuesto: '#9ca3af',   // gray-400
  enviado: '#60a5fa',       // blue-400
  aprobado: '#4ade80',      // green-400
  en_produccion: '#facc15', // yellow-400
  entregado: '#34d399',     // emerald-400
  cancelado: '#f87171',     // red-400
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
