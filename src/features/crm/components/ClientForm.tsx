import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateClient, useUpdateClient } from '@/features/crm/hooks/useClients'
import { CLIENT_SOURCE_LABELS, type Client, type ClientSource } from '@/features/crm/types'

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  source: z.enum(['mercadolibre', 'tiendanube', 'instagram', 'facebook', 'otro']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el form opera en modo edición */
  client?: Client
  /** Llamado al crear un cliente nuevo (solo en modo creación) */
  onCreated?: (client: Client) => void
  /** Llamado al guardar edición exitosa */
  onUpdated?: () => void
}

export function ClientForm({ open, onOpenChange, client, onCreated, onUpdated }: ClientFormProps) {
  const workshopId = useWorkshopId()
  const createMutation = useCreateClient(workshopId)
  const updateMutation = useUpdateClient(workshopId)
  const isEditing = Boolean(client)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { name: '', phone: '', email: '', source: 'otro', notes: '' },
  })

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        phone: client.phone ?? '',
        email: client.email ?? '',
        source: client.source,
        notes: client.notes ?? '',
      })
    } else {
      reset({ name: '', phone: '', email: '', source: 'otro', notes: '' })
    }
  }, [client, reset, open])

  const sourceValue = watch('source')

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      source: values.source as ClientSource,
      notes: values.notes || null,
    }

    if (isEditing && client) {
      await updateMutation.mutateAsync({ id: client.id, data: payload })
      onUpdated?.()
    } else {
      const created = await createMutation.mutateAsync({ workshop_id: workshopId, ...payload })
      onCreated?.(created)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="client-name">Nombre *</Label>
            <Input id="client-name" {...register('name')} placeholder="Nombre completo" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-phone">Teléfono</Label>
            <Input id="client-phone" {...register('phone')} placeholder="+54 11 1234-5678" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" type="email" {...register('email')} placeholder="cliente@ejemplo.com" />
            {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label>¿Cómo llegó?</Label>
            <Select value={sourceValue} onValueChange={(v) => setValue('source', v as ClientSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CLIENT_SOURCE_LABELS) as [ClientSource, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="client-notes">Notas</Label>
            <Input id="client-notes" {...register('notes')} placeholder="Observaciones opcionales" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
