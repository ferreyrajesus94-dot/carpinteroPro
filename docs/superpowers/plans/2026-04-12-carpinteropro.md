# CarpinteroPro — Implementation Plan (Living Document)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un SaaS de gestión de taller de carpintería con 4 módulos (Inventario, Presupuestos, CRM/Kanban, Dashboard), PWA-ready, multi-dispositivo, con arquitectura preparada para multi-tenant.

**Architecture:** React 18 + TypeScript frontend modular por features, Supabase (Postgres + PostgREST) como backend, deploy en Vercel. Cada feature es autocontenida bajo `src/features/`, comparte solo `src/shared/`. Schema incluye `workshop_id` en todas las tablas desde el día 1 para migración a multi-tenant sin reescribir.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui, React Router v6, TanStack Query, Zustand, Supabase, React Hook Form + Zod, @dnd-kit/core, Recharts, vite-plugin-pwa, jspdf, Vitest + React Testing Library.

---

## Progress Tracker

| Fase | Estado | Completada |
|------|--------|-----------|
| **Fase 0** — Scaffolding + deploy pipeline | ✅ Completa | 2026-04-12 |
| **Fase 1** — Inventario + historial de precios | ✅ Completa | 2026-04-12 |
| **Fase 2** — Recetas (BOM) | ✅ Completa | 2026-04-13 |
| **Fase 3** — Presupuestos + Contratos + Plantillas | ✅ Completa | 2026-04-13 |
| **Fase 4** — CRM + Kanban | ✅ Completa | 2026-04-13 |
| **Fase 5** — Dashboard | ⏳ Pendiente | - |
| **Fase 6** — Pulido, PWA verificada, deploy final | ⏳ Pendiente | - |

---

## Skills y MCPs por fase (usar SOLO cuando corresponde)

> Las siguientes skills aplican a **todas las fases**: `superpowers:test-driven-development` (antes de escribir código), `superpowers:verification-before-completion` (al cerrar cada fase).

| Fase | Skills específicas | MCPs |
|------|--------------------|------|
| 0 | `frontend-design:frontend-design` | `context7` (Vite, vite-plugin-pwa, shadcn, Supabase CLI) |
| 1 | `superpowers:test-driven-development` | `context7` (Supabase triggers, TanStack Query, Recharts, RHF+Zod) |
| 2 | — | `context7` (Zustand) |
| 3 | `superpowers:test-driven-development` | `context7` (jspdf, markdown renderers) |
| 4 | `frontend-design:frontend-design` | `context7` (@dnd-kit, touch sensors) |
| 5 | `frontend-design:frontend-design` | `context7` (Recharts avanzado, date-fns) |
| 6 | `superpowers:requesting-code-review`, `superpowers:finishing-a-development-branch`, `code-simplifier:code-simplifier` | `mcp__github__*`, `context7` (Lighthouse PWA) |

---

## Estructura de archivos del proyecto completo

