# Changelog

All notable changes to CarpinteroPro are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0-beta.1] — 2026-08-31

Production state-machine UI + end-to-end browser coverage for the
inventory → recipe → quote → production → delivery cycle.

### Added

- **Production order state-machine UI** in
  `src/features/production/components/ProductionOrderActions.tsx`.
  Surfaces the legal next-state buttons for the current order
  state, wired to the existing `useTransitionProductionOrder` hook
  and the `transition_production_order_state` RPC. The
  `ProductionOrderDetailPage` was previously intentionally
  read-only with a comment promising transition actions in a
  future PR; this commit closes that gap. Cancellation, pausing,
  and delivery prompt for confirmation because each is terminal
  or otherwise hard to revert.

- **Per-client production history** in
  `src/features/crm/components/ClientProductionSection.tsx`. The
  `CrmClientDetailPage` previously only listed the client's
  quotes; the new section surfaces every production order whose
  `quote_id` belongs to the client, with a link into the
  production detail page and a per-state badge. Filtering is
  client-side on the existing `list_production_orders` query
  cache so no new server endpoint is required.

- **`PRODUCTION_ORDER_STATE_LABELS`** is now exported from the
  production `api/types` barrel so cross-feature consumers
  (production board, order detail, event timeline, the new
  ClientProductionSection) render the same Spanish labels
  without duplicating the map locally.

- **E2E browser tests** for the full operational cycle in
  `tests/e2e/browser/`. Two new specs — `inventory-recipe-quote.spec.ts`
  and `production-cycle.spec.ts` — exercise material creation,
  stock adjustment, recipe build, quote creation, production
  board drag, start-production dialog, and the new
  ProductionOrderActions flow all the way to `delivered`. A shared
  helper at `tests/e2e/browser/helpers/e2e-admin.ts` reuses the
  long-lived `E2E_ADMIN_EMAIL` admin user so the suite no longer
  needs the `E2E_SUPABASE_SERVICE_ROLE_KEY` secret. Both specs
  run cleanly in 1m 36s each and pass three consecutive
  invocations without flake.

### Fixed

- **`StockAdjustDialog`** invalidated the materials query cache
  after a movement so the MaterialList refreshes immediately
  instead of keeping the stale stock value until the page is
  reloaded.

- **`WoodItemsSection`** inputs were missing `aria-label`
  attributes, which broke Playwright's `getByLabel` selector
  for the quantity / waste % fields and also exposed an
  accessibility issue (visible label and programmatic name
  diverged whenever the `usage` mode was set).

- **`production-cycle.spec.ts`** was setting the test quote to
  `en_produccion` manually, but the production board picker
  filters on `stored_status === "aprobado"`, so the picker
  never showed the quote. The test now leaves the quote in
  `aprobado` and lets the SQL-projected overlay do the work.

## [0.2.0-beta.1] — 2026-08-18

Pre-OSS hardening: AGPL-3.0 LICENSE added, demo credentials removed from
the public surface, and six warning-level findings from a security audit
addressed. The leaked demo workshop password that previously lived in
tracked files has been rotated in Supabase; the new value lives only in
`.env` (gitignored). The hosted SaaS billing
integration (`mercadopago-webhook`) is now `cancel_at_period_end` for
the demo workshop — the project ships as free software.

### Added

- **AGPL-3.0 LICENSE** at the repository root (`LICENSE`,
  `Copyright (C) 2026 Jesus Elias Ferreyra`). AGPL over MIT was chosen
  to keep the hosted version of CarpinteroPro open-source: any modified
  deployment served over the network must publish its source.

### Changed

- **README.md**: the Live demo section no longer hardcodes the demo
  account credentials. Demo access is now requested by opening an issue
  tagged `demo`.
- **README.md**: new License section links to `LICENSE` with a
  plain-language summary of the AGPL-3.0 SaaS-copyleft obligation.
- **TermsPage and PrivacyPage** (`src/features/legal/pages/*.tsx`):
  the hardcoded support email and `mailto:` anchors now use the
  existing `getSupportEmail` / `getSupportMailtoHref` helpers from
  `src/shared/lib/supportContact.ts`, reading `VITE_SUPPORT_EMAIL`.
  Changing the support address no longer requires a code change.
- **`.gitignore`**: covers `.env` and `.env.*` explicitly, with
  `.env.example` retained as the tracked template. Previously only
  `.env.local` was ignored (via the `*.local` rule), leaving
  `.env`, `.env.production`, etc. at risk of accidental commit.

### Security

- **`tests/e2e/envCheck.ts`**: `getAdminEmail` and `getAdminPassword`
  now throw when `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` are unset
  instead of silently falling back to the hardcoded demo values. Tests
  fail loudly instead of running against unknown credentials.
- **`supabase/functions/create-subscription/index.ts`**: the
  `console.info("create-subscription request", …)` call no longer
  logs the user `email` (PII). Only `workshopId` (internal UUID)
  is retained.
