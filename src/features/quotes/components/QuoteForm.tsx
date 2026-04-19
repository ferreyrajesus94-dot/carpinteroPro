import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useFurnitureTemplates } from '@/features/recipes/hooks/useRecipes'
import { computeRecipeCost, resolveItemQuantity } from '@/features/recipes/types'
import { useClients } from '../hooks/useClients'
import { useQuote, useCreateQuote, useUpdateQuote, useGenerateQuoteNumber } from '../hooks/useQuotes'
import { QUOTE_STATUS_LABELS, type QuoteStatus, type MarginMode, type QuoteFormValues } from '../types'
import { QuoteExtrasFieldArray } from './QuoteExtrasFieldArray'
import { QuoteLivePreview } from './QuoteLivePreview'
import { ClientDialog } from './ClientDialog'
import { ClientSection } from './ClientSection'
import { FurnitureSection } from './FurnitureSection'
import { MarginSection } from './MarginSection'

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
  const [searchParams] = useSearchParams()
  const workshopId = useWorkshopId()
  const isEditing = Boolean(id)
  const prefillTemplateId = searchParams.get('template')

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
      furniture_template_id: prefillTemplateId ?? '',
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
    const paramValues = Object.fromEntries((tpl.params ?? []).map((p) => [p.name, p.default]))
    const cost = computeRecipeCost(tpl.recipe_items, tpl.labor_items, paramValues)
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

    const tpl = values.furniture_template_id
      ? templates.find((t) => t.id === values.furniture_template_id)
      : null
    const paramValues = tpl
      ? Object.fromEntries((tpl.params ?? []).map((p) => [p.name, p.default]))
      : {}
    const recipeSnapshots = tpl
      ? tpl.recipe_items.map((ri) => ({
          material_id: ri.material_id,
          material_name: ri.material.name,
          material_unit: ri.material.unit,
          material_category: ri.material.category,
          quantity: resolveItemQuantity(ri, paramValues),
          waste_pct: ri.waste_pct ?? 0,
          price_per_unit: ri.material.price_per_unit,
        }))
      : []
    const laborSnapshots = tpl
      ? (tpl.labor_items ?? []).map((l) => ({
          description: l.description,
          hours: l.hours,
          rate: l.rate,
        }))
      : []

    if (isEditing && id) {
      await updateMutation.mutateAsync({ id, quote: quoteData, extras: extrasData, recipeSnapshots, laborSnapshots })
    } else {
      await createMutation.mutateAsync({ quote: quoteData, extras: extrasData, recipeSnapshots, laborSnapshots })
    }
    navigate('/quotes')
  }

  const quoteNumber = isEditing ? existingQuote?.quote_number : nextNumber

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">
          {isEditing ? `Editar ${quoteNumber}` : `Nuevo presupuesto ${nextNumber ? `— ${nextNumber}` : ''}`}
        </h1>
        {isEditing && (existingQuote?.recipe_snapshots?.length ?? 0) > 0 && (
          <span
            className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400"
            title="La receta quedó congelada al crear este presupuesto; cambios futuros en la plantilla no lo afectan."
          >
            Versión congelada
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-6">

          <ClientSection
            clients={clients}
            clientIdWatch={clientIdWatch}
            setValue={setValue}
            onAddClient={() => setClientDialogOpen(true)}
          />

          <FurnitureSection
            templates={templates}
            templateIdWatch={templateIdWatch}
            register={register}
            errors={errors}
            setValue={setValue}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Extras</h2>
            <QuoteExtrasFieldArray control={control} register={register} errors={errors} />
          </section>

          <MarginSection
            marginModeWatch={marginModeWatch}
            register={register}
            errors={errors}
            setValue={setValue}
          />

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
