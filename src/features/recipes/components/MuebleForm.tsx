import { useEffect } from 'react'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useMaterials } from '@/shared/hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateFurnitureTemplate, useUpdateFurnitureTemplate } from '../hooks/useRecipes'
import { useWorkshopSettings } from '@/shared/hooks/useWorkshopSettings'
import { RecipeCostPreview } from './RecipeCostPreview'
import { StockAlertBanner } from './StockAlertBanner'
import { useStockCheck } from '../hooks/useStockCheck'
import { WoodItemsSection } from './WoodItemsSection'
import { ExtraItemsSection } from './ExtraItemsSection'
import { LaborItemsSection } from './LaborItemsSection'
import { PiecesSection } from './PiecesSection'
import type { FurnitureTemplateWithItems } from '../types'

const itemSchema = z.object({
  material_id: z.string().min(1, 'Seleccioná un material'),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
  waste_pct: z.coerce.number().min(0).max(99).optional(),
  quantity_formula: z.string().optional(),
})

const paramSchema = z.object({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Nombre inválido'),
  default: z.coerce.number(),
})

const laborSchema = z.object({
  description: z.string().min(1, 'Descripción obligatoria'),
  hours: z.coerce.number().positive('Horas > 0'),
  rate: z.coerce.number().min(0, 'Tarifa ≥ 0'),
})

const pieceSchema = z.object({
  material_id: z.string().nullable().optional(),
  piece_name: z.string().min(1, 'Nombre obligatorio'),
  length_cm: z.coerce.number().positive('Largo > 0'),
  width_cm: z.coerce.number().positive('Ancho > 0'),
  thickness_mm: z.coerce.number().nullable().optional(),
  quantity: z.coerce.number().int().positive('Cantidad ≥ 1'),
  notes: z.string().nullable().optional(),
})

const muebleSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  notes: z.string().optional(),
  category: z.string().optional(),
  tags_csv: z.string().optional(),
  height_cm: z.coerce.number().optional(),
  width_cm: z.coerce.number().optional(),
  depth_cm: z.coerce.number().optional(),
  photo_url: z.string().optional(),
  suggested_margin_pct: z.coerce.number().min(0).max(99).optional(),
  params: z.array(paramSchema),
  wood_items: z.array(itemSchema),
  extra_items: z.array(itemSchema),
  labor_items: z.array(laborSchema),
  pieces: z.array(pieceSchema),
})

type FormValues = z.infer<typeof muebleSchema>

interface MuebleFormProps {
  template?: FurnitureTemplateWithItems | null
  onSuccess: () => void
  onCancel: () => void
}