- **`.env.example`**: tracked lines for `E2E_ADMIN_EMAIL` /
  `E2E_ADMIN_PASSWORD` use generic `<your-admin-email>` /
  `<your-admin-password>` placeholders instead of the previously
  hardcoded demo values.

## [0.1.0-beta.1] — 2026-08-12

First public beta of CarpinteroPro. This release bundles the first batch
of verified, production-deployed changes since the project started
tracking versions. Marked `beta.1` because the project is still in
public-testing stage; promotion to `0.1.0` requires explicit
release-stage authorization.

### Fixed

- **Production stock deduction** (Bug #2): the new
  `start_production_order` RPC was creating the production-order row
  and an audit row in `quote_production_stock_deductions`, but never
  inserted into `stock_movements` and never updated `materials.stock`.
  As a result, stock never decremented when production started via
  the new flow. Fixed via an `AFTER INSERT` trigger on
  `quote_production_stock_deductions` that inserts one
  `stock_movements` row per approved BOM line and updates
  `materials.stock` atomically. The trigger also includes
  regression-safe skip-logic so legacy batches (with
  `production_order_id IS NULL`) are not double-deducted.
  Migrations applied:
  - `20260811000001_fix_start_production_order_stock_movements.sql`
  - `20260811000002_fix_trigger_reason_cast.sql` (cast `reason` to
    `::public.stock_movement_reason` enum)
  - `20260811000003_trigger_also_updates_materials_stock.sql`
  Configuration: `workshop_settings.auto_stock_discount = true` for
  the canonical admin workshop.
- **SPA rewrites on Vercel**: direct URL routes (e.g.
  `/dashboard`, `/inventory`) used to return Vercel's 404 page.
  Fixed by adding `vercel.json` with a `path: "*" → /index.html`
  catch-all rewrite. The file was untracked in git since the start
  of the project; this is its first committed version.
- **Materials form 'Precio por pack' placeholder truncated**:
  the input was narrow enough that the helper placeholder
  "Cargá primero las unidades" rendered as "Cargá primero las
  unidade…". Changed the surrounding grid from `grid-cols-2` to
  `grid-cols-1 sm:grid-cols-2` so the inputs stack on small dialogs
  and the placeholder has full width.
- **Dashboard recent-quotes table overflowed 111px** (right=1551,
  viewport=1440): the inner `Table` had `overflow-auto` but the
  page-level wrapper had no `min-w-0`, so the flex children pushed
  the page itself wider than the viewport. Added `min-w-0` to the
  page-level div so the Table's `overflow-auto` engages and an
  internal horizontal scrollbar appears.

### Changed

- **Production board kanban no longer overflows 188px**:
  5 columns at `min-w-[260px] flex-1` summed to 1628px in a 1440px
  viewport, clipping the "Listo" column. Replaced the column
  sizing with `w-[260px] shrink-0` (fixed-width, no shrink) and
  added `min-w-0` to the page-level and kanban containers so the
  flex tree can shrink and the kanban's `overflow-x-auto` engages
  for internal horizontal scrolling.
- **Quotes list "—" replaced with "Sin cliente"**: the table view
  had one remaining fallback path that rendered an em-dash for
  quotes without an associated client. Brought in line with the
  other three render paths in the same file and the Spanish UX.
- **404 page now branded**: any unknown URL used to expose React
  Router's default dev error UI ("Hey developer 👋", stack traces).
  Replaced with a new `NotFoundPage` that renders "Página no
  encontrada" + "Volver al inicio" link to `/dashboard` and
  sets `document.title = "404 — Página no encontrada"`. The
  page uses only Sawdust design tokens.
- **Dialog overlay stops intercepting clicks during close
  animation**: pressing Escape / clicking outside / clicking the X
  started the overlay's fade-out but pointer-events remained `auto`,
  so the next click (e.g. on a sidebar link) was swallowed by the
  fading overlay and the app appeared frozen. Added
  `data-[state=closed]:pointer-events-none` to `DialogOverlay`.
  Cross-feature smoke list: MaterialForm, StockAdjustDialog,
  StockHistoryDialog, ClientDialog, QuoteForm, StartProductionDialog.
- **Inventory "Tendencia" column removed**: every row showed "—"
  because the `PriceSparkline` component had no data series. The
  column ate ~100px of horizontal space without providing information.
  The `PriceSparkline` import is preserved for the per-material
  detail view.
- **Landing page paid-pricing story removed**: the public landing
  page no longer surfaces a pricing section. The app is now
  free-tier-only; subscription / billing remains in the
  authenticated app for future use.

### Notes

- The landing paid-pricing story was removed in commit `8aeb5fd`
  (pre-this-release) — included here for transparency since it is
  user-visible.
- The `0.0.0` placeholder version that was in `package.json` before
  this release was never tagged. Going from a never-tagged
  placeholder to `0.1.0-beta.1` is a "first public beta" per the
  project's release matrix.

[0.1.0-beta.1]: https://github.com/ferreyrajesus94-dot/carpinteroPro/releases/tag/v0.1.0-beta.1