```
carpinteroPro/
├── src/
│   ├── app/
│   │   ├── App.tsx                          # Root con QueryClientProvider + Router
│   │   ├── router.tsx                       # Rutas declarativas por feature
│   │   └── layouts/
│   │       └── AppLayout.tsx                # Sidebar (desktop) + bottom tabs (mobile)
│   ├── features/
│   │   ├── inventory/
│   │   │   ├── components/
│   │   │   │   ├── MaterialList.tsx
│   │   │   │   ├── MaterialForm.tsx
│   │   │   │   └── PriceHistoryChart.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMaterials.ts
│   │   │   │   └── usePriceHistory.ts
│   │   │   ├── api/
│   │   │   │   └── materials.ts             # Queries Supabase
│   │   │   ├── types.ts
│   │   │   └── routes.tsx
│   │   ├── recipes/
│   │   │   ├── components/
│   │   │   │   ├── MuebleList.tsx
│   │   │   │   ├── MuebleForm.tsx
│   │   │   │   └── RecipeCostPreview.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useRecipes.ts
│   │   │   ├── api/
│   │   │   │   └── recipes.ts
│   │   │   ├── types.ts
│   │   │   └── routes.tsx
│   │   ├── quotes/
│   │   │   ├── components/
│   │   │   │   ├── QuoteForm.tsx
│   │   │   │   ├── QuoteList.tsx
│   │   │   │   ├── ContractPreview.tsx
│   │   │   │   └── TemplateEditor.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useQuotes.ts
│   │   │   │   └── useContractTemplates.ts
│   │   │   ├── lib/
│   │   │   │   ├── calculator.ts            # Motor de cálculo PURO (sin React)
│   │   │   │   └── contractRenderer.ts      # Reemplazo de variables en plantillas
│   │   │   ├── api/
│   │   │   │   └── quotes.ts
│   │   │   ├── types.ts
│   │   │   └── routes.tsx
│   │   ├── crm/
│   │   │   ├── components/
│   │   │   │   ├── ClientList.tsx
│   │   │   │   ├── ClientForm.tsx
│   │   │   │   ├── KanbanBoard.tsx
│   │   │   │   ├── KanbanColumn.tsx
│   │   │   │   └── KanbanCard.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useClients.ts
│   │   │   │   └── useKanban.ts
│   │   │   ├── api/
│   │   │   │   └── clients.ts
│   │   │   ├── types.ts
│   │   │   └── routes.tsx
│   │   └── dashboard/
│   │       ├── components/
│   │       │   ├── KpiCard.tsx
│   │       │   ├── SalesChart.tsx
│   │       │   ├── LowStockAlert.tsx
│   │       │   └── TaskList.tsx
│   │       ├── hooks/
│   │       │   └── useDashboardData.ts
│   │       ├── api/
│   │       │   └── dashboard.ts
│   │       └── routes.tsx
│   ├── shared/
│   │   ├── ui/                              # shadcn/ui components (auto-generados)
│   │   ├── lib/
│   │   │   ├── supabase.ts                  # Cliente Supabase singleton
│   │   │   ├── queryClient.ts               # TanStack Query config
│   │   │   └── utils.ts                     # cn() y helpers de formato
│   │   ├── hooks/
│   │   │   └── useWorkshopId.ts             # Hook para el workshop_id del taller actual
│   │   └── types/
│   │       └── database.ts                  # Tipos generados por `supabase gen types`
│   └── main.tsx
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql                    # Schema completo con workshop_id
│   │   └── 0002_recipes.sql                 # furniture_templates + recipe_items (Fase 2)
│   └── seed.sql                             # Datos demo
├── public/
│   ├── icons/                               # Iconos PWA (generados)
│   └── manifest.webmanifest                 # Generado por vite-plugin-pwa
├── tests/
│   └── features/
│       └── quotes/
│           ├── calculator.test.ts
│           └── contractRenderer.test.ts
├── docs/
│   └── superpowers/
│       └── plans/
│           └── 2026-04-12-carpinteropro.md  # Este archivo
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                               # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .env.example
└── package.json
```

---

# FASE 0 — Scaffolding + Deploy Pipeline

> **Skills activas:** `frontend-design:frontend-design` (look & feel base)
> **MCPs activos:** `context7` para Vite, vite-plugin-pwa, shadcn/ui, Supabase CLI

**Objetivo:** Vite+React+TS+Tailwind+shadcn andando localmente, conectado a Supabase, con AppLayout responsive (sidebar en desktop, bottom tabs en mobile), PWA configurada, primer deploy en Vercel.

**Pre-requisitos:** Node 20+, Git, cuenta Supabase, cuenta Vercel, Supabase CLI (`npm i -g supabase`).

---

### Task 0.1: Inicializar proyecto Vite + React + TypeScript

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/app/App.tsx`

- [ ] **Step 1: Crear el proyecto**

```bash
cd /home/estoico/workspace/carpinteroPro
npm create vite@latest . -- --template react-ts
```

Responder: framework `React`, variant `TypeScript`.

- [ ] **Step 2: Instalar dependencias base**

```bash
npm install
npm install react-router-dom @tanstack/react-query zustand
npm install react-hook-form @hookform/resolvers zod
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install recharts
npm install jspdf
npm install date-fns
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configurar Vitest en vite.config.ts**

