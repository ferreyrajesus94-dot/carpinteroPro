# Verify Report: Visual System Polish — PR A

> **Status**: Ready for review. Unit tests, lint, build, assertion-based visual guards, contrast checks, and first-generation Playwright snapshots passed when recorded. See Phase 5 for the final verification evidence.

## Token & Color Role Consistency

- [x] `src/index.css`: `chip-warn/success/info`, `--chart-up/down/neutral`, `focus-ring`, reduced-motion guards added.
- [x] `src/index.css`: `bg-cp-danger/10`, `bg-cp-danger`, `text-cp-danger` utility classes added (fixes fresh-review finding).
- [x] `src/index.css`: `bg-cp-success`, `text-cp-success`, `bg-cp-warn`, `text-cp-warn`, `bg-cp-info`, `text-cp-info` added for consistency.
- [x] `src/index.css`: `.theme-sawdust` moved before `.dark` in cascade to fix dark+theme-sawdust override (fixes fresh-review finding).
- [x] `PriceSparkline` raw hex colors replaced with `var(--chart-*)`. Extracted `resolveSparklineColor()` — tested with 5 cases.
- [x] `QUOTE_STATUS_COLORS` in `quotes.ts` uses `chip-*` token classes.

## Feedback State Wrappers

- [x] `feedback-state.tsx` created with `ErrorState` (role="alert"), `EmptyState` (3 variants), `LoadingState` (role="status", aria-busy).
- [x] `ErrorBoundaryFallback` renders `ErrorState` component (retains retry + support).
- [ ] `RouteErrorFallback` — NOT changed in PR A scope. ErrorBoundaryFallback was already rendering ErrorState; RouteErrorFallback inherits via ErrorBoundaryFallback without code changes.

## Brand Mark

- [x] `LandingHeader` swapped Lucide `Zap` → Flaticon `fi-br-hammer`.
- [x] `LandingFooter` swapped Lucide `Zap` → Flaticon `fi-br-hammer`.

## Feature State Migrations

- [x] `QuoteList` → migrated to `ErrorState` + `LoadingState`.
- [x] `MaterialList` → migrated to `ErrorState` + `LoadingState`.
- [x] `TaskList` → migrated to `ErrorState` + `LoadingState`.
- [x] `ClientList` → migrated to `ErrorState` + `LoadingState`.
- [x] `MuebleList` → migrated to `LoadingState`.

## Visual Regression — Evidence

Playwright visual snapshots were added in Phase 5 for Dashboard, QuoteList, and BillingPage in light/dark mode. Earlier PR-slice notes below are historical context; the final verification evidence is recorded in Phase 5.

### Verified with Unit Tests (JSDOM)

| File | Tests | Evidence |
|------|-------|----------|
| `feedback-state.test.tsx` | 9 tests | `ErrorState` (role="alert"), `EmptyState` (3 variants), `LoadingState` (role="status", aria-busy) |
| `PriceSparkline.test.tsx` | 9 tests | 4 container tests + 5 `resolveSparklineColor()` tests asserting `--chart-up/down/neutral` |
| `ErrorBoundary.test.tsx` | 4 tests | Existing tests pass (Safety Net baseline) |

### Playwright Visual Snapshots

PR-slice snapshot verification was deferred during implementation and completed in Phase 5. The final snapshot scope is:
- Dashboard (light + dark)
- QuoteList (light + dark)
- BillingPage (light + dark)

## Known Gaps (Out of PR A Scope)

- `ActiveQuotesPanel` status chip migration — belongs to PR C (tables/dashboard scope).
- `StockHistoryDialog`, `InventoryStats`, `PriceHistoryChart` still use inline Skeleton loading.
- `ExtraItemsSection` / `WoodItemsSection` in recipes have inline "No hay" empty text.

## Findings Resolved in This Batch

| Finding | Resolution |
|---------|-----------|
| 1. `bg-cp-danger/10` undefined | Added 9 utility classes (`bg-cp-danger`, `text-cp-danger`, etc.) and `/10` opacity variant in `index.css` |
| 2. `.theme-sawdust` overrides `.dark` in cascade | Moved `.theme-sawdust` block before `.dark` so `.dark` wins at same specificity |
| 3. Verify report TODOs | Updated with honest evidence — unit tests confirmed, visual snapshots still pending |
| 4. `openspec/config.yaml` change | SDD infra change from `sdd-init` — kept (enablement config, not feature) |
| 5. Scope alignment | Removed references to files not in PR A diff (`RouteErrorFallback`, dashboard tables, `ActiveQuotesPanel` chip migration) |
| 6. `PriceSparkline` test missing chart assertions | Extracted `resolveSparklineColor()` pure function with 5 assertion cases; component still uses the function |

