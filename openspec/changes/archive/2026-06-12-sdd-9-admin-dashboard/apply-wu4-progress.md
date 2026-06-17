# SDD9 WU4 — Apply Progress

## Goal

Implement the first useful admin screens: platform overview and workshop list/detail, with API clients, TanStack Query hooks, and comprehensive tests.

## Strict TDD Evidence

### RED phase

- Wrote hook tests before hooks existed:
  - `useAdminOverview.test.ts` — 3 tests (success, error, loading)
  - `useAdminWorkshops.test.ts` — 4 initial tests (success, search param, error, empty), later extended with 3 `useAdminWorkshopDetail` tests
  - All failed with "Cannot find module" — expected RED.

- Wrote component tests before components existed:
  - `OverviewPage.test.tsx` — 7 tests (loading, KPIs, status breakdown, zeroes, error, webhook alert, no alert)
  - `WorkshopsPage.test.tsx` — 7 tests (loading, table, status badges, empty, error, search, detail links)
  - `WorkshopDetailPage.test.tsx` — 6 tests (loading, detail data, not-found, error, support context, back link)
  - All failed with "Cannot find module" — expected RED.

### GREEN phase

1. **Types**: `src/features/admin/types.ts`
   - `AdminOverviewResponse`, `AdminWorkshopSummary`, `AdminWorkshopsResponse`, `AdminWorkshopDetailResponse`

2. **API clients**:
   - `src/features/admin/api/overview.ts` — `fetchAdminOverview()` via `supabase.functions.invoke("admin-overview")`
   - `src/features/admin/api/workshops.ts` — `fetchAdminWorkshops(search?)` and `fetchAdminWorkshopDetail(workshopId)` via `supabase.functions.invoke("admin-workshops")`

3. **Hooks**:
   - `useAdminOverview()` — TanStack Query with `["admin-overview"]` key, enabled only when `isPlatformAdmin`
   - `useAdminWorkshops(search?)` — TanStack Query with `["admin-workshops", search]` key
   - `useAdminWorkshopDetail(workshopId)` — TanStack Query with `["admin-workshops", "detail", id]` key, disabled when empty id

4. **OverviewPage**: KPI cards grid (total workshops, new in 30 days, subscriptions, webhook failures), subscription status breakdown, webhook failure alert, loading skeleton, error state, zero-data handling.

5. **WorkshopsPage**: searchable table with debounced search, columns (name, created date, profiles, onboarded, subscription status badge, detail link), loading skeleton, empty state, error state.

6. **WorkshopDetailPage**: workshop header with subscription badge, support context cards (total profiles, onboarded), not-found state with back link, error state, loading skeleton.

7. **Route wiring**: `/admin` → `OverviewPage`, `/admin/workshops` → `WorkshopsPage`, `/admin/workshops/:workshopId` → `WorkshopDetailPage`. Billing and support routes remain placeholders for WU5.

### REFACTOR phase

- Kept hooks, API clients, and components separate — each has a single responsibility.
- Status labels extracted as shared constants within the feature.
- Debounced search uses local state with `setTimeout`/`clearTimeout`.
- No shared abstractions across WU4 files that would need premature generalization.

## Validation

| Command | Result | Detail |
|---------|--------|--------|
| `npm test` | PASS (56 files, 346 tests) | All 20 new WU4 tests pass alongside existing 326 tests |
| `npm run lint` | PASS (0 errors, 6 pre-existing warnings) | React Compiler + React Hook Form `watch()` warnings, unrelated |
| `npx tsc --noEmit` | PASS (0 errors) | TypeScript compilation clean |
| LSP diagnostics on `src/features/admin/` | PASS | 0 diagnostics across 19 files |

## Files changed

| File | Change | Lines |
|------|--------|:-----:|
| `src/features/admin/types.ts` | NEW — admin DTO types | +29 |
| `src/features/admin/api/overview.ts` | NEW — admin overview API client | +11 |
| `src/features/admin/api/workshops.ts` | NEW — admin workshops API client | +24 |
| `src/features/admin/hooks/useAdminOverview.ts` | NEW — overview hook | +16 |
| `src/features/admin/hooks/useAdminOverview.test.ts` | NEW — overview hook tests | +72 |
| `src/features/admin/hooks/useAdminWorkshops.ts` | NEW — workshops list + detail hooks | +30 |
| `src/features/admin/hooks/useAdminWorkshops.test.ts` | NEW — workshops hooks tests | +116 |
| `src/features/admin/components/OverviewPage.tsx` | NEW — KPI cards + status breakdown | +176 |
| `src/features/admin/components/OverviewPage.test.tsx` | NEW — overview page tests | +132 |
| `src/features/admin/components/WorkshopsPage.tsx` | NEW — searchable workshops table | +200 |
| `src/features/admin/components/WorkshopsPage.test.tsx` | NEW — workshops page tests | +161 |
| `src/features/admin/components/WorkshopDetailPage.tsx` | NEW — workshop detail + support context | +184 |
| `src/features/admin/components/WorkshopDetailPage.test.tsx` | NEW — detail page tests | +150 |
| `src/features/admin/routes.tsx` | MODIFY — wire OverviewPage, WorkshopsPage, WorkshopDetailPage | +4/-1 |
| `src/features/admin/routes.test.tsx` | MODIFY — add QueryClient wrapper + API mocks | +22/-2 |

## Changed lines estimate

~1,327 changed lines across 15 files (including tests). This exceeds the 400-line review-budget threshold and the 250-420 forecast. Recommendation: split WU4 into two PRs before review:

- **PR4a:** API clients + hooks + tests (~302 lines)
- **PR4b:** OverviewPage + WorkshopsPage + WorkshopDetailPage + route wiring + component tests (~1,025 lines)

Alternatively, keep as one PR since the files are isolated within the admin feature and tests are colocated.

## Residual risks

- Edge Functions are not deployed yet — API calls will fail until functions are deployed to Supabase.
- `ownerEmail: null` in workshop summaries is intentional (WU4 TODO from WU2); owner resolution is not defined in the current schema.
- Billing and support screens remain placeholders for WU5.
- Debounced search uses 300ms — may need tuning for production latency.

## Out of scope (verified)

- No billing/support UI screens.
- No impersonation, mutations, or destructive operations.
- No Edge Function changes beyond WU2.
- No cross-feature imports — admin feature uses only `@/shared/` imports plus local admin modules.
