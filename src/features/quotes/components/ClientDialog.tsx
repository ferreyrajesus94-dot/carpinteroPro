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
import { useCreateClient } from '../hooks/useClients'
import { CLIENT_SOURCE_LABELS, type Client, type ClientSource } from '../types'

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  source: z.enum(['mercadolibre', 'tiendanube', 'instagram', 'facebook', 'otro']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (client: Client) => void
}

export function ClientDialog({ open, onOpenChange, onCreated }: ClientDialogProps) {
  const workshopId = useWorkshopId()
  const createMutation = useCreateClient(workshopId)

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

  const sourceValue = watch('source')

  async function onSubmit(values: FormValues) {
    const client = await createMutation.mutateAsync({
      workshop_id: workshopId,
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      source: values.source as ClientSource,
      notes: values.notes || null,
    })
    reset()
    onCreated(client)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
