import { useMemo } from 'react'
import type { FieldArrayWithId, UseFormRegister, FieldErrors } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import type { Material } from '@/shared/types/material'
import { computeAreaByMaterial } from '../lib/computePieceArea'

export interface PieceFormValue {
  material_id?: string | null
  piece_name: string
  length_cm: number
  width_cm: number
  thickness_mm?: number | null
  quantity: number
  notes?: string | null
}

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
  pieces: PieceFormValue[]
}

interface PiecesSectionProps {
  fields: FieldArrayWithId<FormValues, 'pieces'>[]
  piecesWatch: PieceFormValue[]
  materials: Material[]
  register: UseFormRegister<FormValues>
  errors: FieldErrors<FormValues>
  onAppend: (value: PieceFormValue) => void
  onRemove: (index: number) => void
}

export function PiecesSection({
  fields,
  piecesWatch,
  materials,
  register,
  errors,
  onAppend,
  onRemove,
}: PiecesSectionProps) {
  const totals = useMemo(() => computeAreaByMaterial(piecesWatch ?? []), [piecesWatch])
  const totalPieces = (piecesWatch ?? []).reduce((s, p) => s + (Number(p.quantity) || 0), 0)
  const totalM2 = totals.reduce((s, t) => s + t.totalM2, 0)

  return (
    <section className="space-y-3 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Despiece (cortes)</h3>
          <p className="text-xs text-muted-foreground">
            Lista de piezas físicas que componen el mueble. Aparecen en la hoja de taller que descargan los empleados.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onAppend({
              piece_name: '',
              length_cm: 0,
              width_cm: 0,
              thickness_mm: null,
              quantity: 1,
              material_id: null,
              notes: '',
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar pieza
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sin piezas cargadas. La hoja de taller mostrará un aviso de "despiece no cargado".
        </p>
      )}

      {fields.map((field, index) => (
        <div key={field.id} className="space-y-1 rounded border bg-muted/20 p-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre de la pieza</Label>
              <Input
                {...register(`pieces.${index}.piece_name`)}
                placeholder="Ej: Lateral izquierdo"
              />
              {errors.pieces?.[index]?.piece_name && (
                <p className="text-destructive text-xs">
                  {errors.pieces[index]?.piece_name?.message}
                </p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Largo (cm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                {...register(`pieces.${index}.length_cm`)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ancho (cm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                {...register(`pieces.${index}.width_cm`)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Espesor (mm)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                {...register(`pieces.${index}.thickness_mm`)}
                placeholder="18"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cantidad</Label>
              <Input
                type="number"
                step="1"
                min="1"
                {...register(`pieces.${index}.quantity`)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Material</Label>
              <select
                {...register(`pieces.${index}.material_id`)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— Sin material —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
            <Input
              {...register(`pieces.${index}.notes`)}
              placeholder="Veta, canto, instrucciones especiales…"
            />
          </div>
        </div>
      ))}

      {fields.length > 0 && (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <div className="flex justify-between">
            <span className="font-semibold">Total piezas</span>
            <span>{totalPieces}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">Total m²</span>
            <span>{totalM2.toFixed(2)} m²</span>
          </div>
          {totals.length > 1 && (
            <div className="mt-1 space-y-0.5 border-t pt-1">
              {totals.map((t) => {
                const matName = t.materialId
                  ? materials.find((m) => m.id === t.materialId)?.name ?? 'Material desconocido'
                  : 'Sin material'
                return (
                  <div key={t.materialId ?? 'none'} className="flex justify-between text-muted-foreground">
                    <span>{matName}</span>
                    <span>
                      {t.totalM2.toFixed(2)} m² · {t.pieces} pieza{t.pieces === 1 ? '' : 's'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
