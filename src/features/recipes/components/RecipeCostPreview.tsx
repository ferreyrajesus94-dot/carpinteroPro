import { formatARS } from '@/shared/lib/utils'
import type { Material } from '@/features/inventory/types'
import { computeWoodUsage } from '../lib/computeWoodUsage'
import { safeEvalFormula } from '../lib/evalFormula'

interface ItemDraft {
  material_id: string
  quantity: number
  waste_pct?: number
  quantity_formula?: string
}

interface LaborDraft {
  description: string
  hours: number
  rate: number
}

interface RecipeCostPreviewProps {
  woodItems: ItemDraft[]
  extraItems: ItemDraft[]
  laborItems?: LaborDraft[]
  materials: Material[]
  suggestedMarginPct?: number | null
  paramValues?: Record<string, number>
}

const formatNum = (n: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)

export function RecipeCostPreview({ woodItems, extraItems, laborItems = [], materials, suggestedMarginPct, paramValues = {} }: RecipeCostPreviewProps) {
  const materialMap = new Map(materials.map((m) => [m.id, m]))

  const resolveQty = (item: ItemDraft): number => {
    const fallback = Number(item.quantity) || 0
    return safeEvalFormula(item.quantity_formula, paramValues, fallback)
  }

  const woodLines = woodItems
    .map((item) => {
      const mat = materialMap.get(item.material_id)
      const qty = resolveQty(item)
      if (!mat || qty <= 0) return null
      const waste = Number(item.waste_pct) || 0
      const qtyWithWaste = qty * (1 + waste / 100)
      return { mat, qty, waste, usage: computeWoodUsage(mat, qtyWithWaste) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const woodsTotal = woodLines.reduce((sum, l) => sum + l.usage.subtotal, 0)

  let extrasTotal = 0
  for (const item of extraItems) {
    const mat = materialMap.get(item.material_id)
    const qty = resolveQty(item)
    if (mat && qty > 0) {
      const waste = Number(item.waste_pct) || 0
      extrasTotal += qty * (1 + waste / 100) * mat.price_per_unit
    }
  }

  let laborTotal = 0
  for (const l of laborItems) {
    const h = Number(l.hours) || 0
    const r = Number(l.rate) || 0
    if (h > 0 && r > 0) laborTotal += h * r
  }

  const total = woodsTotal + extrasTotal + laborTotal

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Costo estimado</h3>

      {woodLines.length > 0 && (
        <div className="space-y-1 border-b pb-2">
          {woodLines.map(({ mat, qty, waste, usage }) => (
            <div key={mat.id} className="flex justify-between text-xs text-muted-foreground gap-2">
              <span className="truncate">
                {mat.name}: {formatNum(qty)} {usage.inputUnitLabel}
                {waste > 0 && ` (+${waste}% merma)`}
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
      <div className="flex justify-between text-sm">
        <span>Mano de obra</span>
        <span>{formatARS(laborTotal)}</span>
      </div>
      <div className="flex justify-between font-semibold border-t pt-2">
        <span>Total costo</span>
        <span>{formatARS(total)}</span>
      </div>
      {suggestedMarginPct != null && suggestedMarginPct > 0 && total > 0 && (
        <div className="flex justify-between text-sm text-primary">
          <span>Precio sugerido ({suggestedMarginPct}% sobre costo)</span>
          <span className="font-semibold">{formatARS(total * (1 + suggestedMarginPct / 100))}</span>
        </div>
      )}
    </div>
  )
}
