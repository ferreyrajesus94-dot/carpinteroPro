# SDD 4 Apply Progress — Cache/PWA privacy

## Completed tasks
- ✅ Work Unit 1: Added shared cache privacy helper/tests and removed durable TanStack Query persistence.
- ✅ Work Unit 2: Wired cache purge into AuthProvider startup/logout/session removal/user switch with tests.
- ✅ Work Unit 3: Removed unsafe Supabase REST runtime caching from Workbox and added config assertion test.
- ✅ Blocker fix pass after fresh review: targeted purge scope, safe user-switch ordering, and stronger Workbox assertion.

## Files changed
- `src/shared/lib/cachePrivacy.ts` (new)
- `src/shared/lib/cachePrivacy.test.ts` (new)
- `src/shared/lib/queryClient.ts`
- `src/shared/providers/AuthProvider.tsx`
- `src/shared/providers/AuthProvider.test.tsx`
- `vite.config.ts`
- `vite.config.test.ts` (new)

## TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| Cache privacy helper + PWA assertion | Added `cachePrivacy.test.ts` + `vite.config.test.ts`; `npm test -- src/shared/lib/cachePrivacy.test.ts vite.config.test.ts` failed (missing module, privacy gap) | Implemented `cachePrivacy.ts`, removed query persistence side effects in `queryClient.ts`, removed Supabase REST runtime caching in `vite.config.ts` | Added explicit sensitive key cases (quotes/clients/tasks/materials/stock/price/subscription/recipes/templates/settings) and preserved-key exactness checks | Kept cleanup logic centralized in `src/shared/lib/cachePrivacy.ts` with best-effort storage handling |
| Auth lifecycle purge | Extended `AuthProvider.test.tsx` with startup/session-removal/logout/user-switch expectations; focused run initially failed on async transition behavior | Integrated `purgeLegacyCachePrivacyState` and `purgeSensitiveBrowserState` into `AuthProvider.tsx` lifecycle and signOut path | Added same-user refresh assertion (no user-switch purge) and stale-load safety coverage with async waits | Preserved provider API/feature boundaries; no feature-specific cleanup code added |
| Post-review blocker fixes | Strengthened tests for auth-token preservation, non-app key preservation, slow user-switch purge ordering, signOut ordering, and Supabase REST runtime cache pattern detection. `npm test -- src/shared/lib/cachePrivacy.test.ts src/shared/providers/AuthProvider.test.tsx vite.config.test.ts` failed on 3 blocker expectations before fixes. | Updated cache purge to remove only targeted app/query legacy keys (preserving Supabase auth/third-party keys), invalidated protected UI state before awaiting user-switch purge, and moved logout purge to run after `supabase.auth.signOut()` in `finally`. Strengthened Vite test to fail on Supabase REST runtime cache patterns. | Added explicit check for `carpinteroPro.business.*` removal while preserving `sb-*-auth-token`, checked user-switch transition remains in `profile_loading` until purge resolves, and hardened Vite assertion to detect string, RegExp, or function `urlPattern` values for Supabase REST caching. | Kept fixes in existing shared/auth config boundaries; no feature hook churn.

## Test commands run
- `npm test -- src/shared/lib/cachePrivacy.test.ts vite.config.test.ts` ❌ (RED expected)
- `npm test -- src/shared/lib/cachePrivacy.test.ts src/shared/providers/AuthProvider.test.tsx vite.config.test.ts` ✅
- `npm test` ❌ (intermediate auth test timing failure fixed)
- `npm test` ✅
- `npm test -- src/shared/lib/cachePrivacy.test.ts src/shared/providers/AuthProvider.test.tsx vite.config.test.ts` ❌ (post-review RED: 3 blocker failures)
- `npm test -- src/shared/lib/cachePrivacy.test.ts src/shared/providers/AuthProvider.test.tsx vite.config.test.ts` ✅
- `npm test` ✅
- `npm test -- vite.config.test.ts` ✅ (post-review Workbox string-pattern hardening)
- `npm test` ✅

## Deviations from design
- Adjusted sign-out sequencing to call `supabase.auth.signOut()` before logout purge. This preserves Supabase-owned auth storage lifecycle while still enforcing cache cleanup via `finally`.

## Remaining tasks
- Manual browser verification remains for verify phase: user A → logout → user B, inspect localStorage + Cache Storage in DevTools.

## Review workload / PR boundary
- Implementation remains centralized and within single-PR budget (well below 400 changed lines in app/test code).
- Suggested PR boundary: all SDD 4 apply files listed above.
