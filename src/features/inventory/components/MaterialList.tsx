import { useState } from 'react'
import { Pencil, Trash2, TrendingUp, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useMaterials, useDeleteMaterial } from '../hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import type { Material, MaterialCategory } from '../types'
import { MATERIAL_CATEGORIES } from '../types'

interface MaterialListProps {
  onEdit: (material: Material) => void
  onViewHistory: (material: Material) => void
}

export function MaterialList({ onEdit, onViewHistory }: MaterialListProps) {
  const workshopId = useWorkshopId()
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all')

  const { data: materials = [], isLoading } = useMaterials(
    workshopId,
    categoryFilter !== 'all' ? { category: categoryFilter } : undefined
  )
  const deleteMutation = useDeleteMaterial(workshopId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Cargando materiales...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtro por categoría */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Categoría:</span>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as MaterialCategory | 'all')}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {MATERIAL_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {materials.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay materiales. Agregá el primero con el botón de arriba.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Precio/u</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="w-[120px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const isLowStock = material.stock <= material.min_stock
                return (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {material.name}
                        {isLowStock && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" />
                            Stock bajo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{material.category}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency: 'ARS',
                        minimumFractionDigits: 0,
                      }).format(material.price_per_unit)}
                    </TableCell>
                    <TableCell>
                      <span className={isLowStock ? 'text-destructive font-medium' : ''}>
                        {material.stock}
                      </span>
                      {material.min_stock > 0 && (
                        <span className="text-muted-foreground text-xs ml-1">
                          / mín {material.min_stock}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {material.unit}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onViewHistory(material)}
                          title="Ver historial de precios"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(material)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`¿Eliminar "${material.name}"?`)) {
                              deleteMutation.mutate(material.id)
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
      )}
    </div>
  )
}
