import { useMemo, useState } from 'react'
import { Pencil, Trash2, TrendingUp, AlertTriangle, Search, PackagePlus, History } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
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

type SortOption = 'name-asc' | 'name-desc' | 'stock-asc' | 'stock-desc' | 'price-asc' | 'price-desc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc',   label: 'Nombre A-Z' },
  { value: 'name-desc',  label: 'Nombre Z-A' },
  { value: 'stock-asc',  label: 'Stock ↑' },
  { value: 'stock-desc', label: 'Stock ↓' },
  { value: 'price-asc',  label: 'Precio ↑' },
  { value: 'price-desc', label: 'Precio ↓' },
]

interface MaterialListProps {
  onEdit: (material: Material) => void
  onViewHistory: (material: Material) => void
  onAdjustStock: (material: Material) => void
  onViewStockHistory: (material: Material) => void
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

export function MaterialList({ onEdit, onViewHistory, onAdjustStock, onViewStockHistory }: MaterialListProps) {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null)

  const { data: materials = [], isLoading, isError } = useMaterials(
    workshopId,
    categoryFilter !== 'all' ? { category: categoryFilter } : undefined
  )
  const deleteMutation = useDeleteMaterial(workshopId)

  const visibleMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? materials.filter((m) => m.name.toLowerCase().includes(q))
      : materials
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':   return a.name.localeCompare(b.name, 'es')
        case 'name-desc':  return b.name.localeCompare(a.name, 'es')
        case 'stock-asc':  return a.stock - b.stock
        case 'stock-desc': return b.stock - a.stock
        case 'price-asc':  return a.price_per_unit - b.price_per_unit
        case 'price-desc': return b.price_per_unit - a.price_per_unit
      }
    })
    return sorted
  }, [materials, search, sortBy])

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
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onViewHistory(material)} title="Historial de precios">
          <TrendingUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled={!isOnline} onClick={() => onAdjustStock(material)} title="Ajustar stock">
          <PackagePlus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onViewStockHistory(material)} title="Movimientos de stock">
          <History className="h-4 w-4" />
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Categoría:</span>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as MaterialCategory | 'all')}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {MATERIAL_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Orden:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleMaterials.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {materials.length === 0
            ? 'No hay materiales. Agregá el primero con el botón de arriba.'
            : 'No se encontraron materiales con esos filtros.'}
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {visibleMaterials.map((material) => (
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
                {visibleMaterials.map((material) => {
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
