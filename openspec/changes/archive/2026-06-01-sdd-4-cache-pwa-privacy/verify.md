# SDD 4 Verify — Cache/PWA Privacy

## Status

PASS_WITH_WARNING

Automated verification passes and the implementation satisfies the cache/PWA privacy acceptance criteria. Warning: app/test changed-line workload appears above the 400-line review budget when untracked new files are counted.

## Review workload decision

- Decision: `size:exception` accepted by the user on 2026-06-01.
- Rationale: the implementation is centralized, within the SDD 4 scope, has automated validation passing, and received fresh-review PASS after blocker fixes.
- Follow-up: keep this as a single review unit unless PR preparation reveals a polluted diff or reviewer requests a split.

## Spec coverage

| Acceptance area | Result | Evidence |
|---|---|---|
| Sensitive TanStack Query data is not durably persisted | PASS | `src/shared/lib/queryClient.ts` no longer imports or calls `persistQueryClient`/`createSyncStoragePersister`; `isPersistableQueryKey()` is deny-by-default and tested for sensitive and unknown keys. |
| Logout/session removal clears in-memory and persisted sensitive cache | PASS | `purgeSensitiveBrowserState()` calls `queryClient.clear()`, removes `REACT_QUERY_OFFLINE_CACHE` and targeted CarpinteroPro cache/business keys, and is invoked for `logout` and `session-removed` in `AuthProvider.tsx`; tests cover both paths. |
| User switch clears previous user's data before ready/protected state | PASS | `AuthProvider.tsx` detects authenticated user id changes, invalidates previous profile load, enters `profile_loading`, clears profile state, awaits `purgeSensitiveBrowserState('user-switch')`, then loads the new profile; test covers deferred purge ordering. |
| Supabase REST Workbox runtime cache removed | PASS | `vite.config.ts` has no `runtimeCaching` rule and no `supabase-api` runtime cache; `vite.config.test.ts` asserts no Supabase REST runtime cache pattern exists. |
| Legacy Supabase API cache cleanup | PASS | `cachePrivacy.ts` deletes Cache Storage key `supabase-api`; unit test verifies the delete call and error tolerance. |
| Preserved non-sensitive keys remain | PASS | `theme`, `cp.palette`, `cp.density`, `cp.howto.*`, and `carpinteroPro.rememberedEmail` are preserved by `isPreservedLocalStorageKey()` and covered by tests. |
| Sensitive modules covered by strategy | PASS | Central deny-by-default query persistence covers quotes, clients, tasks, materials, stock movements, price history, subscription, recipes/templates/settings, and future unknown query keys. |
| Startup cleanup for legacy persisted sensitive data | PASS | `AuthProvider` runs `purgeLegacyCachePrivacyState()` before `getSession()`; helper delegates to the same purge path. |

## Task completion status

- Work Unit 1: PASS — shared `cachePrivacy` helper/tests added; durable TanStack Query persistence removed.
- Work Unit 2: PASS — AuthProvider startup/logout/session removal/user-switch purge integration added with tests.
- Work Unit 3: PASS — unsafe Supabase REST Workbox runtime caching removed; config assertion test added.
- Manual browser checklist: manual_pending (environment does not provide an interactive browser/DevTools session).

## Strict TDD compliance

- Strict TDD is active in `openspec/config.yaml`.
- Project-local `.pi/gentle-ai/support/strict-tdd-verify.md`: not present; default strict-TDD verification checks applied.
- `apply-progress.md` contains a `TDD Cycle Evidence` table with RED/GREEN/TRIANGULATE/REFACTOR entries for cache privacy/PWA assertions, auth lifecycle purge, and post-review blocker fixes.
- Reported test files exist and were inspected: `src/shared/lib/cachePrivacy.test.ts`, `src/shared/providers/AuthProvider.test.tsx`, `vite.config.test.ts`.
- Assertion quality: PASS. Tests assert observable privacy contracts and sequencing; no tautological, type-only, ghost-loop, smoke-only, or implementation-detail CSS assertions found.
- GREEN rechecked with `npm test`: PASS.

## Test / validation commands

- `if [ -f .pi/gentle-ai/support/strict-tdd-verify.md ]; then echo FOUND; sed -n '1,220p' .pi/gentle-ai/support/strict-tdd-verify.md; else echo MISSING; fi` → `MISSING`.
- `grep "persistQueryClient|createSyncStoragePersister|REACT_QUERY_OFFLINE_CACHE|supabase-api|runtimeCaching|supabase.co/rest" src` → only legacy cleanup/test references found (`REACT_QUERY_OFFLINE_CACHE`, `supabase-api`); no active persistence setup.
- `grep "persistQueryClient|createSyncStoragePersister|REACT_QUERY_OFFLINE_CACHE|supabase-api|runtimeCaching|supabase.co/rest" vite.config.ts` → no matches.
- `git diff --numstat -- src/shared/lib/cachePrivacy.ts src/shared/lib/cachePrivacy.test.ts src/shared/lib/queryClient.ts src/shared/providers/AuthProvider.tsx src/shared/providers/AuthProvider.test.tsx vite.config.ts vite.config.test.ts` plus `wc -l` for untracked new app/test files → existing modified files: 307 changed lines; untracked new app/test files: 247 lines; total app/test review workload estimate: 554 changed lines.
- `npm test` → PASS: 30 files passed, 230 tests passed, duration 19.17s.

## Review workload / PR boundary findings

- Tasks forecast: single PR, 260–380 changed lines, no chained PRs recommended, 400-line risk Medium.
- Actual app/test review workload by current working tree appears above budget if untracked new files are counted: 554 changed lines/lines added+deleted.
- No scope creep found beyond assigned SDD 4 files/behavior.
- `size:exception` was accepted by the user on 2026-06-01.
- Finding severity: WARNING accepted. The implementation is centralized and within the intended PR boundary, but reviewers should still be told the app/test diff exceeds the 400-line target.
- OpenSpec docs are separate from app/test review workload and are not included in the 554 app/test estimate.

## Manual browser checklist

manual_pending, not a code blocker because automated coverage is sufficient for the privacy contracts verified here.

Recommended exact manual steps:
1. Build/run the app with service worker enabled in a real browser profile.
2. Log in as user A.
3. Load sensitive business data: quotes, clients, tasks, inventory/materials, price history, and billing/subscription page if available.
4. Open DevTools → Application → Local Storage and Cache Storage; confirm no durable TanStack Query business cache is present and note any legacy `REACT_QUERY_OFFLINE_CACHE` / `supabase-api` entries.
5. Log out.
6. Confirm preserved keys remain if present: `theme`, `cp.palette`, `cp.density`, `cp.howto.*`, `carpinteroPro.rememberedEmail`.
7. Confirm sensitive `carpinteroPro.*` cache/business keys, `REACT_QUERY_OFFLINE_CACHE`, in-memory query-backed UI data, and Cache Storage `supabase-api` are gone.
8. Log in as user B in the same browser profile.
9. Confirm user A data is not visible while B's profile loads or after B reaches the protected UI.

## Blockers

None.

## Risks / notes

- Review workload warning above 400 changed lines has been acknowledged with a user-accepted `size:exception`.
- Engram memory tools were unavailable in the executor session, so verify decision persistence to Engram was performed by the parent orchestrator.
