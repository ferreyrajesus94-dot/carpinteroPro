import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useClients } from '@/features/crm/hooks/useClients'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { CLIENT_SOURCE_LABELS } from '@/features/crm/types'
import { Button } from '@/shared/ui/button'
import { ClientForm } from './ClientForm'
import type { Client } from '@/features/crm/types'

export function ClientList() {
  const workshopId = useWorkshopId()
  const navigate = useNavigate()
  const { data: clients = [], isLoading } = useClients(workshopId)
  const { data: quotes = [] } = useQuotes(workshopId)
  const [formOpen, setFormOpen] = useState(false)

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

  function formatDate(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button size="sm" onClick={() => setFormOpen(true)}>+ Nuevo cliente</Button>
      </div>

      {clients.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Sin clientes todavía.</div>
      ) : (
        <div className="overflow-auto flex-1">
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
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => setFormOpen(false)}
      />
    </div>
  )
}
