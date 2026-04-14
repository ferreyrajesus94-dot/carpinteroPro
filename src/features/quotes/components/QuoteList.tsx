import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useQuotes, useDeleteQuote } from '../hooks/useQuotes'
import { formatCurrency } from '../types'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { calculateQuote } from '../lib/calculator'

export function QuoteList() {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const { data: quotes = [], isLoading, isError } = useQuotes(workshopId)
  const deleteMutation = useDeleteQuote(workshopId)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; quoteNumber: string } | null>(null)

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Error al cargar los presupuestos. Revisá tu conexión e intentá de nuevo.
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Eliminar presupuesto"
        description={`¿Seguro que querés eliminar el presupuesto ${deleteTarget?.quoteNumber}? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
        isPending={deleteMutation.isPending}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Button asChild disabled={!isOnline}>
          <Link to="/quotes/new">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Link>
        </Button>
      </div>

      {quotes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No hay presupuestos aún. ¡Creá el primero!
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {quotes.map((q) => {
              const { salePrice } = calculateQuote({
                recipeCost: q.recipe_cost,
                extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
                marginMode: q.margin_mode,
                marginPct: q.margin_pct,
              })
              return (
                <div key={q.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-sm">{q.quote_number}</span>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <p className="text-sm font-medium">{q.furniture_name}</p>
                  <p className="text-xs text-muted-foreground">{q.client?.name ?? 'Sin cliente'}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatCurrency(salePrice)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/quotes/${q.id}/contract`}><FileText className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild disabled={!isOnline}>
                        <Link to={`/quotes/${q.id}`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!isOnline}
                        onClick={() => setDeleteTarget({ id: q.id, quoteNumber: q.quote_number })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">N°</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Mueble</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((q) => {
                  const { salePrice } = calculateQuote({
                    recipeCost: q.recipe_cost,
                    extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
                    marginMode: q.margin_mode,
                    marginPct: q.margin_pct,
                  })
                  return (
                    <tr key={q.id}>
                      <td className="px-4 py-3 font-mono font-medium">{q.quote_number}</td>
                      <td className="px-4 py-3">{q.client?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">{q.furniture_name}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(salePrice)}</td>
                      <td className="px-4 py-3"><QuoteStatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/quotes/${q.id}/contract`}><FileText className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild disabled={!isOnline}>
                            <Link to={`/quotes/${q.id}`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!isOnline}
                            onClick={() => setDeleteTarget({ id: q.id, quoteNumber: q.quote_number })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
