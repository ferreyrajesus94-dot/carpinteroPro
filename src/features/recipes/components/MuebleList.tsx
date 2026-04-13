import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
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
import { computeRecipeCost } from '../types'
import { formatARS } from '@/shared/lib/utils'
import type { FurnitureTemplateWithItems } from '../types'

interface MuebleListProps {
  onEdit: (template: FurnitureTemplateWithItems) => void
}

export function MuebleList({ onEdit }: MuebleListProps) {
  const workshopId = useWorkshopId()
  const { data: templates = [], isLoading } = useFurnitureTemplates(workshopId)
  const deleteMutation = useDeleteFurnitureTemplate(workshopId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Cargando muebles...
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
    <div className="rounded-md border">
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
                      onClick={() => onEdit(template)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
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
  )
}
