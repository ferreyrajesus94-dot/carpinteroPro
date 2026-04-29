import { Outlet, NavLink, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { OfflineBanner } from '@/shared/components/OfflineBanner'
import { useTheme } from '@/shared/hooks/useTheme'
import { useAuth } from '@/shared/providers/AuthProvider'
import { NAV_ITEMS, type NavItem } from './nav-items'
import { dispatchFab } from '@/shared/lib/fab'

function isWizardPath(pathname: string) {
  const segs = pathname.split('/').filter(Boolean)
  return segs[0] === 'quotes' && segs.length === 2 && segs[1] !== 'templates'
}

function activeNav(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(n => pathname === n.to || pathname.startsWith(n.to + '/'))
}

export function AppLayout() {
  const { theme, toggle } = useTheme()
  const { session, loading, onboardedAt } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (!onboardedAt) return <Navigate to="/onboarding" replace />

  const userEmail = session?.user?.email ?? ''
  const workshopName = session?.user?.user_metadata?.workshop_name ?? ''
  const displayName = session?.user?.user_metadata?.full_name ?? ''
  const initials = displayName
    ? displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase()

  const wizard = isWizardPath(location.pathname)
  const current = activeNav(location.pathname)
  const sectionTitle = current?.label
    ?? (location.pathname.startsWith('/settings') ? 'Ajustes'
      : location.pathname.startsWith('/profile') ? 'Mi perfil' : 'CarpinteroPro')

  function handleFab() {
    if (!current) return
    if (current.fabHref) navigate(current.fabHref)
    else if (current.fabAction) dispatchFab(current.fabAction)
  }

  // Wizard: layout fullscreen sin shell
  if (wizard) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* === SIDEBAR DESKTOP ≥1024 === */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col border-r border-line bg-cp-surface">
        <div className="flex h-14 items-center gap-2 px-4 border-b border-line">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cp-accent">
            <i className="fi fi-br-hammer text-sm text-[var(--cp-accent-ink)]" />
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight text-ink">
            CarpinteroPro
          </span>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium transition-colors',
                  isActive
                    ? 'bg-cp-accent-soft text-cp-accent'
                    : 'text-ink2 hover:bg-cp-bg2 hover:text-ink'
                )
              }
            >
              <i className={`fi ${icon} text-base leading-none shrink-0`} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-2 space-y-0.5">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium transition-colors',
                isActive ? 'bg-cp-accent-soft text-cp-accent' : 'text-ink2 hover:bg-cp-bg2 hover:text-ink'
              )
            }
          >
            <i className="fi fi-rr-settings text-base leading-none shrink-0" />
            Ajustes
          </NavLink>
          <Link
            to="/profile"
            className="mt-1 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-cp-bg2 transition-colors"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cp-accent text-[var(--cp-accent-ink)] font-mono text-[11px] font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              {workshopName && <p className="truncate text-[12.5px] font-semibold text-ink">{workshopName}</p>}
              {userEmail && <p className="truncate text-[11px] text-ink3">{userEmail}</p>}
            </div>
          </Link>
        </div>
      </aside>

      {/* === COLUMNA PRINCIPAL === */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineBanner />

        {/* Topbar desktop */}
        <header className="hidden lg:flex h-14 items-center gap-3 px-6 border-b border-line bg-cp-surface/85 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-1.5 text-[11px] text-ink3 font-mono uppercase tracking-wider">
            <span>CarpinteroPro</span>
            <i className="fi fi-rr-angle-small-right text-[10px]" />
            <span className="text-ink2">{sectionTitle}</span>
          </div>
          <div className="flex-1" />
          <div className="relative w-[320px] hidden xl:block">
            <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-ink3 text-xs" />
            <input
              type="search"
              placeholder="Buscar clientes, presupuestos, materiales…"
              className="h-9 w-full rounded-md border border-line bg-cp-bg2 pl-9 pr-12 text-[13px] text-ink placeholder:text-ink3 focus:outline-none focus:border-accent"
              disabled
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line bg-cp-surface px-1.5 py-0.5 font-mono text-[10px] text-ink3">⌘K</kbd>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            className="grid h-9 w-9 place-items-center rounded-md text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors cursor-pointer"
          >
            <i className={`fi ${theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'} text-base leading-none`} />
          </button>
        </header>

        {/* Header mobile */}
        <header className="flex h-12 items-center gap-2 px-4 border-b border-line bg-cp-surface/85 backdrop-blur lg:hidden sticky top-0 z-10">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cp-accent shrink-0">
            <i className="fi fi-br-hammer text-[11px] text-[var(--cp-accent-ink)]" />
          </div>
          <span className="font-display font-semibold text-[14px] tracking-tight text-ink truncate flex-1">
            {sectionTitle}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            className="grid h-8 w-8 place-items-center rounded-md text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors cursor-pointer"
          >
            <i className={`fi ${theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'} text-base leading-none`} />
          </button>
          <NavLink
            to="/settings"
            aria-label="Ajustes"
            className={({ isActive }) =>
              cn(
                'grid h-8 w-8 place-items-center rounded-md transition-colors',
                isActive ? 'bg-cp-accent-soft text-cp-accent' : 'text-ink2 hover:bg-cp-bg2 hover:text-ink'
              )
            }
          >
            <i className="fi fi-rr-settings text-base leading-none" />
          </NavLink>
          <Link
            to="/profile"
            aria-label="Mi perfil"
            className="grid h-8 w-8 place-items-center rounded-full bg-cp-accent text-[var(--cp-accent-ink)] font-mono text-[11px] font-semibold hover:opacity-90 transition-opacity"
          >
            {initials}
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <Outlet />
        </main>

        {/* FAB contextual mobile */}
        {current?.fabLabel && (
          <button
            type="button"
            onClick={handleFab}
            className="fixed left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-cp-accent px-5 text-[14px] font-medium text-[var(--cp-accent-ink)] shadow-xl transition-transform hover:scale-[1.02] active:scale-95 lg:hidden"
            style={{ bottom: 'calc(72px + env(safe-area-inset-bottom) + 14px)' }}
          >
            <i className="fi fi-rr-plus text-sm leading-none" />
            {current.fabLabel}
          </button>
        )}

        {/* Bottom tabs mobile */}
        <nav
          aria-label="Navegación principal"
          className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-line bg-cp-surface/95 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-ink' : 'text-ink3 hover:text-ink2'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <i className={cn(`fi ${icon} text-lg leading-none`, isActive && 'text-cp-accent')} />
                  <span className={isActive ? 'font-semibold' : 'font-medium'}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
