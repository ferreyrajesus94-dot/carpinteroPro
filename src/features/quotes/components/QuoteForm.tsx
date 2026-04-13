import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useFurnitureTemplates } from '@/features/recipes/hooks/useRecipes'
import { computeRecipeCost } from '@/features/recipes/types'
import { useClients } from '../hooks/useClients'
import { useQuote, useCreateQuote, useUpdateQuote, useGenerateQuoteNumber } from '../hooks/useQuotes'
import { QUOTE_STATUS_LABELS, type QuoteStatus, type MarginMode, type QuoteFormValues } from '../types'
import { QuoteExtrasFieldArray } from './QuoteExtrasFieldArray'
import { QuoteLivePreview } from './QuoteLivePreview'
import { ClientDialog } from './ClientDialog'

const extraSchema = z.object({
  description: z.string().min(1, 'La descripción es obligatoria'),
  amount: z.coerce.number().min(0),
  show_in_quote: z.boolean(),
})

const quoteSchema = z.object({
  client_id: z.string().optional(),
  furniture_template_id: z.string().optional(),
  furniture_name: z.string().min(1, 'El nombre del mueble es obligatorio'),
  recipe_cost: z.coerce.number().min(0),
  extras: z.array(extraSchema),
  margin_mode: z.enum(['on_cost', 'on_price']),
  margin_pct: z.coerce.number().min(0).max(99),
  status: z.enum(['presupuesto', 'enviado', 'aprobado', 'en_produccion', 'entregado', 'cancelado']),
  notes: z.string().optional(),
})

export function QuoteForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const workshopId = useWorkshopId()
  const isEditing = Boolean(id)

  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  const { data: existingQuote } = useQuote(id ?? null)
  const { data: nextNumber } = useGenerateQuoteNumber(workshopId)
  const { data: clients = [] } = useClients(workshopId)
  const { data: templates = [] } = useFurnitureTemplates(workshopId)
  const createMutation = useCreateQuote(workshopId)
  const updateMutation = useUpdateQuote(workshopId)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema) as Resolver<QuoteFormValues>,
    defaultValues: {
      client_id: '',
      furniture_template_id: '',
      furniture_name: '',
      recipe_cost: 0,
      extras: [],
      margin_mode: 'on_cost',
      margin_pct: 30,
      status: 'presupuesto',
      notes: '',
    },
  })

  useEffect(() => {
    if (existingQuote) {
      reset({
        client_id: existingQuote.client_id ?? '',
        furniture_template_id: existingQuote.furniture_template_id ?? '',
        furniture_name: existingQuote.furniture_name,
        recipe_cost: existingQuote.recipe_cost,
        extras: existingQuote.extras.map((e) => ({
          description: e.description,
          amount: e.amount,
          show_in_quote: e.show_in_quote,
        })),
        margin_mode: existingQuote.margin_mode,
        margin_pct: existingQuote.margin_pct,
        status: existingQuote.status,
        notes: existingQuote.notes ?? '',
      })
    }
  }, [existingQuote, reset])

  const templateIdWatch = watch('furniture_template_id')
  useEffect(() => {
    if (!templateIdWatch) return
    const tpl = templates.find((t) => t.id === templateIdWatch)
    if (!tpl) return
    setValue('furniture_name', tpl.name)
    const cost = computeRecipeCost(tpl.recipe_items)
    setValue('recipe_cost', cost.total)
  }, [templateIdWatch, templates, setValue])

  const recipeCostWatch = watch('recipe_cost')
  const extrasWatch = watch('extras')
  const marginModeWatch = watch('margin_mode')
  const marginPctWatch = watch('margin_pct')
  const clientIdWatch = watch('client_id')
  const statusWatch = watch('status')

  function handleClientCreated(client: { id: string }) {
    setValue('client_id', client.id)
  }

  async function onSubmit(values: QuoteFormValues) {
    const quoteNumber = isEditing ? existingQuote!.quote_number : (nextNumber ?? 'P-0001')

    const quoteData = {
      workshop_id: workshopId,
      quote_number: quoteNumber,
      client_id: values.client_id || null,
      furniture_template_id: values.furniture_template_id || null,
      furniture_name: values.furniture_name,
      recipe_cost: values.recipe_cost,
      status: values.status as QuoteStatus,
      margin_mode: values.margin_mode as MarginMode,
      margin_pct: values.margin_pct,
      notes: values.notes || null,
    }

    const extrasData = values.extras.map((e) => ({
      description: e.description,
      amount: e.amount,
      show_in_quote: e.show_in_quote,
    }))

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, quote: quoteData, extras: extrasData })
    } else {
      await createMutation.mutateAsync({ quote: quoteData, extras: extrasData })
    }
    navigate('/quotes')
  }

  const quoteNumber = isEditing ? existingQuote?.quote_number : nextNumber

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? `Editar ${quoteNumber}` : `Nuevo presupuesto ${nextNumber ? `— ${nextNumber}` : ''}`}
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-6">

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cliente</h2>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Seleccionar cliente</Label>
                <Select value={clientIdWatch ?? ''} onValueChange={(v) => setValue('client_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin cliente</SelectItem>
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
                onClick={() => setClientDialogOpen(true)}
                title="Nuevo cliente"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mueble</h2>
            <div className="space-y-1">
              <Label>Plantilla de mueble (opcional)</Label>
              <Select
                value={templateIdWatch ?? ''}
                onValueChange={(v) => setValue('furniture_template_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin plantilla — ingresá nombre y costo manualmente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin plantilla</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="furniture_name">Nombre del mueble *</Label>
              <Input
                id="furniture_name"
                {...register('furniture_name')}
                placeholder="Ej: Ropero 2 puertas"
              />
              {errors.furniture_name && (
                <p className="text-destructive text-xs">{errors.furniture_name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="recipe_cost">Costo base ($)</Label>
              <Input
                id="recipe_cost"
                type="number"
                min="0"
                step="0.01"
                {...register('recipe_cost')}
                placeholder="0"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Extras</h2>
            <QuoteExtrasFieldArray control={control} errors={errors} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Margen</h2>
            <RadioGroup
              value={marginModeWatch}
              onValueChange={(v) => setValue('margin_mode', v as MarginMode)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="on_cost" id="on_cost" />
                <Label htmlFor="on_cost">Sobre el costo</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="on_price" id="on_price" />
                <Label htmlFor="on_price">Sobre el precio de venta</Label>
              </div>
            </RadioGroup>
            <div className="w-28 space-y-1">
              <Label htmlFor="margin_pct">Margen (%)</Label>
              <Input
                id="margin_pct"
                type="number"
                min="0"
                max="99"
                step="0.1"
                {...register('margin_pct')}
              />
              {errors.margin_pct && (
                <p className="text-destructive text-xs">{errors.margin_pct.message}</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estado</h2>
            <Select value={statusWatch} onValueChange={(v) => setValue('status', v as QuoteStatus)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(QUOTE_STATUS_LABELS) as [QuoteStatus, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="space-y-2">
            <Label htmlFor="notes">Notas internas (opcional)</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              rows={3}
              placeholder="Medidas, aclaraciones, etc."
            />
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate('/quotes')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear presupuesto'}
            </Button>
          </div>
        </form>

        <div className="lg:w-72">
          <QuoteLivePreview
            recipeCost={recipeCostWatch ?? 0}
            extras={extrasWatch ?? []}
            marginMode={marginModeWatch}
            marginPct={marginPctWatch ?? 0}
          />
        </div>
      </div>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onCreated={handleClientCreated}
      />
    </div>
  )
}
