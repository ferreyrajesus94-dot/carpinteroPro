# Apply Progress — SDD-12 Commission Payout Flow

## Status

Partial apply completed by `sdd-apply`, then parent audit/repair completed one
blocking issue found by fresh reviewer.

The original `sdd-apply` run timed out before writing this progress artifact.
This file was reconstructed from the current diff, validation commands, and
fresh review findings.

## Delegation audit

| Phase | Agent | Result | Assessment |
| --- | --- | --- | --- |
| explore | `scout` | failed acceptance formatting, but produced complete report | usable content; orchestration artifact issue only |
| spec | `oracle` | completed | appropriate: planning/documentation phase |
| design | `oracle` | completed | appropriate: planning/documentation phase |
| tasks | `oracle` | completed, summary missing | artifact exists and is valid |
| status | `sdd-status` | completed | correct: native status before apply |
| apply | `sdd-apply` | timed out | implementation landed, but missing apply-progress required parent audit |
| review | `reviewer` fresh context | completed | found one blocker, now fixed |

## Implemented work units

### WU1 — Schema + DB Types

Completed:

- `supabase/migrations/20260618000001_youtuber_bank_details.sql`
- `supabase/migrations/20260618000002_commission_status.sql`
- `supabase/migrations/20260618000003_payout_runs.sql`
- `tests/supabase/migrations/payoutSchema.test.ts`
- `src/shared/types/database.ts` updated

### WU2 — Payout Edge Function

Completed:

- `supabase/functions/admin-referral-payouts/index.ts`
- `supabase/functions/admin-referral-payouts/mapping.ts`
- `supabase/functions/admin-referral-payouts/payouts.ts`
- `tests/supabase/functions/adminReferralPayouts.test.ts`
- `admin-youtube-mutate` bank-detail validation and tests

Parent repair after review:

- Fixed payout-history nested Supabase data transformation by adding
  `mapPayoutHistoryRows`.
- Added regression test proving nested rows flatten to admin email and
  commission details.
- Removed invalid `self.crypto.randomUUID()` fallback.

### WU3 — Admin UI: Commissions Tab + Stale Badge

Completed:

- `CommissionsTab` stale badge
- `ReferidosPage` mounts Comisiones and Pagos tabs
- hooks/API additions for payout data
- component tests updated

Parent repair:

- Stabilized `CommissionsTab` data memoization to avoid a new hook dependency
  lint warning.

### WU4 — Admin UI: Payouts Tab + Bank Details Form

Completed:

- `src/features/admin/components/PayoutsTab.tsx`
- bank detail fields in `YoutuberDialog`
- component tests for payouts and bank fields

### WU5 — Integration + Polish

Completed:

- `tests/integration/payoutWorkflow.test.ts`
- `tests/e2e/admin/payout-flow.spec.ts`
- full Vitest validation green

## Commands run

```text
npm test
# PASS: 75 test files, 557 tests

npx tsc --noEmit
# PASS

npm run lint
# PASS with 0 errors, 6 warnings in pre-existing React Hook Form watch usage
```

Focused regression command after parent blocker fix:

```text
npm test -- tests/supabase/functions/adminReferralPayouts.test.ts
# PASS: 1 test file, 20 tests
```

## Fresh review findings

Blocking finding fixed:

- `handlePayoutHistory` previously passed raw nested Supabase join rows directly
  to `buildPayoutHistoryResponse`; this would have lost `profiles.email` and
  nested commission details. Fixed with explicit transformation.

Non-blocking notes:

- Existing `admin-referral-commissions` endpoint does not expose `status`; stale
  badge treats missing status as pending for MVP.
- Payout history still uses inner joins; acceptable because created_by is
  restricted and payout runs should always have commissions.
- Integration test is mostly pure-function level; current full Vitest suite is
  green, but a stronger edge-function mock test would improve confidence.

## Residual risks

- `openspec validate` may require splitting the single `spec.md` into
  capability-scoped specs before sync/archive.
- E2E test was added but not executed in this audit pass.
- Supabase local DB reset/pgTAP was not run in this audit pass; schema tests are
  covered by Vitest migration assertions.

## Judgment Day Round 1 fixes — 2026-06-18

Confirmed findings fixed only:

- C1: Added `status` to commission response/type/test data and changed the stale badge to count only `pending` commissions older than 30 days. Added regression coverage for old paid commissions not showing as stale.
- C2: Added compensating deletion of the just-created `payout_runs` row when `mark-paid` commission updates fail; cleanup failures are logged and the endpoint returns an update error.
- C3: Added client-side CBU/CVU/CUIT validation on blur in `YoutuberDialog`, accessible inline errors, and submit blocking while bank validation errors exist. Added component coverage.
- C4: Reworked payout-flow E2E assertions to verify stable UI structure and explicit empty/table states instead of no-op conditional assertions.

Commands run after fixes:

```text
npm test -- tests/supabase/functions/adminReferralPayouts.test.ts tests/features/admin/CommissionsTab.test.tsx tests/features/admin/PayoutsTab.test.tsx tests/features/admin/ReferidosPage.test.tsx tests/supabase/functions/adminReferralCommissions.test.ts tests/supabase/functions/adminYoutubeMutate.test.ts
# PASS: 6 test files, 83 tests

npx tsc --noEmit
# PASS

npm run lint
# PASS with 0 errors, 6 pre-existing React Compiler warnings in React Hook Form watch usage outside this SDD-12 fix scope
```

## Validation status

