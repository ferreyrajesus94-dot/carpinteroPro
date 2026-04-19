import type { FieldArrayWithId, UseFormRegister, FieldErrors } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { formatARS } from '@/shared/lib/utils'

interface ItemValue {
  material_id: string
  quantity: number
  waste_pct?: number
  quantity_formula?: string
}

interface ParamValue {
  name: string
  default: number
}

interface LaborValue {
  description: string
  hours: number
  rate: number
}

interface FormValues {
  name: string
  notes?: string
  category?: string
  tags_csv?: string
  height_cm?: number
  width_cm?: number
  depth_cm?: number
  photo_url?: string
  suggested_margin_pct?: number
  params: ParamValue[]
  wood_items: ItemValue[]
  extra_items: ItemValue[]
  labor_items: LaborValue[]
}

interface LaborItemsSectionProps {
  fields: FieldArrayWithId<FormValues, 'labor_items'>[]
  laborItemsWatch: LaborValue[]
  register: UseFormRegister<FormValues>
  errors: FieldErrors<FormValues>
  onAppend: (value: LaborValue) => void
  onRemove: (index: number) => void
  defaultRate: number
}

export function LaborItemsSection({
  fields,
  laborItemsWatch,
  register,
  errors,
  onAppend,
  onRemove,
  defaultRate,
}: LaborItemsSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Mano de obra</h3>
      {fields.map((field, index) => {
        const hours = Number(laborItemsWatch[index]?.hours) || 0
        const rate = Number(laborItemsWatch[index]?.rate) || 0
        const subtotal = hours * rate
        return (
          <div key={field.id} className="space-y-1">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Descripción</Label>
                <Input
                  {...register(`labor_items.${index}.description`)}
                  placeholder="Ej: Armado y lustrado"
                />
                {errors.labor_items?.[index]?.description && (
                  <p className="text-destructive text-xs">
                    {errors.labor_items[index]?.description?.message}
                  </p>
                )}
              </div>
              <div className="w-20 space-y-1">
                <Label className="text-xs text-muted-foreground">Horas</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  {...register(`labor_items.${index}.hours`)}
                  placeholder="0"
                />
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-xs text-muted-foreground">Tarifa/h</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  {...register(`labor_items.${index}.rate`)}
                  placeholder="0"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            {subtotal > 0 && (
              <p className="text-xs text-muted-foreground pl-1">{formatARS(subtotal)}</p>
            )}
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAppend({ description: '', hours: 1, rate: defaultRate || 0 })}
      >
        <Plus className="h-4 w-4 mr-1" />
        Agregar mano de obra
      </Button>
    </div>
  )
}
