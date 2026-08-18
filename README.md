# CarpinteroPro

Open-source workshop management for carpenters — materials, recipes, quotes, production, and CRM in one place.

## The problem it solves

Running a carpentry workshop means juggling a dozen moving parts: what wood do I have in stock, what does that bookshelf actually cost me to build, how much should I charge, did the client approve the quote, and when production starts, do I have enough material to actually start?

Most carpenters track this with paper notebooks, a stack of WhatsApp messages, and a spreadsheet they hope doesn't break. The sharper ones build a custom Excel. The lucky ones pay for a generic SaaS that was made for a different industry and try to force-fit it.

CarpinteroPro is built for the workshop floor, not the spreadsheet. It's the tool the carpenter wishes they had: a single place to record materials, define a furniture recipe once and quote it many times, send a quote to a client, and once approved, start production — which automatically deducts the right amount of material from stock. Every movement is logged, so you always know what you have, what you spent, and what you sold.

The app is open source and free. The end-user product is Spanish-only because the target audience is Spanish-speaking carpenters who don't want to fight technology — they want to make furniture.

## Who it's for

**Primary user — the carpenter or workshop owner:**
- Define a furniture recipe once (wood, hardware, finish, cut pieces) with live cost calculation.
- Quote any recipe with margin rules, export to PDF or WhatsApp, and track approval status on a Kanban board.
- Start production from an approved quote; material is deducted from stock automatically and a movement is logged.
- Keep a clean CRM of clients with quote history.
- See real numbers on a dashboard: revenue, materials in stock, quotes in flight.

**Secondary user — the developer who forks or contributes:**
- Multi-tenant React 19 + Vite + TypeScript app on Supabase.
- Feature-sliced architecture: every feature is self-contained under `src/features/<name>/`, no cross-feature imports, ESLint enforces it.
- Edge Functions in Deno for the platform admin surface.
- Tests at every layer: Vitest for units, Playwright for business-critical flows.

## Live demo

A demo deployment is available at https://carpintero-pro.vercel.app.

Demo access is granted on request — open an issue tagged `demo` with your
GitHub username and we'll add you to the demo workshop.

## Key features

Verified against the source under `src/features/`:

- **Materials inventory** — workshop-scoped CRUD, unit-of-measure, price-per-unit, minimum stock, price history with charts.
- **Stock movements ledger** — every change recorded as an immutable row (purchase, consumption, shrinkage, adjustment, quote discount). Reversals are first-class.
- **Furniture recipes (BOM)** — bill of materials with cut pieces and live cost calculation against current material prices.
- **Quotes with recipe snapshots** — picking a recipe freezes the cost at quote time so price changes don't retroactively alter sent quotes.
- **Production orders** — Kanban board, state machine, automatic stock deduction on start via a Postgres trigger.
- **Global search** — cross-feature search across the app.
- **CRM** — clients with quote history and stats.
- **Dashboard** — workshop metrics and recent activity.
- **Workshop settings** — workshop-wide preferences (auto stock discount, etc.).
- **Onboarding** — guided signup flow that creates the workshop + profile.
- **Multi-tenant** — every row carries `workshop_id uuid NOT NULL`, every query is RLS-scoped via `get_current_workshop_id()`.
- **Role-based access** — Supabase Auth + RLS policies; platform admin routes gated behind a separate Edge Function surface.
- **Platform admin** — Edge Functions for diagnostics, force-onboarding, toggle workshop, toggle maintenance, youtuber program, etc.
- **Billing surface (parked)** — MercadoPago integration code is present for a future paid tier that isn't currently offered; the app is free.

## Tech stack

**Frontend**

- React 19 + Vite 8 + TypeScript
- Tailwind CSS 3 (with `shadcn/ui`-style components in `src/shared/ui/`)
- TanStack Query 5 for server state
- Zustand for client state
- React Hook Form + Zod for forms and validation
- Radix UI primitives (Dialog, Select, RadioGroup, Tooltip, Switch, Label, Separator, Slot)
- React Router 7 with lazy-loaded per-feature routes
- Recharts for charts, jspdf for PDF exports, sonner for toasts
- PWA via `vite-plugin-pwa`

**Backend**

- Supabase — Postgres, Auth, Storage, Realtime, and Edge Functions (Deno)
- 75+ SQL migrations under `supabase/migrations/`
- 16 Edge Functions under `supabase/functions/` (admin tools, billing webhooks, public APIs)
- RLS enabled on every domain table; workshop identity is server-derived through `auth.uid() → profiles.workshop_id`

**Deploy**

- Vercel auto-deploys the frontend from `main` (catch-all SPA rewrite in `vercel.json`)
- Supabase Cloud runs the database, auth, and Edge Functions

**Testing**

- Vitest + Testing Library for unit and component tests
- Playwright for business-critical end-to-end flows

## Quick start

### Prerequisites