Reemplazar contenido de `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
})
```

- [ ] **Step 4: Crear archivo de setup de tests**

Crear `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verificar que la app corre**

```bash
npm run dev
```

Esperado: `http://localhost:5173` muestra la pantalla default de Vite.

- [ ] **Step 6: Commit inicial**

```bash
git add .
git commit -m "chore: initialize vite+react+ts project with dependencies"
```

---

### Task 0.2: Configurar Tailwind CSS + shadcn/ui

**Files:**
- Create: `tailwind.config.ts`, `src/index.css`, `components.json`
- Modify: `vite.config.ts` (path alias ya configurado)

- [ ] **Step 1: Instalar Tailwind**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p --ts
```

- [ ] **Step 2: Configurar tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

- [ ] **Step 3: Instalar tailwindcss-animate y clsx/class-variance-authority**

```bash
npm install -D tailwindcss-animate
npm install clsx class-variance-authority lucide-react
```

- [ ] **Step 4: Inicializar shadcn/ui**

```bash
npx shadcn@latest init
```

Responder en el wizard:
- Style: `Default`
- Base color: `Slate`
- CSS variables: `Yes`

Esto crea `components.json` y actualiza `src/index.css` con las variables CSS.

- [ ] **Step 5: Crear `src/shared/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Instalar tailwind-merge**

```bash
npm install tailwind-merge
```

- [ ] **Step 7: Agregar componentes shadcn necesarios para el layout**

```bash
npx shadcn@latest add button badge separator tooltip
```

- [ ] **Step 8: Verificar estilos**

```bash
npm run dev
```

Esperado: app carga sin errores de CSS, consola limpia.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: configure tailwind css and shadcn/ui"
```

---

### Task 0.3: Configurar Supabase cliente

**Files:**
- Create: `src/shared/lib/supabase.ts`, `.env.local`, `.env.example`
- Modify: `src/shared/lib/queryClient.ts`

- [ ] **Step 1: Instalar Supabase JS**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Crear `.env.example`**

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKSHOP_ID=00000000-0000-0000-0000-000000000001
```

- [ ] **Step 3: Crear `.env.local`**

Copiar `.env.example` a `.env.local` y llenar con los valores reales del proyecto Supabase (crear proyecto en supabase.com si no existe aún).

```bash
cp .env.example .env.local
```

Editar `.env.local` con las credenciales reales.

- [ ] **Step 4: Crear `src/shared/lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 5: Crear `src/shared/types/database.ts` placeholder**

Este archivo será reemplazado por `supabase gen types` después de crear el schema. Por ahora:

```typescript
// Auto-generated by: supabase gen types typescript --project-id <id> > src/shared/types/database.ts
// Run after each migration to keep types in sync.
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
```

- [ ] **Step 6: Crear `src/shared/lib/queryClient.ts`**

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
    },
  },
})
```

- [ ] **Step 7: Agregar `.env.local` al `.gitignore`**

Verificar que `.gitignore` incluya `.env.local` (Vite lo agrega por defecto).

- [ ] **Step 8: Commit**

```bash
git add .env.example src/shared/lib/supabase.ts src/shared/lib/queryClient.ts src/shared/types/database.ts
git commit -m "chore: configure supabase client and tanstack query"
```

---

### Task 0.4: React Router + AppLayout responsive

