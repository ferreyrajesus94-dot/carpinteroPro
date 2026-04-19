import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFabAction } from '@/shared/lib/fab'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useClientsPaginated } from '@/features/crm/hooks/useClients'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { PAGE_SIZE } from '@/features/crm/api/clients'
import { CLIENT_SOURCE_LABELS } from '@/features/crm/types'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { ClientForm } from './ClientForm'
import type { Client } from '@/features/crm/types'

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ClientList() {
  const workshopId = useWorkshopId()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const [page, setPage] = useState(0)
  const { data: result, isLoading, isError } = useClientsPaginated(workshopId, page)
  const { data: quotes = [] } = useQuotes(workshopId)
  const [formOpen, setFormOpen] = useState(false)
  useFabAction('crm:new', useCallback(() => setFormOpen(true), [setFormOpen]))

  const clients = result?.data ?? []
  const totalCount = result?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const statsByClient = quotes.reduce<Record<string, { count: number; lastDate: string }>>(
    (acc, q) => {
      if (!q.client_id) return acc
      if (!acc[q.client_id]) acc[q.client_id] = { count: 0, lastDate: '' }
      acc[q.client_id].count += 1
      if (!acc[q.client_id].lastDate || q.created_at > acc[q.client_id].lastDate) {
        acc[q.client_id].lastDate = q.created_at
      }
      return acc
    },
    {}
  )

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Error al cargar los clientes. Revisá tu conexión e intentá de nuevo.
      </p>
    )
  }

  if (isLoading && !result) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button size="sm" disabled={!isOnline} onClick={() => setFormOpen(true)}>
          + Nuevo cliente
        </Button>
      </div>

      {clients.length === 0 && totalCount === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Sin clientes todavía.</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden p-4 space-y-2 overflow-y-auto">
            {clients.map((client: Client) => {
              const stats = statsByClient[client.id]
              return (
                <div
                  key={client.id}
                  className="rounded-md border p-3 space-y-1 cursor-pointer hover:bg-muted/30"
                  onClick={() => navigate(`/crm/clientes/${client.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{client.name}</span>
                    <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                      {CLIENT_SOURCE_LABELS[client.source]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{client.phone ?? '—'}</span>
                    <span>{stats?.count ?? 0} presupuestos</span>
                  </div>
                  {stats && (
                    <p className="text-xs text-muted-foreground">Último: {formatDate(stats.lastDate)}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-left">Teléfono</th>
                  <th className="px-4 py-3 text-left">Origen</th>
                  <th className="px-4 py-3 text-right">Presupuestos</th>
                  <th className="px-4 py-3 text-right">Último presupuesto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((client: Client) => {
                  const stats = statsByClient[client.id]
                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/crm/clientes/${client.id}`)}
                    >
                      <td className="px-4 py-3 font-medium">{client.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{client.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                          {CLIENT_SOURCE_LABELS[client.source]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{stats?.count ?? 0}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {stats ? formatDate(stats.lastDate) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground p-4 border-t">
              <span>{totalCount} clientes — página {page + 1} de {totalPages}</span>
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
