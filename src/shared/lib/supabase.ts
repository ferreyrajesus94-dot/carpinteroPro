import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Objeto mutable: AuthProvider lo actualiza tras login con el workshop_id real.
// El cliente supabase mantiene una referencia a este objeto, por lo que
// cualquier mutación aplica a todas las requests futuras.
const _headers: Record<string, string> = {}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { headers: _headers },
})

/** Llamar tras login exitoso para que las políticas RLS filtren por taller. */
export function setWorkshopId(workshopId: string) {
  _headers['x-workshop-id'] = workshopId
}

/** Llamar al hacer logout para limpiar el header. */
export function clearWorkshopId() {
  delete _headers['x-workshop-id']
}
