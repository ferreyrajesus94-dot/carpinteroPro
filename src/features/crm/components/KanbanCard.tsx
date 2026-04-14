import { useNavigate } from 'react-router-dom'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { formatCurrency, QUOTE_STATUS_COLORS } from '@/features/quotes/types'
import type { QuoteWithExtras } from '@/features/quotes/types'

interface KanbanCardProps {
  quote: QuoteWithExtras
}

export function KanbanCard({ quote }: KanbanCardProps) {
  const navigate = useNavigate()

  const { salePrice } = calculateQuote({
    recipeCost: quote.recipe_cost,
    extras: quote.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
    marginMode: quote.margin_mode,
    marginPct: quote.margin_pct,
  })

  const clientName = quote.client?.name ?? 'Sin cliente'
  const statusColor = QUOTE_STATUS_COLORS[quote.status]

  return (
    <div
      className="bg-white rounded-lg border border-border p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow space-y-2"
      onClick={() => navigate(`/quotes/${quote.id}`)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">{quote.quote_number}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
          {quote.status}
        </span>
      </div>
      <p className="text-sm font-medium leading-tight">{quote.furniture_name}</p>
      <p className="text-xs text-muted-foreground">{clientName}</p>
      <p className="text-sm font-semibold text-right">{formatCurrency(salePrice)}</p>
    </div>
  )
}
