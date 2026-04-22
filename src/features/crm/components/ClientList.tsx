import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Phone, Search, Tag, Users } from 'lucide-react'
import { useFabAction } from '@/shared/lib/fab'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useClientsPaginated } from '@/features/crm/hooks/useClients'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { PAGE_SIZE } from '@/features/crm/api/clients'
import { CLIENT_SOURCE_LABELS } from '@/features/crm/types'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { formatCurrency } from '@/features/quotes/types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { SectionHowto } from '@/shared/ui/section-howto'
import { ClientForm } from './ClientForm'
import type { Client } from '@/features/crm/types'

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ClientList() {
  const workshopId = useWorkshopId()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const { data: result, isLoading, isError } = useClientsPaginated(workshopId, page)
  const { data: quotes = [] } = useQuotes(workshopId)
  const [formOpen, setFormOpen] = useState(false)
  useFabAction('crm:new', useCallback(() => setFormOpen(true), []))

  const clients = useMemo(() => result?.data ?? [], [result?.data])
  const totalCount = result?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const statsByClient = useMemo(() => {
    return quotes.reduce<Record<string, { count: number; total: number; lastDate: string }>>(
      (acc, q) => {
        if (!q.client_id) return acc
        if (!acc[q.client_id]) acc[q.client_id] = { count: 0, total: 0, lastDate: '' }
        const { salePrice } = calculateQuote({
          recipeCost: q.recipe_cost,
          extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
          marginMode: q.margin_mode,
          marginPct: q.margin_pct,
        })
        acc[q.client_id].count += 1
        acc[q.client_id].total += salePrice
        if (!acc[q.client_id].lastDate || q.created_at > acc[q.client_id].lastDate) {
          acc[q.client_id].lastDate = q.created_at
        }
        return acc
      },
      {}
    )
  }, [quotes])

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    )
  }, [clients, search])

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Error al cargar los clientes. Revisá tu conexión e intentá de nuevo.
      </p>
    )
  }

  if (isLoading && !result) {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="pb-24 md:pb-6 space-y-5 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink3">CRM</div>
          <h1 className="font-display text-2xl md:text-[32px] font-semibold tracking-tight text-ink mt-1">
            Clientes
          </h1>
          <p className="text-[13px] text-ink3 mt-1">
            {totalCount} contacto{totalCount === 1 ? '' : 's'} activo{totalCount === 1 ? '' : 's'}
          </p>
        </div>
        <Button size="sm" disabled={!isOnline} onClick={() => setFormOpen(true)}>
          + Nuevo
        </Button>
      </div>

      <SectionHowto
        storageKey="crm"
        steps={[
          'Cada contacto guarda teléfono, origen y el histórico de presupuestos.',
          'Tocá un cliente para ver su detalle, presupuestos y totales facturados.',
          'Los "trabajos" son presupuestos aprobados o entregados a ese cliente.',
        ]}
      />

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente, teléfono o email…"
          className="pl-9"
        />
      </div>

      {totalCount === 0 ? (
        <div className="rounded-xl border border-line bg-cp-bg2 p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-cp-accent-soft">
            <Users className="h-5 w-5 text-cp-accent" />
          </div>
          <p className="font-medium text-ink">Sin clientes todavía</p>
          <p className="mt-1 text-[13px] text-ink3">Agregá tu primer cliente para empezar a armar presupuestos.</p>
          <Button className="mt-4" size="sm" disabled={!isOnline} onClick={() => setFormOpen(true)}>
            + Nuevo cliente
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            {filteredClients.map((client: Client) => {
              const stats = statsByClient[client.id]
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => navigate(`/crm/clientes/${client.id}`)}
                  className="group rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-line2 hover:bg-cp-bg2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold"
                      style={{ background: 'var(--cp-accent-soft)', color: 'var(--cp-accent)' }}
                    >
                      {initials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-medium text-[14.5px] text-ink">{client.name}</div>
                        <div className="shrink-0 font-mono text-[12px] text-ink2">
                          {stats ? formatCurrency(stats.total) : '—'}
                        </div>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink3">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={11} />
                          {client.phone ?? '—'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Tag size={11} />
                          {CLIENT_SOURCE_LABELS[client.source]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink3">
                        {stats?.count ?? 0} trabajo{stats?.count === 1 ? '' : 's'}
                        {stats?.lastDate ? ` · último ${formatDate(stats.lastDate)}` : ''}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {filteredClients.length === 0 && (
            <p className="py-6 text-center text-sm text-ink3">Sin resultados para "{search}".</p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line pt-3 text-sm text-ink3">
              <span>
                {totalCount} clientes — página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => setFormOpen(false)}
      />
    </div>
  )
}
