import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { useAuth } from '@/shared/providers/AuthProvider'

/** Protege todas las rutas hijas: redirige a /login si no hay sesión. */
function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

/** Redirige al dashboard si ya está logueado (evita mostrar login innecesariamente). */
function GuestOnly() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export const router = createBrowserRouter([
  // Rutas públicas (solo para no autenticados)
  {
    element: <GuestOnly />,
    children: [
      {
        path: '/login',
        lazy: () => import('@/features/auth/routes').then(m => ({ Component: m.AuthRoutes })),
      },
    ],
  },
  // Rutas protegidas
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        errorElement: (
          <div className="flex h-screen flex-col items-center justify-center gap-4 p-8">
            <p className="text-lg font-medium text-destructive">Error al cargar la página</p>
            <button
              className="text-sm text-muted-foreground underline"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
          </div>
        ),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            lazy: () => import('@/features/dashboard/routes').then(m => ({ Component: m.DashboardRoutes })),
          },
          {
            path: 'inventory',
            lazy: () => import('@/features/inventory/routes').then(m => ({ Component: m.InventoryRoutes })),
          },
          {
            path: 'recipes',
            lazy: () => import('@/features/recipes/routes').then(m => ({ Component: m.RecipesRoutes })),
          },
          {
            path: 'quotes',
            lazy: () => import('@/features/quotes/routes').then(m => ({ Component: m.QuotesRoutes })),
          },
          {
            path: 'crm',
            lazy: () => import('@/features/crm/routes').then(m => ({ Component: m.CrmRoutes })),
          },
          {
            path: 'settings',
            lazy: () => import('@/features/settings/routes').then(m => ({ Component: m.SettingsRoutes })),
          },
        ],
      },
    ],
  },
])
