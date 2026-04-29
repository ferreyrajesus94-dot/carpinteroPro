import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { markOnboarded, resetOnboarding } from '../api/profiles'
import { useAuth } from '@/shared/providers/AuthProvider'

export function useMarkOnboarded() {
  const { session, refreshProfile } = useAuth()
  return useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('No hay sesión activa')
      await markOnboarded(session.user.id)
      await refreshProfile()
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useResetOnboarding() {
  const { session, refreshProfile } = useAuth()
  return useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('No hay sesión activa')
      await resetOnboarding(session.user.id)
      await refreshProfile()
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