---

## PR C2: Admin Table Alignment

> **Status**: Scoped implementation complete for Billing/Support/Workshops admin tables. 597 unit tests passed when recorded (baseline 597 + 0 new — refactoring-only changes). BillingPage visual snapshots were completed in Phase 5.

### Admin Table Migrations

- [x] `BillingPage.tsx` — migrated ad-hoc `<table>` → `Table*` components; inline error state → `ErrorState`; inline empty state → `EmptyState`; raw status badge colors → `chip-success`/`chip-warn`/`chip-danger` tokens.
- [x] `SupportPage.tsx` — migrated ad-hoc `<table>` → `Table*` components; inline error state → `ErrorState`; inline empty state → `EmptyState` (with description); raw event type badge colors → `chip-success`/`chip-danger` tokens.
- [x] `WorkshopsPage.tsx` — migrated ad-hoc `<table>` → `Table*` components; inline error state → `ErrorState`; inline empty state → `EmptyState` (with dynamic search/no-results variants); raw status badge colors → `chip-success`/`chip-warn`/`chip-danger` tokens.
- [x] `src/index.css`: added `chip-danger` CSS class alongside existing `chip-warn/success/info` for cancelled/past_due status rendering.

### Admin Table Scope — Remaining Future Work

`CodesPanel.tsx`, `CommissionsTab.tsx`, and `PayoutsTab.tsx` still contain ad-hoc `<table>` markup under the referral-admin UI. They were not migrated in PR C2. The spec/tasks now define PR C2 scope as Billing/Support/Workshops and track these referral-admin tables as explicit future work, not completed verification.

### Test Results

| File | Tests | Evidence |
|------|-------|----------|
| `BillingPage.test.tsx` | 10 tests | All pass — table rendering, empty state, error state, expand/collapse, sort, cancel/pause actions, workshop links |
| `SupportPage.test.tsx` | 9 tests | All pass — loading skeleton, diagnostics table, event type badges, empty state, error state, workshop link, filter dropdown |
| `WorkshopsPage.test.tsx` | 7 tests | All pass — loading skeleton, workshops table, status badges, empty state, error state, search filter, workshop detail links |

### Visual Regression — Phase 5 Evidence

Playwright visual snapshots for admin BillingPage (light + dark) were implemented and passed in Phase 5 under the dedicated `chromium-admin-snapshots` project.

### Playwright Assertion Guard — Local Mocks

`tests/e2e/browser/visual-polish-a11y.spec.ts` requires local Supabase mocks because it verifies authenticated app-shell focus and reduced-motion behavior without test credentials. The default Playwright config runs that spec only in the `chromium-local-mocks` project, whose dev server sets `VITE_USE_LOCAL_MOCKS=true`. Other E2E specs remain on the normal `chromium` project.

### Reduced Motion & Contrast Checks

Reduced-motion behavior is covered by the assertion-based Playwright guard above. Programmatic contrast checks across `sawdust`, `workshop`, `graphite` × light/dark are now covered by `visual-polish-contrast.spec.ts` — see §5.3 for results.

### Fixes Applied Post-Review (PR C2 Rev 2)

| Finding | Fix | File |
|---------|-----|------|
| BillingPage empty state used `variant="no-results"` with search-specific default copy | Changed to `variant="empty-feature"` — generic description, no search implication | `BillingPage.tsx` |
| `tasks.md` Phase 4.3 claimed snapshots done (`[x]`) while they were not run | Changed to `[ ]` with honest note | `tasks.md` |
| Missing `.chip-danger` token documentation in `tasks.md` | Added NOTE to task 4.1 | `tasks.md` |
| Vitest config lacked `test.only` guard for CI | Added `allowOnly: !process.env.CI` | `vite.config.ts` |
| `WorkshopsPage.test.tsx` search test flagged as failing | Verified passing (7/7) with honest real-timer assertion — no changes needed | `WorkshopsPage.test.tsx` |
| Visual E2E only passed when manually setting `VITE_USE_LOCAL_MOCKS=true` | Added a dedicated `chromium-local-mocks` Playwright project and mock dev server for `visual-polish-a11y.spec.ts` | `playwright.config.ts` |
| Duplicate desktop/mobile navigation labels | Changed labels to distinct lateral/inferior navigation names | `AppLayout.tsx` |
| BillingPage action column announced as `Taller` | Changed sr-only header to `Acciones` | `BillingPage.tsx` |
| Spec over-scoped all admin tables and snapshot MUSTs | Narrowed current table scope, documented referral-admin tables as future work, and converted snapshot requirement to an explicit pending verification gap until infrastructure exists | `spec.md`, `tasks.md` |