**Files:**
- Create: `src/app/router.tsx`, `src/app/layouts/AppLayout.tsx`, `src/app/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Crear `src/app/router.tsx`**

```typescript
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        lazy: () => import('@/features/dashboard/routes').then(m => ({ Component: m.DashboardRoutes })),
      },
      {
        path: 'inventory',
        lazy: () => import('@/features/inventory/routes').then(m => ({ Component: m.InventoryRoutes })),
      },
      {
        path: 'recipes',
        lazy: () => import('@/features/recipes/routes').then(m => ({ Component: m.RecipesRoutes })),
      },
      {
        path: 'quotes',
        lazy: () => import('@/features/quotes/routes').then(m => ({ Component: m.QuotesRoutes })),
      },
      {
        path: 'crm',
        lazy: () => import('@/features/crm/routes').then(m => ({ Component: m.CrmRoutes })),
      },
    ],
  },
])
```

- [ ] **Step 2: Crear `src/app/layouts/AppLayout.tsx`**

```typescript
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, BookOpen, FileText, Users } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventario', icon: Package },
  { to: '/recipes', label: 'Recetas', icon: BookOpen },
  { to: '/quotes', label: 'Presupuestos', icon: FileText },
  { to: '/crm', label: 'Clientes', icon: Users },
]

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — visible solo en md+ */}
      <aside className="hidden md:flex md:w-56 md:flex-col border-r bg-card">
        <div className="flex h-14 items-center px-4 border-b">
          <span className="font-bold text-lg text-primary">CarpinteroPro</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="flex h-14 items-center px-4 border-b md:hidden">
          <span className="font-bold text-lg text-primary">CarpinteroPro</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <Outlet />
        </main>

        {/* Bottom tab bar — visible solo en mobile */}
        <nav className="fixed bottom-0 left-0 right-0 flex md:hidden border-t bg-card z-10">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Crear `src/app/App.tsx`**

```typescript
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/shared/lib/queryClient'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: Actualizar `src/main.tsx`**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { App } from '@/app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Crear routes placeholder para cada feature**

Crear los siguientes 5 archivos con contenido idéntico (reemplazar el nombre):

`src/features/dashboard/routes.tsx`:
```typescript
export function DashboardRoutes() {
  return <div className="p-4"><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-muted-foreground">Próximamente</p></div>
}
```

Repetir para `inventory`, `recipes`, `quotes`, `crm` cambiando el nombre del componente y el título.

- [ ] **Step 6: Verificar navegación**

```bash
npm run dev
```

Esperado:
- Desktop (≥768px): sidebar visible izquierda, contenido a la derecha.
- Mobile (<768px): header arriba, bottom tabs abajo, contenido en el medio.
- Navegar entre rutas no da errores.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: add app layout with responsive sidebar and bottom tabs"
```

---

### Task 0.5: Configurar PWA (vite-plugin-pwa)

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icons/` (iconos PWA)

- [ ] **Step 1: Instalar vite-plugin-pwa**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Actualizar `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: 'CarpinteroPro',
        short_name: 'CarpinteroPro',
        description: 'Gestión integral de taller de carpintería',
        theme_color: '#1e293b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
})
```

- [ ] **Step 3: Generar iconos placeholder**

Crear `public/icons/` y agregar dos iconos PNG de 192x192 y 512x512. Pueden ser placeholders por ahora (se reemplazan en Fase 6 con el logo real).

```bash
# Requiere imagemagick o similar, o simplemente crear archivos PNG manualmente
# Si no tenés imagemagick, copiar cualquier PNG y renombrarlo
mkdir -p public/icons
# Copiar cualquier imagen de 192x192 como icon-192.png y 512x512 como icon-512.png
```

- [ ] **Step 4: Verificar build con PWA**

```bash
npm run build && npm run preview
```

Abrir `http://localhost:4173` en Chrome. En DevTools → Application → Manifest debe mostrar el manifest sin errores. Service Worker debe estar registrado.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: configure PWA with vite-plugin-pwa and service worker"
```

---

### Task 0.6: Deploy a GitHub + Vercel

**Files:**
- Create: `.github/workflows/deploy.yml` (opcional CI), `.vercelignore`

- [ ] **Step 1: Crear repositorio en GitHub**

```bash
gh repo create carpinteroPro --public --source=. --remote=origin --push
```

O crear en github.com y hacer push manual:
```bash
git remote add origin https://github.com/<tu-usuario>/carpinteroPro.git
git push -u origin main
```

- [ ] **Step 2: Conectar Vercel**

1. Ir a vercel.com → New Project → Import desde GitHub.
2. Seleccionar repo `carpinteroPro`.
3. Framework preset: **Vite** (auto-detectado).
4. Agregar variables de entorno:
   - `VITE_SUPABASE_URL` = URL del proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY` = Anon key del proyecto Supabase
   - `VITE_WORKSHOP_ID` = `00000000-0000-0000-0000-000000000001`
