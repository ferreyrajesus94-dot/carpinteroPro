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
import type { Material } from '@/shared/types/material'
import { computeWoodUsage } from '../lib/computeWoodUsage'
import { totalPieceAreaM2 } from '@/shared/lib/computeNesting'
import { formatARS } from '@/shared/lib/utils'
import { CutPiecesSection } from './CutPiecesSection'
import type { CutPieceDraft } from './CutPiecesSection'

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
export interface ItemValue {
  material_id: string
  quantity: number
  waste_pct?: number
  quantity_formula?: string
  cut_pieces?: CutPieceDraft[]
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
        const isPlaca = mat?.wood_subtype === 'placa' && mat?.unit === 'un'
        const cutPieces = woodItemsWatch[index]?.cut_pieces ?? []
        const hasCutPieces = isPlaca && cutPieces.length > 0

        // Si hay piezas definidas, la cantidad se auto-calcula desde ellas
        const qty = hasCutPieces
          ? totalPieceAreaM2(cutPieces.filter((p) => p.length_cm > 0 && p.width_cm > 0 && p.quantity > 0))
          : Number(woodItemsWatch[index]?.quantity) || 0

        const waste = Number(woodItemsWatch[index]?.waste_pct) || 0
        const qtyWithWaste = qty * (1 + waste / 100)
        const usage = mat ? computeWoodUsage(mat, qtyWithWaste) : null

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

              {/* Campo de cantidad: visible solo si NO hay piezas definidas */}
              {!hasCutPieces && (
                <div className="w-24 space-y-1">
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
              )}

              <div className="w-20 space-y-1">
                <Label className="text-xs text-muted-foreground">Merma %</Label>
                <Input
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  {...register(`wood_items.${index}.waste_pct`)}
                  placeholder="0"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            {usage && qty > 0 && usage.mode !== 'flat' && (
              <p className="text-xs text-muted-foreground pl-1">
                {hasCutPieces
                  ? `${qty.toFixed(3)} m² calculado desde piezas`
                  : hintFor(usage)}{' '}
                · {formatARS(usage.subtotal)}
              </p>
            )}

            <Input
              className="text-xs"
              placeholder="Fórmula opcional (ej: largo_cm / 100)"
              {...register(`wood_items.${index}.quantity_formula` as const)}
            />

            {/* Sección de piezas a cortar: solo para placas con unidad 'un' */}
            {isPlaca && (
              <CutPiecesSection
                pieces={cutPieces}
                boardLength={mat?.length_cm ?? null}
                boardWidth={mat?.width_cm ?? null}
                onChange={(newPieces) => {
                  setValue(`wood_items.${index}.cut_pieces`, newPieces)
                  // Sincronizar cantidad con el área total de las piezas
                  const area = totalPieceAreaM2(
                    newPieces.filter((p) => p.length_cm > 0 && p.width_cm > 0 && p.quantity > 0),
                  )
                  if (area > 0) setValue(`wood_items.${index}.quantity`, area)
                }}
              />
            )}
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onAppend({ material_id: '', quantity: 0, waste_pct: 0, quantity_formula: '', cut_pieces: [] })}
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
