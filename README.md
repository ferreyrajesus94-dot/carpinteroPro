# CarpinteroPro

CarpinteroPro is a production-oriented SaaS for carpentry and woodworking shops. It helps teams manage materials, furniture templates, quotes, contracts, CRM workflows, billing, and workshop settings with a tenant-safe Supabase backend.

## Quick path

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill the public Supabase values:
   ```bash
   cp .env.example .env.local
   ```
3. Start the local app:
   ```bash
   npm run dev
   ```

For full environment guidance, read [`docs/operations/environment-setup.md`](docs/operations/environment-setup.md).

## Stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| State/data | Zustand, TanStack Query |
| Forms | React Hook Form, Zod |
| Backend | Supabase Auth, Postgres, RLS, Edge Functions |
| Billing | MercadoPago |
| Testing | Vitest, Testing Library, jsdom |
| Deploy | Vercel frontend, Supabase backend |

## Prerequisites

- Node.js 20 or newer.
- npm.
- A Supabase project with URL and anon key access.
- Supabase CLI for migrations and Edge Function workflows.
- MercadoPago sandbox/production credentials when testing billing flows.

## Environment

The frontend only needs browser-safe Vite variables in `.env.local`:

```dotenv
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Server-only values such as the Supabase service role key and MercadoPago secrets belong in Supabase Edge Function secrets, not in frontend env files. See [`docs/operations/environment-setup.md`](docs/operations/environment-setup.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and create the production build. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:e2e` | Run Playwright E2E/integration tests. |
| `npm run preview` | Preview the production build locally. |

## E2E testing

Business-critical Playwright checks run separately from `npm test` with `npm run test:e2e`.
See [`docs/testing/runbook.md`](docs/testing/runbook.md) for local Supabase env, fixtures, cleanup, and debugging.

## Deployment overview

- **Frontend:** Vercel auto-deploys from `main`.
- **Backend:** Supabase owns Auth, Postgres, RLS policies, and Edge Functions.
- **Migrations:** Keep local migration history reconciled before applying remote changes.
- **Billing:** MercadoPago secrets are configured for Supabase Edge Functions.

Before production changes, complete the [`docs/operations/supabase-production-checklist.md`](docs/operations/supabase-production-checklist.md) and follow the migration/rollback docs when applicable.

## Operations docs

| Need | Doc |
| --- | --- |
| Configure local, preview, or production env | [`docs/operations/environment-setup.md`](docs/operations/environment-setup.md) |
| Check Supabase production readiness | [`docs/operations/supabase-production-checklist.md`](docs/operations/supabase-production-checklist.md) |
| Deploy database migrations safely | [`docs/operations/migration-deployment.md`](docs/operations/migration-deployment.md) |
| Recover from a bad release | [`docs/operations/rollback-runbook.md`](docs/operations/rollback-runbook.md) |
| Understand Vercel config status | [`docs/operations/vercel-config-decision.md`](docs/operations/vercel-config-decision.md) |

## Out of scope for SDD 5

Monitoring dashboards, alert routing, logging pipelines, support workflows, and performance budgets are deferred to SDD 6.
