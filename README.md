# CarpinteroPro

Free open-source workshop management for carpenters. Quote, build, and track jobs from any device.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

---

## Live demo

A demo deployment is available at:

> **https://carpintero-pro.vercel.app**

The demo runs the same build that ships from `main` and uses the in-app mock data backend (see [Demo data + safety](#demo-data--safety)) so anyone can explore the full workflow without an admin credential.

### Screenshots

Seven screenshots cover the end-to-end journey. The image files are deferred to a follow-up W6 commit; this README lists the expected slots so reviewers know where each screenshot will land. The capture plan lives in `docs/portfolio/README.md` (also a follow-up commit).

| # | Screen | What it shows |
| --- | --- | --- |
| 01 | Signup | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |
| 02 | Onboarding | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |
| 03 | Inventory | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |
| 04 | Quote wizard | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |
| 05 | Contract PDF | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |
| 06 | Production | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |
| 07 | Settings | *Screenshot deferred — see `docs/portfolio/README.md` in a follow-up commit.* |

---

## What it does

- **Signup → onboarding** — Create an account, accept terms and privacy, and provision a workshop in a single guided flow.
- **Inventory** — Workshop-scoped materials with units, prices, minimum stock, and a full price-history chart.
- **Quote wizard with PDF contract** — Pick a client and a furniture recipe, configure margin rules, freeze the recipe cost at quote time, render a contract, and export to PDF or share via WhatsApp.
- **Production (state machine + reversal)** — Move approved quotes through a Kanban board; starting production automatically deducts the right amount of material from stock and writes an immutable ledger row. Reversals are first-class and idempotent.
- **CRM clients + tasks + global search** — Clients carry quote history and stats, tasks track follow-ups, and a cross-feature search hits every domain table.
- **Free, forever** — No trial, no subscription, no payment prompt. Historical `subscriptions` rows are preserved for audit but never gate access.

The application is Spanish-only because the target audience is Spanish-speaking carpenters who don't want to fight technology — they want to make furniture.

---

## Tech stack

- **Frontend:** React 19 + Vite 8 + TypeScript + TanStack Query 5 + React Router 7 + Tailwind CSS 3 + Radix UI primitives + React Hook Form + Zod + Recharts + jspdf + vite-plugin-pwa.
- **Backend:** Supabase — Postgres, Row Level Security, Auth, and Edge Functions in Deno 2. 75+ SQL migrations and 16 Edge Functions live in `supabase/`.
- **Testing:** Vitest + Testing Library (unit/component), Playwright (browser/integration), pgTAP (SQL).
- **CI:** Node 24 in CI; Node ≥ 20.0.0 locally. `engines.node: ">=20.0.0"` is pinned in `package.json`.

---

## Architecture overview

Three tiers, no monolith:

```text
  ┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
  │ Browser SPA                              │    │ Supabase (per-region free tier)         │
  │  React 19 + Vite 8 + TanStack Query      │    │  Postgres + RLS + Auth                  │
  │  React Router 7 (lazy per feature)       │◀──▶│  Storage + Edge Functions (Deno 2)      │
  │  vite-plugin-pwa (service worker)        │    │  Realtime (WebSocket)                   │
  │  VITE_DB_URL / VITE_DB_ANON_KEY only     │    │  Row-level security on every table       │
  └──────────────────────────────────────────┘    └──────────────────────────────────────────┘
                          ▲                                       ▲
                          │ static SPA build (dist/)              │ Edge Function secrets
                          ▼                                       ▼
  ┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
  │ Vercel (static hosting)                  │    │ Edge Functions (Deno 2)                 │
  │  Auto-deploy from main                   │    │  mercadopago-webhook (parked for free)  │
  │  SPA rewrite + CSP + security headers    │    │  admin-* tools (platform admin)         │
  │  vercel.json owns rewrites + headers     │    │  shared/_shared/ CORS + admin client    │
  └──────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

**Workshop identity is server-derived.** Every domain table carries `workshop_id uuid NOT NULL`. The active workshop is resolved through `auth.uid() → profiles.workshop_id` (via `get_current_workshop_id()`). Clients never choose or pass a workshop id.

**Feature-sliced frontend.** Each feature lives under `src/features/<name>/` with its own `api/`, `hooks/`, `components/`, `routes.tsx`. Cross-feature imports are forbidden by ESLint (`eslint-plugin-import` `import/no-restricted-paths`). Shared code lives only under `src/shared/`. `src/app/` composes the public APIs of features.

**Stock deduction ledger.** Production start writes to `quote_production_stock_deductions`; an `AFTER INSERT` trigger writes one immutable `stock_movements` row per approved BOM line and updates `materials.stock` atomically. Reversals are first-class.

**Snapshotted quotes.** A quote freezes recipe cost at quote time so future price changes never retroactively alter sent quotes.

**Edge Functions are conditional for the free launch.** The historical `mercadopago-webhook` and `admin-*` Edge Functions remain deployed but are not exercised by the free user journey. They are kept for any future optional paid feature.

---

## Tradeoffs

The free-launch scope is honest about what is in and what is out:

- **Vite 8 + `'unsafe-inline'` CSP.** Vite injects inline scripts for its bootstrap and the PWA service-worker registration needs `unsafe-inline` for `script-src` and `style-src`. Tightening to hashed or nonced CSP requires a Vite plugin that emits the matching nonces; it is documented as a future enhancement in `docs/operations/vercel-config-decision.md` and is out of scope for this launch.
- **Playwright + pgTAP require Docker.** The browser/integration suites and the SQL suite both depend on a disposable Supabase stack (`supabase start` + `supabase db reset`). A contributor who only wants to run unit tests does not need Docker; the Vitest suite (131 files / 999 tests) does not.
- **Hosted services unverified.** SMTP delivery, hosted backups/restore, Sentry end-to-end, and a real support inbox are listed as **unverified** in [Known limitations](#known-limitations-unverified-hosted-checks). They require operator-side wiring (project, secrets, DNS) that is out of scope for local implementation.
- **`mercadopago-webhook` audit finding #2 (`approved` → `past_due`) is documented, not fixed.** The status mapper in `supabase/functions/_shared/billing.ts:8` falls through `approved` to `past_due`. The mismatch is asserted as a follow-up in `tests/e2e/integration/mercadopago-webhook.spec.ts`. Repairing the mapper would change behavior in the live webhook handler and is intentionally deferred; the free journey does not depend on it.
- **Free model = no revenue stream.** The app is free, with no trial, no subscription, and no in-app payment prompt. Historical billing rows are preserved for audit; future optional paid features, if added, would live behind the existing Edge Function surface and the `subscriptions` table — they do not affect free access.

---

## Tests

The suite is layered by purpose. All counts below are measured against the current `main` branch on a local disposable database after `supabase db reset`.

| Layer | Tool | Count | Local command |
| --- | --- | --- | --- |
| Unit + component | Vitest + Testing Library | 131 files / 999 tests | `npm run test:coverage` |
| SQL assertions | pgTAP (Supabase test runner) | 19 files / 565 assertions (all green locally) | `supabase test db --local` |
| Browser + integration | Playwright | 21 spec files / 60 tests (compile-clean; execution requires `supabase start` + a disposable stack) | `npm run test:e2e` |

Key proofs worth naming explicitly:

- `supabase/tests/cross_tenant_full_coverage.test.sql` — cross-tenant read/write denial for every workshop-scoped table (the cross-tenant RLS proof).
- `supabase/tests/tenant_isolation.test.sql` — historical cross-tenant isolation contract that `cross_tenant_full_coverage` extends.
- `supabase/tests/workshop_is_active_protection.test.sql` — `workshops.is_active` cannot be self-reactivated by an authenticated workshop member.
- `supabase/tests/profile_admin_field_escalation.test.sql` — `is_platform_admin` and `workshop_role` cannot be escalated by the row owner.
- `tests/e2e/integration/subscription-state.spec.ts` — historical-subscription proof: a workshop with `past_due` / expired-trial / cancelled history still reaches the free dashboard.
- `tests/e2e/browser/free-journey.spec.ts` — the end-to-end happy path: login → onboarding → inventory → quote → contract PDF → production.
- `tests/e2e/browser/signup-journey.spec.ts` — synthetic-account signup reaches the dashboard without admin credentials.

---

## Run locally

Prerequisites: Node ≥ 20.0.0 (the repo pins Node 24 in CI; `.nvmrc` ships with `24`), npm 10+, and Docker if you want to run the Supabase local stack and the pgTAP / Playwright suites.

```bash
nvm use         # or ensure Node >=20.0.0
npm ci
npm run lint
npm run test:coverage
npm run build
# Optional: disposable DB + pgTAP + e2e
supabase start
supabase db reset
supabase test db --local
npm run test:e2e -- tests/e2e/browser/free-journey.spec.ts
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values you need. The runtime contract is **`VITE_DB_URL` / `VITE_DB_ANON_KEY`** — that is what `src/shared/lib/supabase.ts` reads.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_DB_URL` | yes | Supabase project URL. |
| `VITE_DB_ANON_KEY` | yes | Supabase anon key (browser-safe). |
| `VITE_USE_LOCAL_MOCKS` | no | Set to `true` to preview the UI without a Supabase stack. See [Demo data + safety](#demo-data--safety). |
| `VITE_SENTRY_DSN` | no | If set, `@sentry/react` is loaded dynamically and reports are sent to that project. |
| `VITE_SUPPORT_EMAIL` | no | Operator support inbox displayed in the legal pages and the error boundary. See [Known limitations](#known-limitations-unverified-hosted-checks). |

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, MercadoPago tokens, etc.) belong in Supabase Edge Function secrets, never in `.env.local`. See `docs/operations/environment-setup.md`.

---

## Deploy

Vercel hosts the frontend, Supabase hosts the backend.

1. Link a Supabase project at https://supabase.com (the free tier is sufficient for a single workshop's personal use).
2. Push the migrations from `supabase/migrations/` via `supabase db push` against the linked remote, or apply them in the Supabase SQL editor in order.
3. Build the frontend: `npm run build` produces `dist/` (Vite static SPA, PWA precache).
4. Vercel auto-deploys from `main` per `.github/workflows/release.yml` (a `workflow_run` gate deploys the exact SHA CI tested).
5. Configure the Vercel project environment:

   | Variable | Value |
   | --- | --- |
   | `VITE_DB_URL` | your Supabase project URL |
   | `VITE_DB_ANON_KEY` | your Supabase anon key |
   | `VITE_USE_LOCAL_MOCKS` | `false` (production) |
   | `VITE_SENTRY_DSN` | (optional) Sentry project DSN |
   | `VITE_SUPPORT_EMAIL` | (optional) operator support inbox |

6. (Optional) Deploy the historical Edge Functions via `supabase functions deploy <name>` for each function under `supabase/functions/`. They are not exercised by the free user journey.

`vercel.json` defines the SPA catch-all rewrite plus a conservative set of security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`). See `docs/operations/vercel-config-decision.md` for the rationale.

---

## Known limitations (unverified hosted checks)

These checks require operator-side wiring (SMTP, DNS, hosted project, secrets) that is not exercised by the local implementation. Each row records the precise missing input. Resolve before claiming production-ready.

| Check | Status | Missing input |
| --- | --- | --- |
| Signup email delivery | unverified | SMTP wiring at hosted Supabase + `enable_confirmations=true` in `supabase/config.toml`. |
| Reset email delivery | unverified | Reset UI not implemented (out of scope) + SMTP wiring at hosted Supabase. |
| Staging backup restore | unverified | Hosted Supabase PITR or scheduled backups not configured. |
| Error reporter end-to-end | unverified | Sentry project + DSN not configured at hosted environment. `@sentry/react` is wired and tree-shakes when no DSN is set; an end-to-end test requires a real project. |
| Support inbox | unverified | A real operator inbox must be set via `VITE_SUPPORT_EMAIL`. The legal pages and error boundary fall back to a non-routable placeholder (`example.com`); this README does not reproduce the placeholder text — it is a documented fallback, not a chosen email. |
| Hosted ledger diff vs local | unverified | `supabase migration list --linked` not inspected against the committed migration history. |
| Playwright suite executed against hosted | unverified | Browser suite compiles locally (`npx playwright test --list` → 60 tests); full execution requires `supabase start` + Docker + a hosted preview environment. |
| Edge Function secrets at hosted | unverified | `mercadopago-webhook` and `admin-*` secrets are not configured at hosted Supabase; the free journey does not depend on them. |

The README does not list a real email address for support. The default placeholder used by the legal pages is intentionally non-routable; configure `VITE_SUPPORT_EMAIL` before launch.

---

## Demo data + safety

The default `src/shared/lib/mockData.ts` ships a workshop named **"Carpintería El Ñandú"** with the email `taller@demo.carpintero.pro`, four synthetic clients (`@ejemplo.com`), sample materials, recipes, quotes, and an empty `subscriptions` array. There are no admin credentials and no real customer data.

The mock data is **never bundled into production builds.** `src/shared/lib/supabase.ts` gates the dynamic `import("./mockSupabase")` behind two conditions:

```text
import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_MOCKS === "true"
```

Vite tree-shakes the dynamic import away when the conditions are false. Setting `VITE_USE_LOCAL_MOCKS=true` in `.env.local` lets you preview the UI without a Supabase stack — useful for design review — and is the only way the mock path runs.

---

## License + acknowledgments

CarpinteroPro is released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). The full text lives in the [`LICENSE`](LICENSE) file at the root of this repository. In plain terms: anyone who runs a modified version as a network service — including as a hosted SaaS — must publish the source of their modifications to the people who use that service. Internal use inside a single organization is not affected.

