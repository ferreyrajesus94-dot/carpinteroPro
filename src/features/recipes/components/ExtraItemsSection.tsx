import type { FieldArrayWithId, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
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
import type { Material } from '@/features/inventory/types'

// Local form shape used by MuebleForm
interface ItemValue {
  material_id: string
  quantity: number
}

interface FormValues {
  name: string
  notes?: string
  wood_items: ItemValue[]
  extra_items: ItemValue[]
}

interface ExtraItemsSectionProps {
  fields: FieldArrayWithId<FormValues, 'extra_items'>[]
  extraItemsWatch: ItemValue[]
  extraMaterials: Material[]
  allMaterials: Material[]
  register: UseFormRegister<FormValues>
  errors: FieldErrors<FormValues>
  setValue: UseFormSetValue<FormValues>
  onAppend: (value: ItemValue) => void
  onRemove: (index: number) => void
}

export function ExtraItemsSection({
  fields,
  extraItemsWatch,
  extraMaterials,
  allMaterials,
  register,
  errors,
  setValue,
  onAppend,
  onRemove,
}: ExtraItemsSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Gastos extras</h3>
      {fields.map((field, index) => {
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
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAppend({ material_id: '', quantity: 0 })}
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
  )
}
