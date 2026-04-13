import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useQuotes, useDeleteQuote } from '../hooks/useQuotes'
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, formatCurrency } from '../types'

export function QuoteList() {
  const workshopId = useWorkshopId()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)
  const deleteMutation = useDeleteQuote(workshopId)

  function handleDelete(id: string, quoteNumber: string) {
    if (confirm(`¿Eliminar el presupuesto ${quoteNumber}?`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) return <div className="p-4 text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Button asChild>
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Mueble</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => {
                const totalExtras = q.extras.reduce((acc, e) => acc + e.amount, 0)
                const costBase = q.recipe_cost + totalExtras
                const salePrice =
                  q.margin_mode === 'on_cost'
                    ? costBase * (1 + q.margin_pct / 100)
                    : q.margin_pct < 100
                    ? costBase / (1 - q.margin_pct / 100)
                    : costBase

                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-medium">{q.quote_number}</TableCell>
                    <TableCell>{q.client?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{q.furniture_name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(salePrice)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[q.status]}`}>
                        {QUOTE_STATUS_LABELS[q.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/quotes/${q.id}/contract`}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/quotes/${q.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(q.id, q.quote_number)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
