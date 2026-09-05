# Changelog

All notable changes to CarpinteroPro are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.1-beta.2] — 2026-09-05

UI audit: refactored to a single OKLCH redesign system, extracted
five shared components, added performance optimizations and 58 smoke
tests for design-system primitives. Also includes a Vite 8.0.16
compatibility fix that was blocking login.

### Changed

- **Design tokens unified on OKLCH**: the redesign system introduced in
  `src/index.css` (3 themes `sawdust` / `workshop` / `graphite` + dark
  mode, `--cp-accent` / `--ink` / `--bg` etc.) is now the canonical
  surface across `src/shared/ui/*`. Legacy shadcn HSL tokens kept as
  `@deprecated` in `src/index.css` for migration tracking only.

- **`src/shared/ui/*`**: 12 components (Button, Card, Badge, Input,
  Select, Switch, Dialog, Table, Textarea, Tooltip, RadioGroup,
  Separator) now use the OKLCH tokens. Variants are first-class
  (e.g. `<Button variant="outline">`, not `isOutline`).

- **`React.forwardRef` removed** from all 12 shadcn-style components
  (React 19 has native ref-as-prop). `<ThemeToggle>` extracted to
  `src/shared/components/ThemeToggle.tsx` with `variant="icon" | "label"`.

- **Color tokens**: hardcoded Tailwind palette (`bg-yellow-500`,
  `text-green-700`, `border-destructive/40`, etc.) replaced with
  OKLCH tokens (`bg-cp-warn`, `text-cp-success`, `border-cp-danger/40`)
  in 10+ files including `LoginPage`, `OfflineBanner`,
  `MaintenanceBanner`, `OverviewPage`, `ProductionPipelineWidget`,
  `InventoryStats`, `ProductionStartReviewDialog`,
  `WorkshopDetailPage`, `CommissionsTab`, `StockHistoryDialog`,
  `StockAlertBanner`, `StockAlertBanner`.

- **Lint cleanup**: dead `theme="light"|"dark"` and `toggle: () => void`
  props removed from `LandingHeader` interface (useTheme already
  wired internally). `<EmptyState>` consolidated into
  `feedback-state.tsx` with optional `icon?: LucideIcon`. Two versions
  (with and without icon) detected in the codebase; only one now.

- **LandingHeader** (public landing page) is now the header for
  authenticated users too — both use `<BrandMark>` with the same
  defaults, removing the legacy compat shim that previously accepted
  `theme`/`toggle` props.

### Added

- **Five shared components** in `src/shared/ui/`:
  - `<Avatar>` with `getInitials(name, email)` helper,
    `size="xs|sm|md|lg"` and `tone="solid|soft"` variants. Migrates
    5 call sites (AppLayout sidebar + mobile header, ProfilePage,
    ClientList, ClientDetail, QuoteForm).
  - `<Eyebrow>` with `variant="sans|mono"`, `tone="muted|danger|warn"`,
    and `as="span|p|div|h2|h3|h4"` polymorphic root. Migrates
    20+ section labels across landing, dashboard, inventory,
    production, search, settings, billing, admin, crm, recipes.
  - `<BrandMark>` with `size="xs|sm|md|lg"`, `shape="square|rounded"`,
    optional `wordmark` and `label` override, optional `href` for
    `<Link>` wrapping. Migrates 8 call sites including the public
    landing header + footer and the authenticated `AppLayout` desktop
    sidebar + mobile section badge.
  - `<ChipToggle>` with `variant="filter|tab|category|nav-chip"`,
    optional `count` badge with `badgeTone="neutral|accent|danger"`.
    Migrates 4 call sites (SearchResults filter chips, TaskList tabs +
    category chips, AdminLayout mobile chip nav).
  - `<SidebarNavLink>` (companion: `<SidebarNavLink>` is the export)
    with `variant="row-icon|icon-square|bottom-tab|chip"`, optional
    `badge={{count, tone}}`. Migrates 10 call sites across
    `AppLayout` (sidebar list + admin/settings links + mobile icon
    buttons + bottom tabs) and `AdminLayout` (sidebar + mobile chip
    nav). Centralizes the active-state styling that was duplicated
    verbatim across both layouts.

- **`<RetryButton>`** in `src/shared/components/RetryButton.tsx` —
  small shared button replacing the inline `<button>` that was
  duplicated in 8 places across inventory, quotes, crm, tasks, and
  admin feature components.

- **Performance optimizations** on drag-heavy components:
  `<Column>` and `<OrderCard>` in `ProductionBoard` and
  `<DroppableColumn>` and `<DraggableCard>` in `<QuoteList>` wrapped
  with `React.memo` to avoid re-rendering every card on each
  drag-over. Callbacks (`moveQuoteToStatus`, `handleDragEnd`,
  `handleStart`) wrapped with `useCallback`. Stable `key` props on
  draggable lists (`order.id`, not array index).

- **`useDeferredValue`** in `SearchResultsPage` — the input now drives
  the data hook through `useDeferredValue(trimmedDraft)`, keeping
  keystroke latency independent of the result-render cost. URL
  address-bar sync keeps the original `useDebouncedValue` 250ms
  timing (the contract for the address-bar mirror is different
  from the input responsiveness contract).

- **`startTransition` on retry**: error-state retry buttons in
  `MaterialList` and `QuoteList` wrap the refetch in
  `startTransition(() => refetch())` so the button stays responsive
  while the query is in flight.

- **58 smoke tests** in `src/shared/ui/*.test.tsx` for components
  that had no coverage: Button, Card, Input, Select, Switch,
  Tooltip, Badge, Separator, Textarea, RadioGroup, Skeleton, plus
  `EmptyState` (now exported from `feedback-state.tsx`). Each test
  asserts render, variants, `className` forwarding, a11y role/aria,
  and one user interaction where applicable.
  Total tests passing: **967** (was 909 baseline).

- **Explicit OKLCH opacity utilities** in `src/index.css` for the
  41 `cp-*/N` combinations actually used in the codebase (e.g.
  `.bg-cp-warn\/10`, `.border-cp-danger\/40`, `.text-cp-success`).
  Rendered via `color-mix(in oklch, var(--cp-X) N%, transparent)`
  for OKLCH fidelity. Tailwind JIT cannot derive opacity variants
  from raw `@layer utilities` definitions, so each combination
  needs an explicit utility.

### Fixed

- **Vite 8.0.16 silently substitutes the literal `[SENSITIVE]` for
  any `import.meta.env.VITE_SUPABASE_*`** at bundle time, breaking
  `createClient(supabaseUrl, supabaseAnonKey)` with "Invalid
  supabaseUrl" inside `@supabase/supabase-js`. The throw was caught
  by `App.tsx`'s `<ErrorBoundary name="app-root">` and rendered an
  empty fallback with no `console.error`, so the failure mode was
  invisible during Playwright smoke tests. Renamed to `VITE_DB_URL`
  and `VITE_DB_ANON_KEY` to escape the redaction. No `.env.local`
  changes were committed (environment files are git-ignored);
  only `.env.example` and `src/shared/lib/supabase.ts` were
  updated.

- `bg-cp-accent text-white` in MaterialList, QuoteList, QuoteForm
  replaced with `text-[var(--cp-accent-ink)]` to honor the per-theme
  ink color in dark mode and the workshop/sawdust graphite variants
  where `--cp-accent-ink` is not white.

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