- Node.js 20 or newer
- npm (the project uses `legacy-peer-deps=true` via `.npmrc`; pnpm should also work)
- Supabase CLI (`npx supabase` works if you don't want a global install)
- Docker, if you want to run Supabase locally via `supabase start`

### Steps

1. Clone the repo and install dependencies:

   ```bash
   git clone <your-fork-url> carpinteroPro
   cd carpinteroPro
   npm install
   ```

2. Copy the env template and fill the public Supabase values:

   ```bash
   cp .env.example .env.local
   ```

   At minimum you need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Server-only secrets (service role, MercadoPago) belong in Supabase Edge Function secrets, not in `.env.local` — see `docs/operations/environment-setup.md`.

3. Start Supabase locally and apply migrations:

   ```bash
   npx supabase start
   npx supabase db reset
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. (Optional) Run the tests:

   ```bash
   npm test          # Vitest, one-shot
   npm run test:watch # Vitest in watch mode
   npm run test:e2e  # Playwright business-critical flows
   ```

6. (Optional) Type-check and lint:

   ```bash
   npm run lint
   npm run build
   ```

A demo `VITE_USE_LOCAL_MOCKS=true` flag in `.env.example` lets you skip the backend and inspect the UI with a fake session, materials, and quotes. Useful for design review without a running Supabase.

## Architecture

The short version:

- **Multi-tenant.** Every domain table has `workshop_id uuid NOT NULL`. RLS is enabled on every table; the active workshop is resolved server-side via `get_current_workshop_id()` (which reads `auth.uid() → profiles.workshop_id`). Clients never get to choose or pass a workshop id.
- **Feature-sliced frontend.** Each feature lives under `src/features/<name>/` with its own `api/`, `hooks/`, `components/`, and `types.ts`. Cross-feature imports are forbidden by ESLint (`eslint-plugin-import` `import/no-restricted-paths`). Shared code lives only under `src/shared/`. `src/app/` composes the public APIs of features.
- **Stock deduction ledger.** Stock mutations flow through the trusted `apply_stock_movement` RPC. Production start writes to a `quote_production_stock_deductions` audit row; an `AFTER INSERT` trigger writes one `stock_movements` row per approved BOM line and updates `materials.stock` atomically. Reversals are first-class and idempotent.
- **Snapshotted quotes.** A quote captures recipe cost at quote time so future material price changes don't alter sent quotes.
- **Edge Functions for the platform admin.** Platform-admin work — diagnostics, toggling workshops, toggling maintenance, the referral system — runs in Deno Edge Functions under `supabase/functions/`. All Edge Functions share a `_shared/` directory for CORS and Supabase admin clients.
- **Lazy-loaded routes.** Per-feature routes are wrapped in `React.lazy()` and exported as `<Name>Routes`. The root renders `AppLayout` (sidebar on desktop, bottom tabs on mobile) and redirects `/` to `/dashboard`.

There is no `ARCHITECTURE.md` file in the repo yet — the canonical architecture lives in `openspec/specs/` (per-domain specs) and `CLAUDE.md` (developer conventions). The OpenSpec change directory `openspec/changes/archive/` is the historical record of past changes.

## Self-hosting

The app is open source; nothing about the Supabase backend is hosted-only. To run your own copy:

1. Create a free-tier Supabase project at https://supabase.com.
2. Copy the project URL and anon key into `.env.local` (see Quick Start).
3. Apply the migrations from `supabase/migrations/` either via `supabase db push` (against a linked remote) or by running them directly in the Supabase SQL editor in order.
4. Deploy the Edge Functions from `supabase/functions/` via `supabase functions deploy <name>` for each function.
5. Configure the Edge Function secrets listed in `docs/operations/environment-setup.md` (`SUPABASE_SERVICE_ROLE_KEY`, MercadoPago tokens if you use the billing surface, etc.).
6. Deploy the frontend to Vercel, Netlify, or any static host. The `vercel.json` SPA rewrite is needed for any non-root path to work — if you don't use Vercel, port the `*` → `/index.html` rewrite to your host.

The free Supabase tier is enough for a single workshop's personal use.

## Project structure

A bird's-eye view for new contributors:

```text
carpinteroPro/
├── src/
│   ├── app/                  # Entry point, router, AppLayout
│   ├── features/             # 15 self-contained features
│   │   ├── admin/            # Platform admin tooling (post-auth)
│   │   ├── auth/             # Login / signup / password reset
│   │   ├── billing/          # MercadoPago surface (parked)
│   │   ├── crm/              # Clients, quote history
│   │   ├── dashboard/        # Workshop metrics
│   │   ├── inventory/        # Materials + stock movements
│   │   ├── landing/          # Public marketing site
│   │   ├── legal/            # Privacy / terms pages
│   │   ├── onboarding/       # First-run workshop creation
│   │   ├── production/       # Production orders + Kanban
│   │   ├── quotes/           # Quotes, contracts, Kanban
│   │   ├── recipes/          # Furniture templates (BOM)
│   │   ├── search/           # Global search
│   │   ├── settings/         # Workshop settings
│   │   └── tasks/            # Tasks
│   └── shared/               # Cross-feature primitives only
│       ├── lib/              # supabase client, queryClient, utils
│       ├── types/            # database.ts (regenerated, do not edit)
│       └── ui/               # shadcn-style components
├── supabase/
│   ├── migrations/           # 75+ SQL migrations, applied in order
│   ├── functions/            # 16 Deno Edge Functions
│   └── config.toml
├── openspec/
│   ├── specs/                # Canonical per-domain specs
│   └── changes/              # Active + archived change proposals
├── docs/
│   ├── operations/           # Env, migrations, rollback, Vercel
│   ├── testing/              # E2E runbook
│   └── mercadopago-webhook-checklist.md
├── tests/                    # Playwright specs
├── AGENTS.md                 # Code review rules
├── CLAUDE.md                 # Developer conventions
├── CHANGELOG.md              # Per-version change log
└── package.json
```

Each feature folder follows the same shape (`api/`, `hooks/`, `components/`, `types.ts`, optional `lib/`, `index.ts`). When in doubt, follow an existing feature.

## Useful docs

The repo has more documentation than fits in a README. Worth reading:

- [`AGENTS.md`](AGENTS.md) — code review rules every PR must satisfy.
- [`CLAUDE.md`](CLAUDE.md) — developer conventions, troubleshooting, and unwritten rules worth knowing (shadcn install quirk, manual `database.ts` caveats, RHF + Zod coerce caveat).
- [`CHANGELOG.md`](CHANGELOG.md) — what shipped in each version (currently `v0.1.0-beta.1`).
- [`docs/operations/environment-setup.md`](docs/operations/environment-setup.md) — authoritative env guide for local, preview, and production.
- [`docs/operations/migration-deployment.md`](docs/operations/migration-deployment.md) — how to ship database changes safely.
- [`docs/operations/rollback-runbook.md`](docs/operations/rollback-runbook.md) — what to do when a release goes wrong.
- [`docs/operations/supabase-production-checklist.md`](docs/operations/supabase-production-checklist.md) — pre-production checklist.
- [`docs/testing/runbook.md`](docs/testing/runbook.md) — Playwright E2E setup, fixtures, cleanup.
- [`openspec/`](openspec/) — canonical product specs and the historical record of every change.

## Contributing

The project treats contribution rules as non-negotiable. Read [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) before opening a PR — they document the conventions the maintainers enforce.

**Non-negotiable rules:**

- **Feature-sliced architecture.** A feature is self-contained under `src/features/<name>/`. Features import only their own files and `src/shared/**`. Shared code never imports from a feature. ESLint enforces this with `eslint-plugin-import` `import/no-restricted-paths`. If you find yourself wanting to import across features, expose it through the feature's `index.ts` instead.
- **Multi-tenant by default.** Every new database table must include `workshop_id uuid NOT NULL` and have RLS enabled. Don't reintroduce client-controlled tenant selection.
- **Server role key is never in the frontend.** The Supabase service role key belongs only in Supabase Edge Function secrets. All client queries go through the typed Supabase client in `src/shared/lib/supabase`.
- **No more `any`.** TypeScript is strict. No `any`, no `var`, no unused imports.
- **Hooks follow the Rules of Hooks.** Functional components with named exports only.
- **Generated types stay generated.** `src/shared/types/database.ts` is produced by `supabase gen types`. If you don't have a personal access token, maintain it by hand but always include `Relationships: []` (supabase-js v2 requires it to infer row types).

**Process:**

- **Issue-first PRs.** Every PR must close an issue with `status:approved`. Open an issue first, get a maintainer to approve it, then open the PR. Branch name must match `^(feat|fix|chore|docs|refactor|perf|test|build|ci)/[a-z0-9._-]+$`.
- **OpenSpec for medium and large changes.** Anything beyond a small fix goes through the OpenSpec workflow under `openspec/` — proposal, design, tasks, apply, verify, archive. Read the existing specs in `openspec/specs/` and historical changes in `openspec/changes/archive/` to learn the format.
- **Tests and lint must pass.** Run `npm test` and `npm run lint` before pushing. New behaviour ships with a test. Business-critical user flows ship with a Playwright spec.
- **Version every change.** This is a pre-1.0 project; every completed change bumps the version. Use the `release-versioning` skill to assess the bump.

There is no `CONTRIBUTING.md` file yet (this section is the draft). A standalone `CONTRIBUTING.md` will be split out of this README as the contributor base grows.

## License

CarpinteroPro is released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). The full text lives in the [`LICENSE`](LICENSE) file at the root of this repository.

In plain terms: anyone who runs a modified version as a network service — including as a hosted SaaS — must publish the source of their modifications to the people who use that service. Internal use inside a single organization is not affected.

## Maintainers

- **GitHub:** https://github.com/ferreyrajesus94-dot/carpinteroPro
- **Production deployment:** https://carpintero-pro.vercel.app
- **Supabase project:** `revbbzqjglqnphjrasvv` (canonical hosting; self-hosting instructions above)
- **Support channel:** the issue tracker on GitHub. For security issues, do not open a public issue — contact the maintainers directly via the GitHub profile.

## Acknowledgements

CarpinteroPro is built on the shoulders of generous open-source work: React, Vite, Tailwind, TanStack Query, Radix UI, Supabase, Vitest, Playwright, and many others. Thank you to the maintainers and contributors of those projects.
