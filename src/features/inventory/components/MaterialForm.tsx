import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { useCreateMaterial, useUpdateMaterial } from '../hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import type { Material } from '../types'
import { MATERIAL_CATEGORIES, UNITS_OF_MEASURE } from '../types'

const materialSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  category: z.enum([
    'madera', 'herraje', 'pintura', 'adhesivo', 'vidrio', 'tela', 'otro',
  ]),
  unit: z.enum([
    'ml', 'l', 'g', 'kg', 'cm', 'm', 'cm2', 'm2', 'cm3', 'm3', 'un',
  ]),
  price_per_unit: z.coerce.number().min(0, 'Debe ser ≥ 0'),
  stock: z.coerce.number().min(0, 'Debe ser ≥ 0'),
  min_stock: z.coerce.number().min(0, 'Debe ser ≥ 0').default(0),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof materialSchema>

interface MaterialFormProps {
  material?: Material | null
  onSuccess: () => void
  onCancel: () => void
}

export function MaterialForm({ material, onSuccess, onCancel }: MaterialFormProps) {
  const workshopId = useWorkshopId()
  const createMutation = useCreateMaterial(workshopId)
  const updateMutation = useUpdateMaterial(workshopId)
  const isEditing = Boolean(material)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(materialSchema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      category: 'madera',
      unit: 'un',
      price_per_unit: 0,
      stock: 0,
      min_stock: 0,
      notes: '',
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (material) {
      reset({
        name: material.name,
        category: material.category,
        unit: material.unit,
        price_per_unit: material.price_per_unit,
        stock: material.stock,
        min_stock: material.min_stock,
        notes: material.notes ?? '',
      })
    }
  }, [material, reset])

  async function onSubmit(values: FormValues) {
    if (isEditing && material) {
      await updateMutation.mutateAsync({ id: material.id, data: values })
    } else {
      await createMutation.mutateAsync(values)
    }
    onSuccess()
  }

  const category = watch('category')
  const unit = watch('unit')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Nombre */}
      <div className="space-y-1">
        <Label htmlFor="name">Nombre del material</Label>
        <Input id="name" {...register('name')} placeholder="Ej: Madera MDF 18mm" />
        {errors.name && (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Categoría */}
        <div className="space-y-1">
          <Label>Categoría</Label>
          <Select
            value={category}
            onValueChange={(v) => setValue('category', v as FormValues['category'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unidad */}
        <div className="space-y-1">
          <Label>Unidad de medida</Label>
          <Select
            value={unit}
            onValueChange={(v) => setValue('unit', v as FormValues['unit'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS_OF_MEASURE.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Precio */}
        <div className="space-y-1">
          <Label htmlFor="price">Precio/u (ARS)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            {...register('price_per_unit')}
          />
          {errors.price_per_unit && (
            <p className="text-destructive text-xs">{errors.price_per_unit.message}</p>
          )}
        </div>

        {/* Stock actual */}
        <div className="space-y-1">
          <Label htmlFor="stock">Stock actual</Label>
          <Input id="stock" type="number" min="0" step="0.01" {...register('stock')} />
          {errors.stock && (
            <p className="text-destructive text-xs">{errors.stock.message}</p>
          )}
        </div>

        {/* Stock mínimo */}
        <div className="space-y-1">
          <Label htmlFor="min_stock">Stock mínimo</Label>
          <Input
            id="min_stock"
            type="number"
            min="0"
            step="0.01"
            {...register('min_stock')}
          />
          {errors.min_stock && (
            <p className="text-destructive text-xs">{errors.min_stock.message}</p>
          )}
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Proveedor, especificaciones, etc."
          rows={2}
        />
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Agregar material'}
        </Button>
      </div>
    </form>
  )
}
