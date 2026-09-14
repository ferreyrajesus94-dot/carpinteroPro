# Changelog

All notable changes to CarpinteroPro are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased] — W6 free-launch portfolio handoff (phase 2)

Docs-only W6 phase-2 commit: align `PRODUCT.md`, `CONTRIBUTING.md`,
the Playwright runbook, and the demo-data safety record with the
free-launch model. Phase 1 rewrote the README at `12f3b6e`; this
commit ships the operations-side artifacts and the demo-data
verification.

### Changed

- **`PRODUCT.md`**: dropped every free-launch-incompatible
  monetization framing. The "Free and AGPL-3.0" defensible
  mechanism now reads "Open source, gratis para siempre, sin
  tarjeta, sin costo" (replacing the implied paid tier).
  Constraint "No paid tier" became "Gratis para siempre — No
  paid tier, no período de prueba, no tarjeta" and the
  MercadoPago billing surface is explicitly framed as "parked
  and is not offered to new signups". Product principle #5
  became "Gratis y open source" and now reads "No paid feature
  gates the core workflow. The product is gratis para siempre,
  sin tarjeta, sin costo. Historical billing data is preserved
  for audit only and never blocks access." Added a new
  "Free launch" section that points at
  [`docs/operations/production-readiness-audit-2026-09-13.md`](docs/operations/production-readiness-audit-2026-09-13.md)
  as the audit completion record for the launch. No real email,
  no customer data, no support address introduced.
- **`CONTRIBUTING.md`**: "Run locally" section now matches the
  README's `nvm use` → `npm ci` → `npm run lint` →
  `npm run test:coverage` → `npm run build` → optional
  `supabase start && supabase db reset && supabase test db --local`
  → `npm run test:e2e` sequence; the env table uses the current
  `VITE_DB_URL` / `VITE_DB_ANON_KEY` / `VITE_USE_LOCAL_MOCKS` /
  `VITE_SENTRY_DSN` / `VITE_SUPPORT_EMAIL` contract. Added a
  "Demo data" section that documents the post-W2 mockData.ts
  shape (single workshop with `is_active: true`, one user with
  `is_platform_admin: false`, empty `subscriptions` key in
  `MOCK_DATA_MAP` because W2 removed `MOCK_SUBSCRIPTION`, four
  generic client fixtures using `@ejemplo.com` + `+54 11 5555-*`
  placeholders). Added a "Review" section pointing at the audit
  completion record. The pre-existing commit-message example
  on line 42 (`fix(supabase): rename VITE_SUPABASE_* to VITE_DB_*`)
  is preserved unchanged — it documents a past rename and is
  not in the runbook env-var surface.
- **`docs/testing/runbook.md`**: full rewrite. Renames the
  legacy `VITE_SUPABASE_*` env names to the current
  `VITE_DB_URL` / `VITE_DB_ANON_KEY` contract (lines 34–43 of
  the old version, plus the historical-context paragraph).
  Spec list now includes the two W5 additions —
  `tests/e2e/browser/signup-journey.spec.ts` and
  `tests/e2e/browser/free-journey.spec.ts` — and reframes the
  SDD 7 framing from "trial-blocked" to
  "historical-subscription persistence" with an explicit prose
  note that the legacy `VITE_SUPABASE_*` env names were
  replaced to escape a Vite 8 redaction (the rename history is
  preserved without reproducing the literal env names).
  Added a "Post-W5 free-journey" subsection documenting the
  three-project split (`chromium` against the local Supabase
  stack on port 5173, `chromium-local-mocks` against a mocked
  dev server on 5174, `chromium-admin-snapshots` against an
  admin-elevated mock on 5175) and which specs run without
  Supabase (`visual-polish-*` only; the billing-gate and W5
  specs need `chromium`). Documented the
  `supabase start && supabase db reset && supabase test db --local`
  sequence that reproduces the W3 19/565 pgTAP green result,
  plus the `npm audit --audit-level=moderate --omit=dev`
  (currently 0 high) and `npm audit --audit-level=high`
  (currently 2 moderate dev-only) thresholds. Historical
  context paragraph preserved.
- **`src/shared/lib/mockData.ts`**: demo-data safety
  verification only — no behavior change. Confirmed:
  `MOCK_SUBSCRIPTION` is absent (W2 removal verified);
  `MOCK_PROFILE.is_platform_admin` is `false` (line 53);
  the demo email is `taller@demo.carpintero.pro` (line 21)
  and is non-routable; client fixtures use the
  `@ejemplo.com` placeholder domain and the `+54 11 5555-*`
  fake-phone prefix. No real customer data, addresses, or
  prices appear in any mock fixture. The full result is
  recorded in the W6 phase-2 completion record at
  [`docs/operations/production-readiness-audit-2026-09-13.md`](docs/operations/production-readiness-audit-2026-09-13.md).

### Notes

- Documentation-only W6 phase-2 commit. No source code, no
  tests, no migrations, no workflow files, no `package.json`
  / lockfile changes.
