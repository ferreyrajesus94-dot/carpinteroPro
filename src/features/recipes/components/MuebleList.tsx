import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Copy, FileText, Search, AlertTriangle, FileDown } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import {
  useFurnitureTemplates,
  useDeleteFurnitureTemplate,
  useDuplicateFurnitureTemplate,
  useTemplateUsageCounts,
} from '../hooks/useRecipes'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useMaterials } from '@/features/inventory/hooks/useMaterials'
import { useAllPriceHistory } from '@/features/inventory/hooks/useAllPriceHistory'
import { useWorkshopSettings } from '@/features/settings/hooks/useWorkshopSettings'
import { FurnitureCostSparkline } from './FurnitureCostSparkline'
import { computeStockShortages } from '../lib/stockCheck'
import { generateTechnicalSheetPDF } from '../lib/pdf'
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
  const { data: usageCounts = {} } = useTemplateUsageCounts(workshopId)
  const { data: settings } = useWorkshopSettings(workshopId)
  const { data: materials = [] } = useMaterials(workshopId)
  const { data: priceHistory = [] } = useAllPriceHistory(workshopId)
  const stockAlertEnabled = Boolean(settings?.stock_alert_enabled)
  const deleteMutation = useDeleteFurnitureTemplate(workshopId)
  const duplicateMutation = useDuplicateFurnitureTemplate(workshopId)
  const [deleteTarget, setDeleteTarget] = useState<FurnitureTemplateWithItems | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__')

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of templates) if (t.category) set.add(t.category)
    return Array.from(set).sort()
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((t) => {
      if (categoryFilter !== '__all__' && t.category !== categoryFilter) return false
      if (!q) return true
      const haystack = [
        t.name,
        t.category ?? '',
        ...(t.tags ?? []),
        t.notes ?? '',
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [templates, search, categoryFilter])

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
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Eliminar mueble"
        description={`¿Seguro que querés eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
          setDeleteTarget(null)
        }}
        isPending={deleteMutation.isPending}
      />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, tag, categoría..."
            className="pl-8"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filteredTemplates.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</p>
      )}

      {/* Mobile: cards */}
      <div className="sm:hidden space-y-2">
        {filteredTemplates.map((template) => {
          const { total } = computeRecipeCost(template.recipe_items, template.labor_items)
          const usedIn = usageCounts[template.id] ?? 0
          const dims = [template.height_cm, template.width_cm, template.depth_cm].filter((v) => v != null)
          const shortages = stockAlertEnabled
            ? computeStockShortages(template.recipe_items, materials)
            : []
          return (
            <div key={template.id} className="rounded-md border p-3 space-y-1">
              <div className="flex items-center gap-3">
                {template.photo_url && (
                  <img src={template.photo_url} alt="" className="h-12 w-12 rounded object-cover border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate flex items-center gap-1">
                      {template.name}
                      {shortages.length > 0 && (
                        <AlertTriangle
                          className="h-4 w-4 text-destructive shrink-0"
                          aria-label={`Faltan ${shortages.length} materiales`}
                        />
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground shrink-0 flex items-center gap-2">
                      <FurnitureCostSparkline items={template.recipe_items} priceHistory={priceHistory} />
                      {formatARS(total)}
                    </span>
                  </div>
                  {template.category && (
                    <span className="text-xs text-muted-foreground">{template.category}</span>
                  )}
                </div>
              </div>
              {dims.length === 3 && (
                <p className="text-xs text-muted-foreground">
                  {template.height_cm}×{template.width_cm}×{template.depth_cm} cm (A×An×P)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {template.recipe_items.length} material{template.recipe_items.length !== 1 ? 'es' : ''}
                {usedIn > 0 && ' · '}
                {usedIn > 0 && (
                  <Link to={`/quotes?template=${template.id}`} className="underline">
                    usado en {usedIn} presupuesto{usedIn !== 1 ? 's' : ''}
                  </Link>
                )}
              </p>
              <div className="flex gap-1 pt-1">
                <Button variant="ghost" size="icon" disabled={!isOnline} onClick={() => onEdit(template)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!isOnline || duplicateMutation.isPending}
                  onClick={() => duplicateMutation.mutate(template.id)}
                  title="Duplicar"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" asChild disabled={!isOnline} title="Crear presupuesto">
                  <Link to={`/quotes/new?template=${template.id}`}>
                    <FileText className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => generateTechnicalSheetPDF({ template, settings: settings ?? null })}
                  title="Exportar ficha técnica PDF"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!isOnline}
                  onClick={() => setDeleteTarget(template)}
                  title="Eliminar"
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
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Medidas (cm)</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Usado en</TableHead>
              <TableHead>Costo estimado</TableHead>
              <TableHead className="w-[180px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.map((template) => {
              const { total } = computeRecipeCost(template.recipe_items, template.labor_items)
              const usedIn = usageCounts[template.id] ?? 0
              const hasDims = template.height_cm != null && template.width_cm != null && template.depth_cm != null
              const shortages = stockAlertEnabled
                ? computeStockShortages(template.recipe_items, materials)
                : []
              return (
                <TableRow key={template.id}>
                  <TableCell>
                    {template.photo_url ? (
                      <img src={template.photo_url} alt="" className="h-10 w-10 rounded object-cover border" />
                    ) : (
                      <div className="h-10 w-10 rounded border bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {template.name}
                      {shortages.length > 0 && (
                        <AlertTriangle
                          className="h-4 w-4 text-destructive shrink-0"
                          aria-label={`Faltan ${shortages.length} materiales`}
                        />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {template.category ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {hasDims ? `${template.height_cm}×${template.width_cm}×${template.depth_cm}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {template.recipe_items.length} material{template.recipe_items.length !== 1 ? 'es' : ''}
                  </TableCell>
                  <TableCell className="text-sm">
                    {usedIn > 0 ? (
                      <Link to={`/quotes?template=${template.id}`} className="underline text-muted-foreground hover:text-foreground">
                        {usedIn} presupuesto{usedIn !== 1 ? 's' : ''}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    <span className="inline-flex items-center gap-2">
                      <FurnitureCostSparkline items={template.recipe_items} priceHistory={priceHistory} />
                      {formatARS(total)}
                    </span>
                  </TableCell>
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
                        disabled={!isOnline || duplicateMutation.isPending}
                        onClick={() => duplicateMutation.mutate(template.id)}
                        title="Duplicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        disabled={!isOnline}
                        title="Crear presupuesto"
                      >
                        <Link to={`/quotes/new?template=${template.id}`}>
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => generateTechnicalSheetPDF({ template, settings: settings ?? null })}
                        title="Exportar ficha técnica PDF"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!isOnline}
                        onClick={() => setDeleteTarget(template)}
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
