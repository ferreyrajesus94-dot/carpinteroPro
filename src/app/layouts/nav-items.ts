import { LayoutGrid, PackageOpen, Wrench, Armchair, FileText, Users, SquareCheck, type LucideIcon } from 'lucide-react'
import type { FabAction } from '@/shared/lib/fab'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Etiqueta del FAB contextual en mobile. Si no hay, no se muestra FAB. */
  fabLabel?: string
  /** Para rutas con su propio create page; si está, el FAB navega ahí. */
  fabHref?: string
  /** Si no hay href, dispara este evento global y la ruta lo maneja. */
  fabAction?: FabAction
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Inicio',        icon: LayoutGrid },
  { to: '/inventory', label: 'Inventario',    icon: PackageOpen,     fabLabel: 'Material',     fabAction: 'inventory:new' },
  { to: '/production',label: 'Producción',    icon: Wrench },
  { to: '/recipes',   label: 'Muebles',       icon: Armchair,        fabLabel: 'Mueble',       fabAction: 'recipes:new' },
  { to: '/quotes',    label: 'Presupuestos',  icon: FileText, fabLabel: 'Presupuesto',  fabHref: '/quotes/new' },
  { to: '/crm',       label: 'Clientes',      icon: Users,        fabLabel: 'Cliente',      fabAction: 'crm:new' },
  { to: '/tareas',    label: 'Tareas',        icon: SquareCheck,     fabLabel: 'Tarea',        fabAction: 'tasks:new' },
]
