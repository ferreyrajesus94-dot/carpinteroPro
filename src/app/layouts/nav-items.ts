import type { FabAction } from '@/shared/lib/fab'

export type NavItem = {
  to: string
  label: string
  icon: string
  /** Etiqueta del FAB contextual en mobile. Si no hay, no se muestra FAB. */
  fabLabel?: string
  /** Para rutas con su propio create page; si está, el FAB navega ahí. */
  fabHref?: string
  /** Si no hay href, dispara este evento global y la ruta lo maneja. */
  fabAction?: FabAction
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Inicio',        icon: 'fi-rr-apps' },
  { to: '/inventory', label: 'Inventario',    icon: 'fi-rr-box-open',     fabLabel: 'Material',     fabAction: 'inventory:new' },
  { to: '/recipes',   label: 'Muebles',       icon: 'fi-rr-couch',        fabLabel: 'Mueble',       fabAction: 'recipes:new' },
  { to: '/quotes',    label: 'Presupuestos',  icon: 'fi-rr-file-invoice', fabLabel: 'Presupuesto',  fabHref: '/quotes/new' },
  { to: '/crm',       label: 'Clientes',      icon: 'fi-rr-users',        fabLabel: 'Cliente',      fabAction: 'crm:new' },
  { to: '/tareas',    label: 'Tareas',        icon: 'fi-rr-checkbox',     fabLabel: 'Tarea',        fabAction: 'tasks:new' },
]
