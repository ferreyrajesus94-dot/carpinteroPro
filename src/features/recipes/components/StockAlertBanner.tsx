import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { StockCheckResult } from '../hooks/useStockCheck'

interface Props {
  check: StockCheckResult
  /** Si true, muestra un mensaje verde "stock suficiente" cuando no hay faltantes. */
  showOk?: boolean
}

export function StockAlertBanner({ check, showOk = false }: Props) {
  if (!check.enabled) return null

  if (!check.hasShortage) {
    if (!showOk) return null
    return (
      <div className="flex items-start gap-2 rounded-md border border-cp-success/30 bg-cp-success/10 p-3 text-sm text-cp-success">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Stock suficiente para fabricar este mueble.</span>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <div className="flex items-start gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span className="font-medium">Stock insuficiente para fabricar este mueble</span>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-foreground/80">
        {check.shortages.map((s) => (
          <li key={s.materialId} className="flex items-baseline justify-between gap-2">
            <span className="truncate">
              <Link to={`/inventory?id=${s.materialId}`} className="underline">
                {s.name}
              </Link>
            </span>
            <span className="shrink-0 tabular-nums">
              faltan {s.missing.toFixed(2)} {s.unit} (tenés {s.available.toFixed(2)}, necesitás {s.required.toFixed(2)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
