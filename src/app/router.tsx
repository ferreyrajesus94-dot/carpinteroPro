import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'

// El guard de auth vive en AppLayout (rutas protegidas) y en LoginPage (ruta pública).
// No se pueden usar hooks de contexto en componentes creados a nivel de módulo
// (fuera del árbol de React), por eso el guard no va aquí.

export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: () => import('@/features/auth/routes').then(m => ({ Component: m.AuthRoutes })),
  },
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
        path: 'dashboard/*',
        lazy: () => import('@/features/dashboard/routes').then(m => ({ Component: m.DashboardRoutes })),
      },
      {
        path: 'inventory/*',
        lazy: () => import('@/features/inventory/routes').then(m => ({ Component: m.InventoryRoutes })),
      },
      {
        path: 'recipes/*',
        lazy: () => import('@/features/recipes/routes').then(m => ({ Component: m.RecipesRoutes })),
      },
      {
        path: 'quotes/*',
        lazy: () => import('@/features/quotes/routes').then(m => ({ Component: m.QuotesRoutes })),
      },
      {
        path: 'crm/*',
        lazy: () => import('@/features/crm/routes').then(m => ({ Component: m.CrmRoutes })),
      },
      {
        path: 'tareas/*',
        lazy: () => import('@/features/tasks/routes').then(m => ({ Component: m.TasksRoutes })),
      },
      {
        path: 'settings/*',
        lazy: () => import('@/features/settings/routes').then(m => ({ Component: m.SettingsRoutes })),
      },
      {
        path: 'profile/*',
        lazy: () => import('@/features/auth/routes').then(m => ({ Component: m.ProfileRoutes })),
      },
    ],
  },
])
