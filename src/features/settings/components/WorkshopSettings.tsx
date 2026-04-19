import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useWorkshopSettings, useUpsertWorkshopSettings } from '../hooks/useWorkshopSettings'

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  logo_url: z.string().optional(),
  auto_stock_discount: z.boolean(),
  stock_alert_enabled: z.boolean(),
  default_labor_rate: z.coerce.number().min(0).optional(),
})

type FormValues = z.infer<typeof schema>

export function WorkshopSettings() {
  const workshopId = useWorkshopId()
  const { data: settings, isLoading } = useWorkshopSettings(workshopId)
  const upsertMutation = useUpsertWorkshopSettings(workshopId)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      logo_url: '',
      auto_stock_discount: false,
      stock_alert_enabled: false,
      default_labor_rate: undefined,
    },
  })

  const autoStockDiscount = watch('auto_stock_discount')
  const stockAlertEnabled = watch('stock_alert_enabled')

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name,
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        address: settings.address ?? '',
        logo_url: settings.logo_url ?? '',
        auto_stock_discount: settings.auto_stock_discount ?? false,
        stock_alert_enabled: settings.stock_alert_enabled ?? false,
        default_labor_rate: settings.default_labor_rate ?? undefined,
      })
    }
  }, [settings, reset])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setValue('logo_url', reader.result as string)
    reader.readAsDataURL(file)
  }

  async function onSubmit(values: FormValues) {
    await upsertMutation.mutateAsync({
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      logo_url: values.logo_url || null,
      auto_stock_discount: values.auto_stock_discount,
      stock_alert_enabled: values.stock_alert_enabled,
      default_labor_rate: values.default_labor_rate ?? null,
    })
  }

  if (isLoading) return <div className="p-4 text-muted-foreground">Cargando...</div>

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Ajustes del taller</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del taller</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nombre del taller</Label>
              <Input id="name" {...register('name')} placeholder="Ej: Carpintería San Martín" />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" {...register('phone')} placeholder="+54 11 1234-5678" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} placeholder="taller@ejemplo.com" />
              {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="address">Dirección</Label>
              <Input id="address" {...register('address')} placeholder="Calle 123, Ciudad" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="logo">Logo del taller</Label>
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                La imagen se guarda en el dispositivo y aparece en el PDF.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="default_labor_rate">Tarifa por hora de mano de obra (opcional)</Label>
              <Input
                id="default_labor_rate"
                type="number"
                min="0"
                step="1"
                {...register('default_labor_rate')}
                placeholder="Ej: 3500"
              />
              <p className="text-xs text-muted-foreground">
                Se usa como valor inicial al agregar ítems de mano de obra a un mueble.
              </p>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-stock-discount" className="cursor-pointer">
                    Descontar stock automáticamente al aprobar presupuestos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cuando marques un presupuesto como Aprobado, los materiales que componen
                    el mueble se restarán del stock automáticamente. Podés revertir el movimiento
                    manualmente desde el inventario.
                  </p>
                </div>
                <Switch
                  id="auto-stock-discount"
                  checked={autoStockDiscount}
                  onCheckedChange={(v) => setValue('auto_stock_discount', v, { shouldDirty: true })}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="stock-alert-enabled" className="cursor-pointer">
                    Alertar stock insuficiente al abrir un mueble
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cruza la lista de materiales del mueble contra el stock del inventario
                    y muestra un aviso si falta algo. Desactivalo si trabajás bajo demanda.
                  </p>
                </div>
                <Switch
                  id="stock-alert-enabled"
                  checked={stockAlertEnabled}
                  onCheckedChange={(v) => setValue('stock_alert_enabled', v, { shouldDirty: true })}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
