import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, setWorkshopId, clearWorkshopId } from '@/shared/lib/supabase'

interface AuthContextValue {
  session: Session | null
  workshopId: string | null
  onboardedAt: string | null
  /** true mientras se restaura la sesión inicial */
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [workshopId, setWorkshopIdState] = useState<string | null>(null)
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('workshop_id, onboarded_at')
      .eq('id', userId)
      .single()

    if (data?.workshop_id) {
      setWorkshopId(data.workshop_id)
      setWorkshopIdState(data.workshop_id)
    }
    setOnboardedAt(data?.onboarded_at ?? null)
  }

  async function refreshProfile() {
    if (session?.user?.id) {
      await loadProfile(session.user.id)
    }
  }

  useEffect(() => {
    // Restaurar sesión al montar (ej. recarga de página)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Suscribirse a cambios de sesión (login / logout / refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) {
          loadProfile(session.user.id)
        } else {
          clearWorkshopId()
          setWorkshopIdState(null)
          setOnboardedAt(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, workshopId, onboardedAt, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