Implementation is safe to continue to SDD verify, subject to the residual risks
above.

## Judgment Day Round 2 Fix

Confirmed Round 2 issue fixed:

- Replaced shorthand Fragment in `PayoutsTab` payout-history list with
  `<Fragment key={run.id}>` so React list reconciliation has a key on the
  direct mapped child.

Commands run:

```text
npm test -- tests/features/admin/PayoutsTab.test.tsx
# PASS: 1 file, 8 tests

npx tsc --noEmit
# PASS

npm run lint
# PASS with 0 errors, 6 pre-existing warnings outside this scope
```

## Strict TDD Cycle Evidence

Strict TDD mode is active for SDD-12. The original `sdd-apply` run timed out
before writing this formal table, but the repository now contains the tests,
implementation, validation commands, and Judgment Day repairs referenced below.

| Work Unit | RED | GREEN | TRIANGULATE | SAFETY NET | REFACTOR |
| --- | --- | --- | --- | --- | --- |
| WU1 — Schema + DB Types | Added schema assertions in `tests/supabase/migrations/payoutSchema.test.ts` for bank columns, commission status, payout runs, indexes, and RLS expectations. | Added migrations `20260618000001_youtuber_bank_details.sql`, `20260618000002_commission_status.sql`, `20260618000003_payout_runs.sql`; updated `src/shared/types/database.ts`. | Assertions cover all three migration scopes and the platform-global `payout_runs` table decision. | `npm test` passes migration assertion suite as part of full Vitest run. | Kept `payout_method` for backward compatibility; documented platform-global/admin-only rationale. |
| WU2 — Payout Edge Function | Added `tests/supabase/functions/adminReferralPayouts.test.ts` for payout totals, bank validation, payout run records, pending grouping, mark-paid behavior, bank details, and payout history mapping. | Added `supabase/functions/admin-referral-payouts/{index,mapping,payouts}.ts`; extended `admin-youtube-mutate` bank fields and validation. | Judgment Day found missing nested Supabase mapping; added `mapPayoutHistoryRows` regression test and implementation. | Focused payout tests pass: 20/20 after repair; full `npm test` passes. | Removed invalid `self.crypto.randomUUID()` fallback; added compensating cleanup for failed mark-paid updates. |
| WU3 — Commissions Tab + Stale Badge | Added component tests for `ReferidosPage` tabs and `CommissionsTab` stale badge behavior, including paid-old commission regression. | Mounted Comisiones/Pagos tabs; added status-aware stale badge and payout hooks/API calls. | Judgment Day confirmed status needed to flow from API to UI; added `status` to commission response/types/tests. | Focused admin component tests pass; full `npm test` passes. | Stabilized `CommissionsTab` data memoization to avoid a new hook dependency warning. |
| WU4 — Payouts Tab + Bank Details Form | Added `tests/features/admin/PayoutsTab.test.tsx` and bank validation component tests in `ReferidosPage.test.tsx`. | Added `PayoutsTab`, `PayoutModal`, payout history UI, and bank fields in `YoutuberDialog`. | Judgment Day found missing Fragment key and missing client-side validation; both fixed and re-judged. | `npm test -- tests/features/admin/PayoutsTab.test.tsx` passes 8/8; focused suite passed 83 tests after Round 1 fixes. | Added `Fragment key={run.id}`; added accessible on-blur bank validation and submit blocking. |
| WU5 — Integration + Polish | Added `tests/integration/payoutWorkflow.test.ts` and `tests/e2e/admin/payout-flow.spec.ts` for payout workflow coverage. | Implemented integration path across pending grouping, mark-paid, payout history, and UI routing. | Judgment Day tightened E2E assertions to avoid silent no-op tests. | Full `npm test` passes 75 files / 559 tests; `npx tsc --noEmit` passes; `npm run lint` passes with 0 errors. | Documented residual risks: Playwright env not configured here, no true pgTAP run, shallow E2E full-flow seed. |

### Validation evidence summary

```text
npm test
# PASS: 75 test files, 559 tests

npx tsc --noEmit
# PASS

npm run lint
# PASS: 0 errors, 6 pre-existing warnings outside SDD-12 scope
```

### Judgment Day evidence summary

- Round 1 confirmed and fixed: stale badge status flow, compensating payout_run
  cleanup, client-side bank validation, E2E assertion quality.
- Round 2 confirmed and fixed: `PayoutsTab` mapped Fragment key.
- Round 3: both judges reported no blocking issues; terminal state approved.

## Post-archive Local QA Fix

During local manual QA with seeded data, the `Pagos` tab returned a 500 from
`admin-referral-payouts` because payout history selected `profiles.email`, but
`public.profiles` does not have an `email` column. Email lives in `auth.users`
and should not be assumed available through the public `profiles` relationship.

Fix applied:

- `admin-referral-payouts` now selects `profiles.display_name` for payout
  history.
- `mapPayoutHistoryRows` maps `profiles.display_name`, falling back to
  `created_by` when display name is unavailable.
- `adminReferralPayouts.test.ts` was updated to cover the real profile shape.

Validation:

```text
npm test -- tests/supabase/functions/adminReferralPayouts.test.ts
# PASS: 1 file, 20 tests

npx tsc --noEmit
# PASS
```

Manual QA:

- Local Supabase migrations applied.
- Local Edge Functions served.
- Demo referral payout data seeded.
- `/admin/referidos` loads Youtubers, Comisiones, and Pagos tabs.
- Pagos tab shows historical payout and opens the Nuevo pago modal.
