import { useNavigate } from 'react-router-dom'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { formatCurrency, QUOTE_STATUS_COLORS } from '@/features/quotes/types'
import type { QuoteWithExtras } from '@/features/quotes/types'

interface KanbanCardProps {
  quote: QuoteWithExtras
  draggable?: boolean
}

export function KanbanCard({ quote, draggable = false }: KanbanCardProps) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: quote.id,
    data: { status: quote.status },
    disabled: !draggable,
  })

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
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className={`bg-card text-card-foreground rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow space-y-2 ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      onClick={() => { if (!isDragging) navigate(`/quotes/${quote.id}`) }}
      {...attributes}
      {...listeners}
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
