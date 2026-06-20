# Verify Report: Visual System Polish — PR A

> **Status**: Ready for review. All unit tests pass (577 total, 572 baseline + 5 new).
> Playwright visual snapshots are not yet implemented — see Visual Regression section.

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

PR A touches visual tokens and feedback states, but no Playwright visual regression snapshots exist yet. The visual snapshot requirement (per spec) will be fulfilled as part of per-PR verification (Phase 5) when Playwright snapshot infrastructure is set up.

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
