import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/shared/lib/formatters'
import { QuoteStatusBadge } from '@/features/quotes/components/QuoteStatusBadge'
import { getSalePrice, type DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  quotes: DashboardStats['activeQuotes']
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
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2 p-4">
            {quotes.map((q) => (
              <Link key={q.id} to={`/quotes/${q.id}`} className="block rounded-md border p-3 space-y-1 hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{q.quote_number}</span>
                  <QuoteStatusBadge status={q.status} />
                </div>
                <p className="text-sm font-medium">{q.furniture_name}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{q.client?.name ?? '—'}</span>
                  <span>{formatCurrency(getSalePrice(q))}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-x-auto">
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
                    <td className="px-5 py-3 text-muted-foreground">{quote.client?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatCurrency(getSalePrice(quote))}</td>
                    <td className="px-5 py-3"><QuoteStatusBadge status={quote.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {format(new Date(quote.created_at), 'd MMM yyyy', { locale: es })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
