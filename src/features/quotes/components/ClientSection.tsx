import { UserPlus } from 'lucide-react'
import type { UseFormSetValue } from 'react-hook-form'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import type { Client } from '@/features/crm/types'
import type { QuoteFormValues } from '../types'

interface ClientSectionProps {
  clients: Client[]
  clientIdWatch: string | undefined
  setValue: UseFormSetValue<QuoteFormValues>
  onAddClient: () => void
}

export function ClientSection({ clients, clientIdWatch, setValue, onAddClient }: ClientSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cliente</h2>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label>Seleccionar cliente</Label>
          <Select value={clientIdWatch ?? '__none__'} onValueChange={(v) => setValue('client_id', v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sin cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin cliente</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}{c.phone ? ` — ${c.phone}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="self-end"
          onClick={onAddClient}
          title="Nuevo cliente"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