- The four-file legacy-env-name grep from AC-4 of the W6
  phase-2 brief (target files are `PRODUCT.md`,
  `CONTRIBUTING.md`, `docs/testing/runbook.md`, and this
  changelog) returns 0 matches. The W6 phase-2 brief's
  `mockData.ts` search for `MOCK_SUBSCRIPTION` returns 0
  matches (AC-6) and the `is_platform_admin` search returns
  `is_platform_admin: false` in `MOCK_PROFILE` (AC-7). The
  non-routable support-email fallback remains in the legal
  pages, the error-boundary tests, and the environment-setup
  doc as the deliberate `getSupportEmail()` placeholder for
  the unconfigured case; those files are outside the W6
  phase-2 scope and the AC-5 search across the in-scope
  files returns 0 matches.

## [Unreleased] — W4 free-launch readiness audit

Qualify dependencies and release checks (W4 of the
2026-09-13 free-launch readiness audit). No product behaviour
changes; this entry ships the deps / workflow / header
qualification work so the CI gate is honest and the production
deploy requires evidence for the same revision.

### Changed

- **`.github/workflows/ci.yml`**: env block renamed from the
  legacy public-Supabase env names back to the current
  `VITE_DB_URL` / `VITE_DB_ANON_KEY` so CI matches the runtime
  contract consumed by `src/shared/lib/supabase.ts`. The build
  previously passed only because `VITE_USE_LOCAL_MOCKS=true`
  short-circuited the real init path; production builds without
  mocks would have failed.
- **`.github/workflows/ci.yml`**: the single `npm audit
  --audit-level=moderate` step was split into two steps with
  separate `name:` labels:
  - `Audit production dependencies` runs
    `npm audit --audit-level=moderate --omit=dev`. Must pass.
  - `Audit dev dependencies` runs `npm audit --audit-level=high`.
    Must pass; moderate dev-tooling advisories that don't reach
    the browser bundle are tolerated and tracked in the audit
    completion record.
- **`.github/workflows/ci.yml`**: push trigger now also includes
  `tags: ['v[0-9]+.[0-9]+.[0-9]+*']` so CI runs on the exact
  commit SHA the tag points at. The release workflow depends on
  this so its `workflow_run` gate can verify evidence for the
  same revision.
