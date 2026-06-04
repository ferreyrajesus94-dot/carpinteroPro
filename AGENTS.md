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
- All DB queries in `src/features/<name>/api/`
- TanStack Query wrappers in `src/features/<name>/hooks/`

### Import Boundaries
- `src/app/**` may compose multiple features and wire feature public APIs together
- `src/features/<feature>/**` may import only its own feature files and `src/shared/**`
- `src/features/<feature>/index.ts` may expose a public API for app-level composition, not feature-to-feature imports
- `src/shared/**` must not import from `src/features/**`
- ESLint enforces this staged model with `eslint-plugin-import` `import/no-restricted-paths`; temporary exceptions are documented in `eslint.config.js` for OpenSpec change `2026-06-03-sdd-8-architecture-cleanup` and should be removed as later SDD8 work units clean each scope.

## Database
- Every table must include `workshop_id uuid NOT NULL` for multi-tenant isolation
- RLS must be enabled on every new table
- Always include `Relationships: []` in manually maintained `database.ts` types

## Supabase
- Never expose service role key in frontend
- All client queries go through the typed `supabase` client from `@/shared/lib/supabase`