## Phase 5 Verification Tasks — Resolved (2026-06-21)

### 5.1 `npm test` + `npm run lint`

| Command | Result | Notes |
|---------|--------|-------|
| `npm test` | PASS — 599/599 | 79 test files, all passing |
| `npm run lint` | PASS — 0 errors, 6 warnings | Warnings are pre-existing React Compiler `react-hook-form watch()` notices, unchanged |

### 5.2 Playwright Snapshots — Dashboard, QuoteList, BillingPage (light + dark)

Created 3 new test spec files with 12 total tests:

| Spec | Tests | Baseline Path | Status |
|------|-------|---------------|--------|
| `visual-polish-snapshots.spec.ts` | 4 dashboard + quotelist screenshots | `*-snapshots.spec.ts-snapshots/*-chromium-local-mocks-linux.png` | ✅ PASS |
| `visual-polish-snapshots-admin.spec.ts` | 2 billing page screenshots | `*-snapshots-admin.spec.ts-snapshots/*-chromium-admin-snapshots-linux.png` | ✅ PASS |
| `visual-polish-contrast.spec.ts` | 6 WCAG contrast checks (3 themes × 2 modes) | Assertion-based (no screenshots) | ✅ PASS |

Infrastructure changes:
- **VITE_MOCK_ADMIN**: New env var (`src/vite-env.d.ts` + `mockData.ts`) elevates mock profile `is_platform_admin` to `true`.
- **functions.invoke mock**: Added to `mockSupabase.ts` — returns mock subscription data for admin BillingPage.
- **Third dev server + project**: `playwright.config.ts` adds port 5175 with `VITE_MOCK_ADMIN=true` and `chromium-admin-snapshots` project.
- All snapshot baselines committed as first-generation references; `maxDiffPixelRatio: 0.01` tolerance for anti-aliasing.

### 5.3 WCAG Contrast Check

Programmatic check verifies token contrast ratios using canvas-based color resolution. Now covers all 3 themes (`sawdust`, `workshop`, `graphite`) in both light and dark modes (6 test cases total):

All 6 token pairs are tested per combination:
- `text-ink` on body `bg-background` — AA normal (4.5:1)
- `text-ink2` on body `bg-background` — AA normal (4.5:1)
- `text-ink2` on `bg-cp-surface` — AA normal (4.5:1)
- `text-ink2` on `bg-cp-bg2` — AA normal (4.5:1)
- `text-ink` on `bg-cp-bg2` — AA normal (4.5:1)
- `text-ink3` on body `bg-background` — AA large (3:1)

All 36 assertions (6 combinations × 6 pairs) pass. See `visual-polish-contrast.spec.ts` for exact ratios per combination.

> **Note**: Base `.dark` defines `--ink`, `--ink-2`, `--ink-3`, `--bg`, `--bg-2`, and `--surface` for all themes. Theme-specific dark overrides (`.dark.theme-workshop`, `.dark.theme-graphite`, `.dark.theme-sawdust`) only adjust accent tokens (`--cp-accent`, `--cp-accent-ink`). Text/background tokens in dark mode inherit from the base `.dark` block unless overridden. The test verifies each combination independently as rendered by the browser.

### Post-Judgment Fix Verification (2026-06-21)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:e2e -- tests/e2e/browser/visual-polish-a11y.spec.ts` | PASS — 3/3 | Ran under `chromium-local-mocks` project |
| `VITE_USE_LOCAL_MOCKS=true npm run test:e2e -- tests/e2e/browser/visual-polish-a11y.spec.ts` | PASS — 3/3 | Explicit env still passes; no credentials required |
| `npm run lint` | PASS with 6 existing React Compiler warnings | Pre-existing, unchanged |
| `npm test` | PASS — 599/599 | Up from 597 in prior run (2 more tests from table.test.tsx?) |
| `npm run build` | PASS | Production build completed |
| `npx playwright test --project=chromium-local-mocks --project=chromium-admin-snapshots` | PASS — 15/15 | All visual polish E2E tests (incl. pre-existing a11y spec) |
