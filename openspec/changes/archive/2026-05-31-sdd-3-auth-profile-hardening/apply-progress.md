# SDD 3 Apply Progress — Auth/Profile Hardening

## Status

`apply_pr2_complete` — PR 1 AuthProvider contract/retry work remains complete, and PR 2 AppLayout fail-closed recovery UI/tests are now complete.

## Workload / PR Boundary

| Field | Value |
|---|---|
| Assigned slice | PR 1 — AuthProvider contract + retry + tests |
| Delivery path | auto-chain / stacked-to-main |
| Review budget | 400 changed lines |
| PR1 touched-source diff | 3 files, 354 insertions / 36 deletions (`git diff --stat`); numstat total 390 changed lines after reducing `useWorkshopId.test.ts` formatting-only churn |
| PR2 touched-source diff | 2 files, 261 insertions / 68 deletions (`git diff --stat -- src/app/layouts/AppLayout.tsx src/app/layouts/AppLayout.test.tsx`); numstat total 329 changed lines after reverting formatting-only churn. |
| Boundary decision | Keep PR 1 and PR 2 separate; each slice stays under the 400-line review budget after PR2 churn reduction. |

## Completed Tasks

- Task 1 — RED AuthProvider failure-contract tests: complete.
- Task 2 — GREEN/TRIANGULATE/REFACTOR AuthProvider implementation: complete.
- Task 3 — RED AppLayout recovery-gate tests: complete.
- Task 4 — GREEN/TRIANGULATE/REFACTOR AppLayout fail-closed behavior: complete.
- Task 5 — PR 1 and PR 2 apply evidence: complete for apply phase.

## Files Changed

- `src/shared/providers/AuthProvider.tsx`
  - Exported `AuthStatus`, `ProfileIssueKind`, and `ProfileIssue`.
  - Added `status` and `profileIssue` to the auth context while preserving `session`, `workshopId`, `onboardedAt`, `loading`, `signOut`, and `refreshProfile`.
  - Switched profile lookup to `.maybeSingle()`.
  - Added one automatic retry for profile query errors.
  - Added `profile_missing` for authenticated sessions with no profile row.
  - Added `profile_error` with user-safe Spanish copy for unrecovered query failures.
  - Added manual retry through `refreshProfile()`.
  - Added stale async load guards with request id + active user id refs.
  - Kept `loading` as a derived compatibility flag.
- `src/shared/providers/AuthProvider.test.tsx`
  - Added/updated tests for explicit status/profileIssue exposure, ready profile, valid not-onboarded profile, missing profile, query error retry failure, retry success, manual retry from missing/error, auth login/logout compatibility, and stale load protection.
  - Updated Supabase profile query mocks to support `.maybeSingle()` and explicit `{ data, error }` result shapes.
- `src/shared/hooks/useWorkshopId.test.ts`
  - Updated test mock auth values with new compatible `status` and `profileIssue` fields after `npm run build` exposed TypeScript mock drift.
  - Did not change `src/shared/hooks/useWorkshopId.ts`.
- `src/app/layouts/AppLayout.tsx`
  - Split auth/profile gating from the authenticated shell so billing/protected hooks only run after `status === 'ready'`, a session exists, and onboarding is complete.
  - Added fail-closed recovery UI for `profile_error` and `profile_missing` with fallback-safe heading/body, `Reintentar`, `Cerrar sesión`, and support guidance.
  - Preserved unauthenticated login redirect and valid not-onboarded onboarding redirect.
- `src/app/layouts/AppLayout.test.tsx`
  - Refactored the auth mock to mutable `mockAuthState` with explicit `status`/`profileIssue`.
  - Added tests for profile error recovery, profile missing recovery instead of onboarding, retry/logout actions, valid not-onboarded redirect, and avoiding billing hooks while auth/profile state is inconsistent.

## TDD Cycle Evidence

| Cycle | RED evidence | GREEN evidence | Triangulation / refactor |
|---|---|---|---|
| AuthProvider status/profileIssue contract | `npm test -- src/shared/providers/AuthProvider.test.tsx` failed: `status` was `undefined` and new profile state expectations failed (12 failed / 16 tests). | Implemented exported auth/profile types and context fields; targeted provider tests passed (16/16). | Preserved existing compatibility fields and kept `loading` derived from `initializing`/`profile_loading`. |
| Profile missing vs. query error | RED tests expected `profile_missing` for `{ data: null, error: null }` and `profile_error` after two query errors; existing provider silently treated null/error as empty profile. | `.maybeSingle()` lookup now maps missing rows to `profile_missing` without retry and unrecovered query errors to `profile_error` after exactly one retry. | User-facing issue copy is Spanish and does not expose raw Supabase error messages. |
| Retry and stale-load safety | RED tests expected retry success to reach `ready`, manual retry to recover, and stale async profile load not to overwrite sign-out. | `refreshProfile()` reuses the current session ref; request id + active user id guards prevent stale async writes. | Added profile-query mock helpers with explicit result queues to keep tests readable and deterministic. |
| Compatibility after context expansion | `npm run build` initially failed because `useWorkshopId.test.ts` mocked the old `AuthContextValue` shape without `status`/`profileIssue`. | Updated the test mock with compatible `status: 'ready'` and `profileIssue: null`; build passed. | `useWorkshopId.ts` itself remained unchanged per guardrail. |
| AppLayout fail-closed recovery gate | `npm test -- src/app/layouts/AppLayout.test.tsx` failed as expected after RED tests: recovery UI was absent, profile issues redirected to onboarding, and billing hooks were called for inconsistent profile state (5 failed / 11 tests). | Split `AppLayout` into an auth/profile gate plus `AuthenticatedAppShell`; targeted layout tests passed (11/11). | Recovery UI is local to `AppLayout.tsx`, fallback-safe when `profileIssue` is null, and billing hooks are only called inside the ready authenticated shell. |
| AppLayout regression coverage | RED tests covered retry/logout callbacks, valid ready + `onboardedAt: null` onboarding redirect, and blocked protected shell content. | Combined AuthProvider + AppLayout targeted tests passed (27/27), full `npm test` passed (223/223), lint/build passed. | Kept `useWorkshopId.ts`, cache/PWA/queryClient, schema/RLS, migrations, and PR1 provider logic unchanged during PR2. |

