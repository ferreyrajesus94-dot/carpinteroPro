import { useEffect } from 'react'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useMaterials } from '@/features/inventory/hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateFurnitureTemplate, useUpdateFurnitureTemplate } from '../hooks/useRecipes'
import { RecipeCostPreview } from './RecipeCostPreview'
import { WoodItemsSection } from './WoodItemsSection'
import { ExtraItemsSection } from './ExtraItemsSection'
import type { FurnitureTemplateWithItems } from '../types'

const itemSchema = z.object({
  material_id: z.string().min(1, 'Seleccioná un material'),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor a 0'),
})

const muebleSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  notes: z.string().optional(),
  wood_items: z.array(itemSchema),
  extra_items: z.array(itemSchema),
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
    defaultValues: { name: '', notes: '', wood_items: [], extra_items: [] },
  })

  const { fields: woodFields, append: appendWood, remove: removeWood } = useFieldArray({
    control,
    name: 'wood_items',
  })
  const { fields: extraFields, append: appendExtra, remove: removeExtra } = useFieldArray({
    control,
    name: 'extra_items',
  })

  useEffect(() => {
    if (template) {
      const woodItems = template.recipe_items
        .filter((i) => i.material.category === 'madera')
        .map((i) => ({ material_id: i.material_id, quantity: i.quantity }))
      const extraItems = template.recipe_items
        .filter((i) => i.material.category !== 'madera')
        .map((i) => ({ material_id: i.material_id, quantity: i.quantity }))

      reset({
        name: template.name,
        notes: template.notes ?? '',
        wood_items: woodItems,
        extra_items: extraItems,
      })
    }
  }, [template, reset])

  const woodItemsWatch = watch('wood_items')
  const extraItemsWatch = watch('extra_items')

  async function onSubmit(values: FormValues) {
    const items = [
      ...values.wood_items.map((i) => ({ material_id: i.material_id, quantity: i.quantity })),
      ...values.extra_items.map((i) => ({ material_id: i.material_id, quantity: i.quantity })),
    ]

    if (isEditing && template) {
      await updateMutation.mutateAsync({
        id: template.id,
        template: { name: values.name, notes: values.notes || null },
        items,
      })
    } else {
      await createMutation.mutateAsync({
        template: { name: values.name, notes: values.notes || null, workshop_id: workshopId },
        items,
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

      <div className="space-y-1">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" {...register('notes')} placeholder="Medidas, variantes, etc." rows={2} />
      </div>

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

      <RecipeCostPreview
        woodItems={woodItemsWatch}
        extraItems={extraItemsWatch}
        materials={allMaterials}
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
