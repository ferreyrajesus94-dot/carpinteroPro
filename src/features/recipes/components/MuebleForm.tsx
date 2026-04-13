import { useEffect } from 'react'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
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
import { useMaterials } from '@/features/inventory/hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateFurnitureTemplate, useUpdateFurnitureTemplate } from '../hooks/useRecipes'
import { RecipeCostPreview } from './RecipeCostPreview'
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

  // Poblar el formulario cuando se edita
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
      {/* Nombre */}
      <div className="space-y-1">
        <Label htmlFor="name">Nombre del mueble</Label>
        <Input id="name" {...register('name')} placeholder="Ej: Ropero 2 puertas" />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" {...register('notes')} placeholder="Medidas, variantes, etc." rows={2} />
      </div>

      {/* Sección Maderas */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Maderas</h3>
        {woodFields.map((field, index) => {
          const mat = allMaterials.find((m) => m.id === woodItemsWatch[index]?.material_id)
          return (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Select
                  value={woodItemsWatch[index]?.material_id ?? ''}
                  onValueChange={(v) => setValue(`wood_items.${index}.material_id`, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná madera" />
                  </SelectTrigger>
                  <SelectContent>
                    {woodMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.wood_items?.[index]?.material_id && (
                  <p className="text-destructive text-xs">
                    {errors.wood_items[index]?.material_id?.message}
                  </p>
                )}
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Cantidad {mat ? `(${mat.unit})` : ''}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`wood_items.${index}.quantity`)}
                  placeholder="0"
                />
                {errors.wood_items?.[index]?.quantity && (
                  <p className="text-destructive text-xs">
                    {errors.wood_items[index]?.quantity?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeWood(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendWood({ material_id: '', quantity: 0 })}
          disabled={woodMaterials.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar madera
        </Button>
        {woodMaterials.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay maderas en el inventario. Agregá materiales de categoría "Madera" primero.
          </p>
        )}
      </div>

      {/* Sección Gastos extras */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Gastos extras</h3>
        {extraFields.map((field, index) => {
          const mat = allMaterials.find((m) => m.id === extraItemsWatch[index]?.material_id)
          return (
            <div key={field.id} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Select
                  value={extraItemsWatch[index]?.material_id ?? ''}
                  onValueChange={(v) => setValue(`extra_items.${index}.material_id`, v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná extra" />
                  </SelectTrigger>
                  <SelectContent>
                    {extraMaterials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.extra_items?.[index]?.material_id && (
                  <p className="text-destructive text-xs">
                    {errors.extra_items[index]?.material_id?.message}
                  </p>
                )}
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Cantidad {mat ? `(${mat.unit})` : ''}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register(`extra_items.${index}.quantity`)}
                  placeholder="0"
                />
                {errors.extra_items?.[index]?.quantity && (
                  <p className="text-destructive text-xs">
                    {errors.extra_items[index]?.quantity?.message}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExtra(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendExtra({ material_id: '', quantity: 0 })}
          disabled={extraMaterials.length === 0}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar gasto extra
        </Button>
        {extraMaterials.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No hay extras en el inventario. Agregá materiales de otra categoría primero.
          </p>
        )}
      </div>

      {/* Preview de costo */}
      <RecipeCostPreview
        woodItems={woodItemsWatch}
        extraItems={extraItemsWatch}
        materials={allMaterials}
      />

      {/* Acciones */}
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
