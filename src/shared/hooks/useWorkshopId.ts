import { useAuth } from '@/shared/providers/AuthProvider'

/**
 * Devuelve el workshop_id del taller activo.
 * Fase 5: lee del perfil del usuario autenticado (via AuthProvider).
 */
export function useWorkshopId(): string {
  const { workshopId } = useAuth()
  return workshopId ?? ''
}
