import { useMemo, useState } from 'react'
import { Pencil, Trash2, TrendingUp, AlertTriangle, Search, PackagePlus, History, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { Label } from '@/shared/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/ui/dialog'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useMaterials, useDeleteMaterial } from '../hooks/useMaterials'
import { useAllPriceHistory } from '../hooks/useAllPriceHistory'
import { PriceSparkline, type SparklinePoint } from './PriceSparkline'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { exportMaterialsCsv } from '../lib/exportMaterialsCsv'
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
  const parts: string[] = []
  if (m.category === 'madera') {
    const dims = [m.length_cm, m.width_cm, m.thickness_cm]
    const hasAnyDim = dims.some((d) => d != null)
    const subtypeLabel = m.wood_subtype
      ? WOOD_SUBTYPES.find((w) => w.value === m.wood_subtype)?.label
      : null
    const dimsStr = hasAnyDim
      ? dims.map((d) => (d != null ? formatNum(d) : '—')).join(' × ') + ' cm'
      : null
    const woodInfo = [subtypeLabel, dimsStr].filter(Boolean).join(' · ')
    if (woodInfo) parts.push(woodInfo)
  }
  if ((m.category === 'pintura' || m.category === 'adhesivo') && m.volume_ml != null) {
    parts.push(`Envase ${formatNum(m.volume_ml)} ml`)
  }
  if (m.pack_size != null) {
    const packPrice = m.price_per_unit * m.pack_size
    parts.push(`Pack de ${m.pack_size} · ${formatARS(packPrice)}/pack`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function MaterialList({ onEdit, onViewHistory, onAdjustStock, onViewStockHistory }: MaterialListProps) {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null)

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (lowStockOnly ? 1 : 0) +
    (sortBy !== 'name-asc' ? 1 : 0)

  const resetFilters = () => {
    setCategoryFilter('all')
    setLowStockOnly(false)
    setSortBy('name-asc')
  }

  const { data: materials = [], isLoading, isError } = useMaterials(
    workshopId,
    categoryFilter !== 'all' ? { category: categoryFilter } : undefined
  )
  const deleteMutation = useDeleteMaterial(workshopId)
  const { data: priceHistory = [] } = useAllPriceHistory(workshopId, 90)

  const sparklineByMaterial = useMemo(() => {
    const map = new Map<string, SparklinePoint[]>()
    for (const row of priceHistory) {
      const arr = map.get(row.material_id) ?? []
      arr.push({ date: row.changed_at, price: row.new_price })
      map.set(row.material_id, arr)
    }
    for (const m of materials) {
      const arr = map.get(m.id) ?? []
      arr.push({ date: m.updated_at, price: m.price_per_unit })
      map.set(m.id, arr)
    }
    return map
  }, [priceHistory, materials])

  const visibleMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    let filtered = q
      ? materials.filter((m) => {
          if (m.name.toLowerCase().includes(q)) return true
          if ((m.notes ?? '').toLowerCase().includes(q)) return true
          const subtypeLbl = m.wood_subtype
            ? WOOD_SUBTYPES.find((w) => w.value === m.wood_subtype)?.label.toLowerCase() ?? ''
            : ''
          if (subtypeLbl.includes(q)) return true
          return false
        })
      : materials
    if (lowStockOnly) {
      filtered = filtered.filter((m) => m.stock <= m.min_stock)
    }
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
  }, [materials, search, sortBy, lowStockOnly])

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

      {/* Search + filtros */}
      {/* Mobile: fila compacta con search + botón Filtros + botón Export icon-only */}
      <div className="flex gap-2 sm:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setFiltersOpen(true)}
          className="relative shrink-0"
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1 text-[10px] leading-none flex items-center justify-center rounded-full"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => exportMaterialsCsv(visibleMaterials)}
          disabled={visibleMaterials.length === 0}
          className="shrink-0"
          aria-label="Exportar CSV"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop: barra completa en fila */}
      <div className="hidden sm:flex sm:items-center sm:flex-wrap sm:gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
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
        <div className="flex items-center gap-2">
          <Switch
            id="low-stock-only"
            checked={lowStockOnly}
            onCheckedChange={setLowStockOnly}
          />
          <Label htmlFor="low-stock-only" className="text-sm cursor-pointer">
            Sólo stock bajo
          </Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportMaterialsCsv(visibleMaterials)}
          disabled={visibleMaterials.length === 0}
          className="ml-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Dialog de filtros (mobile) */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-sm">Categoría</Label>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as MaterialCategory | 'all')}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {MATERIAL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Orden</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="low-stock-only-mobile"
                checked={lowStockOnly}
                onCheckedChange={setLowStockOnly}
              />
              <Label htmlFor="low-stock-only-mobile" className="text-sm cursor-pointer">
                Sólo stock bajo
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={resetFilters} disabled={activeFilterCount === 0}>
              Limpiar
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <div className="flex items-center gap-2">
                    <span>{formatARS(material.price_per_unit)} / {material.unit}</span>
                    <PriceSparkline data={sparklineByMaterial.get(material.id) ?? []} width={50} height={18} />
                  </div>
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
                  <TableHead className="w-[100px]">Tendencia</TableHead>
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
                      <TableCell>
                        <PriceSparkline data={sparklineByMaterial.get(material.id) ?? []} />
                      </TableCell>
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