5. Click **Deploy**.

- [ ] **Step 3: Verificar deploy**

Abrir la URL de Vercel (ej. `carpinteropro.vercel.app`). Debe cargar el AppLayout con las 5 rutas navegables. En mobile/celular, verificar que el bottom tab bar aparece.

- [ ] **Step 4: Marcar Fase 0 como completa en este plan**

Actualizar la tabla "Progress Tracker" al inicio de este documento:
- Cambiar estado a `✅ Completa` y agregar la fecha.

- [ ] **Step 5: Commit final de fase**

```bash
git add .
git commit -m "chore: add vercel config and complete phase 0 scaffolding"
```

---

# FASE 1 — Inventario + Historial de Precios

> **Skills activas:** `superpowers:test-driven-development`
> **MCPs activos:** `context7` (Supabase triggers, TanStack Query, Recharts, RHF+Zod)

**Objetivo:** CRUD de materiales con filtros, trigger de historial de precios en Postgres, gráfico de evolución de precio por material, alerta de stock bajo.

> **Esta fase se detalla completamente al comenzar su implementación.**

- [ ] Migración SQL: tablas `materials` y `price_history` + trigger
- [ ] `supabase gen types` → actualizar `src/shared/types/database.ts`
- [ ] `src/features/inventory/api/materials.ts` — queries Supabase
- [ ] `src/features/inventory/hooks/useMaterials.ts` — TanStack Query
- [ ] `src/features/inventory/hooks/usePriceHistory.ts`
- [ ] `MaterialList.tsx` — tabla con filtros por tipo/medida + badge stock bajo
- [ ] `MaterialForm.tsx` — formulario RHF+Zod crear/editar
- [ ] `PriceHistoryChart.tsx` — gráfico Recharts con historial
- [ ] Tests de hooks (mock Supabase)
- [ ] Seed con materiales demo
- [ ] Actualizar Progress Tracker

---

# FASE 2 — Recetas (BOM)

> **MCPs activos:** `context7` (Zustand si aplica)

**Objetivo:** CRUD de recetas de muebles (lista de materiales + cantidades), costo estimado en vivo al precio actual de los materiales.

> **Esta fase se detalla completamente al comenzar su implementación.**

- [ ] Migración SQL: `furniture_templates` + `recipe_items`
- [ ] `supabase gen types` → actualizar tipos
- [ ] `src/features/recipes/api/recipes.ts`
- [ ] `src/features/recipes/hooks/useRecipes.ts`
- [ ] `RecipeList.tsx` — lista con costo estimado
- [ ] `RecipeForm.tsx` — builder de items con selector de material
- [ ] `RecipeCostPreview.tsx` — total en vivo mientras se edita
- [ ] Actualizar Progress Tracker

---

# FASE 3 — Presupuestos + Contratos + Plantillas

> **Skills activas:** `superpowers:test-driven-development` (motor de cálculo — TDD estricto)
> **MCPs activos:** `context7` (jspdf, markdown renderers)

**Objetivo:** Motor de cálculo puro con tests, formulario de presupuesto, plantillas editables de contrato, exportar a WhatsApp/PDF.

> **Esta fase se detalla completamente al comenzar su implementación.**

- [ ] Migración SQL: `quotes`, `quote_extras`, `contract_templates`
- [ ] `supabase gen types` → actualizar tipos
- [ ] **TDD:** `tests/features/quotes/calculator.test.ts` + `src/features/quotes/lib/calculator.ts`
- [ ] **TDD:** `tests/features/quotes/contractRenderer.test.ts` + `src/features/quotes/lib/contractRenderer.ts`
- [ ] `QuoteForm.tsx` — flujo: cliente → receta → extras → costos fijos → margen → total
- [ ] `ContractPreview.tsx` — renderizar plantilla con variables reemplazadas
- [ ] `TemplateEditor.tsx` — editor markdown + preview + variables disponibles
- [ ] Seed con plantilla de contrato default
- [ ] Actualizar Progress Tracker

---

# FASE 4 — CRM + Kanban

