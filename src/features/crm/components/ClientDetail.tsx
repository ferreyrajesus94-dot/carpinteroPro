import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useClients, useDeleteClient } from '@/features/crm/hooks/useClients'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/features/quotes/types'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { CLIENT_SOURCE_LABELS } from '@/features/crm/types'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { QuoteStatusBadge } from '@/features/quotes/components/QuoteStatusBadge'
import { ClientForm } from './ClientForm'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const workshopId = useWorkshopId()
  const { data: clients = [] } = useClients(workshopId)
  const { data: quotes = [] } = useQuotes(workshopId)
  const deleteMutation = useDeleteClient(workshopId)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const client = clients.find((c) => c.id === id)
  const clientQuotes = quotes
    .filter((q) => q.client_id === id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  if (!client) {
    return <div className="p-8 text-center text-muted-foreground">Cliente no encontrado.</div>
  }

  async function handleDelete() {
    await deleteMutation.mutateAsync(client!.id)
    navigate('/crm/clientes')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar cliente"
        description={`¿Seguro que querés eliminar a ${client.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />

      <div className="flex items-center justify-between">
        <button
          className="text-sm text-muted-foreground hover:underline"
          onClick={() => navigate('/crm/clientes')}
        >
          ← Clientes
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={clientQuotes.length > 0}
            onClick={() => setDeleteOpen(true)}
          >
            Eliminar
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-semibold text-lg">{client.name}</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Teléfono</dt>
          <dd>{client.phone ?? '—'}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{client.email ?? '—'}</dd>
          <dt className="text-muted-foreground">Origen</dt>
          <dd>{CLIENT_SOURCE_LABELS[client.source]}</dd>
          {client.notes && (
            <>
              <dt className="text-muted-foreground">Notas</dt>
              <dd>{client.notes}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="rounded-lg border border-border">
        <h3 className="font-medium p-4 border-b border-border">Presupuestos</h3>
        {clientQuotes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin presupuestos aún.</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-border">
              {clientQuotes.map((q) => {
                const { salePrice } = calculateQuote({
                  recipeCost: q.recipe_cost,
                  extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
                  marginMode: q.margin_mode,
                  marginPct: q.margin_pct,
                })
                return (
                  <Link
                    key={q.id}
                    to={`/quotes/${q.id}`}
                    className="block p-4 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-medium">{q.quote_number}</span>
                      <QuoteStatusBadge status={q.status} />
                    </div>
                    <p className="text-sm font-medium">{q.furniture_name}</p>
                    <div className="flex items-center justify-between mt-1 text-sm">
                      <span className="text-muted-foreground">{formatDate(q.created_at)}</span>
                      <span className="font-medium">{formatCurrency(salePrice)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Nº</th>
                    <th className="px-4 py-2 text-left">Mueble</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientQuotes.map((q) => {
                    const { salePrice } = calculateQuote({
                      recipeCost: q.recipe_cost,
                      extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
                      marginMode: q.margin_mode,
                      marginPct: q.margin_pct,
                    })
                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate(`/quotes/${q.id}`)}
                      >
                        <td className="px-4 py-2 font-mono text-xs">{q.quote_number}</td>
                        <td className="px-4 py-2">{q.furniture_name}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(salePrice)}</td>
                        <td className="px-4 py-2"><QuoteStatusBadge status={q.status} /></td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{formatDate(q.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <ClientForm
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onUpdated={() => setEditOpen(false)}
      />
    </div>
  )
}
