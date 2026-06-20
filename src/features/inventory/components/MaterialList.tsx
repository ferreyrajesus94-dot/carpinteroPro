import { useMemo, useState } from 'react'
import { Pencil, Trash2, TrendingUp, AlertTriangle, Search, PackagePlus, History, Download, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { Switch } from '@/shared/ui/switch'
import { Label } from '@/shared/ui/label'
import { SectionHowto } from '@/shared/ui/section-howto'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState, LoadingState } from '@/shared/ui/feedback-state'
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
import { PriceSparkline } from './PriceSparkline'
import type { SparklinePoint } from '@/shared/ui/PriceSparkline'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { exportMaterialsCsv } from '../lib/exportMaterialsCsv'
import { formatCurrency } from '@/shared/lib/formatters'
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
    parts.push(`Pack de ${m.pack_size} · ${formatCurrency(packPrice)}/pack`)
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

  const { data: materials = [], isLoading, isError } = useMaterials(workshopId)
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

  // Derived stats for stat strip
  const lowStockCount = useMemo(() => materials.filter(m => m.stock <= m.min_stock).length, [materials])
  const noStockCount = useMemo(() => materials.filter(m => m.stock === 0).length, [materials])
  const totalValue = useMemo(() => materials.reduce((s, m) => s + m.price_per_unit * m.stock, 0), [materials])

  // Category counts for chips
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of materials) map.set(m.category, (map.get(m.category) ?? 0) + 1)
    return map
  }, [materials])

  const visibleMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    let filtered = materials
    if (categoryFilter !== 'all') filtered = filtered.filter(m => m.category === categoryFilter)
    if (q) {
      filtered = filtered.filter((m) => {
        if (m.name.toLowerCase().includes(q)) return true
        if ((m.notes ?? '').toLowerCase().includes(q)) return true
        const subtypeLbl = m.wood_subtype
          ? WOOD_SUBTYPES.find((w) => w.value === m.wood_subtype)?.label.toLowerCase() ?? ''
          : ''
        return subtypeLbl.includes(q)
      })
    }
    if (lowStockOnly) filtered = filtered.filter((m) => m.stock <= m.min_stock)
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':   return a.name.localeCompare(b.name, 'es')
        case 'name-desc':  return b.name.localeCompare(a.name, 'es')
        case 'stock-asc':  return a.stock - b.stock
        case 'stock-desc': return b.stock - a.stock
        case 'price-asc':  return a.price_per_unit - b.price_per_unit
        case 'price-desc': return b.price_per_unit - a.price_per_unit
      }
    })
  }, [materials, categoryFilter, search, sortBy, lowStockOnly])

  if (isError) {
    return (
      <ErrorState
        title="Error al cargar los materiales"
        description="Revisá tu conexión e intentá de nuevo."
      />
    )
  }

  if (isLoading) {
    return <LoadingState label="Cargando materiales..." />
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

      <SectionHowto
        storageKey="inventory"
        steps={[
          'Cada material tiene stock, precio y tendencia de las últimas semanas.',
          'Usá el filtro "Stock bajo" para ver lo que hay que reponer.',
          'Tocá los botones de acción para editar, ajustar stock o ver historial.',
        ]}
      />

      {/* Stat strip — clickeable para filtrar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="bg-surface border border-line rounded-xl p-3.5">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Materiales</div>
          <div className="mt-1.5 font-display text-[22px] leading-none font-semibold text-ink">{materials.length}</div>
        </div>
        <button
          onClick={() => setLowStockOnly(v => !v)}
          className={`text-left rounded-xl p-3.5 border transition-all ${
            lowStockOnly
              ? 'border-[var(--cp-warn)] ring-2 ring-[var(--cp-warn)]/20 bg-surface'
              : 'border-line bg-surface hover:border-line2'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Stock bajo</div>
            {lowStockCount > 0 && <AlertTriangle size={13} style={{ color: 'var(--cp-warn)' }} />}
          </div>
          <div className="mt-1.5 font-display text-[22px] leading-none font-semibold text-ink">{lowStockCount}</div>
          <div className="mt-1 text-[11px] text-ink3">{lowStockOnly ? '✓ Filtrando' : 'Tocá para filtrar'}</div>
        </button>
        <div className="bg-surface border border-line rounded-xl p-3.5">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Sin stock</div>
          <div className={`mt-1.5 font-display text-[22px] leading-none font-semibold ${noStockCount > 0 ? 'text-[var(--cp-danger)]' : 'text-ink'}`}>{noStockCount}</div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-3.5">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-ink3 font-medium">Valor inventario</div>
          <div className="mt-1.5 font-display text-[18px] leading-none font-semibold text-ink truncate">{formatCurrency(totalValue)}</div>
        </div>
      </div>

      {/* Search + filtros */}
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
          <Switch id="low-stock-only" checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          <Label htmlFor="low-stock-only" className="text-sm cursor-pointer">Sólo stock bajo</Label>
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

      {/* Category chips — scrollable horizontal */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[{ value: 'all', label: 'Todos', count: materials.length }, ...MATERIAL_CATEGORIES.map(c => ({
          value: c.value,
          label: c.label,
          count: categoryCounts.get(c.value) ?? 0,
        }))].filter(c => c.value === 'all' || c.count > 0).map(chip => (
          <button
            key={chip.value}
            onClick={() => setCategoryFilter(chip.value as MaterialCategory | 'all')}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              categoryFilter === chip.value
                ? 'bg-cp-accent text-white'
                : 'bg-cp-bg2 text-ink2 hover:bg-cp-bg border border-line'
            }`}
          >
            {chip.label}
            <span className={`font-mono text-[10px] ${categoryFilter === chip.value ? 'opacity-80' : 'text-ink3'}`}>
              {chip.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filtros dialog (mobile) */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Switch id="low-stock-only-mobile" checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
              <Label htmlFor="low-stock-only-mobile" className="text-sm cursor-pointer">Sólo stock bajo</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={resetFilters} disabled={activeFilterCount === 0}>Limpiar</Button>
            <Button onClick={() => setFiltersOpen(false)}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {visibleMaterials.length === 0 ? (
        <EmptyState
          icon={materials.length === 0 ? PackagePlus : Search}
          title={materials.length === 0 ? 'Sin materiales todavía' : 'Nada coincide'}
          description={
            materials.length === 0
              ? 'Agregá el primero con el botón Nuevo material.'
              : 'Probá cambiar los filtros o limpiar la búsqueda.'
          }
        />
      ) : (
        <>
          {/* Mobile: cards densas */}
          <div className="sm:hidden space-y-2">
            {visibleMaterials.map((material) => {
              const isLow = material.stock <= material.min_stock
              const extra = formatExtraInfo(material)
              return (
                <div key={material.id} className="bg-surface border border-line rounded-xl overflow-hidden hover:border-line2 transition-colors">
                  <div className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-[14px] text-ink truncate">{material.name}</div>
                            {extra && <div className="text-[11.5px] text-ink3 truncate mt-0.5">{extra}</div>}
                          </div>
                          {isLow && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                                  style={{ background: 'oklch(94% 0.06 70)', color: 'oklch(40% 0.14 40)' }}>
                              <AlertTriangle size={10} />
                              Stock bajo
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 flex items-end justify-between gap-2">
                          <div>
                            <div className="font-mono text-[15px] font-semibold text-ink">{formatCurrency(material.price_per_unit)}</div>
                            <div className="text-[11px] text-ink3">por {material.unit}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-mono text-[15px] font-semibold ${isLow ? 'text-[var(--cp-warn)]' : 'text-ink'}`}>
                              {material.stock}
                            </div>
                            <div className="text-[11px] text-ink3">stock · mín {material.min_stock}</div>
                          </div>
                          <div className="text-cp-accent self-end">
                            <PriceSparkline data={sparklineByMaterial.get(material.id) ?? []} width={52} height={20} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-line px-3 py-2 flex gap-1">
                    {actions(material)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-xl border border-line overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-cp-bg2 hover:bg-cp-bg2">
                  <TableHead className="text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Nombre</TableHead>
                  <TableHead className="text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Categoría</TableHead>
                  <TableHead className="text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Precio/u</TableHead>
                  <TableHead className="text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Stock</TableHead>
                  <TableHead className="text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Unidad</TableHead>
                  <TableHead className="w-[100px] text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Tendencia</TableHead>
                  <TableHead className="w-[160px] text-ink3 font-medium text-[11px] uppercase tracking-[0.06em]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMaterials.map((material) => {
                  const isLowStock = material.stock <= material.min_stock
                  return (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="flex items-center gap-2">
                          {material.name}
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full"
                                  style={{ background: 'oklch(94% 0.06 70)', color: 'oklch(40% 0.14 40)' }}>
                              <AlertTriangle size={10} />
                              Stock bajo
                            </span>
                          )}
                        </div>
                        {formatExtraInfo(material) && (
                          <p className="text-[11.5px] text-ink3 font-normal mt-0.5">{formatExtraInfo(material)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-ink2 capitalize text-sm">{material.category}</TableCell>
                      <TableCell className="font-mono text-sm text-ink">{formatCurrency(material.price_per_unit)}</TableCell>
                      <TableCell>
                        <span className={`font-mono text-sm font-medium ${isLowStock ? 'text-[var(--cp-warn)]' : 'text-ink'}`}>
                          {material.stock}
                        </span>
                        {material.min_stock > 0 && (
                          <span className="text-ink3 text-xs ml-1">/ mín {material.min_stock}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-ink2 text-sm">{material.unit}</TableCell>
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
