# Fase 6 — Pulido UX, PWA Offline y Code Review

**Fecha:** 2026-04-14  
**Status:** Aprobado

## Objetivo

Cerrar el proyecto con tres bloques ejecutados en orden:

1. **Pulido UX** — mobile-first, estados de carga/error, consistencia visual
2. **PWA offline** — app instalable, caché de datos con TanStack Query persist, banner de conexión
3. **Code review ligero** — simplifier solo sobre lo problemático, build/lint/test verde

---

## Bloque 1: Pulido UX

### Enfoque

Recorrer las 5 features en orden (inventory → recipes → quotes → crm → dashboard). En cada una se aplican las tres dimensiones: mobile/responsiveness (foco principal), estados de carga/error, consistencia visual.

### Mobile/Responsiveness (foco principal)

**Criterio breakpoint:** `< 640px` = mobile, `>= 640px` = desktop. Usar clases Tailwind `sm:` como punto de quiebre.

| Feature | Problema principal | Solución |
|---|---|---|
| Inventory | Tabla de materiales no cabe en mobile | Cambiar a cards apiladas en `< 640px` |
| Recipes | Lista de muebles con columnas — colapsar en mobile | Cards apiladas, preview de costo siempre visible |
| Quotes | Formulario con columnas laterales — ilegible en mobile | Layout de una columna en mobile, scroll natural |
| Quotes | Lista de presupuestos como tabla | Cards en mobile en vez de tabla |
| CRM — Kanban | Scroll horizontal de 6 columnas en mobile | Vista lista filtrable por estado en `< 640px` |
| CRM — ClientList | Tabla de clientes | Cards en mobile |
| CRM — ClientDetail | Historial en tabla | Scroll vertical, cards compactas |
| Dashboard | ActiveQuotesPanel tabla | Cards en mobile |

### Estados de carga y error

- Usar el componente `Skeleton` de shadcn en todas las features durante carga inicial.
- Patrón uniforme: si `isLoading` → mostrar skeletons; si `isError` → mostrar mensaje de error con botón "Reintentar" (`query.refetch()`).
- No inventar componentes nuevos — usar `Skeleton` de `@/shared/ui/skeleton` en todos lados.

### Consistencia visual transversal

- **Badges de estado de quote:** mismo componente con los mismos colores en QuoteList, KanbanCard, ActiveQuotesPanel y ClientDetail. Centralizar en `src/features/quotes/components/QuoteStatusBadge.tsx`.
- **Botones de acción principal:** variante `default` de shadcn, tamaño `default`. No mezclar `sm` y `default` en la misma pantalla sin razón.
- **Skeletons:** siempre desde `@/shared/ui/skeleton`, nunca spinners ad-hoc excepto en botones de submit (usar `Loader2` de lucide-react).

---

## Bloque 2: PWA Offline

### Stack

`vite-plugin-pwa` ya está instalado. Configurar en modo `generateSW` con Workbox.

### App Shell (Service Worker)

```ts
// vite.config.ts — VitePWA plugin
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts-cache' }
      }
    ]
  },
  manifest: {
    name: 'CarpinteroPro',
    short_name: 'CarpinteroPro',
    theme_color: '#1a1a2e',   // ajustar al primario real de la app
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
})
```

Los requests a Supabase **no** se cachean en el Service Worker — los datos se persisten vía TanStack Query.

### Persistencia de datos (TanStack Query)

Instalar `@tanstack/query-persist-client-core` + `@tanstack/query-sync-storage-persister`.

```ts
// src/shared/lib/queryClient.ts — agregar persister
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const persister = createSyncStoragePersister({ storage: window.localStorage })

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 horas
})
```

- Al abrir sin red: TanStack Query sirve datos desde localStorage (último fetch).
- Al reconectar: `refetchOnReconnect: true` (default) re-fetcha automáticamente. No se necesita lógica extra.

### Modo solo lectura offline

Cuando `!navigator.onLine`:
- El componente `OfflineBanner` muestra una barra en la parte superior de `AppLayout`.
- Los botones de escritura (crear, editar, eliminar) se deshabilitan con `disabled={!isOnline}` y muestran tooltip "Sin conexión".
- No se bloquea la navegación ni la visualización.

### `OfflineBanner`

```tsx
// src/shared/components/OfflineBanner.tsx
// Detecta navigator.onLine + eventos 'online'/'offline'
// Muestra: barra amarilla con texto "Sin conexión — modo solo lectura"
// Se oculta automáticamente al reconectar
```

Hook auxiliar: `src/shared/hooks/useOnlineStatus.ts` — retorna `boolean`.

### Íconos PWA

Generar `public/icons/icon-192.png` y `public/icons/icon-512.png`. Si no hay assets de marca, usar una versión con las iniciales "CP" sobre fondo del color primario.

### Lo que NO incluye esta fase

- Background sync para escrituras pendientes (requiere Service Worker con cola — fuera de alcance).
- Notificaciones push.
- Caché de imágenes de usuario.

---

## Bloque 3: Code Review / Simplifier

### Proceso

1. Correr `code-simplifier:code-simplifier` sobre los archivos modificados en Fase 6.
2. Aplicar solo sugerencias de: código duplicado obvio, imports sin usar, lógica innecesariamente compleja.
3. Ignorar: extracciones de abstracción para un solo uso, cambios arquitecturales, renombres.

### Límites explícitos

- No tocar `src/shared/types/database.ts`.
- No tocar componentes en `src/shared/ui/` (shadcn).
- No cambiar arquitectura feature-sliced.

### Verificación final

```bash
npm run build   # debe pasar sin errores TS
npm run lint    # cero warnings nuevos
npm run test    # todos los tests verdes
```

Al pasar la verificación: invocar `superpowers:finishing-a-development-branch` para el PR final.

---

## Archivos nuevos

| Archivo | Propósito |
|---|---|
| `src/shared/hooks/useOnlineStatus.ts` | Detecta estado de conexión |
| `src/shared/components/OfflineBanner.tsx` | Banner de modo offline |
| `src/features/quotes/components/QuoteStatusBadge.tsx` | Badge unificado de estado |
| `public/icons/icon-192.png` | Ícono PWA 192×192 |
| `public/icons/icon-512.png` | Ícono PWA 512×512 |

## Archivos modificados clave

| Archivo | Cambio |
|---|---|
| `vite.config.ts` | Configurar VitePWA con Workbox y manifest |
| `src/shared/lib/queryClient.ts` | Agregar persistQueryClient |
| `src/app/layouts/AppLayout.tsx` | Integrar OfflineBanner |
| Componentes de lista/tabla en todas las features | Versión mobile (cards) |
