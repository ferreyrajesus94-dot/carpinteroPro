import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
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
    ],
  },
])
