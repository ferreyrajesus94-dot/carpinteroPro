import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useQuotes, useUpdateQuote } from '@/features/quotes/hooks/useQuotes'
import { formatCurrency, QUOTE_STATUS_LABELS, type QuoteStatus } from '@/features/quotes/types'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { KanbanCard } from './KanbanCard'
import type { QuoteWithExtras } from '@/features/quotes/types'

const STATUS_ORDER: QuoteStatus[] = [
  'presupuesto', 'enviado', 'aprobado', 'en_produccion', 'entregado', 'cancelado',
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

function DroppableColumn({ status, children }: { status: QuoteStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto p-2 space-y-2 rounded-b-lg transition-colors ${isOver ? 'bg-primary/10' : ''}`}
    >
      {children}
    </div>
  )
}

export function KanbanBoard() {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)
  const updateMutation = useUpdateQuote(workshopId)
  const [mobileStatus, setMobileStatus] = useState<QuoteStatus>('enviado')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as QuoteStatus
    const prevStatus = active.data.current?.status as QuoteStatus | undefined
    if (!prevStatus || prevStatus === newStatus) return
    const quote = quotes.find((q) => q.id === active.id)
    if (!quote) return
    updateMutation.mutate({
      id: quote.id,
      quote: { status: newStatus },
      extras: quote.extras.map((e) => ({
        description: e.description,
        amount: e.amount,
        show_in_quote: e.show_in_quote,
      })),
    })
  }

  const grouped = useMemo(
    () => STATUS_ORDER.reduce<Record<QuoteStatus, QuoteWithExtras[]>>(
      (acc, status) => { acc[status] = quotes.filter((q) => q.status === status); return acc },
      {} as Record<QuoteStatus, QuoteWithExtras[]>
    ),
    [quotes]
  )

  const columnTotals = useMemo(
    () => STATUS_ORDER.reduce<Record<QuoteStatus, number>>(
      (acc, status) => { acc[status] = columnTotal(grouped[status]); return acc },
      {} as Record<QuoteStatus, number>
    ),
    [grouped]
  )

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Kanban</h1>
        <Link to="/crm/clientes" className="text-sm text-primary underline underline-offset-4">
          Clientes →
        </Link>
      </div>

      {/* Mobile: lista filtrable por estado */}
      <div className="sm:hidden p-4 space-y-3">
        <Select value={mobileStatus} onValueChange={(v) => setMobileStatus(v as QuoteStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]} ({grouped[s].length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {grouped[mobileStatus].length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin presupuestos en este estado</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(columnTotals[mobileStatus])}
            </p>
            {grouped[mobileStatus].map((q) => (
              <KanbanCard key={q.id} quote={q} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: columnas horizontales */}
      <div className="hidden sm:flex flex-1 overflow-x-auto p-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
                      <p className="text-xs text-muted-foreground mt-1">{formatCurrency(columnTotals[status])}</p>
                    )}
                  </div>
                  <DroppableColumn status={status}>
                    {cards.map((q) => <KanbanCard key={q.id} quote={q} draggable={isOnline} />)}
                    {cards.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sin presupuestos</p>
                    )}
                  </DroppableColumn>
                </div>
              )
            })}
          </div>
        </DndContext>
      </div>

      {!isOnline && (
        <p className="text-xs text-center text-muted-foreground pb-2">Modo solo lectura — sin conexión</p>
      )}
    </div>
  )
}
