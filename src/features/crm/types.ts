import type { Database } from '@/shared/types/database'

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientInsert = Database['public']['Tables']['clients']['Insert']
export type ClientUpdate = Database['public']['Tables']['clients']['Update']
export type ClientSource = Database['public']['Enums']['client_source']

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  mercadolibre: 'MercadoLibre',
  tiendanube: 'TiendaNube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  otro: 'Otro',
}
