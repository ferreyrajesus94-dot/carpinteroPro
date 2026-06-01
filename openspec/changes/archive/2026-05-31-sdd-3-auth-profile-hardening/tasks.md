# SDD 3 Tasks — Auth/Profile Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–480 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (AuthProvider contract + retry + tests) → PR 2 (AppLayout fail-closed recovery + tests) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

---

## Scope Guardrails (must hold during apply)

- No cache/PWA cleanup in this SDD (`src/shared/lib/queryClient.ts` stays untouched unless a hard correctness blocker appears).
- No schema/RLS redesign or Supabase migration work.
- Keep `src/shared/hooks/useWorkshopId.ts` unchanged (`workshopId ?? ''`) unless a verified blocker appears.
- Preserve `AuthContextValue` compatibility fields: `session`, `workshopId`, `onboardedAt`, `loading`, `signOut`, `refreshProfile`.
- `status` becomes authoritative for shell gating; do not infer readiness from null checks alone.

---

## PR / Work-Unit Boundary Plan

```text
main
 └─ PR 1 📍 AuthProvider contract + retry + tests
     └─ PR 2 AppLayout fail-closed recovery + tests + apply evidence
```

If final diff remains ≤400 changed lines and review stays focused, PR 1 + PR 2 MAY be combined into one PR. If forecast/actual goes over budget, keep split.

---

## Implementation Order (strict TDD)

### Task 1 — RED (AuthProvider failure-contract tests)

**Targets**
- `src/shared/providers/AuthProvider.test.tsx`

**Action**
- Add failing tests for:
  - explicit `status` + `profileIssue` exposure with compatibility fields intact;
  - missing profile row => `profile_missing`;
  - query error => one auto retry, then `profile_error`;
  - query error then success on retry => `ready`;
  - valid row + `onboarded_at = null` remains `ready`;
  - manual retry (`refreshProfile`) recovers from missing/error;
  - stale async load does not overwrite newer auth state.
- Update Supabase profile query mocks to support `.maybeSingle()` and result shapes:
  - `{ data: row, error: null }`
  - `{ data: null, error: null }`
  - `{ data: null, error: {...} }`

**Expected RED evidence**
- `npm test -- src/shared/providers/AuthProvider.test.tsx` fails on new expectations.

**Rollback**
- Revert only newly added RED tests.

---

### Task 2 — GREEN/TRIANGULATE/REFACTOR (AuthProvider implementation)

**Targets**
- `src/shared/providers/AuthProvider.tsx`
- `src/shared/providers/AuthProvider.test.tsx`

**Action**
- Add `AuthStatus`, `ProfileIssueKind`, `ProfileIssue`.
- Extend context value with `status` + `profileIssue` while preserving existing fields.
- Implement profile loader using `.maybeSingle()`.
- Implement bounded retry: 1 automatic retry for query errors only.
- Implement manual retry via `refreshProfile()`.
- Implement stale-session guards (request id + active user id) to avoid outdated async writes.
- Keep `loading` as derived compatibility flag from status.
- Keep user-safe Spanish copy for recovery issues.

**Expected GREEN evidence**
- `npm test -- src/shared/providers/AuthProvider.test.tsx` passes.

**Triangulate / Refactor expectations**
- Remove test duplication with helper builders for profile responses.
- Ensure no `any`, unused imports/vars, or hook-rule violations.

**Rollback**
- Revert AuthProvider + corresponding tests as one unit.

---

### Task 3 — RED (AppLayout recovery-gate tests)

**Targets**
- `src/app/layouts/AppLayout.test.tsx`

**Action**
- Add failing tests for:
  - `profile_error` shows recovery screen and blocks protected shell;
  - `profile_missing` shows recovery screen and does not redirect to onboarding;
  - retry button calls `refreshProfile`;
  - logout button calls `signOut`;
  - `ready` + `onboardedAt: null` still redirects onboarding;
  - billing hook/path is not invoked under `profile_error`/`profile_missing`.
- Refactor auth mock to mutable `mockAuthState` with explicit `status`.

**Expected RED evidence**
- `npm test -- src/app/layouts/AppLayout.test.tsx` fails on new scenarios.

**Rollback**
- Revert new AppLayout RED tests.

---

### Task 4 — GREEN/TRIANGULATE/REFACTOR (AppLayout fail-closed behavior)

**Targets**
- `src/app/layouts/AppLayout.tsx`
- `src/app/layouts/AppLayout.test.tsx`

**Action**
- Split auth gating from authenticated shell to avoid calling protected/billing hooks before auth/profile validity.
- Add fail-closed recovery UI for `profile_error` and `profile_missing` with:
  - heading/body from `profileIssue` fallback-safe,
  - `Reintentar` (calls `refreshProfile`),
  - `Cerrar sesión` (calls `signOut`),
  - support guidance text.
- Preserve existing unauthenticated and onboarding redirects for valid states.

**Expected GREEN evidence**
- `npm test -- src/app/layouts/AppLayout.test.tsx` passes.

**Triangulate / Refactor expectations**
- Keep component boundaries small (`AppLayout` + `AuthenticatedAppShell` + local recovery component).
- Avoid unnecessary UI refactors outside auth/profile failure handling.

**Rollback**
- Revert AppLayout + tests as one unit.

---

### Task 5 — Integration checks + apply evidence doc

**Targets**
- `openspec/changes/sdd-3-auth-profile-hardening/apply-progress.md` (create)

**Action**
- Record strict TDD evidence table with explicit RED → GREEN → TRIANGULATE → REFACTOR for AuthProvider and AppLayout units.
- Record verification command outputs and any split/chain decision actually used.

**Expected evidence**
- Apply artifact includes command snippets/results and known warnings.

**Rollback**
- Revert progress doc if implementation is rolled back.

---

## Acceptance Checks (before verify)

- [ ] `AuthProvider` exposes explicit status contract and compatibility fields.
- [ ] Missing profile row is `profile_missing`, not onboarding redirect.
- [ ] Query errors are not silent; one auto retry then `profile_error`.
- [ ] Manual retry can recover to `ready`.
- [ ] Protected content is fail-closed for `profile_error`/`profile_missing`.
- [ ] Valid profile with `onboardedAt = null` still routes to onboarding.
- [ ] `useWorkshopId.ts` remains unchanged unless blocker is documented.
- [ ] No cache/PWA hardening changes included.

---

## Verification Commands

```bash
npm test -- src/shared/providers/AuthProvider.test.tsx
npm test -- src/app/layouts/AppLayout.test.tsx
npm test -- src/shared/providers/AuthProvider.test.tsx src/app/layouts/AppLayout.test.tsx
npm test
npm run lint
npm run build
```

---

## Task Result Contract

| Field | Value |
|---|---|
| status | `tasks_complete` |
| artifact | `openspec/changes/sdd-3-auth-profile-hardening/tasks.md` |
| next_recommended | `sdd-apply` (respect budget gate; split into chained PRs if forecast/actual > 400 lines) |
| skill_resolution | `paths-injected` (`cognitive-doc-design`, `work-unit-commits`, `chained-pr`) |
