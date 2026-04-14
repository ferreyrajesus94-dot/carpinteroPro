import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  formatCurrency,
} from '@/features/quotes/types'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import type { QuoteWithExtras } from '@/features/quotes/types'
import type { DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  quotes: DashboardStats['activeQuotes']
}

function getSalePrice(quote: QuoteWithExtras): number {
  return calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map(e => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  }).salePrice
}

export function ActiveQuotesPanel({ quotes }: Props) {
  const navigate = useNavigate()

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Presupuestos activos</h3>
      </div>

      {quotes.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No hay presupuestos activos
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-5 py-3 font-medium">Nº</th>
                <th className="px-5 py-3 font-medium">Mueble</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium text-right">Total</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(quote => (
                <tr
                  key={quote.id}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <td className="px-5 py-3 font-mono text-xs">{quote.quote_number}</td>
                  <td className="px-5 py-3">{quote.furniture_name}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {quote.client?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatCurrency(getSalePrice(quote))}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[quote.status]}`}>
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {format(new Date(quote.created_at), 'd MMM yyyy', { locale: es })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
