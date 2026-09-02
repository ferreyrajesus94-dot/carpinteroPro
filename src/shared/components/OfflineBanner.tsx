import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="bg-cp-warn text-ink text-xs text-center py-1.5 font-medium">
      Sin conexión — modo solo lectura
    </div>
  )
}
