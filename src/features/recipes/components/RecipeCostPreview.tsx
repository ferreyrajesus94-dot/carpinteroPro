import { formatARS } from '@/shared/lib/utils'
import type { Material } from '@/features/inventory/types'

interface ItemDraft {
  material_id: string
  quantity: number
}

interface RecipeCostPreviewProps {
  woodItems: ItemDraft[]
  extraItems: ItemDraft[]
  materials: Material[]
}

export function RecipeCostPreview({ woodItems, extraItems, materials }: RecipeCostPreviewProps) {
  const materialMap = new Map(materials.map((m) => [m.id, m]))

  let woodsTotal = 0
  for (const item of woodItems) {
    const mat = materialMap.get(item.material_id)
    if (mat && item.quantity > 0) woodsTotal += item.quantity * mat.price_per_unit
  }

  let extrasTotal = 0
  for (const item of extraItems) {
    const mat = materialMap.get(item.material_id)
    if (mat && item.quantity > 0) extrasTotal += item.quantity * mat.price_per_unit
  }

  const total = woodsTotal + extrasTotal

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Costo estimado</h3>
      <div className="flex justify-between text-sm">
        <span>Maderas</span>
        <span>{formatARS(woodsTotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Gastos extras</span>
        <span>{formatARS(extrasTotal)}</span>
      </div>
      <div className="flex justify-between font-semibold border-t pt-2">
        <span>Total</span>
        <span>{formatARS(total)}</span>
      </div>
    </div>
  )
}
