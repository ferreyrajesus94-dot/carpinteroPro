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
import { computeWoodUsage } from '../lib/computeWoodUsage'
import { formatARS } from '@/shared/lib/utils'

function labelFor(mode: string, unit: string): string {
  if (mode === 'placa-pieces' || mode === 'placa-area') return 'Área (m²)'
  if (mode === 'lineal-pieces' || mode === 'lineal-meters') return 'Metros (m)'
  return `Cantidad (${unit})`
}

function hintFor(u: { mode: string; piecesNeeded: number | null; pieceLabel: string | null }): string {
  if (u.mode === 'placa-pieces' && u.piecesNeeded != null) {
    return `≈ ${u.piecesNeeded} placa${u.piecesNeeded === 1 ? '' : 's'}${u.pieceLabel ? ` de ${u.pieceLabel}` : ''}`
  }
  if (u.mode === 'lineal-pieces' && u.piecesNeeded != null) {
    return `≈ ${u.piecesNeeded} pieza${u.piecesNeeded === 1 ? '' : 's'}${u.pieceLabel ? ` de ${u.pieceLabel}` : ''}`
  }
  if (u.mode === 'placa-area') return `Cobro por m²${u.pieceLabel ? ` (placas de ${u.pieceLabel})` : ''}`
  if (u.mode === 'lineal-meters') return 'Cobro por metro lineal'
  return ''
}

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

interface WoodItemsSectionProps {
  fields: FieldArrayWithId<FormValues, 'wood_items'>[]
  woodItemsWatch: ItemValue[]
  woodMaterials: Material[]
  allMaterials: Material[]
  register: UseFormRegister<FormValues>
  errors: FieldErrors<FormValues>
  setValue: UseFormSetValue<FormValues>
  onAppend: (value: ItemValue) => void
  onRemove: (index: number) => void
}

export function WoodItemsSection({
  fields,
  woodItemsWatch,
  woodMaterials,
  allMaterials,
  register,
  errors,
  setValue,
  onAppend,
  onRemove,
}: WoodItemsSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Maderas</h3>
      {fields.map((field, index) => {
        const mat = allMaterials.find((m) => m.id === woodItemsWatch[index]?.material_id)
        const qty = Number(woodItemsWatch[index]?.quantity) || 0
        const usage = mat ? computeWoodUsage(mat, qty) : null
        return (
          <div key={field.id} className="space-y-1">
            <div className="flex items-end gap-2">
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
                  {usage ? labelFor(usage.mode, usage.inputUnitLabel) : 'Cantidad'}
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
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            {usage && qty > 0 && usage.mode !== 'flat' && (
              <p className="text-xs text-muted-foreground pl-1">
                {hintFor(usage)} · {formatARS(usage.subtotal)}
              </p>
            )}
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAppend({ material_id: '', quantity: 0 })}
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
  )
}