> **Skills activas:** `frontend-design:frontend-design` (tarjetas Kanban + mobile)
> **MCPs activos:** `context7` (@dnd-kit/core, touch sensors)

**Objetivo:** Gestión de clientes con historial de presupuestos, tablero Kanban con 6 columnas, drag & drop funcional en desktop y mobile.

> **Esta fase se detalla completamente al comenzar su implementación.**

- [ ] Migración SQL: `clients` + enum `quote_status`
- [ ] `supabase gen types` → actualizar tipos
- [ ] `src/features/crm/api/clients.ts`
- [ ] `ClientList.tsx` + `ClientForm.tsx`
- [ ] `KanbanBoard.tsx` — DndContext con 6 columnas
- [ ] `KanbanColumn.tsx` — SortableContext por columna
- [ ] `KanbanCard.tsx` — tarjeta con cliente, mueble, total, días
- [ ] `useKanban.ts` — optimistic updates al mover tarjetas
- [ ] Scroll horizontal mobile con snap
- [ ] Actualizar Progress Tracker

---

# FASE 5 — Dashboard

> **Skills activas:** `frontend-design:frontend-design` (jerarquía visual, layout)
> **MCPs activos:** `context7` (Recharts avanzado, date-fns)

**Objetivo:** Vista principal con KPIs, gráfico de ventas, alertas de stock bajo, lista de tareas.

> **Esta fase se detalla completamente al comenzar su implementación.**

- [ ] Migración SQL: `tasks`
- [ ] `supabase gen types` → actualizar tipos
- [ ] `src/features/dashboard/api/dashboard.ts` — queries agregadas
- [ ] `useDashboardData.ts` — datos para todos los widgets
- [ ] `KpiCard.tsx` — tarjeta de métrica reutilizable
- [ ] `SalesChart.tsx` — ventas últimos 6 meses (Recharts)
- [ ] `LowStockAlert.tsx` — lista de materiales bajo mínimo
- [ ] `TaskList.tsx` — tareas pendientes con checkbox
- [ ] Layout responsive 2 columnas desktop / 1 columna mobile
- [ ] Actualizar Progress Tracker

---

# FASE 6 — Pulido, PWA verificada, Deploy final

> **Skills activas:** `superpowers:requesting-code-review`, `superpowers:finishing-a-development-branch`, `code-simplifier:code-simplifier`
> **MCPs activos:** `mcp__github__*`, `context7` (Lighthouse PWA checklist)

**Objetivo:** Seed demo completo, README con screenshots, PWA instalable testeada en celular real, dark mode, deploy a producción limpio.

> **Esta fase se detalla completamente al comenzar su implementación.**

- [ ] `supabase/seed.sql` — datos demo realistas (taller, materiales, clientes, presupuestos)
- [ ] Dark mode: clase `dark` en `tailwind.config.ts`, toggle en AppLayout
- [ ] Iconos PWA reales (logo CarpinteroPro)
- [ ] Lighthouse audit: PWA score ≥ 90
- [ ] README.md con descripción, stack, screenshots, instrucciones de setup local
- [ ] Code review con `superpowers:requesting-code-review`
- [ ] `code-simplifier:code-simplifier` — pasada final
- [ ] GitHub: crear release v1.0.0 + issues de roadmap post-v1
- [ ] Vercel: verificar dominio + variables de entorno de producción
- [ ] Smoke test flujo crítico en URL pública desde celular
- [ ] Actualizar Progress Tracker → todos ✅

---

## Flujo crítico de verificación end-to-end (al terminar cada fase)

```
1. npm run dev → carga sin errores de consola
2. npm run test → todos los tests pasan
3. npm run build → build exitoso
4. Flujo manual:
   Fase 1: crear madera → cambiar precio → ver historial
   Fase 2: crear receta con 2 materiales → ver costo estimado
   Fase 3: crear cliente → presupuesto desde receta → generar contrato → copiar WhatsApp
   Fase 4: mover presupuesto en Kanban → refrescar → estado persiste
   Fase 5: dashboard muestra KPIs consistentes con datos
   Fase 6: abrir URL desde celular → instalar PWA → usar app offline (modo lectura)
```
