import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { calculateQuote } from '../lib/calculator'
import { formatCurrency } from '@/shared/lib/formatters'
import type { QuoteFormValues } from '../types'

interface QuoteLivePreviewProps {
  recipeCost: number
  extras: QuoteFormValues['extras']
  marginMode: 'on_cost' | 'on_price'
  marginPct: number
}

export function QuoteLivePreview({ recipeCost, extras, marginMode, marginPct }: QuoteLivePreviewProps) {
  const result = useMemo(
    () =>
      calculateQuote({
        recipeCost,
        extras: extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
        marginMode,
        marginPct,
      }),
    [recipeCost, extras, marginMode, marginPct]
  )

  const visibleExtras = extras.filter((e) => e.show_in_quote && e.amount > 0)

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Vista previa del precio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Costo del mueble</span>
          <span>{formatCurrency(recipeCost)}</span>
        </div>

        {visibleExtras.map((e, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-muted-foreground truncate max-w-[60%]">{e.description || 'Extra'}</span>
            <span>{formatCurrency(e.amount)}</span>
          </div>
        ))}

        <Separator />

        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(result.costBase)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Margen ({marginPct}%{marginMode === 'on_price' ? ' sobre precio' : ''})
          </span>
          <span>{formatCurrency(result.marginAmount)}</span>
        </div>

        <Separator />

        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(result.salePrice)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
