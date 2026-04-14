import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { useFurnitureTemplates, useDeleteFurnitureTemplate } from '../hooks/useRecipes'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { computeRecipeCost } from '../types'
import { formatARS } from '@/shared/lib/utils'
import type { FurnitureTemplateWithItems } from '../types'

interface MuebleListProps {
  onEdit: (template: FurnitureTemplateWithItems) => void
}

export function MuebleList({ onEdit }: MuebleListProps) {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const { data: templates = [], isLoading } = useFurnitureTemplates(workshopId)
  const deleteMutation = useDeleteFurnitureTemplate(workshopId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay muebles. Creá el primero con el botón de arriba.
      </p>
    )
  }

  return (
    <>
      {/* Mobile: cards */}
      <div className="sm:hidden space-y-2">
        {templates.map((template) => {
          const { total } = computeRecipeCost(template.recipe_items)
          return (
            <div key={template.id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{template.name}</span>
                <span className="text-sm text-muted-foreground">{formatARS(total)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {template.recipe_items.length} material{template.recipe_items.length !== 1 ? 'es' : ''}
              </p>
              <div className="flex gap-1 pt-1">
                <Button variant="ghost" size="icon" disabled={!isOnline} onClick={() => onEdit(template)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!isOnline}
                  onClick={() => {
                    if (confirm(`¿Eliminar "${template.name}"?`)) deleteMutation.mutate(template.id)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Costo estimado</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => {
              const { total } = computeRecipeCost(template.recipe_items)
              return (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {template.recipe_items.length} material{template.recipe_items.length !== 1 ? 'es' : ''}
                  </TableCell>
                  <TableCell className="font-semibold">{formatARS(total)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!isOnline}
                        onClick={() => onEdit(template)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!isOnline}
                        onClick={() => {
                          if (confirm(`¿Eliminar "${template.name}"?`)) {
                            deleteMutation.mutate(template.id)
                          }
                        }}
                        title="Eliminar"
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
    </>
  )
}
