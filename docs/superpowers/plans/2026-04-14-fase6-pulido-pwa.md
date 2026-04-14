# Fase 6 — Pulido UX, PWA Offline y Code Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el proyecto con polish mobile-first en todas las features, PWA offline con caché de datos, y una pasada ligera del simplifier.

**Architecture:** Orden de ejecución — Bloque 1 (Pulido UX, feature a feature) → Bloque 2 (PWA Offline) → Bloque 3 (Code Review). Las tareas de shared (Skeleton, QuoteStatusBadge, useOnlineStatus) van primero porque las consumen todas las features.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3 (breakpoint `sm:` = 640px), shadcn/ui, TanStack Query v5, vite-plugin-pwa, @tanstack/query-persist-client-core, @tanstack/query-sync-storage-persister, sharp (dev dep para icons).

---

## Archivos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/shared/hooks/useOnlineStatus.ts` | Detecta conexión a internet |
| `src/shared/components/OfflineBanner.tsx` | Barra de aviso modo offline |
| `src/features/quotes/components/QuoteStatusBadge.tsx` | Badge de estado unificado |
| `scripts/generate-icons.mjs` | Genera PWA icons 192/512 |
| `public/icons/icon-192.png` | Ícono PWA 192×192 (generado) |
| `public/icons/icon-512.png` | Ícono PWA 512×512 (generado) |

## Archivos modificados clave

| Archivo | Cambio |
|---|---|
| `src/app/layouts/AppLayout.tsx` | Integrar OfflineBanner |
| `src/shared/lib/queryClient.ts` | Agregar persist client |
| `src/features/inventory/components/MaterialList.tsx` | Skeleton + mobile cards + offline |
| `src/features/recipes/components/MuebleList.tsx` | Skeleton + mobile cards + offline |
| `src/features/quotes/components/QuoteList.tsx` | Skeleton + mobile cards + offline + QuoteStatusBadge |
| `src/features/crm/components/KanbanBoard.tsx` | Mobile list view + offline |
| `src/features/crm/components/ClientList.tsx` | Skeleton + mobile cards + offline |
| `src/features/dashboard/components/ActiveQuotesPanel.tsx` | Mobile cards |

---

## BLOQUE 1: Pulido UX

---

### Task 1: Shared — Skeleton + QuoteStatusBadge + useOnlineStatus

**Files:**
- Create: `src/shared/hooks/useOnlineStatus.ts`
- Create: `src/features/quotes/components/QuoteStatusBadge.tsx`
- Install: shadcn Skeleton component

- [ ] **Step 1: Install shadcn Skeleton**

```bash
npx shadcn add skeleton
```

> **Bug conocido:** shadcn escribe en `@/shared/ui/` literal. Si aparece una carpeta `@/` en la raíz del proyecto, moverla:
> ```bash
> cp "@/shared/ui/skeleton.tsx" src/shared/ui/skeleton.tsx 2>/dev/null; rm -rf "@/"
> ```
> Verificar que existe `src/shared/ui/skeleton.tsx`.

- [ ] **Step 2: Write failing test for useOnlineStatus**

Crear `src/shared/hooks/useOnlineStatus.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('updates to false when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
  })

  it('updates to true when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    const { result } = renderHook(() => useOnlineStatus())
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/shared/hooks/useOnlineStatus.test.ts
```

Expected: FAIL (módulo no encontrado)

- [ ] **Step 4: Implement useOnlineStatus**

Crear `src/shared/hooks/useOnlineStatus.ts`:

```ts
import { useEffect, useState } from 'react'

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/shared/hooks/useOnlineStatus.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 6: Create QuoteStatusBadge**

Crear `src/features/quotes/components/QuoteStatusBadge.tsx`:

```tsx
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../types'
import type { QuoteStatus } from '../types'

interface QuoteStatusBadgeProps {
  status: QuoteStatus
}

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[status]}`}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/hooks/useOnlineStatus.ts src/shared/hooks/useOnlineStatus.test.ts src/features/quotes/components/QuoteStatusBadge.tsx src/shared/ui/skeleton.tsx
git commit -m "feat(shared): add useOnlineStatus hook, QuoteStatusBadge, and Skeleton"
```

