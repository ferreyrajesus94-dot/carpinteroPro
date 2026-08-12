# Changelog

All notable changes to CarpinteroPro are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