## Test / Verification Commands

```bash
npm test -- src/shared/providers/AuthProvider.test.tsx
# RED before implementation: failed as expected (12 failed / 16 tests), primarily `status` undefined and missing profile state behavior.

npm test -- src/shared/providers/AuthProvider.test.tsx
# GREEN after implementation: PASS — 1 file, 16 tests passed.

npx eslint src/shared/providers/AuthProvider.tsx src/shared/providers/AuthProvider.test.tsx
# PASS — no output.

npm test -- src/app/layouts/AppLayout.test.tsx
# PASS — 1 file, 5 tests passed. Compatibility check only; AppLayout was not edited.

npm run build
# First run: FAIL due `src/shared/hooks/useWorkshopId.test.ts` mock missing new AuthContextValue fields.
# After mock compatibility update: PASS — tsc -b && vite build completed.

npm test -- src/shared/providers/AuthProvider.test.tsx src/shared/hooks/useWorkshopId.test.ts
# PASS — 2 files, 18 tests passed.

npx eslint src/shared/providers/AuthProvider.tsx src/shared/providers/AuthProvider.test.tsx src/shared/hooks/useWorkshopId.test.ts
# PASS — no output.

npm test
# PASS — 28 files, 217 tests passed.

npm run lint
# PASS with warnings — 0 errors, 6 pre-existing React Compiler warnings in form components / WorkshopSettings watch() usage.

npm run build
# PASS — tsc -b && vite build completed.

git diff --check -- src/shared/providers/AuthProvider.tsx src/shared/providers/AuthProvider.test.tsx src/shared/hooks/useWorkshopId.test.ts openspec/changes/sdd-3-auth-profile-hardening/apply-progress.md
# PASS — no whitespace errors.

npm test -- src/app/layouts/AppLayout.test.tsx
# PR2 RED before implementation: failed as expected — 5 failed / 11 tests. Missing recovery UI, profile issue states redirected to onboarding, and billing hooks still ran for inconsistent profile state.

npm test -- src/app/layouts/AppLayout.test.tsx
# PR2 GREEN after implementation: PASS — 1 file, 11 tests passed.

npm test -- src/shared/providers/AuthProvider.test.tsx src/app/layouts/AppLayout.test.tsx
# PASS — 2 files, 27 tests passed.

npx eslint src/app/layouts/AppLayout.tsx src/app/layouts/AppLayout.test.tsx
# PASS — no output.

npm test
# PASS — 28 files, 223 tests passed.

npm run lint
# PASS with warnings — 0 errors, 6 pre-existing React Compiler warnings in form components / WorkshopSettings watch() usage.

npm run build
# PASS — tsc -b && vite build completed.

git diff --check -- src/app/layouts/AppLayout.tsx src/app/layouts/AppLayout.test.tsx openspec/changes/sdd-3-auth-profile-hardening/apply-progress.md
# PASS — no whitespace errors.

npm test -- src/app/layouts/AppLayout.test.tsx
# PASS after churn reduction — 1 file, 11 tests passed.

npm test -- src/shared/providers/AuthProvider.test.tsx src/app/layouts/AppLayout.test.tsx
# PASS after churn reduction — 2 files, 27 tests passed.

npm test
# PASS after churn reduction — 28 files, 223 tests passed.

npm run lint
# PASS after churn reduction with warnings — 0 errors, 6 pre-existing React Compiler warnings in form components / WorkshopSettings watch() usage.

npm run build
# PASS after churn reduction — tsc -b && vite build completed.

npx eslint src/app/layouts/AppLayout.tsx src/app/layouts/AppLayout.test.tsx
# PASS after churn reduction — no output.
```

## Deviations from Design

- Added a minimal compatibility update to `src/shared/hooks/useWorkshopId.test.ts` after TypeScript build exposed mocked `AuthContextValue` drift. This does not change `useWorkshopId.ts` runtime behavior and stays within PR 1 contract compatibility.
- PR 2 stayed within the planned AppLayout recovery scope; no PR1 provider rework was needed.
- After fresh review flagged review-budget overrun, PR2 reverted formatting-only churn in `AppLayout.tsx`; behavior stayed the same and targeted/full verification remained green.
- After SDD verify flagged PR1 at 434 changed lines, `useWorkshopId.test.ts` formatting-only churn was reduced; PR1 is now 390 changed lines with provider/useWorkshopId targeted tests, full tests, lint, build, and LSP diagnostics still green.
- Did not touch cache/PWA/queryClient, schema/RLS, migrations, or `useWorkshopId.ts`.

## Remaining Tasks

- SDD 3 apply tasks are complete for PR 1 and PR 2.
- Remaining follow-up: run fresh review / SDD verify before merge/archive.

## Risks / Notes

- `AppLayout` now consumes `status` and fails closed for `profile_error`/`profile_missing`; user-visible recovery is implemented.
- PR 1 and PR 2 each remain under the 400-line review budget after reducing PR2 and PR1 formatting-only churn.
- Engram memory tools were unavailable in the PR1 subagent toolset; PR2 progress is persisted in OpenSpec and should be saved to Engram by this apply executor if tools are available.
