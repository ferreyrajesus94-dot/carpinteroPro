# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Type-check + production build (tsc -b && vite build)
npm run lint         # ESLint
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Vitest in watch mode

# Run a single test file
npx vitest run src/features/inventory/hooks/useMaterials.test.ts

# Generate Supabase types after migrations
SUPABASE_ACCESS_TOKEN=<token> npx supabase gen types typescript --project-id revbbzqjglqnphjrasvv > src/shared/types/database.ts
```

## Architecture

Feature-sliced: each module lives under `src/features/<name>/` and is self-contained. Shared code lives under `src/shared/` only (no cross-feature imports).

```
src/
  app/           # Entry point, router, AppLayout
  features/      # inventory | recipes | quotes | crm | dashboard
    <feature>/
      api/       # Supabase query functions
      hooks/     # TanStack Query wrappers
      components/
      types.ts
      routes.tsx # Lazy-loaded, exported as <Name>Routes
  shared/
    lib/         # supabase.ts, queryClient.ts, utils.ts
    types/       # database.ts (auto-generated, never edit manually)
    ui/          # shadcn components (installed via `npx shadcn add`)
    hooks/
```

All feature routes are lazy-loaded via React Router's `lazy()`. The root renders `AppLayout` (sidebar on desktop, bottom tabs on mobile) and redirects `/` → `/dashboard`.

## Key conventions

**Path alias:** `@/` maps to `src/`. Always use it for imports.

**Supabase:** The typed client is at `@/shared/lib/supabase`. All DB queries go in `src/features/<name>/api/`. After running migrations, regenerate `database.ts` (see command above).

**shadcn components:** Install with `npx shadcn add <component>` — they land in `src/shared/ui/`. Do not edit them manually. The `react-refresh/only-export-components` ESLint rule is disabled for `src/shared/ui/**` because shadcn exports multiple things per file.

**`vite.config.ts` imports from `vitest/config`**, not `vite` — this is intentional so Vitest globals work with the path alias.

**Tailwind v3** (not v4). Config is in `tailwind.config.ts`. CSS variables for theming are in `src/index.css`. The `.h-screen` utility is overridden to `100dvh` for iOS Safari.

**Multi-tenant design:** Every DB table must include `workshop_id uuid` from day one. The current placeholder is `VITE_WORKSHOP_ID=00000000-0000-0000-0000-000000000001`.

## Environment

`.env.local` (gitignored) holds:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_WORKSHOP_ID=
```

Supabase project: `revbbzqjglqnphjrasvv`. The CLI is available via `npx supabase`.

## Deploy

- **Vercel** (auto-deploys from `main`): https://carpintero-pro.vercel.app
- **GitHub**: https://github.com/ferreyrajesus94-dot/carpinteroPro
- `.npmrc` has `legacy-peer-deps=true` — required because `vite-plugin-pwa@1.2.0` doesn't declare Vite 8 peer support yet, but works correctly.