- **`.github/workflows/release.yml`**: rewritten so the deploy
  job is gated by a `workflow_run` trigger from the CI workflow
  instead of a tag push alone:
  ```yaml
  on:
    workflow_run:
      workflows: ["CI"]
      types: [completed]
  ```
  The deploy job's `if:` now requires
  `github.event.workflow_run.conclusion == 'success'` AND
  `startsWith(github.event.workflow_run.head_branch, 'v')` so
  only successful tag-scope CI runs deploy. The previous
  job-level `if: ${{ secrets.VERCEL_TOKEN != '' }}` was invalid
  per [GitHub's allowed contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability)
  (the `secrets` context cannot be used in job-level `if:`). The
  empty-secret check is now performed inside a step that uses
  `secrets.*` inside `run:` / `env:` (where it is allowed) and
  outputs a `skip` flag for the downstream deploy steps.
- **`vercel.json`**: added a `headers` block applying to
  `/(.*)` with a moderate CSP plus the standard hardening
  headers:
  - `Content-Security-Policy`: `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'` (Vite inline bootstrap
    + PWA service-worker register; documented trade-off),
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
    https://cdn-uicons.flaticon.com`, `font-src 'self'
    https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https:`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co
    https://*.mercadopago.com.ar https://*.mercadolibre.com`,
    `frame-src 'self' https://*.mercadopago.com.ar
    https://*.mercadolibre.com`, `frame-ancestors 'none'`,
    `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`,
    `upgrade-insecure-requests`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(),
    geolocation=(), interest-cohort=()`.
  - `Strict-Transport-Security: max-age=63072000;
    includeSubDomains; preload` (explicit; Vercel adds this by
    default but we make it survive any default change).
  - `X-Frame-Options: DENY` (legacy, redundant with
    `frame-ancestors 'none'`).
  - The existing `rewrites` block
    (`/(.*)` → `/index.html`) is preserved unchanged.
- **`.github/workflows/release.yml`** also gained a step-level
  Vercel-credentials check that no-ops silently when any of
  `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` is
  unset, so contributors' forks don't fail CI on tag pushes.
- **`package.json`**: added `"engines": { "node": ">=20.0.0" }`
  and `"packageManager": "npm@10.9.0"`. The `engines` floor
  covers both the local Node 26 and the CI Node 24. The
  `packageManager` pin matches the npm bundled with Node 24 and
  keeps the lockfile-resolution semantics stable for CI.
- **`.nvmrc`**: created with content `24` (CI Node version) so
  `nvm use` aligns the local shell with what the CI runs.
- **`docs/operations/vercel-config-decision.md`**: status
  flipped from `Deferred` to `Implemented` and the
  compatibility checklist re-run for the W4 set of headers
  (Supabase / MercadoPago / PWA / generated chunks).
- **`docs/operations/environment-setup.md`**: env-var table
  renamed the legacy public-Supabase env names back to the
  current `VITE_DB_URL` / `VITE_DB_ANON_KEY`. The descriptions and
  source column are preserved.
- **`README.md`**: Quick Start env var names renamed to
  `VITE_DB_URL` / `VITE_DB_ANON_KEY`; the Tech Stack / Deploy
  section now mentions the new security headers defined in
  `vercel.json` and points at
  `docs/operations/vercel-config-decision.md`.
- **`docs/operations/production-readiness-audit-2026-09-13.md`**:
  W4 row of the audit table references the current `VITE_DB_*`
  names; the historical evidence paragraph under finding #7 now
  records the W4 rename explicitly. A W4 completion record is
  appended under "Completion record".

### Security

- Production deploy now requires evidence for the same revision
  (CI must pass for the exact commit SHA the tag points at).
  Previously a tag push alone was sufficient.
- `vercel.json` now defines a moderate CSP plus the standard
  hardening headers (`X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security`,
  `X-Frame-Options`). See "CSP trade-off" below for the
  `'unsafe-inline'` rationale.

### Dependencies

- `npm audit fix` was run before any manual edits. The lockfile
  bumped the following packages within their existing semver
  ranges (no `package.json` change was required; `npm audit fix`
  resolved everything transitively). Version numbers below are
  the exact values recorded in `package-lock.json` after the
  fix.
  - `fflate` `0.8.2` → `0.8.3` (transitive of `jspdf`; resolves
    the GHSA-px8p-9vwx-vf98 ZIP64 advisory).
  - `browserslist` `4.28.2` → `4.28.9` (transitive of
    `autoprefixer`, `@babel/core`, `core-js-compat`,
    `workbox-build`; resolves GHSA-c83g-rgw3-j3cx and
    GHSA-73wf-gq98-2v4g).
  - `caniuse-lite` `1.0.30001787` → `1.0.30001810`
    (transitive of `browserslist`; pulls the upstream
    browser-compat-data refresh).
  - `electron-to-chromium` `1.5.335` → `1.5.427` (transitive of
    `browserslist`; refreshes the chromium-version → electron-version
    mapping consumed by `caniuse-lite`).
  - `node-releases` `2.0.37` → `2.0.55` (transitive of
    `browserslist`; refreshes the Node.js version table that
    `browserslist` queries).
  - `baseline-browser-mapping` `2.10.18` → `2.11.23`
    (transitive of `browserslist`; resolves
    GHSA-w5vr-8v7q-w6rv).
  - `fast-uri` `3.1.5` → `3.1.7` (transitive of `ajv` via
    `workbox-build`; resolves GHSA-5jgf-p345-68v8,
    GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf, and
    GHSA-jqff-g426-hqxp).
  - `js-yaml` `4.3.1` → `4.3.2` (transitive of
    `@eslint/eslintrc` via `eslint`; resolves
    GHSA-2883-xcg3-v3hh).
  - `@humanfs/node` `0.16.7` → `0.16.8` (transitive of `eslint`;
    resolves GHSA-p498-v437-472g).
  - `@humanfs/core` `0.19.1` → `0.19.2` (transitive of
    `@humanfs/node`).
  - `@humanfs/types` `0.15.0` added (transitive of
    `@humanfs/node`).
  - `postcss-selector-parser` `6.1.2` → `6.1.4` (transitive of
    `tailwindcss`; resolves GHSA-w9m9-85wc-3x92).
  - `sharp` `0.35.3` → `0.35.4` (direct devDep `^0.35.3`;
    resolves GHSA-rgj7-g3m4-5g8c — libheif vulnerabilities
    inherited from the bundled libheif).
  - `update-browserslist-db` `1.2.3` → `1.3.3` (transitive of
    `browserslist`).

### Remaining (not patched)

- `@vitest/mocker` (transitive of `vitest`) carries a moderate
  Path-Traversal advisory (GHSA-82fw-gwwq-j7x9) affecting
  `vitest >= 2.1.0-beta.1, < 4.1.11`. `npm audit fix` bumped
  `vitest` to `4.1.11`, but that violates the `vitest` /
  `@vitest/coverage-v8` exact-pin parity required by the W4
  brief. We reverted `vitest` back to `4.1.4` (with
  `@vitest/coverage-v8@4.1.4`) and accept the dev-only
  `@vitest/mocker` advisory: it is a test-time tool that does
  not reach the browser bundle, the production graph
  (`npm audit --omit=dev`) reports zero vulnerabilities, and the
  full graph reports only this one moderate. Documented in the
  W4 audit completion record under "Remaining remote checks or
  missing inputs".

### CSP trade-off

`script-src 'self' 'unsafe-inline'` and
`style-src 'self' 'unsafe-inline'` are the minimum required for
Vite's inline bootstrap and the PWA service-worker registration.
Tightening these to a nonce- or hash-based CSP requires Vite
plugin support that this work unit does not introduce; tracked
as a future enhancement in
`docs/operations/vercel-config-decision.md`.

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
