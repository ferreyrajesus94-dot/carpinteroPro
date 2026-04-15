import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const workshopId = import.meta.env.VITE_WORKSHOP_ID

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// El header x-workshop-id es leído por la función get_current_workshop_id()
// en las políticas RLS para aislar los datos por taller.
// TODO (Fase 5 - Auth real): reemplazar por claims del JWT de Supabase Auth.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-workshop-id': workshopId ?? '',
    },
  },
})
