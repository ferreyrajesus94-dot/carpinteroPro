import { formatARS } from '@/shared/lib/utils'
import type { Material } from '@/features/inventory/types'
import { computeWoodUsage } from '../lib/computeWoodUsage'

interface ItemDraft {
  material_id: string
  quantity: number
}

interface RecipeCostPreviewProps {
  woodItems: ItemDraft[]
  extraItems: ItemDraft[]
  materials: Material[]
}

const formatNum = (n: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)

export function RecipeCostPreview({ woodItems, extraItems, materials }: RecipeCostPreviewProps) {
  const materialMap = new Map(materials.map((m) => [m.id, m]))

  const woodLines = woodItems
    .map((item) => {
      const mat = materialMap.get(item.material_id)
      const qty = Number(item.quantity) || 0
      if (!mat || qty <= 0) return null
      return { mat, qty, usage: computeWoodUsage(mat, qty) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const woodsTotal = woodLines.reduce((sum, l) => sum + l.usage.subtotal, 0)

  let extrasTotal = 0
  for (const item of extraItems) {
    const mat = materialMap.get(item.material_id)
    if (mat && item.quantity > 0) extrasTotal += item.quantity * mat.price_per_unit
  }

  const total = woodsTotal + extrasTotal

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Costo estimado</h3>

      {woodLines.length > 0 && (
        <div className="space-y-1 border-b pb-2">
          {woodLines.map(({ mat, qty, usage }) => (
            <div key={mat.id} className="flex justify-between text-xs text-muted-foreground gap-2">
              <span className="truncate">
                {mat.name}: {formatNum(qty)} {usage.inputUnitLabel}
                {usage.piecesNeeded != null && (
                  ` → ${usage.piecesNeeded} pieza${usage.piecesNeeded === 1 ? '' : 's'}`
                )}
              </span>
              <span className="shrink-0">{formatARS(usage.subtotal)}</span>
            </div>
          ))}
        </div>
      )}

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
