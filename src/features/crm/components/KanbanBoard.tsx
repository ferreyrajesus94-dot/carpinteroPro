import { Link } from 'react-router-dom'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { formatCurrency, QUOTE_STATUS_LABELS, type QuoteStatus } from '@/features/quotes/types'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { KanbanCard } from './KanbanCard'
import type { QuoteWithExtras } from '@/features/quotes/types'

const STATUS_ORDER: QuoteStatus[] = [
  'presupuesto',
  'enviado',
  'aprobado',
  'en_produccion',
  'entregado',
  'cancelado',
]

function columnTotal(quotes: QuoteWithExtras[]): number {
  return quotes.reduce((acc, q) => {
    const { salePrice } = calculateQuote({
      recipeCost: q.recipe_cost,
      extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
      marginMode: q.margin_mode,
      marginPct: q.margin_pct,
    })
    return acc + salePrice
  }, 0)
}

export function KanbanBoard() {
  const workshopId = useWorkshopId()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)

  const grouped = STATUS_ORDER.reduce<Record<QuoteStatus, QuoteWithExtras[]>>(
    (acc, status) => {
      acc[status] = quotes.filter((q) => q.status === status)
      return acc
    },
    {} as Record<QuoteStatus, QuoteWithExtras[]>
  )

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Kanban</h1>
        <Link to="/crm/clientes" className="text-sm text-primary underline underline-offset-4">
          Clientes →
        </Link>
      </div>
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {STATUS_ORDER.map((status) => {
            const cards = grouped[status]
            return (
              <div key={status} className="flex flex-col w-64 bg-muted/40 rounded-lg">
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{QUOTE_STATUS_LABELS[status]}</span>
                    <span className="text-xs bg-muted rounded-full px-2 py-0.5">{cards.length}</span>
                  </div>
                  {cards.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(columnTotal(cards))}</p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {cards.map((q) => (
                    <KanbanCard key={q.id} quote={q} />
                  ))}
                  {cards.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin presupuestos</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
