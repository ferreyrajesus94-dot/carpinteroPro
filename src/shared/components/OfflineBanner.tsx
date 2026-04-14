import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="bg-yellow-500 text-yellow-950 text-xs text-center py-1.5 font-medium">
      Sin conexión — modo solo lectura
    </div>
  )
}
