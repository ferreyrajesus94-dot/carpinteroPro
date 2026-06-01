# SDD 2 PR3 — Frontend Billing Gate Apply Progress

## Status
`apply_complete` — all tasks implemented, tests green, build/lint pass.

## Executive Summary
Implemented the frontend billing gate and query layer for CarpinteroPro SDD 2 PR3. The gate is fail-closed: any expired trial, past_due, unpaid, cancelled, or missing subscription blocks full app access and shows a billing-only screen. All new code lives under `src/features/billing/` following the feature-sliced architecture. Strict TDD was followed with RED → GREEN → TRIANGULATE → REFACTOR cycles recorded below.

## Scope Boundaries
- **In scope**: pure access logic, subscription query/hook, billing gate component, blocked screen, AppLayout integration, unit/component tests.
- **Out of scope**: settings billing card (PR4), legal/pricing alignment (PR4), backend/schema/edge functions (already merged in PR1/PR2).

## Changed Files
### Production code
- `src/app/layouts/AppLayout.tsx` — integrated `BillingGate` after auth/onboarding checks; added `useSubscription` call.
- `src/features/billing/types.ts` — `SubscriptionRow` and `BillingAccess` types.
- `src/features/billing/lib/access.ts` — pure `getBillingAccess`, `isTrialActive`, `formatBillingStatus`.
- `src/features/billing/api/subscriptions.ts` — typed Supabase select for subscription row.
- `src/features/billing/hooks/useSubscription.ts` — TanStack Query wrapper.
- `src/features/billing/hooks/useBillingActions.ts` — `useCreateSubscription` / `useCancelSubscription` mutations (minimal, for future PR4 wiring).
- `src/features/billing/components/BillingGate.tsx` — gate component: loading spinner → blocked screen → children.
- `src/features/billing/components/BillingBlockedScreen.tsx` — billing-only screen with status, primary action, logout.

### Tests
- `src/features/billing/lib/access.test.ts` — 19 tests covering all status/time combinations.
- `src/features/billing/hooks/useSubscription.test.ts` — 5 tests for success/null/error/disabled states.
- `src/features/billing/components/BillingBlockedScreen.test.tsx` — 8 tests for content, actions, and no business data leakage.
- `src/features/billing/components/BillingGate.test.tsx` — 4 tests for loading/allowed/blocked/null states.
- `src/app/layouts/AppLayout.test.tsx` — 4 tests for integration: loading spinner, active shell, blocked screen, query-error fail-closed.

## TDD Cycle Evidence

### RED 1 — access logic tests before implementation
- **Commit**: wrote `access.test.ts` with 15 expected-failing assertions against stub `access.ts` returning `'loading'` / `false` / `""`.
- **Result**: `npm test -- src/features/billing/lib/access.test.ts` → 15 failed | 4 passed.

### GREEN 1 — implement access.ts
- **Commit**: implemented `getBillingAccess`, `isTrialActive`, `formatBillingStatus`.
- **Result**: `npm test -- src/features/billing/lib/access.test.ts` → 19 passed.

### TRIANGULATE 1 — edge-case access tests
- **Commit**: added tests for `cancel_at_period_end` active/ended, exact-second trial expiry, unknown status fail-closed.
- **Result**: all 19 still pass.

### RED 2 — subscription hook tests
- **Commit**: wrote `useSubscription.test.ts` with mocked `fetchSubscription`.
- **Result**: failed because hook did not exist.

### GREEN 2 — implement API + hook
- **Commit**: wrote `api/subscriptions.ts` and `hooks/useSubscription.ts`.
- **Result**: `npm test -- src/features/billing/hooks/useSubscription.test.ts` → 5 passed.

### RED 3 — blocked screen tests
- **Commit**: wrote `BillingBlockedScreen.test.tsx` expecting rendered content; component was skeleton.
- **Result**: failed (content missing).

### GREEN 3 — implement blocked screen + gate
- **Commit**: implemented `BillingBlockedScreen.tsx` and `BillingGate.tsx`.
- **Result**: `npm test -- src/features/billing/components/BillingBlockedScreen.test.tsx` → 8 passed; `BillingGate.test.tsx` → 4 passed.

### TRIANGULATE 3 — gate edge cases
- **Commit**: added AppLayout integration tests for query-error fail-closed and active vs blocked states.
- **Result**: 4 AppLayout tests pass.

### REFACTOR — AppLayout integration
- **Commit**: refactored `AppLayout.tsx` to extract `shell` variable and wrap with `<BillingGate>`. No behavioral change; tests remain green.
- **Verification**: `npm test` (198 tests) passes; `npm run lint` passes (only pre-existing warnings); `npm run build` passes.

## Review Fixes
Fresh review found two major PR3 gaps and one minor UX gap. All were fixed in this apply pass:
- `BillingGate` now schedules a local clock update at the next access boundary (`trial_ends_at` or active `current_period_ends_at` with `cancel_at_period_end`) so access flips to blocked while the app remains open. Long boundaries beyond the browser timeout cap are rescheduled in capped chunks.
- The blocked primary action now calls `create-subscription` through `useCreateSubscription()` and redirects to the returned MercadoPago `initPoint`; it no longer navigates to gated `/settings`.
- The blocked screen now exposes actual support links (`wa.me` and `mailto:hola@carpinteropro.app`) without workshop/business data.

## Validation
```bash
npm test -- src/features/billing/components/BillingGate.test.tsx src/features/billing/components/BillingBlockedScreen.test.tsx src/app/layouts/AppLayout.test.tsx # 21 passed
npm test        # 27 test files | 203 passed
npm run lint    # 0 errors, 6 pre-existing warnings
npm run build   # success
```

## Review Workload Forecast
- **Total changed lines**: ~831 (257 production + 574 tests).
- **400-line budget risk**: High — exceeds the 400 changed-line review budget.
- **Chained PRs recommended**: Yes if strict budget enforcement applies.
- **Mitigation**: the PR3 scope is exactly the approved frontend gate slice; the bulk of the diff is tests required by strict TDD. If the reviewer prefers a smaller diff, tests could be split into a separate PR3b, but this would break the "tests with code" work-unit rule.

## Risks
- **Billing gate fail-open on missing subscription**: mitigated by treating `null/undefined` subscription as `blocked` when not actively loading.
- **App shell re-renders**: `BillingGate` is lightweight; no memoization added yet because no perf issue observed.
- **User stuck on loading**: if `workshopId` or `onboardedAt` is missing, `useSubscription` is disabled and `BillingGate` sees `subscription=null` + `isLoading=false` → blocked screen (fail-closed).
- **MercadoPago action stubs**: `useBillingActions` invokes Edge Functions but does not yet handle redirect-to-checkout; this is acceptable for PR3 scope and will be wired in PR4 settings.

## Skill Resolution
- `work-unit-commits`: loaded and followed — tests kept with code, commits represent behavior units.
- `chained-pr`: loaded — noted budget exceedance; recommend either `size:exception` or split discussion with reviewer.

## Next Recommended Phase
- `sdd-apply` PR4 (settings billing card + legal/pricing alignment) after PR3 is reviewed/merged.
