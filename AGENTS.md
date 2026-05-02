# Code Review Rules — CarpinteroPro

## General
- No unused variables or imports
- No `any` types in TypeScript
- Use `const`/`let`, never `var`

## React
- Use functional components with named exports
- No direct DOM manipulation
- Hooks must follow the Rules of Hooks

## Architecture
- Feature-sliced: each feature is self-contained under `src/features/<name>/`
- No cross-feature imports; shared code goes to `src/shared/`
- DB queries belong in `src/features/<name>/api/` for feature-specific data, or in `src/shared/api/` when the same data is consumed by multiple features (e.g. materials, workshop_settings, furniture_templates)
- TanStack Query wrappers belong in `src/features/<name>/hooks/` for feature-specific hooks, or in `src/shared/hooks/` when the same query is consumed by multiple features
- Components and hooks must never call `supabase` directly — always go through an `api/` function

## Database
- Every table must include `workshop_id uuid NOT NULL` for multi-tenant isolation
- RLS must be enabled on every new table
- Always include `Relationships: []` in manually maintained `database.ts` types

## Supabase
- Never expose service role key in frontend
- All client queries go through the typed `supabase` client from `@/shared/lib/supabase`
