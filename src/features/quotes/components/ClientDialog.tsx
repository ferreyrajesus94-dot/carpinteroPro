import { ClientForm } from '@/features/crm/components/ClientForm'
import type { Client } from '@/features/crm/types'

interface ClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: Client) => void
}

export function ClientDialog({ open, onOpenChange, onCreated }: ClientDialogProps) {
  return <ClientForm open={open} onOpenChange={onOpenChange} onCreated={onCreated} />
}