export function MuebleForm({ template, onSuccess, onCancel }: MuebleFormProps) {
  const workshopId = useWorkshopId()
  const isEditing = Boolean(template)

  const { data: allMaterials = [] } = useMaterials(workshopId)
  const { data: workshopSettings } = useWorkshopSettings(workshopId)
  const defaultLaborRate = workshopSettings?.default_labor_rate ?? 0
  const woodMaterials = allMaterials.filter((m) => m.category === 'madera')
  const extraMaterials = allMaterials.filter((m) => m.category !== 'madera')

  const createMutation = useCreateFurnitureTemplate(workshopId)
  const updateMutation = useUpdateFurnitureTemplate(workshopId)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(muebleSchema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      notes: '',
      category: '',
      tags_csv: '',
      height_cm: undefined,
      width_cm: undefined,
      depth_cm: undefined,
      photo_url: '',
      suggested_margin_pct: undefined,
      params: [],
      wood_items: [],
      extra_items: [],
      labor_items: [],
      pieces: [],
    },
  })

  const { fields: paramFields, append: appendParam, remove: removeParam } = useFieldArray({
    control,
    name: 'params',
  })
  const { fields: woodFields, append: appendWood, remove: removeWood } = useFieldArray({
    control,
    name: 'wood_items',
  })
  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control,
    name: 'extra_items',
  })
  const { fields: laborFields, append: appendLabor, remove: removeLabor } = useFieldArray({
    control,
    name: 'labor_items',
  })
  const { fields: pieceFields, append: appendPiece, remove: removePiece } = useFieldArray({
    control,
    name: 'pieces',
  })

  useEffect(() => {
    if (template) {
      const woodItems = template.recipe_items
        .filter((i) => i.material.category === 'madera')
        .map((i) => ({
          material_id: i.material_id,
          quantity: i.quantity,
          waste_pct: i.waste_pct,
          quantity_formula: i.quantity_formula ?? '',
        }))
      const extraItems = template.recipe_items
        .filter((i) => i.material.category !== 'madera')
        .map((i) => ({
          material_id: i.material_id,
          quantity: i.quantity,
          waste_pct: i.waste_pct,
          quantity_formula: i.quantity_formula ?? '',
        }))
      const laborItems = (template.labor_items ?? []).map((l) => ({
        description: l.description,
        hours: l.hours,
        rate: l.rate,
      }))
      const pieces = (template.recipe_pieces ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({
          material_id: p.material_id ?? null,
          piece_name: p.piece_name,
          length_cm: p.length_cm,
          width_cm: p.width_cm,
          thickness_mm: p.thickness_mm ?? null,
          quantity: p.quantity,
          notes: p.notes ?? '',
        }))

      reset({
        name: template.name,
        notes: template.notes ?? '',
        category: template.category ?? '',
        tags_csv: (template.tags ?? []).join(', '),
        height_cm: template.height_cm ?? undefined,
        width_cm: template.width_cm ?? undefined,
        depth_cm: template.depth_cm ?? undefined,
        photo_url: template.photo_url ?? '',
        suggested_margin_pct: template.suggested_margin_pct ?? undefined,
        params: (template.params ?? []).map((p) => ({ name: p.name, default: p.default })),
        wood_items: woodItems,
        extra_items: extraItems,
        labor_items: laborItems,
        pieces,
      })
    }
  }, [template, reset])

  const woodItemsWatch = watch('wood_items')
  const extraItemsWatch = watch('extra_items')
  const laborItemsWatch = watch('labor_items')
  const piecesWatch = watch('pieces')
  const photoUrlWatch = watch('photo_url')
  const suggestedMarginWatch = watch('suggested_margin_pct')
  const paramsWatch = watch('params')

  const paramValues: Record<string, number> = {}
  for (const p of paramsWatch ?? []) {
    if (p?.name) paramValues[p.name] = Number(p.default) || 0
  }

  const stockCheck = useStockCheck([
    ...(woodItemsWatch ?? []),
    ...(extraItemsWatch ?? []),
  ])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setValue('photo_url', reader.result as string)
    reader.readAsDataURL(file)
  }

  async function onSubmit(values: FormValues) {
    const items = [
      ...values.wood_items.map((i) => ({
        material_id: i.material_id,
        quantity: i.quantity,
        waste_pct: i.waste_pct ?? 0,
        quantity_formula: i.quantity_formula?.trim() || null,
      })),
      ...values.extra_items.map((i) => ({
        material_id: i.material_id,
        quantity: i.quantity,
        waste_pct: i.waste_pct ?? 0,
        quantity_formula: i.quantity_formula?.trim() || null,
      })),
    ]
    const laborItems = values.labor_items.map((l) => ({
      description: l.description,
      hours: l.hours,
      rate: l.rate,
    }))

    const pieces = values.pieces.map((p, idx) => ({
      material_id: p.material_id?.toString().trim() ? p.material_id : null,
      piece_name: p.piece_name,
      length_cm: p.length_cm,
      width_cm: p.width_cm,
      thickness_mm: p.thickness_mm ?? null,
      quantity: p.quantity,
      notes: p.notes?.toString().trim() || null,
      sort_order: idx,
    }))

    const tags = (values.tags_csv ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const baseFields = {
      name: values.name,
      notes: values.notes || null,
      category: values.category?.trim() || null,
      tags,
      height_cm: values.height_cm || null,
      width_cm: values.width_cm || null,
      depth_cm: values.depth_cm || null,
      photo_url: values.photo_url || null,
      suggested_margin_pct: values.suggested_margin_pct ?? null,
      params: values.params.map((p) => ({ name: p.name, default: p.default })),
    }

    if (isEditing && template) {
      await updateMutation.mutateAsync({
        id: template.id,
        template: baseFields,
        items,
        laborItems,
        pieces,
      })
    } else {
      await createMutation.mutateAsync({
        template: { ...baseFields, workshop_id: workshopId },
        items,
        laborItems,
        pieces,
      })
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre del mueble</Label>
        <Input id="name" {...register('name')} placeholder="Ej: Ropero 2 puertas" />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="category">Categoría</Label>
          <Input id="category" {...register('category')} placeholder="Ej: mesas, placares" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tags_csv">Tags (separados por coma)</Label>
          <Input id="tags_csv" {...register('tags_csv')} placeholder="madera dura, melamina" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="height_cm">Alto (cm)</Label>
          <Input id="height_cm" type="number" step="0.1" {...register('height_cm')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="width_cm">Ancho (cm)</Label>
          <Input id="width_cm" type="number" step="0.1" {...register('width_cm')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="depth_cm">Profundidad (cm)</Label>
          <Input id="depth_cm" type="number" step="0.1" {...register('depth_cm')} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="photo">Foto del mueble</Label>
          <Input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>
        {photoUrlWatch ? (
          <img src={photoUrlWatch} alt="Preview" className="h-16 w-16 rounded-md object-cover border" />
        ) : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor="suggested_margin_pct">Margen sugerido (%)</Label>
        <Input
          id="suggested_margin_pct"
          type="number"
          step="1"
          min="0"
          max="99"
          {...register('suggested_margin_pct')}
          placeholder="Ej: 40"
        />
        {errors.suggested_margin_pct && (
          <p className="text-destructive text-xs">{errors.suggested_margin_pct.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" {...register('notes')} placeholder="Detalles de fabricación, variantes, etc." rows={2} />
      </div>

      <section className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Parámetros (opcional)</h3>
            <p className="text-xs text-muted-foreground">
              Variables para fórmulas. Ej: <code>largo_cm</code> = 120. Usalas como cantidad en items: <code>largo_cm / 100</code>.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendParam({ name: '', default: 0 })}
          >
            Agregar
          </Button>
        </div>
        {paramFields.map((f, idx) => (
          <div key={f.id} className="grid grid-cols-[1fr_120px_auto] gap-2 items-start">
            <div className="space-y-1">
              <Input
                placeholder="nombre (ej: largo_cm)"
                {...register(`params.${idx}.name` as const)}
              />
              {errors.params?.[idx]?.name && (
                <p className="text-destructive text-xs">{errors.params[idx]?.name?.message}</p>
              )}
            </div>
            <Input
              type="number"
              step="any"
              placeholder="valor por defecto"
              {...register(`params.${idx}.default` as const)}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeParam(idx)}>
              Quitar
            </Button>
          </div>
        ))}
      </section>

      <WoodItemsSection
        fields={woodFields}
        woodItemsWatch={woodItemsWatch}
        woodMaterials={woodMaterials}
        allMaterials={allMaterials}
        register={register}
        errors={errors}
        setValue={setValue}
        onAppend={appendWood}
        onRemove={removeWood}
      />

      <ExtraItemsSection
        fields={extraFields}
        extraItemsWatch={extraItemsWatch}
        extraMaterials={extraMaterials}
        allMaterials={allMaterials}
        register={register}
        errors={errors}
        setValue={setValue}
        onAppend={appendExtra}
        onRemove={removeExtra}
      />

      <LaborItemsSection
        fields={laborFields}
        laborItemsWatch={laborItemsWatch}
        register={register}
        errors={errors}
        onAppend={appendLabor}
        onRemove={removeLabor}
        defaultRate={defaultLaborRate}
      />

      <PiecesSection
        fields={pieceFields}
        piecesWatch={piecesWatch}
        materials={allMaterials}
        register={register}
        errors={errors}
        onAppend={appendPiece}
        onRemove={removePiece}
      />

      <StockAlertBanner check={stockCheck} showOk />

      <RecipeCostPreview
        woodItems={woodItemsWatch}
        extraItems={extraItemsWatch}
        laborItems={laborItemsWatch}
        materials={allMaterials}
        paramValues={paramValues}
        suggestedMarginPct={
          typeof suggestedMarginWatch === 'number' && !Number.isNaN(suggestedMarginWatch)
            ? suggestedMarginWatch
            : null
        }
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear mueble'}
        </Button>
      </div>
    </form>
  )
}
