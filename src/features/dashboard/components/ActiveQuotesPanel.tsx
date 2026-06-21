import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatCurrency } from '@/shared/lib/formatters'
import { QUOTE_STATUS_COLORS, QUOTE_STATUS_LABELS } from '@/shared/types/quotes'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { getSalePrice, type DashboardStats } from '../hooks/useDashboardStats'

interface Props {
  quotes: DashboardStats['activeQuotes']
}

function DashboardQuoteStatusBadge({ status }: { status: DashboardStats['activeQuotes'][0]['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}>
      {QUOTE_STATUS_LABELS[status]}
    </span>
  )
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
                  <DashboardQuoteStatusBadge status={q.status} />
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
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Mueble</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map(quote => (
                  <TableRow
                    key={quote.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{quote.quote_number}</TableCell>
                    <TableCell>{quote.furniture_name}</TableCell>
                    <TableCell className="text-muted-foreground">{quote.client?.name ?? '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(getSalePrice(quote))}</TableCell>
                    <TableCell><DashboardQuoteStatusBadge status={quote.status} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(quote.created_at), 'd MMM yyyy', { locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
