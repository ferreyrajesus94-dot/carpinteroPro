/**
 * Returns the current workshop ID.
 *
 * Pre-auth (actual): lee desde la variable de entorno VITE_WORKSHOP_ID.
 * El ID se envía como header "x-workshop-id" en cada request a Supabase
 * (configurado en shared/lib/supabase.ts) para que las políticas RLS
 * filtren los datos por taller.
 *
 * TODO (Fase 5 - Auth real): reemplazar por:
 *   const { data: { session } } = await supabase.auth.getSession()
 *   return session?.user?.app_metadata?.workshop_id
 */
export function useWorkshopId(): string {
  return import.meta.env.VITE_WORKSHOP_ID as string
}
