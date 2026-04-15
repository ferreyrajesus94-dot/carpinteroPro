import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/shared/lib/queryClient'
import { AuthProvider } from '@/shared/providers/AuthProvider'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" theme="system" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
