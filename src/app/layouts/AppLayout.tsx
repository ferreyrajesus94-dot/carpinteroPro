import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, BookOpen, FileText, Users, Settings } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { OfflineBanner } from '@/shared/components/OfflineBanner'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventario', icon: Package },
  { to: '/recipes', label: 'Muebles', icon: BookOpen },
  { to: '/quotes', label: 'Presupuestos', icon: FileText },
  { to: '/crm', label: 'Clientes', icon: Users },
  { to: '/settings', label: 'Ajustes', icon: Settings },
]

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — visible solo en md+ */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r bg-card">
        <div className="flex h-14 items-center px-4 border-b">
          <span className="font-bold text-lg text-primary">CarpinteroPro</span>
        </div>
        <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <OfflineBanner />
        {/* Header mobile */}
        <header className="flex h-14 items-center px-4 border-b md:hidden">
          <span className="font-bold text-lg text-primary">CarpinteroPro</span>
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
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
