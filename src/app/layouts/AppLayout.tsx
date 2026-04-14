import { Outlet, NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { OfflineBanner } from '@/shared/components/OfflineBanner'
import { useTheme } from '@/shared/hooks/useTheme'

const navItems = [
  { to: '/dashboard', label: 'Dashboard',      icon: 'fi-rr-apps'          },
  { to: '/inventory', label: 'Inventario',     icon: 'fi-rr-box-open'      },
  { to: '/recipes',   label: 'Muebles',        icon: 'fi-rr-couch'         },
  { to: '/quotes',    label: 'Presupuestos',   icon: 'fi-rr-file-invoice'  },
  { to: '/crm',       label: 'Clientes',       icon: 'fi-rr-users'         },
  { to: '/settings',  label: 'Ajustes',        icon: 'fi-rr-settings'      },
]

export function AppLayout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — visible solo en md+ */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 px-4 border-b">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <i className="fi fi-br-hammer text-sm text-primary-foreground" />
          </div>
          <span className="font-bold text-base text-foreground tracking-tight">CarpinteroPro</span>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary pl-[10px]'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground border-l-2 border-transparent pl-[10px]'
                )
              }
            >
              <i className={`fi ${icon} text-base leading-none shrink-0`} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t px-3 py-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <i className={`fi ${theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'} text-base leading-none shrink-0`} />
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        {/* Header mobile */}
        <header className="flex h-14 items-center gap-2 px-4 border-b bg-card md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <i className="fi fi-br-hammer text-sm text-primary-foreground" />
          </div>
          <span className="font-bold text-base text-foreground tracking-tight flex-1">CarpinteroPro</span>
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150 cursor-pointer"
          >
            <i className={`fi ${theme === 'dark' ? 'fi-rr-sun' : 'fi-rr-moon'} text-base leading-none`} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <Outlet />
        </main>

        {/* Bottom tab bar — visible solo en mobile */}
        <nav
          aria-label="Navegación principal"
          className="fixed bottom-0 left-0 right-0 flex md:hidden border-t bg-card z-10"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors duration-150',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <i className={`fi ${icon} text-xl leading-none`} />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