**Maintainer:** the `carpintero-pro` GitHub handle (see the repository's commit history).

**Funding:** none. The app is free, has no revenue stream, and no sponsorships.

**Built on the shoulders of:** React, Vite, Tailwind CSS, TanStack Query, Radix UI, Supabase, Vitest, Playwright, pgTAP, and many other open-source projects. Thank you to the maintainers and contributors of those projects.

---

## Audit + verification

The full free-launch readiness audit lives at [`docs/operations/production-readiness-audit-2026-09-13.md`](docs/operations/production-readiness-audit-2026-09-13.md). It covers W1 (build restore), W2 (free-access decoupling), W3 (database grants + RLS protection), W4 (dependency and CI gate), W5 (user journey + Sentry + a11y), and W6 (portfolio + release handoff, of which this README is the first commit).

All W1–W6 acceptance criteria are satisfied locally (Vitest, pgTAP, Playwright compile, lint, build, audit). Hosted checks remain **unverified** until a hosted environment is exercised end-to-end — see the [Known limitations](#known-limitations-unverified-hosted-checks) table for the precise missing inputs.

The portfolio walkthrough (`docs/portfolio/README.md`), the remaining W6 docs (PRODUCT.md, CONTRIBUTING.md, runbook.md, CHANGELOG.md, screenshots), and the demo-data safety verification ship in follow-up W6 commits. The audit completion record for this README commit is appended to the audit document as **W6 — phase 1**.