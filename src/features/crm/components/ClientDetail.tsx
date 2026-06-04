import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Pencil, Phone, Search, Tag, Trash2 } from 'lucide-react'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useClients, useDeleteClient } from '@/features/crm/hooks/useClients'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { formatCurrency } from '@/shared/lib/formatters'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { CLIENT_SOURCE_LABELS } from '@/features/crm/types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { QuoteStatusBadge } from '@/features/quotes/components/QuoteStatusBadge'
import { ClientForm } from './ClientForm'
import type { Client } from '@/features/crm/types'

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type Tab = 'info' | 'presupuestos' | 'notas'

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const workshopId = useWorkshopId()
  const { data: clients = [] } = useClients(workshopId)
  const { data: quotes = [] } = useQuotes(workshopId)
  const deleteMutation = useDeleteClient(workshopId)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('info')

  const client = clients.find((c) => c.id === id)

  const quotesByClient = useMemo(() => {
    return quotes.reduce<Record<string, { count: number; total: number }>>((acc, q) => {
      if (!q.client_id) return acc
      const { salePrice } = calculateQuote({
        recipeCost: q.recipe_cost,
        extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
        marginMode: q.margin_mode,
        marginPct: q.margin_pct,
      })
      if (!acc[q.client_id]) acc[q.client_id] = { count: 0, total: 0 }
      acc[q.client_id].count += 1
      acc[q.client_id].total += salePrice
      return acc
    }, {})
  }, [quotes])

  const clientQuotes = useMemo(
    () =>
      quotes
        .filter((q) => q.client_id === id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((q) => {
          const { salePrice } = calculateQuote({
            recipeCost: q.recipe_cost,
            extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
            marginMode: q.margin_mode,
            marginPct: q.margin_pct,
          })
          return { ...q, salePrice }
        }),
    [quotes, id]
  )

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink3">Cliente no encontrado.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/crm/clientes')}>
          Volver a clientes
        </Button>
      </div>
    )
  }

  async function handleDelete() {
    await deleteMutation.mutateAsync(client!.id)
    navigate('/crm/clientes')
  }

  const stats = quotesByClient[client.id] ?? { count: 0, total: 0 }
  const averageTicket = stats.count > 0 ? Math.round(stats.total / stats.count) : 0

  return (
    <>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar cliente"
        description={`¿Seguro que querés eliminar a ${client.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />

      <div className="pb-24 md:pb-6 p-4 md:p-6">
        <div className="md:grid md:grid-cols-[340px_1fr] md:gap-4">
          {/* Sidebar list (desktop only) */}
          <aside className="hidden md:flex flex-col rounded-xl border border-line bg-surface overflow-hidden max-h-[calc(100dvh-3rem)]">
            <div className="p-3 border-b border-line">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="overflow-y-auto divide-y divide-[var(--line)]">
              {filteredClients.map((c: Client) => {
                const s = quotesByClient[c.id]
                const active = c.id === client.id
                return (
                  <Link
                    key={c.id}
                    to={`/crm/clientes/${c.id}`}
                    className={`flex items-center gap-3 p-3 transition-colors ${
                      active ? 'bg-cp-accent-soft' : 'hover:bg-cp-bg2'
                    }`}
                  >
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold"
                      style={{ background: 'var(--cp-accent-soft)', color: 'var(--cp-accent)' }}
                    >
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[13.5px] font-medium text-ink">{c.name}</div>
                        <span className="shrink-0 font-mono text-[11.5px] text-ink2">{s?.count ?? 0}</span>
                      </div>
                      <div className="truncate text-[11.5px] text-ink3">{c.phone ?? '—'}</div>
                    </div>
                  </Link>
                )
              })}
              {filteredClients.length === 0 && (
                <p className="p-4 text-center text-[12px] text-ink3">Sin resultados.</p>
              )}
            </div>
          </aside>

          {/* Detail */}
          <div className="space-y-4">
            <button
              type="button"
              className="md:hidden inline-flex items-center gap-1 text-sm text-ink3 hover:text-ink"
              onClick={() => navigate('/crm/clientes')}
            >
              <ChevronLeft size={16} /> Clientes
            </button>

            <div className="rounded-xl border border-line bg-surface p-4 md:p-6">
              <div className="flex items-start gap-4">
                <div
                  className="grid h-14 w-14 md:h-16 md:w-16 shrink-0 place-items-center rounded-full font-mono text-[16px] md:text-[18px] font-semibold"
                  style={{ background: 'var(--cp-accent-soft)', color: 'var(--cp-accent)' }}
                >
                  {initials(client.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-xl md:text-[22px] font-semibold text-ink truncate">
                    {client.name}
                  </h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-ink3">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {client.phone ?? '—'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Tag size={12} />
                      {CLIENT_SOURCE_LABELS[client.source]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    <Pencil size={14} className="md:mr-1" />
                    <span className="hidden md:inline">Editar</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clientQuotes.length > 0}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-line p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Trabajos</div>
                  <div className="font-display text-xl md:text-[22px] font-semibold mt-1 text-ink">
                    {stats.count}
                  </div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Facturado</div>
                  <div className="font-mono text-base md:text-[18px] font-semibold mt-1 text-ink">
                    {formatCurrency(stats.total)}
                  </div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Ticket prom.</div>
                  <div className="font-mono text-base md:text-[18px] font-semibold mt-1 text-ink">
                    {formatCurrency(averageTicket)}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile tabs */}
            <div className="md:hidden flex rounded-lg border border-line bg-cp-bg2 p-1 gap-1">
              {(['info', 'presupuestos', 'notas'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'bg-surface text-ink shadow-sm' : 'text-ink3 hover:text-ink'
                  }`}
                >
                  {t === 'info' ? 'Info' : t === 'presupuestos' ? 'Presupuestos' : 'Notas'}
                </button>
              ))}
            </div>

            {/* Info */}
            <section className={`${tab !== 'info' ? 'hidden md:block' : ''}`}>
              <div className="rounded-xl border border-line bg-surface p-4 md:p-5">
                <h2 className="font-display text-[14px] font-semibold text-ink mb-3">Datos de contacto</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-ink3">Teléfono</dt>
                  <dd className="text-ink">{client.phone ?? '—'}</dd>
                  <dt className="text-ink3">Email</dt>
                  <dd className="text-ink break-all">{client.email ?? '—'}</dd>
                  <dt className="text-ink3">Origen</dt>
                  <dd className="text-ink">{CLIENT_SOURCE_LABELS[client.source]}</dd>
                </dl>
              </div>
            </section>

            {/* Presupuestos */}
            <section className={`${tab !== 'presupuestos' ? 'hidden md:block' : ''}`}>
              <div className="rounded-xl border border-line bg-surface p-4 md:p-5">
                <h2 className="font-display text-[14px] font-semibold text-ink mb-3">
                  Historial de presupuestos
                </h2>
                {clientQuotes.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-ink3">Sin presupuestos aún.</p>
                ) : (
                  <div className="space-y-2">
                    {clientQuotes.map((q) => (
                      <Link
                        key={q.id}
                        to={`/quotes/${q.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 transition-colors hover:border-line2 hover:bg-cp-bg2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-ink3">{q.quote_number}</span>
                            <QuoteStatusBadge status={q.status} />
                          </div>
                          <div className="mt-0.5 truncate font-medium text-[13.5px] text-ink">
                            {q.furniture_name}
                          </div>
                          <div className="text-[11px] text-ink3">{formatDate(q.created_at)}</div>
                        </div>
                        <div className="shrink-0 font-mono text-[14px] font-semibold text-ink">
                          {formatCurrency(q.salePrice)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Notas */}
            <section className={`${tab !== 'notas' ? 'hidden md:block' : ''}`}>
              <div className="rounded-xl border border-line bg-surface p-4 md:p-5">
                <h2 className="font-display text-[14px] font-semibold text-ink mb-3">Notas</h2>
                {client.notes ? (
                  <p className="whitespace-pre-wrap text-sm text-ink2">{client.notes}</p>
                ) : (
                  <p className="text-[12px] text-ink3">Sin notas para este cliente.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <ClientForm
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onUpdated={() => setEditOpen(false)}
      />
    </>
  )
}
