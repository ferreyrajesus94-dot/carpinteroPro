import { useState } from 'react'
import { Pencil, Trash2, TrendingUp, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useMaterials, useDeleteMaterial } from '../hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import type { Material, MaterialCategory } from '../types'
import { MATERIAL_CATEGORIES, WOOD_SUBTYPES } from '../types'

interface MaterialListProps {
  onEdit: (material: Material) => void
  onViewHistory: (material: Material) => void
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

const formatNum = (n: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)

function formatExtraInfo(m: Material): string | null {
  if (m.category === 'madera') {
    const dims = [m.length_cm, m.width_cm, m.thickness_cm]
    const hasAnyDim = dims.some((d) => d != null)
    const subtypeLabel = m.wood_subtype
      ? WOOD_SUBTYPES.find((w) => w.value === m.wood_subtype)?.label
      : null
    if (!hasAnyDim && !subtypeLabel) return null
    const dimsStr = hasAnyDim
      ? dims.map((d) => (d != null ? formatNum(d) : '—')).join(' × ') + ' cm'
      : null
    return [subtypeLabel, dimsStr].filter(Boolean).join(' · ')
  }
  if ((m.category === 'pintura' || m.category === 'adhesivo') && m.volume_ml != null) {
    return `Envase ${formatNum(m.volume_ml)} ml`
  }
  return null
}

export function MaterialList({ onEdit, onViewHistory }: MaterialListProps) {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all')
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null)

  const { data: materials = [], isLoading, isError } = useMaterials(
    workshopId,
    categoryFilter !== 'all' ? { category: categoryFilter } : undefined
  )
  const deleteMutation = useDeleteMaterial(workshopId)

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Error al cargar los materiales. Revisá tu conexión e intentá de nuevo.
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    )
  }

  const actions = (material: Material) => {
    const isLowStock = material.stock <= material.min_stock
    return (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onViewHistory(material)} title="Ver historial">
          <TrendingUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(material)} disabled={!isOnline} title="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!isOnline}
          onClick={() => setDeleteTarget(material)}
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
        {isLowStock && (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Stock bajo
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Eliminar material"
        description={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
        isPending={deleteMutation.isPending}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Categoría:</span>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as MaterialCategory | 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {MATERIAL_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {materials.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No hay materiales. Agregá el primero con el botón de arriba.
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {materials.map((material) => (
              <div key={material.id} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{material.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{material.category}</span>
                </div>
                {formatExtraInfo(material) && (
                  <p className="text-xs text-muted-foreground">{formatExtraInfo(material)}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span>{formatARS(material.price_per_unit)} / {material.unit}</span>
                  <span className={material.stock <= material.min_stock ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    Stock: {material.stock}
                  </span>
                </div>
                {actions(material)}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-md border">
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
                        {formatExtraInfo(material) && (
                          <p className="text-xs text-muted-foreground font-normal">
                            {formatExtraInfo(material)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{material.category}</TableCell>
                      <TableCell>{formatARS(material.price_per_unit)}</TableCell>
                      <TableCell>
                        <span className={isLowStock ? 'text-destructive font-medium' : ''}>
                          {material.stock}
                        </span>
                        {material.min_stock > 0 && (
                          <span className="text-muted-foreground text-xs ml-1">/ mín {material.min_stock}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{material.unit}</TableCell>
                      <TableCell>{actions(material)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
