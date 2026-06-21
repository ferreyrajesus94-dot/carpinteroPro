# Verify Report: Visual System Polish — PR A

> **Status**: Ready for review with documented verification gaps. All unit tests listed below passed when recorded.
> Playwright visual snapshots are not implemented — see Visual Regression section.

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

## Visual Regression — Evidence & Gaps

No Playwright visual snapshot tests exist for this PR scope. The existing E2E tests cover business flows (billing, referral, admin) but not visual regression.

### Verified with Unit Tests (JSDOM)

| File | Tests | Evidence |
|------|-------|----------|
| `feedback-state.test.tsx` | 9 tests | `ErrorState` (role="alert"), `EmptyState` (3 variants), `LoadingState` (role="status", aria-busy) |
| `PriceSparkline.test.tsx` | 9 tests | 4 container tests + 5 `resolveSparklineColor()` tests asserting `--chart-up/down/neutral` |
| `ErrorBoundary.test.tsx` | 4 tests | Existing tests pass (Safety Net baseline) |

### Gap: Playwright Visual Snapshots (NOT YET IMPLEMENTED)

PR A touches visual tokens and feedback states, but no Playwright visual regression snapshots exist yet. Snapshot verification remains pending until Playwright snapshot infrastructure is set up; do not treat snapshots as complete for this change.

To add later:
- Dashboard (light + dark): verify `ActiveQuotesPanel` chip colors, sparkline token resolution
- QuoteList (light + dark): verify `ErrorState` / `LoadingState` rendering with dark palette
- This is tracked in PR verification scope, not PR A implementation scope.

## Known Gaps (Out of PR A Scope)

- `ActiveQuotesPanel` status chip migration — belongs to PR C (tables/dashboard scope).
- `StockHistoryDialog`, `InventoryStats`, `PriceHistoryChart` still use inline Skeleton loading.
- `ExtraItemsSection` / `WoodItemsSection` in recipes have inline "No hay" empty text.
- Playwright visual snapshots for Dashboard/QuoteList — deferred to per-PR verification phase.

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

> **Status**: Scoped implementation complete for Billing/Support/Workshops admin tables. 597 unit tests passed when recorded (baseline 597 + 0 new — refactoring-only changes). Playwright visual snapshots not implemented — see Visual Regression section.

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

### Visual Regression — Gap (Unchanged)

Playwright visual snapshots for admin BillingPage (light + dark) remain unimplemented. The same snapshot infrastructure gap from PR A persists. This is a pending verification gap for Phase 5, not completed evidence.

### Playwright Assertion Guard — Local Mocks

`tests/e2e/browser/visual-polish-a11y.spec.ts` requires local Supabase mocks because it verifies authenticated app-shell focus and reduced-motion behavior without test credentials. The default Playwright config runs that spec only in the `chromium-local-mocks` project, whose dev server sets `VITE_USE_LOCAL_MOCKS=true`. Other E2E specs remain on the normal `chromium` project.

### Reduced Motion & Contrast Checks (Pending)

Reduced-motion behavior is covered by the assertion-based Playwright guard above. Manual or screenshot-based contrast checks across `sawdust`, `workshop`, `graphite` × light/dark remain pending; do not treat contrast snapshots/screenshots as existing evidence.

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

### Post-Judgment Fix Verification (2026-06-21)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:e2e -- tests/e2e/browser/visual-polish-a11y.spec.ts` | PASS — 3/3 | Ran under `chromium-local-mocks` project from default Playwright config |
| `VITE_USE_LOCAL_MOCKS=true npm run test:e2e -- tests/e2e/browser/visual-polish-a11y.spec.ts` | PASS — 3/3 | Explicit env still passes; no credentials required |
| `npm run lint` | PASS with 6 existing React Compiler warnings | Warnings are unrelated `react-hook-form watch()` compiler-skip notices |
| `npm test` | PASS — 597/597 | Existing test stderr warnings remain, no failures |
| `npm run build` | PASS | Production build completed |
