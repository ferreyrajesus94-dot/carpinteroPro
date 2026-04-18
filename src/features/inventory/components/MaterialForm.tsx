import { useEffect, useRef, useState } from 'react'
import { useForm, Controller, type Resolver } from 'react-hook-form'
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
import { MATERIAL_CATEGORIES, UNITS_OF_MEASURE, WOOD_SUBTYPES } from '../types'

const optionalPositiveNumber = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : v
  },
  z.union([z.null(), z.number().positive('Debe ser > 0')]),
)

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
  wood_subtype: z.enum(['placa', 'liston', 'tirante', 'columna']).nullable().optional(),
  length_cm: optionalPositiveNumber,
  width_cm: optionalPositiveNumber,
  thickness_cm: optionalPositiveNumber,
  volume_ml: optionalPositiveNumber,
  pack_size: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : v
    },
    z.union([z.null(), z.number().int('Debe ser entero').min(2, 'Debe ser ≥ 2')]),
  ),
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
    control,
    watch,
    reset,
    setValue,
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
      wood_subtype: null,
      length_cm: null,
      width_cm: null,
      thickness_cm: null,
      volume_ml: null,
      pack_size: null,
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
        wood_subtype: material.wood_subtype ?? null,
        length_cm: material.length_cm ?? null,
        width_cm: material.width_cm ?? null,
        thickness_cm: material.thickness_cm ?? null,
        volume_ml: material.volume_ml ?? null,
        pack_size: material.pack_size ?? null,
      })
    }
  }, [material, reset])

  async function onSubmit(values: FormValues) {
    // Limpia campos no aplicables a la categoría antes de guardar
    const isWood = values.category === 'madera'
    const isLiquid = values.category === 'pintura' || values.category === 'adhesivo'
    const payload = {
      ...values,
      wood_subtype: isWood ? values.wood_subtype ?? null : null,
      length_cm: isWood ? values.length_cm ?? null : null,
      width_cm: isWood ? values.width_cm ?? null : null,
      thickness_cm: isWood ? values.thickness_cm ?? null : null,
      volume_ml: isLiquid ? values.volume_ml ?? null : null,
      pack_size: values.pack_size ?? null,
    }
    if (isEditing && material) {
      await updateMutation.mutateAsync({ id: material.id, data: payload })
    } else {
      await createMutation.mutateAsync(payload)
    }
    onSuccess()
  }

  const category = watch('category')
  const isWood = category === 'madera'
  const isLiquid = category === 'pintura' || category === 'adhesivo'

  // Pack price sincronizado con price_per_unit × pack_size
  const priceUnit = watch('price_per_unit')
  const packSize = watch('pack_size')
  const [packPriceStr, setPackPriceStr] = useState('')
  const lastEdit = useRef<'unit' | 'pack' | null>(null)

  useEffect(() => {
    if (lastEdit.current === 'pack') {
      lastEdit.current = null
      return
    }
    const size = typeof packSize === 'number' ? packSize : Number(packSize)
    const unit = typeof priceUnit === 'number' ? priceUnit : Number(priceUnit)
    if (size && size >= 2 && Number.isFinite(unit)) {
      const derived = Math.round(unit * size * 100) / 100
      setPackPriceStr(derived ? String(derived) : '')
    } else {
      setPackPriceStr('')
    }
  }, [priceUnit, packSize])

  const onPackPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value
    setPackPriceStr(str)
    const num = Number(str)
    const size = typeof packSize === 'number' ? packSize : Number(packSize)
    if (size && size >= 2 && Number.isFinite(num)) {
      lastEdit.current = 'pack'
      // 4 decimales de precisión interna para evitar drift al redondear
      const newUnit = Math.round((num / size) * 10000) / 10000
      setValue('price_per_unit', newUnit, { shouldValidate: false, shouldDirty: true })
    }
  }

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
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
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
            )}
          />
        </div>

        {/* Unidad */}
        <div className="space-y-1">
          <Label>Unidad de medida</Label>
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
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
            )}
          />
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

      {/* Sección presentación: pack opcional */}
      <div className="space-y-3 rounded-md border border-border/60 p-3">
        <p className="text-sm font-medium">Presentación (opcional)</p>
        <p className="text-xs text-muted-foreground -mt-2">
          Si el material se compra en pack (ej: listones de a 10), indicá cuántas unidades trae.
          El stock se maneja siempre en unidades.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pack_size">Unidades por pack</Label>
            <Input
              id="pack_size"
              type="number"
              min="2"
              step="1"
              placeholder="Ej: 10"
              {...register('pack_size')}
            />
            {errors.pack_size && (
              <p className="text-destructive text-xs">{errors.pack_size.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="pack_price">Precio por pack (ARS)</Label>
            <Input
              id="pack_price"
              type="number"
              min="0"
              step="0.01"
              placeholder={packSize ? 'Se recalcula en vivo' : 'Cargá primero las unidades'}
              value={packPriceStr}
              onChange={onPackPriceChange}
              disabled={!packSize || (typeof packSize === 'number' && packSize < 2)}
            />
            <p className="text-xs text-muted-foreground">
              Editar este campo recalcula el precio unitario automáticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Sección madera: subtipo + medidas */}
      {isWood && (
        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <p className="text-sm font-medium">Medidas de la pieza de stock</p>

          <div className="space-y-1">
            <Label>Tipo de madera</Label>
            <Controller
              control={control}
              name="wood_subtype"
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => field.onChange(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un tipo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {WOOD_SUBTYPES.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="length_cm">Largo (cm)</Label>
              <Input
                id="length_cm"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ej: 260"
                {...register('length_cm')}
              />
              {errors.length_cm && (
                <p className="text-destructive text-xs">{errors.length_cm.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="width_cm">Ancho (cm)</Label>
              <Input
                id="width_cm"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ej: 183"
                {...register('width_cm')}
              />
              {errors.width_cm && (
                <p className="text-destructive text-xs">{errors.width_cm.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="thickness_cm">Espesor (cm)</Label>
              <Input
                id="thickness_cm"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ej: 1.8"
                {...register('thickness_cm')}
              />
              {errors.thickness_cm && (
                <p className="text-destructive text-xs">{errors.thickness_cm.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sección líquidos: volumen por envase */}
      {isLiquid && (
        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <p className="text-sm font-medium">Volumen por envase</p>
          <div className="space-y-1">
            <Label htmlFor="volume_ml">Volumen (ml)</Label>
            <Input
              id="volume_ml"
              type="number"
              min="0"
              step="1"
              placeholder="Ej: 4000 (lata de 4 L)"
              {...register('volume_ml')}
            />
            {errors.volume_ml && (
              <p className="text-destructive text-xs">{errors.volume_ml.message}</p>
            )}
          </div>
        </div>
      )}

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