---

### Task 2: Inventory — skeleton + mobile cards + offline

**Files:**
- Modify: `src/features/inventory/components/MaterialList.tsx`

- [ ] **Step 1: Replace loading state with Skeleton and add mobile card view**

Reemplazar el contenido de `src/features/inventory/components/MaterialList.tsx`:

```tsx
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
import { useMaterials, useDeleteMaterial } from '../hooks/useMaterials'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import type { Material, MaterialCategory } from '../types'
import { MATERIAL_CATEGORIES } from '../types'

interface MaterialListProps {
  onEdit: (material: Material) => void
  onViewHistory: (material: Material) => void
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n)

export function MaterialList({ onEdit, onViewHistory }: MaterialListProps) {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | 'all'>('all')

  const { data: materials = [], isLoading } = useMaterials(
    workshopId,
    categoryFilter !== 'all' ? { category: categoryFilter } : undefined
  )
  const deleteMutation = useDeleteMaterial(workshopId)

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
          onClick={() => {
            if (confirm(`¿Eliminar "${material.name}"?`)) deleteMutation.mutate(material.id)
          }}
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
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 3: Commit**

```bash
git add src/features/inventory/components/MaterialList.tsx
git commit -m "feat(inventory): mobile cards, skeleton loading, offline-aware buttons"
```

---

### Task 3: Recipes — skeleton + mobile cards + offline

**Files:**
- Modify: `src/features/recipes/components/MuebleList.tsx`

- [ ] **Step 1: Read current MuebleList**

Leer `src/features/recipes/components/MuebleList.tsx` para entender la estructura actual.

- [ ] **Step 2: Add skeleton, mobile cards, and offline**

Modificar `MuebleList.tsx` aplicando el mismo patrón que MaterialList:

1. Importar `Skeleton` de `@/shared/ui/skeleton` y `useOnlineStatus` de `@/shared/hooks/useOnlineStatus`.
2. Reemplazar el loading state (texto "Cargando...") con:
   ```tsx
   return (
     <div className="space-y-2">
       {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
     </div>
   )
   ```
3. Antes del return principal, obtener `const isOnline = useOnlineStatus()`.
4. Envolver la lista existente en:
   ```tsx
   <>
     {/* Mobile: cards */}
     <div className="sm:hidden space-y-2">
       {muebles.map((m) => (
         <div key={m.id} className="rounded-md border p-3 space-y-1">
           <div className="flex items-center justify-between">
             <span className="font-medium">{m.name}</span>
             <span className="text-sm text-muted-foreground">{formatARS(m.total_cost)}</span>
           </div>
           <div className="flex gap-1 pt-1">
             <Button variant="ghost" size="icon" disabled={!isOnline} onClick={() => onEdit(m)}>
               <Pencil className="h-4 w-4" />
             </Button>
             <Button variant="ghost" size="icon" disabled={!isOnline} onClick={() => onDelete(m.id)}>
               <Trash2 className="h-4 w-4 text-destructive" />
             </Button>
           </div>
         </div>
       ))}
     </div>
     {/* Desktop: tabla existente envuelta en <div className="hidden sm:block"> */}
     <div className="hidden sm:block">
       {/* ... tabla original sin cambios ... */}
     </div>
   </>
   ```
5. Agregar `disabled={!isOnline}` a los botones de editar y eliminar dentro de la tabla desktop también.

> Adaptar los props/nombres a los que use el componente actual (puede llamar `onEdit`, `onDelete` u otros).

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add src/features/recipes/components/MuebleList.tsx
git commit -m "feat(recipes): mobile cards, skeleton loading, offline-aware buttons"
```

---

### Task 4: QuoteList — skeleton + mobile cards + offline + QuoteStatusBadge

**Files:**
- Modify: `src/features/quotes/components/QuoteList.tsx`

- [ ] **Step 1: Replace QuoteList content**

Reemplazar `src/features/quotes/components/QuoteList.tsx` con:

```tsx
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useQuotes, useDeleteQuote } from '../hooks/useQuotes'
import { formatCurrency } from '../types'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { calculateQuote } from '../lib/calculator'

export function QuoteList() {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)
  const deleteMutation = useDeleteQuote(workshopId)

  function handleDelete(id: string, quoteNumber: string) {
    if (confirm(`¿Eliminar el presupuesto ${quoteNumber}?`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Button asChild disabled={!isOnline}>
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
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {quotes.map((q) => {
              const { salePrice } = calculateQuote({
                recipeCost: q.recipe_cost,
                extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
                marginMode: q.margin_mode,
                marginPct: q.margin_pct,
              })
              return (
                <div key={q.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-medium text-sm">{q.quote_number}</span>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <p className="text-sm font-medium">{q.furniture_name}</p>
                  <p className="text-xs text-muted-foreground">{q.client?.name ?? 'Sin cliente'}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatCurrency(salePrice)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/quotes/${q.id}/contract`}><FileText className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild disabled={!isOnline}>
                        <Link to={`/quotes/${q.id}`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!isOnline}
                        onClick={() => handleDelete(q.id, q.quote_number)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">N°</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Mueble</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((q) => {
                  const { salePrice } = calculateQuote({
                    recipeCost: q.recipe_cost,
                    extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
                    marginMode: q.margin_mode,
                    marginPct: q.margin_pct,
                  })
                  return (
                    <tr key={q.id}>
                      <td className="px-4 py-3 font-mono font-medium">{q.quote_number}</td>
                      <td className="px-4 py-3">{q.client?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">{q.furniture_name}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(salePrice)}</td>
                      <td className="px-4 py-3"><QuoteStatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/quotes/${q.id}/contract`}><FileText className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild disabled={!isOnline}>
                            <Link to={`/quotes/${q.id}`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!isOnline}
                            onClick={() => handleDelete(q.id, q.quote_number)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 3: Commit**

```bash
git add src/features/quotes/components/QuoteList.tsx
git commit -m "feat(quotes): mobile cards, skeleton, QuoteStatusBadge, offline-aware buttons"
```

---

### Task 4b: QuoteForm — single-column on mobile

**Files:**
- Modify: `src/features/quotes/components/QuoteForm.tsx`

- [ ] **Step 1: Read QuoteForm to identify grid layouts**

Leer `src/features/quotes/components/QuoteForm.tsx` y buscar clases `grid-cols-2` o `grid grid-cols-`.

- [ ] **Step 2: Make grids responsive**

Por cada `className` que contenga `grid-cols-2` sin prefijo responsive, agregar `sm:` antes:

```text
grid grid-cols-2  →  grid sm:grid-cols-2
```

Esto convierte todos los layouts de dos columnas en una sola columna en mobile (`< 640px`) de forma automática. No cambiar nada más.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add src/features/quotes/components/QuoteForm.tsx
git commit -m "feat(quotes): make QuoteForm single-column on mobile"
```

---

### Task 5: CRM — KanbanBoard mobile list view + offline

**Files:**
- Modify: `src/features/crm/components/KanbanBoard.tsx`

- [ ] **Step 1: Replace KanbanBoard with mobile-aware version**

Reemplazar `src/features/crm/components/KanbanBoard.tsx` con:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { formatCurrency, QUOTE_STATUS_LABELS, type QuoteStatus } from '@/features/quotes/types'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/ui/select'
import { QuoteStatusBadge } from '@/features/quotes/components/QuoteStatusBadge'
import { calculateQuote } from '@/features/quotes/lib/calculator'
import { KanbanCard } from './KanbanCard'
import type { QuoteWithExtras } from '@/features/quotes/types'

const STATUS_ORDER: QuoteStatus[] = [
  'presupuesto', 'enviado', 'aprobado', 'en_produccion', 'entregado', 'cancelado',
]

function columnTotal(quotes: QuoteWithExtras[]): number {
  return quotes.reduce((acc, q) => {
    const { salePrice } = calculateQuote({
      recipeCost: q.recipe_cost,
      extras: q.extras.map((e) => ({ amount: e.amount, show_in_quote: e.show_in_quote })),
      marginMode: q.margin_mode,
      marginPct: q.margin_pct,
    })
    return acc + salePrice
  }, 0)
}

export function KanbanBoard() {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const { data: quotes = [], isLoading } = useQuotes(workshopId)
  const [mobileStatus, setMobileStatus] = useState<QuoteStatus>('enviado')

  const grouped = STATUS_ORDER.reduce<Record<QuoteStatus, QuoteWithExtras[]>>(
    (acc, status) => { acc[status] = quotes.filter((q) => q.status === status); return acc },
    {} as Record<QuoteStatus, QuoteWithExtras[]>
  )

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Kanban</h1>
        <Link to="/crm/clientes" className="text-sm text-primary underline underline-offset-4">
          Clientes →
        </Link>
      </div>

      {/* Mobile: lista filtrable por estado */}
      <div className="sm:hidden p-4 space-y-3">
        <Select value={mobileStatus} onValueChange={(v) => setMobileStatus(v as QuoteStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]} ({grouped[s].length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {grouped[mobileStatus].length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin presupuestos en este estado</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(columnTotal(grouped[mobileStatus]))}
            </p>
            {grouped[mobileStatus].map((q) => (
              <KanbanCard key={q.id} quote={q} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: columnas horizontales */}
      <div className="hidden sm:flex flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {STATUS_ORDER.map((status) => {
            const cards = grouped[status]
            return (
              <div key={status} className="flex flex-col w-64 bg-muted/40 rounded-lg">
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{QUOTE_STATUS_LABELS[status]}</span>
                    <span className="text-xs bg-muted rounded-full px-2 py-0.5">{cards.length}</span>
                  </div>
                  {cards.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{formatCurrency(columnTotal(cards))}</p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {cards.map((q) => <KanbanCard key={q.id} quote={q} />)}
                  {cards.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin presupuestos</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!isOnline && (
        <p className="text-xs text-center text-muted-foreground pb-2">Modo solo lectura — sin conexión</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 3: Commit**

```bash
git add src/features/crm/components/KanbanBoard.tsx
git commit -m "feat(crm): KanbanBoard mobile list view with status filter, skeleton, offline indicator"
```

---

### Task 6: CRM — ClientList mobile cards + skeleton + offline

**Files:**
- Modify: `src/features/crm/components/ClientList.tsx`

- [ ] **Step 1: Replace ClientList with mobile-aware version**

Reemplazar `src/features/crm/components/ClientList.tsx` con:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useClients } from '@/features/crm/hooks/useClients'
import { useQuotes } from '@/features/quotes/hooks/useQuotes'
import { CLIENT_SOURCE_LABELS } from '@/features/crm/types'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { ClientForm } from './ClientForm'
import type { Client } from '@/features/crm/types'

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ClientList() {
  const workshopId = useWorkshopId()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
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

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button size="sm" disabled={!isOnline} onClick={() => setFormOpen(true)}>
          + Nuevo cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Sin clientes todavía.</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden p-4 space-y-2 overflow-y-auto">
            {clients.map((client: Client) => {
              const stats = statsByClient[client.id]
              return (
                <div
                  key={client.id}
                  className="rounded-md border p-3 space-y-1 cursor-pointer hover:bg-muted/30"
                  onClick={() => navigate(`/crm/clientes/${client.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{client.name}</span>
                    <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                      {CLIENT_SOURCE_LABELS[client.source]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{client.phone ?? '—'}</span>
                    <span>{stats?.count ?? 0} presupuestos</span>
                  </div>
                  {stats && (
                    <p className="text-xs text-muted-foreground">Último: {formatDate(stats.lastDate)}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-auto flex-1">
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
        </>
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => setFormOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 3: Commit**

```bash
git add src/features/crm/components/ClientList.tsx
git commit -m "feat(crm): ClientList mobile cards, skeleton, offline-aware new button"
```

---

### Task 6b: CRM — ClientDetail mobile

**Files:**
- Modify: `src/features/crm/components/ClientDetail.tsx`

- [ ] **Step 1: Read current ClientDetail**

Leer `src/features/crm/components/ClientDetail.tsx` para identificar la estructura del historial de presupuestos.

- [ ] **Step 2: Make history table responsive**

Aplicar el mismo patrón de cards/tabla:

1. Envolver la tabla de historial en `<div className="hidden sm:block">`.
2. Agregar antes la versión mobile:

```tsx
{/* Mobile: historial como cards */}
<div className="sm:hidden space-y-2">
  {clientQuotes.map((q) => (
    <Link key={q.id} to={`/quotes/${q.id}`} className="block rounded-md border p-3 space-y-1 hover:bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm">{q.quote_number}</span>
        <QuoteStatusBadge status={q.status} />
      </div>
      <p className="text-sm">{q.furniture_name}</p>
      <p className="text-xs text-muted-foreground">{formatDate(q.created_at)}</p>
    </Link>
  ))}
</div>
```

3. Agregar import de `QuoteStatusBadge`:

```tsx
import { QuoteStatusBadge } from '@/features/quotes/components/QuoteStatusBadge'
```

> Adaptar `clientQuotes`, `formatDate`, y el nombre del campo fecha al código actual del componente.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add src/features/crm/components/ClientDetail.tsx
git commit -m "feat(crm): ClientDetail mobile history cards, QuoteStatusBadge"
```

---

### Task 7: Dashboard — ActiveQuotesPanel mobile cards + QuoteStatusBadge

**Files:**
- Modify: `src/features/dashboard/components/ActiveQuotesPanel.tsx`

- [ ] **Step 1: Read current ActiveQuotesPanel**

Leer `src/features/dashboard/components/ActiveQuotesPanel.tsx` para ver su estructura actual.

- [ ] **Step 2: Add mobile cards and QuoteStatusBadge**

Agregar a las importaciones:
```tsx
import { QuoteStatusBadge } from '@/features/quotes/components/QuoteStatusBadge'
```

Después de la tabla existente (envuelta en `<div className="hidden sm:block">`), agregar antes:

```tsx
{/* Mobile: cards */}
<div className="sm:hidden space-y-2 p-4">
  {activeQuotes.length === 0 ? (
    <p className="text-sm text-muted-foreground text-center py-8">No hay presupuestos activos</p>
  ) : (
    activeQuotes.map((q) => (
      <Link key={q.id} to={`/quotes/${q.id}`} className="block rounded-md border p-3 space-y-1 hover:bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-medium">{q.quote_number}</span>
          <QuoteStatusBadge status={q.status} />
        </div>
        <p className="text-sm font-medium">{q.furniture_name}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{q.client?.name ?? '—'}</span>
          <span>{formatCurrency(getSalePrice(q))}</span>
        </div>
      </Link>
    ))
  )}
</div>
```

Envolver la tabla existente en `<div className="hidden sm:block">`.

Reemplazar el inline badge span de estado por `<QuoteStatusBadge status={q.status} />` dentro de la tabla desktop.

> Adaptar `getSalePrice` o el cálculo de precio que use el componente actual.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/components/ActiveQuotesPanel.tsx
git commit -m "feat(dashboard): ActiveQuotesPanel mobile cards, QuoteStatusBadge"
```

---

## BLOQUE 2: PWA Offline

---

### Task 8: OfflineBanner + AppLayout

**Files:**
- Create: `src/shared/components/OfflineBanner.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`

- [ ] **Step 1: Create OfflineBanner**

Crear `src/shared/components/OfflineBanner.tsx`:

```tsx
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-4 py-1.5 border-b border-yellow-200">
      <WifiOff className="h-3 w-3 shrink-0" />
      Sin conexión — modo solo lectura
    </div>
  )
}
```

- [ ] **Step 2: Wire OfflineBanner into AppLayout**

En `src/app/layouts/AppLayout.tsx`, agregar el import:

```tsx
import { OfflineBanner } from '@/shared/components/OfflineBanner'
```

Agregar `<OfflineBanner />` como primer hijo del `<div className="flex flex-1 flex-col overflow-hidden">`, antes del `<header>`:

```tsx
<div className="flex flex-1 flex-col overflow-hidden">
  <OfflineBanner />
  {/* Header mobile */}
  <header className="flex h-14 items-center px-4 border-b md:hidden">
    ...
  </header>
  ...
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/OfflineBanner.tsx src/app/layouts/AppLayout.tsx
git commit -m "feat(pwa): add OfflineBanner in AppLayout for offline detection"
```

---

### Task 9: TanStack Query persist client

**Files:**
- Modify: `src/shared/lib/queryClient.ts`

- [ ] **Step 1: Install persist packages**

```bash
npm install @tanstack/query-persist-client-core @tanstack/query-sync-storage-persister
```

Expected: paquetes agregados a `package.json`.

- [ ] **Step 2: Update queryClient.ts**

Reemplazar `src/shared/lib/queryClient.ts` con:

```ts
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutos
      retry: 1,
      gcTime: 1000 * 60 * 60 * 24, // 24 horas — requerido para que persist funcione
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 horas
})
```

- [ ] **Step 3: Verify build and tests**

```bash
npm run build && npm run test
```

Expected: build sin errores, todos los tests pasan.

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/queryClient.ts package.json package-lock.json
git commit -m "feat(pwa): persist TanStack Query cache to localStorage for offline data"
```

---

### Task 10: PWA icons

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`

- [ ] **Step 1: Install sharp as dev dependency**

```bash
npm install -D sharp
```

- [ ] **Step 2: Create icon generation script**

Crear `scripts/generate-icons.mjs`:

```js
import sharp from 'sharp'
import { mkdir } from 'fs/promises'

await mkdir('public/icons', { recursive: true })

function svgBuffer(size) {
  const fontSize = Math.round(size * 0.35)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="#1e293b"/>
      <text x="50%" y="54%" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">CP</text>
    </svg>`
  )
}

for (const size of [192, 512]) {
  await sharp(svgBuffer(size)).png().toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ public/icons/icon-${size}.png`)
}
```

- [ ] **Step 3: Generate icons**

```bash
node scripts/generate-icons.mjs
```

Expected:
```
✓ public/icons/icon-192.png
✓ public/icons/icon-512.png
```

- [ ] **Step 4: Verify icons exist**

```bash
ls -lh public/icons/
```

Expected: dos archivos PNG de tamaño > 0 bytes.

- [ ] **Step 5: Verify build with icons**

```bash
npm run build
```

Expected: sin errores, `dist/icons/` contiene los dos PNGs.

- [ ] **Step 6: Commit**

```bash
git add public/icons/ scripts/generate-icons.mjs package.json package-lock.json
git commit -m "feat(pwa): generate app icons 192x512 for PWA manifest"
```

---

## BLOQUE 3: Code Review

---

### Task 11: Simplifier + verificación final

**Files:** Los archivos modificados en esta fase.

- [ ] **Step 1: Run code-simplifier**

Invocar el skill `code-simplifier:code-simplifier`. El simplifier revisará el código reciente y sugerirá mejoras. Aplicar solo sugerencias de: código duplicado obvio, imports sin usar, lógica innecesariamente compleja. Ignorar: extracciones de abstracción para un solo uso, refactors estructurales.

- [ ] **Step 2: Run full verification**

```bash
npm run build
```

Expected: cero errores TS.

```bash
npm run lint
```

Expected: cero warnings nuevos respecto a main.

```bash
npm run test
```

Expected: todos los tests pasan (incluyendo los nuevos de `useOnlineStatus`).

- [ ] **Step 3: Final commit**

```bash
git add -p   # revisar y stagear solo los cambios del simplifier
git commit -m "refactor: simplifier pass on fase6 changes"
```

- [ ] **Step 4: Invoke finishing-a-development-branch**

Invocar el skill `superpowers:finishing-a-development-branch` para decidir cómo integrar el trabajo (PR vs merge directo).
