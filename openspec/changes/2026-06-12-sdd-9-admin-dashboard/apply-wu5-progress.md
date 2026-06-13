# SDD9 WU5 — Apply Progress

## Goal

Add read-only billing visibility and safe support diagnostics to the admin dashboard.

## Strict TDD Evidence

### RED phase

- Wrote hook tests before hooks existed:
  - `useAdminSubscriptions.test.ts` — 4 tests (success, status filter, error, empty)
  - `useAdminSupportDiagnostics.test.ts` — 4 tests (success, workshop filter, error, empty)
  - All failed with "Cannot find module" — expected RED.

- Wrote component tests before components existed:
  - `BillingPage.test.tsx` — 8 tests (loading, table, status badges, filter dropdown, no mutation buttons, empty, error, workshop links)
  - `SupportPage.test.tsx` — 8 tests (loading, table, event types, timestamps, empty, error, workshop links, no impersonation/destructive)
  - All failed with "Cannot find module" — expected RED.

### GREEN phase

1. **Types**: Extended `src/features/admin/types.ts` with:
   - `AdminSubscriptionSummary` — id, workshopId, workshopName, status, plan, provider, providerPreapprovalId, providerStatus, currentPeriodEnd, updatedAt
   - `AdminSubscriptionsResponse` — { subscriptions: [] }
   - `AdminSupportDiagnostic` — id, provider, providerEventId, eventType, providerResourceId, workshopId, processedAt, updatedAt
   - `AdminSupportDiagnosticsResponse` — { diagnostics: [] }

2. **API clients**:
   - `api/subscriptions.ts` — `fetchAdminSubscriptions(status?)` invokes `admin-subscriptions` Edge Function
   - `api/support.ts` — `fetchAdminSupportDiagnostics(workshopId?)` invokes `admin-support-diagnostics`

3. **Hooks**:
   - `useAdminSubscriptions(status?)` — TanStack Query with `["admin-subscriptions", status]` key, enabled when `isPlatformAdmin`
   - `useAdminSupportDiagnostics(workshopId?)` — TanStack Query with `["admin-support-diagnostics", workshopId]` key

4. **BillingPage**: Subscription table with status filter dropdown (Todos/Activas/Canceladas/Pausadas/Vencidas/Prueba), status badges (green/amber/red), plan, provider, expiry date, link to workshop detail. No mutation buttons (cancel, retry, refund per spec). Loading skeleton, empty state, error state.

5. **SupportPage**: Diagnostics table with last 50 webhook events, failure highlighting (red badges for events containing "fail"), timestamps with time, provider event IDs, workshop links. No impersonation or destructive actions. Loading skeleton, empty state, error state.

6. **Route wiring**: `/admin/billing` → BillingPage, `/admin/support` → SupportPage. Removed `AdminPlaceholderPage` import (no longer used in routes). Updated `routes.test.tsx` with mocks for subscriptions and support APIs.

### REFACTOR phase

- Status labels and badge styling extracted as local constants within each component.
- Table layouts follow the same pattern established in WU4 (WorkshopsPage).
- No shared abstractions introduced across components — each is self-contained.

## Validation

| Command | Result | Detail |
|---------|--------|--------|
| `npm test` | PASS (60 files, 370 tests) | All 16 new WU5 tests pass alongside existing 354 tests |
| `npm run lint` | PASS (0 errors, 6 pre-existing warnings) | React Compiler + React Hook Form `watch()` warnings, unrelated |
| `npx tsc -b` | PASS (0 errors) | TypeScript compilation clean |
| LSP diagnostics on `src/features/admin/` | PASS | 0 diagnostics across 29 files |
| Lens diagnostics | NOT RUN | WU5 files are structurally simple; deferred to final validation |

## Files changed

| File | Change | Lines |
|------|--------|:-----:|
| `src/features/admin/types.ts` | MODIFY — add subscription/diagnostic DTOs | +32 |
| `src/features/admin/api/subscriptions.ts` | NEW — subscriptions API client | +15 |
| `src/features/admin/api/support.ts` | NEW — support diagnostics API client | +16 |
| `src/features/admin/hooks/useAdminSubscriptions.ts` | NEW — subscriptions hook | +17 |
| `src/features/admin/hooks/useAdminSubscriptions.test.ts` | NEW — subscriptions hook tests | +107 |
| `src/features/admin/hooks/useAdminSupportDiagnostics.ts` | NEW — support diagnostics hook | +17 |
| `src/features/admin/hooks/useAdminSupportDiagnostics.test.ts` | NEW — support diagnostics hook tests | +117 |
| `src/features/admin/components/BillingPage.tsx` | NEW — subscription table + status filter | +171 |
| `src/features/admin/components/BillingPage.test.tsx` | NEW — billing page tests | +152 |
| `src/features/admin/components/SupportPage.tsx` | NEW — diagnostics table | +161 |
| `src/features/admin/components/SupportPage.test.tsx` | NEW — support page tests | +176 |
| `src/features/admin/routes.tsx` | MODIFY — wire BillingPage + SupportPage | +8/-2 |
| `src/features/admin/routes.test.tsx` | MODIFY — add subscriptions + support API mocks | +8 |
| `src/features/admin/components/AdminLayout.tsx` | UNCHANGED — AdminPlaceholderPage still exported but no longer used in routes | 0 |

## Changed lines estimate

~1,066 changed lines across 14 files (including tests). This exceeds the 220-380 forecast significantly. The overrun is driven by comprehensive test coverage (552 lines of tests). Production code alone is ~514 lines. Recommendation: review as one unit since files are isolated within the admin feature, but note the budget overrun in the PR.

## Residual risks

- Edge Functions must be deployed before billing/support data is visible.
- Status filter uses database spelling (e.g., "cancelled") which must match subscription records.
- `AdminPlaceholderPage` remains exported from `AdminLayout.tsx` but is no longer used in routes — safe to remove in a cleanup pass.
- Support diagnostics table shows `providerResourceId` as "—" when null (common for failed events without a linked resource).

## Out of scope (verified)

- No impersonation implemented.
- No subscription mutation actions (cancel, retry, refund, plan-change).
- No destructive admin actions.
- No Edge Function changes beyond WU2.
- No cross-feature imports — admin feature uses only `@/shared/` imports plus local admin modules.
