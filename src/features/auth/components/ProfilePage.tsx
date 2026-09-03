import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/shared/providers/AuthProvider'
import { Avatar } from '@/shared/ui/avatar'

export function ProfilePage() {
  const { session, workshopId, signOut } = useAuth()
  const navigate = useNavigate()

  const user = session?.user
  const email = user?.email ?? ''
  const workshopName = user?.user_metadata?.workshop_name ?? 'Mi Taller'
  const displayName = user?.user_metadata?.full_name ?? ''

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Información de tu cuenta</p>
      </div>

      {/* Avatar + info */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={displayName}
            email={email}
            size="lg"
            tone="solid"
          />
          <div className="min-w-0">
            {displayName && (
              <p className="font-semibold text-foreground truncate">{displayName}</p>
            )}
            <p className="text-sm text-muted-foreground truncate">{email}</p>
          </div>
        </div>
      </div>

      {/* Datos del taller */}
      <div className="rounded-lg border bg-card divide-y">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground shrink-0">Taller</span>
          <span className="text-sm font-medium text-foreground text-right truncate">{workshopName}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground shrink-0">Email</span>
          <span className="text-sm font-medium text-foreground text-right truncate">{email}</span>
        </div>
        {workshopId && (
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground shrink-0">ID de taller</span>
            <span className="text-xs font-mono text-muted-foreground text-right truncate">{workshopId}</span>
          </div>
        )}
      </div>

      {/* Cerrar sesión */}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
      >
        <i className="fi fi-rr-sign-out text-base leading-none" />
        Cerrar sesión
      </button>
    </div>
  )
}
